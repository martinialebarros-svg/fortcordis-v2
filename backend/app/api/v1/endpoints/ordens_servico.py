"""Endpoints para gerenciamento de ordens de servico."""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html import escape
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.financeiro import (
    BandeiraCartao,
    CreditoFinanceiro,
    FormaPagamentoConfiguracao,
    OrdemServicoPagamento,
    Transacao,
)
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor
from app.models.user import User
from app.services.auditoria_service import registrar_auditoria
from app.services.precos_service import calcular_preco_servico
from app.services.push_notifications import send_financeiro_push_notification
from app.services.push_scheduler_service import cancel_pending_os_payment_reminder

router = APIRouter()

OS_STATUSES = {"Pendente", "Pago", "Cancelado"}


class OrdemServicoUpdate(BaseModel):
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    servico_id: Optional[int] = None
    data_atendimento: Optional[datetime] = None
    tipo_horario: Optional[str] = Field(default=None, pattern="^(comercial|plantao)$")

    valor_servico: Optional[float] = Field(default=None, ge=0)
    desconto: Optional[float] = Field(default=None, ge=0)

    observacoes: Optional[str] = None
    status: Optional[str] = None
    recalcular_preco: bool = False


class OrdemServicoPagamentoItemInput(BaseModel):
    forma_pagamento_config_id: Optional[int] = Field(default=None, ge=1)
    forma_pagamento: Optional[str] = None
    bandeira_id: Optional[int] = Field(default=None, ge=1)
    valor: float = Field(..., gt=0)
    data_recebimento: Optional[date] = None
    taxa_percentual: Optional[float] = Field(default=None, ge=0)
    taxa_fixa: Optional[float] = Field(default=None, ge=0)
    observacoes: Optional[str] = None


class OrdemServicoReceberInput(BaseModel):
    forma_pagamento: Optional[str] = "dinheiro"
    data_recebimento: Optional[date] = None
    pagamentos: Optional[List[OrdemServicoPagamentoItemInput]] = None
    valor_credito_utilizado: float = Field(default=0, ge=0)
    destino_credito_excedente: str = Field(default="cliente", pattern="^(cliente|clinica|nenhum)$")
    observacoes_credito: Optional[str] = None


def _to_decimal(value, default: Decimal = Decimal("0.00")) -> Decimal:
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _normalizar_codigo_pagamento(valor: Optional[str]) -> str:
    return str(valor or "").strip().lower().replace(" ", "_")


def _resolve_forma_pagamento_config(
    db: Session,
    forma_pagamento_config_id: Optional[int] = None,
    forma_pagamento_codigo: Optional[str] = None,
) -> Optional[FormaPagamentoConfiguracao]:
    if forma_pagamento_config_id:
        config = (
            db.query(FormaPagamentoConfiguracao)
            .filter(FormaPagamentoConfiguracao.id == forma_pagamento_config_id)
            .first()
        )
        if not config:
            raise HTTPException(status_code=400, detail="Forma de pagamento configurada nao encontrada.")
        return config

    codigo = _normalizar_codigo_pagamento(forma_pagamento_codigo)
    if not codigo:
        return None

    return (
        db.query(FormaPagamentoConfiguracao)
        .filter(func.lower(FormaPagamentoConfiguracao.codigo) == codigo)
        .first()
    )


def _obter_bandeira_nome(
    db: Session,
    bandeira_id: Optional[int],
    forma_config: Optional[FormaPagamentoConfiguracao],
) -> Optional[str]:
    id_bandeira = bandeira_id or (forma_config.bandeira_id if forma_config else None)
    if not id_bandeira:
        return None
    bandeira = db.query(BandeiraCartao).filter(BandeiraCartao.id == id_bandeira).first()
    if not bandeira:
        raise HTTPException(status_code=400, detail="Bandeira de cartao informada nao encontrada.")
    return str(bandeira.nome or "").strip() or None


def _montar_momento_recebimento(data_recebimento: Optional[date], now: datetime) -> datetime:
    if data_recebimento is None:
        return now
    return datetime.combine(
        data_recebimento,
        now.time().replace(microsecond=0),
    )


def _calcular_valores_pagamento(
    valor_bruto: float,
    taxa_percentual: float,
    taxa_fixa: float,
) -> Tuple[float, float]:
    taxa = round((float(valor_bruto) * float(taxa_percentual) / 100.0) + float(taxa_fixa), 2)
    if taxa < 0:
        taxa = 0.0
    if taxa > float(valor_bruto) + 1e-9:
        raise HTTPException(
            status_code=400,
            detail="A taxa calculada nao pode ser maior que o valor bruto do pagamento.",
        )
    valor_liquido = round(float(valor_bruto) - taxa, 2)
    return taxa, valor_liquido


def _serialize_os(
    os_data: OrdemServico,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
) -> dict:
    return {
        "id": os_data.id,
        "numero_os": os_data.numero_os,
        "agendamento_id": os_data.agendamento_id,
        "paciente_id": os_data.paciente_id,
        "clinica_id": os_data.clinica_id,
        "servico_id": os_data.servico_id,
        "paciente": paciente_nome or "",
        "tutor": tutor_nome or "",
        "clinica": clinica_nome or "",
        "servico": servico_nome or "",
        "data_atendimento": str(os_data.data_atendimento) if os_data.data_atendimento else None,
        "tipo_horario": os_data.tipo_horario,
        "valor_servico": float(os_data.valor_servico) if os_data.valor_servico else 0,
        "desconto": float(os_data.desconto) if os_data.desconto else 0,
        "valor_final": float(os_data.valor_final) if os_data.valor_final else 0,
        "status": os_data.status,
        "observacoes": os_data.observacoes,
        "created_at": str(os_data.created_at) if os_data.created_at else None,
    }


def _calcular_valor_servico(
    db: Session,
    clinica_id: int,
    servico_id: int,
    tipo_horario: str,
) -> Decimal:
    return calcular_preco_servico(
        db=db,
        clinica_id=clinica_id,
        servico_id=servico_id,
        tipo_horario=tipo_horario,
        usar_preco_clinica=True,
    )


def _find_os_with_names(db: Session, os_id: int):
    return (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
        .filter(OrdemServico.id == os_id)
        .first()
    )


def _calcular_saldo_credito_cliente(
    db: Session,
    *,
    paciente_id: Optional[int],
    tutor_id: Optional[int],
) -> float:
    if tutor_id:
        if paciente_id:
            filtro = or_(
                CreditoFinanceiro.tutor_id == tutor_id,
                and_(
                    CreditoFinanceiro.tutor_id.is_(None),
                    CreditoFinanceiro.paciente_id == paciente_id,
                ),
            )
        else:
            filtro = CreditoFinanceiro.tutor_id == tutor_id
    elif paciente_id:
        filtro = CreditoFinanceiro.paciente_id == paciente_id
    else:
        return 0.0

    saldo = (
        db.query(func.coalesce(func.sum(CreditoFinanceiro.valor), 0.0))
        .filter(
            CreditoFinanceiro.tipo_destino == "cliente",
            CreditoFinanceiro.status == "Ativo",
            filtro,
        )
        .scalar()
    )
    return round(float(saldo or 0), 2)


def _formatar_moeda_brl(valor: Any) -> str:
    try:
        numero = float(valor or 0)
    except (TypeError, ValueError):
        numero = 0.0
    inteiro, casas = f"{numero:,.2f}".split(".")
    return f"R$ {inteiro.replace(',', '.')},{casas}"


def _formatar_data_ddmmaa(valor: Any) -> str:
    if not valor:
        return "-"
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y")
    texto = str(valor).strip()
    if not texto:
        return "-"
    if texto.endswith("Z"):
        texto = texto[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(texto).strftime("%d/%m/%Y")
    except ValueError:
        return texto


def _texto_pdf(valor: Any, fallback: str = "-") -> str:
    texto = str(valor or "").strip()
    if not texto:
        texto = fallback
    return escape(texto)


def _desenhar_rodape_relatorio(canvas, doc, texto_rodape: str):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D1D5DB"))
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 12 * mm, A4[0] - doc.rightMargin, 12 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(doc.leftMargin, 8 * mm, (texto_rodape or "")[:120])
    canvas.drawRightString(A4[0] - doc.rightMargin, 8 * mm, f"Pagina {canvas.getPageNumber()}")
    canvas.restoreState()


def _gerar_pdf_cobranca_pendencias(
    itens: List[Dict[str, Any]],
    nome_empresa: str,
    contato_empresa: str,
    texto_rodape: str,
    filtros_texto: str,
    mensagem_cobranca: Optional[str] = None,
    logomarca_dados: Optional[bytes] = None,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=18 * mm,
        title="Relatorio de Cobranca - Valores Pendentes",
    )

    styles = getSampleStyleSheet()
    style_titulo = ParagraphStyle(
        "RelatorioTitulo",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=3,
    )
    style_normal = ParagraphStyle(
        "RelatorioNormal",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#111827"),
    )
    style_secao = ParagraphStyle(
        "RelatorioSecao",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=colors.HexColor("#1F2937"),
        spaceAfter=2,
        spaceBefore=6,
    )

    story: List[Any] = []

    logo = None
    if logomarca_dados:
        try:
            logo_reader = ImageReader(BytesIO(logomarca_dados))
            largura, altura = logo_reader.getSize()
            max_largura = 34 * mm
            max_altura = 24 * mm
            escala = min(max_largura / largura, max_altura / altura)
            logo = Image(BytesIO(logomarca_dados), width=largura * escala, height=altura * escala)
            logo.hAlign = "LEFT"
        except Exception:
            logo = None

    emissao = datetime.now().strftime("%d/%m/%Y %H:%M")
    texto_cabecalho = [
        "Relatorio de Cobranca - Valores Pendentes",
        _texto_pdf(nome_empresa, "Fort Cordis"),
        f"Emissao: {emissao}",
    ]
    if contato_empresa:
        texto_cabecalho.append(_texto_pdf(contato_empresa, ""))
    if filtros_texto:
        texto_cabecalho.append(f"Filtros: {_texto_pdf(filtros_texto, '-')} ")

    cabecalho_info = [
        Paragraph(texto_cabecalho[0], style_titulo),
        Paragraph("<br/>".join(texto_cabecalho[1:]), style_normal),
    ]
    if logo:
        tabela_cabecalho = Table(
            [[logo, cabecalho_info]],
            colWidths=[38 * mm, doc.width - (38 * mm)],
        )
        tabela_cabecalho.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story.append(tabela_cabecalho)
    else:
        story.extend(cabecalho_info)

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Mensagem", style_secao))
    mensagem_pdf = (
        str(mensagem_cobranca or "").strip()
        or "Prezados parceiros, segue o demonstrativo atualizado das ordens de servico em aberto para conferencia e programacao de pagamento."
    )
    story.append(
        Paragraph(
            _texto_pdf(mensagem_pdf, "-").replace("\n", "<br/>"),
            style_normal,
        )
    )

    grupos: Dict[str, Dict[str, Any]] = {}
    for item in itens:
        chave = item["chave"]
        grupo = grupos.get(chave)
        if not grupo:
            grupo = {
                "clinica_nome": item["clinica_nome"],
                "clinica_telefone": item["clinica_telefone"],
                "ordens": [],
                "total": 0.0,
            }
            grupos[chave] = grupo

        grupo["ordens"].append(item)
        grupo["total"] += float(item["valor_final"] or 0)

    total_geral = 0.0
    for grupo in grupos.values():
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(f"Clinica: {_texto_pdf(grupo['clinica_nome'], 'Nao informada')}", style_secao))
        story.append(
            Paragraph(
                f"Telefone: {_texto_pdf(grupo['clinica_telefone'], 'nao informado')}",
                style_normal,
            )
        )

        linhas_tabela = [["OS", "Data", "Paciente", "Tutor", "Servico", "Valor"]]
        for ordem in grupo["ordens"]:
            linhas_tabela.append(
                [
                    str(ordem["numero_os"] or "-"),
                    _formatar_data_ddmmaa(ordem["data_atendimento"]),
                    str(ordem["paciente"] or "-"),
                    str(ordem["tutor"] or "-"),
                    str(ordem["servico"] or "-"),
                    _formatar_moeda_brl(ordem["valor_final"]),
                ]
            )

        linhas_tabela.append(["", "", "", "", "Subtotal", _formatar_moeda_brl(grupo["total"])])
        tabela = Table(
            linhas_tabela,
            colWidths=[22 * mm, 22 * mm, 36 * mm, 30 * mm, 48 * mm, 24 * mm],
            repeatRows=1,
        )

        subtotal_row = len(linhas_tabela) - 1
        tabela.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF8")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                    ("FONTNAME", (0, subtotal_row), (-1, subtotal_row), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                    ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
                    ("ALIGN", (0, 0), (0, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, subtotal_row), (-1, subtotal_row), colors.HexColor("#F3F4F6")),
                ]
            )
        )
        story.append(Spacer(1, 1.5 * mm))
        story.append(tabela)
        total_geral += grupo["total"]

    story.append(Spacer(1, 5 * mm))
    story.append(
        Paragraph(
            f"<b>Total pendente geral:</b> {_formatar_moeda_brl(total_geral)}",
            style_normal,
        )
    )
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            "Agradecemos a parceria e permanecemos a disposicao para qualquer duvida.",
            style_normal,
        )
    )
    story.append(Paragraph("Atenciosamente,", style_normal))
    story.append(Paragraph(f"<b>{_texto_pdf(nome_empresa, 'Fort Cordis')}</b>", style_normal))

    rodape_final = texto_rodape.strip() if texto_rodape else nome_empresa
    doc.build(
        story,
        onFirstPage=lambda c, d: _desenhar_rodape_relatorio(c, d, rodape_final),
        onLaterPages=lambda c, d: _desenhar_rodape_relatorio(c, d, rodape_final),
    )
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@router.get("")
def listar_ordens(
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    servico_id: Optional[int] = None,
    tipo_horario: Optional[str] = Query(None, pattern="^(comercial|plantao)$"),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista ordens de servico com filtros."""
    query = (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
    )

    if status:
        query = query.filter(OrdemServico.status == status)
    if clinica_id:
        query = query.filter(OrdemServico.clinica_id == clinica_id)
    if servico_id:
        query = query.filter(OrdemServico.servico_id == servico_id)
    if tipo_horario:
        query = query.filter(OrdemServico.tipo_horario == tipo_horario)
    if data_inicio:
        query = query.filter(func.date(OrdemServico.data_atendimento) >= data_inicio)
    if data_fim:
        query = query.filter(func.date(OrdemServico.data_atendimento) <= data_fim)

    total = query.count()
    results = (
        query.order_by(OrdemServico.data_atendimento.desc(), OrdemServico.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    items = [
        _serialize_os(
            os_data,
            paciente_nome=paciente_nome,
            tutor_nome=tutor_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
        )
        for os_data, paciente_nome, tutor_nome, clinica_nome, servico_nome in results
    ]

    return {"total": total, "items": items}


@router.get("/relatorios/pendencias/pdf")
def gerar_relatorio_pendencias_pdf(
    status: Optional[str] = Query("Pendente"),
    clinica_id: Optional[int] = None,
    clinica_nome: Optional[str] = None,
    servico_id: Optional[int] = None,
    tipo_horario: Optional[str] = Query(None, pattern="^(comercial|plantao)$"),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    busca: Optional[str] = None,
    mensagem: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera PDF profissional de cobranca das ordens de servico pendentes."""
    query = (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
            Clinica.telefone.label("clinica_telefone"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
    )

    if status and status != "todos":
        query = query.filter(OrdemServico.status == status)
    if clinica_id:
        query = query.filter(OrdemServico.clinica_id == clinica_id)
    elif clinica_nome:
        nome_limpo = clinica_nome.strip().lower()
        if nome_limpo == "clinica nao informada":
            query = query.filter(OrdemServico.clinica_id.is_(None))
        else:
            query = query.filter(func.lower(Clinica.nome) == nome_limpo)
    if servico_id:
        query = query.filter(OrdemServico.servico_id == servico_id)
    if tipo_horario:
        query = query.filter(OrdemServico.tipo_horario == tipo_horario)
    if data_inicio:
        query = query.filter(func.date(OrdemServico.data_atendimento) >= data_inicio)
    if data_fim:
        query = query.filter(func.date(OrdemServico.data_atendimento) <= data_fim)
    if busca:
        termo = f"%{busca.strip()}%"
        query = query.filter(
            or_(
                OrdemServico.numero_os.ilike(termo),
                Paciente.nome.ilike(termo),
                Tutor.nome.ilike(termo),
                Clinica.nome.ilike(termo),
                Servico.nome.ilike(termo),
            )
        )

    resultados = query.order_by(Clinica.nome.asc(), OrdemServico.data_atendimento.asc(), OrdemServico.id.asc()).all()
    if not resultados:
        raise HTTPException(
            status_code=404,
            detail="Nao ha ordens para gerar relatorio com os filtros selecionados.",
        )

    itens_relatorio: List[Dict[str, Any]] = []
    for os_data, paciente_nome, tutor_nome, clinica_nome, clinica_telefone, servico_nome in resultados:
        nome_clinica = (clinica_nome or "Clinica nao informada").strip()
        chave = f"id:{os_data.clinica_id}" if os_data.clinica_id else f"nome:{nome_clinica.lower()}"
        itens_relatorio.append(
            {
                "chave": chave,
                "numero_os": os_data.numero_os or "",
                "paciente": paciente_nome or "",
                "tutor": tutor_nome or "",
                "clinica_nome": nome_clinica,
                "clinica_telefone": (clinica_telefone or "").strip(),
                "servico": servico_nome or "",
                "data_atendimento": os_data.data_atendimento,
                "valor_final": float(os_data.valor_final or 0),
            }
        )

    configuracao = db.query(Configuracao).first()
    nome_empresa = (
        (configuracao.nome_empresa or "").strip()
        if configuracao and configuracao.nome_empresa
        else "Fort Cordis Cardiologia Veterinaria"
    )

    contato_partes: List[str] = []
    if configuracao:
        if configuracao.telefone:
            contato_partes.append(str(configuracao.telefone).strip())
        if configuracao.email:
            contato_partes.append(str(configuracao.email).strip())
        cidade_estado = " ".join(
            [parte for parte in [configuracao.cidade or "", configuracao.estado or ""] if parte]
        ).strip()
        if cidade_estado:
            contato_partes.append(cidade_estado)
    contato_empresa = " | ".join([p for p in contato_partes if p])

    filtros_aplicados: List[str] = []
    if status and status != "todos":
        filtros_aplicados.append(f"status={status}")
    if clinica_id:
        clinica_ref = db.query(Clinica).filter(Clinica.id == clinica_id).first()
        filtros_aplicados.append(f"clinica={clinica_ref.nome if clinica_ref else clinica_id}")
    elif clinica_nome:
        filtros_aplicados.append(f"clinica={clinica_nome}")
    if servico_id:
        servico_ref = db.query(Servico).filter(Servico.id == servico_id).first()
        filtros_aplicados.append(f"servico={servico_ref.nome if servico_ref else servico_id}")
    if tipo_horario:
        filtros_aplicados.append(f"tipo_horario={tipo_horario}")
    if data_inicio:
        filtros_aplicados.append(f"de={data_inicio}")
    if data_fim:
        filtros_aplicados.append(f"ate={data_fim}")
    if busca:
        filtros_aplicados.append(f"busca={busca}")
    filtros_texto = ", ".join(filtros_aplicados) if filtros_aplicados else "sem filtros especificos"

    logomarca = None
    texto_rodape = ""
    if configuracao:
        if configuracao.mostrar_logomarca and configuracao.logomarca_dados:
            logomarca = configuracao.logomarca_dados
        texto_rodape = (configuracao.texto_rodape_laudo or "").strip()

    pdf_bytes = _gerar_pdf_cobranca_pendencias(
        itens=itens_relatorio,
        nome_empresa=nome_empresa,
        contato_empresa=contato_empresa,
        texto_rodape=texto_rodape,
        filtros_texto=filtros_texto,
        mensagem_cobranca=mensagem,
        logomarca_dados=logomarca,
    )

    filename = f"relatorio_cobranca_pendencias_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{os_id}")
def obter_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtem uma ordem de servico especifica."""
    os_row = _find_os_with_names(db, os_id)
    if not os_row:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    os_data, paciente_nome, tutor_nome, clinica_nome, servico_nome = os_row
    return _serialize_os(
        os_data,
        paciente_nome=paciente_nome,
        tutor_nome=tutor_nome,
        clinica_nome=clinica_nome,
        servico_nome=servico_nome,
    )


@router.put("/{os_id}")
def atualizar_ordem(
    os_id: int,
    dados: OrdemServicoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza ordem de servico."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    status_anterior = os_data.status
    valor_anterior = float(os_data.valor_final or 0)

    if dados.status is not None and dados.status not in OS_STATUSES:
        raise HTTPException(status_code=400, detail="Status invalido para ordem de servico")

    altera_preco = any(
        [
            dados.clinica_id is not None,
            dados.servico_id is not None,
            dados.tipo_horario is not None,
            dados.valor_servico is not None,
            dados.desconto is not None,
            dados.recalcular_preco,
        ]
    )

    if os_data.status == "Pago" and altera_preco:
        raise HTTPException(
            status_code=400,
            detail="OS ja recebida. Desfaca o recebimento antes de editar valores.",
        )

    if dados.paciente_id is not None:
        os_data.paciente_id = dados.paciente_id
    if dados.clinica_id is not None:
        os_data.clinica_id = dados.clinica_id
    if dados.servico_id is not None:
        os_data.servico_id = dados.servico_id
    if dados.data_atendimento is not None:
        os_data.data_atendimento = dados.data_atendimento
    if dados.tipo_horario is not None:
        os_data.tipo_horario = dados.tipo_horario

    if dados.observacoes is not None:
        os_data.observacoes = dados.observacoes

    if dados.status is not None:
        if os_data.status == "Pago" and dados.status == "Pendente":
            raise HTTPException(
                status_code=400,
                detail="Para voltar para pendente use a opcao de desfazer recebimento.",
            )
        if os_data.status != "Pago" and dados.status == "Pago":
            raise HTTPException(
                status_code=400,
                detail="Use a acao Receber para marcar a OS como paga.",
            )
        os_data.status = dados.status

    if dados.recalcular_preco or dados.clinica_id is not None or dados.servico_id is not None or dados.tipo_horario is not None:
        os_data.valor_servico = _calcular_valor_servico(
            db=db,
            clinica_id=os_data.clinica_id,
            servico_id=os_data.servico_id,
            tipo_horario=os_data.tipo_horario or "comercial",
        )

    if dados.valor_servico is not None:
        os_data.valor_servico = _to_decimal(dados.valor_servico)

    if dados.desconto is not None:
        os_data.desconto = _to_decimal(dados.desconto)

    valor_servico = _to_decimal(os_data.valor_servico)
    desconto = _to_decimal(os_data.desconto)
    if desconto > valor_servico:
        raise HTTPException(status_code=400, detail="Desconto nao pode ser maior que o valor do servico.")

    os_data.valor_final = valor_servico - desconto
    os_data.updated_at = datetime.now()

    db.commit()

    os_row = _find_os_with_names(db, os_id)
    os_updated, paciente_nome, tutor_nome, clinica_nome, servico_nome = os_row
    payload = _serialize_os(
        os_updated,
        paciente_nome=paciente_nome,
        tutor_nome=tutor_nome,
        clinica_nome=clinica_nome,
        servico_nome=servico_nome,
    )
    payload["mensagem"] = "Ordem de servico atualizada com sucesso"

    acao_log = "ORDEM_SERVICO_ATUALIZADA"
    if status_anterior != os_updated.status and os_updated.status == "Cancelado":
        acao_log = "ORDEM_SERVICO_CANCELADA"

    registrar_auditoria(
        current_user=current_user,
        modulo="ordens_servico",
        entidade="ordem_servico",
        entidade_id=os_updated.id,
        acao=acao_log,
        descricao=f"OS {os_updated.numero_os or os_updated.id} atualizada",
        detalhes={
            "status_anterior": status_anterior,
            "status_novo": os_updated.status,
            "valor_final_anterior": valor_anterior,
            "valor_final_novo": float(os_updated.valor_final or 0),
            "campos_alterados": [k for k, v in dados.model_dump(exclude_unset=True).items() if v is not None],
        },
        request=request,
    )

    return payload


@router.patch("/{os_id}/receber")
def receber_ordem(
    os_id: int,
    dados: OrdemServicoReceberInput,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca OS como recebida e cria uma ou mais transacoes vinculadas."""
    os_row = _find_os_with_names(db, os_id)
    if not os_row:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    os_data, paciente_nome, _tutor_nome, clinica_nome, servico_nome = os_row
    if os_data.status == "Pago":
        raise HTTPException(status_code=400, detail="OS ja esta com status Pago.")
    if os_data.status == "Cancelado":
        raise HTTPException(status_code=400, detail="OS cancelada nao pode ser recebida.")

    marker = f"OS_ID={os_data.id};TIPO=RECEBIMENTO_OS"
    transacao_existente = (
        db.query(Transacao)
        .filter(
            Transacao.tipo == "entrada",
            Transacao.status.in_(["Recebido", "Pago"]),
            Transacao.observacoes.like(f"%{marker}%"),
        )
        .order_by(Transacao.id.desc())
        .first()
    )
    if transacao_existente:
        raise HTTPException(status_code=400, detail="Ja existe recebimento ativo para esta OS.")

    now = datetime.now()
    valor_os = round(float(os_data.valor_final or 0), 2)
    momento_recebimento_base = _montar_momento_recebimento(dados.data_recebimento, now)
    valor_credito_solicitado = round(float(dados.valor_credito_utilizado or 0), 2)
    pagamentos_input = list(dados.pagamentos or [])
    if not pagamentos_input and valor_credito_solicitado <= 0:
        pagamentos_input = [
            OrdemServicoPagamentoItemInput(
                forma_pagamento=dados.forma_pagamento or "dinheiro",
                valor=valor_os,
                data_recebimento=dados.data_recebimento,
            )
        ]

    tutor_id = (
        db.query(Paciente.tutor_id)
        .filter(Paciente.id == os_data.paciente_id)
        .scalar()
    )

    saldo_credito_disponivel = _calcular_saldo_credito_cliente(
        db,
        paciente_id=os_data.paciente_id,
        tutor_id=tutor_id,
    )
    valor_credito_utilizado = valor_credito_solicitado
    if valor_credito_utilizado < 0:
        raise HTTPException(status_code=400, detail="Valor de credito utilizado invalido.")
    if valor_credito_utilizado > 0:
        if saldo_credito_disponivel <= 0:
            raise HTTPException(status_code=400, detail="Cliente sem credito disponivel para uso.")
        if valor_credito_utilizado > saldo_credito_disponivel + 1e-9:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Credito solicitado ({valor_credito_utilizado:.2f}) maior que o saldo disponivel "
                    f"({saldo_credito_disponivel:.2f})."
                ),
            )
        if valor_credito_utilizado > valor_os + 1e-9:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Credito solicitado ({valor_credito_utilizado:.2f}) maior que o valor da OS ({valor_os:.2f})."
                ),
            )

    if not pagamentos_input and valor_credito_utilizado <= 0:
        raise HTTPException(
            status_code=400,
            detail="Informe ao menos um pagamento ou utilize credito disponivel para receber a OS.",
        )

    os_data.status = "Pago"
    os_data.updated_at = now

    transacoes_criadas: List[Transacao] = []
    total_bruto = 0.0
    total_taxas = 0.0
    total_liquido = 0.0
    datas_recebimento: List[datetime] = []

    for idx, pagamento in enumerate(pagamentos_input, start=1):
        forma_config = _resolve_forma_pagamento_config(
            db=db,
            forma_pagamento_config_id=pagamento.forma_pagamento_config_id,
            forma_pagamento_codigo=pagamento.forma_pagamento,
        )

        codigo_forma = _normalizar_codigo_pagamento(
            pagamento.forma_pagamento or (forma_config.codigo if forma_config else None)
        )
        if not codigo_forma:
            codigo_forma = "dinheiro"

        nome_forma = (
            str(forma_config.nome).strip()
            if forma_config and forma_config.nome
            else codigo_forma.replace("_", " ").title()
        )
        adquirente = str(forma_config.adquirente).strip() if forma_config and forma_config.adquirente else None
        bandeira_nome = _obter_bandeira_nome(db, pagamento.bandeira_id, forma_config)

        taxa_percentual = (
            float(pagamento.taxa_percentual)
            if pagamento.taxa_percentual is not None
            else float(forma_config.taxa_percentual or 0) if forma_config else 0.0
        )
        taxa_fixa = (
            float(pagamento.taxa_fixa)
            if pagamento.taxa_fixa is not None
            else float(forma_config.taxa_fixa or 0) if forma_config else 0.0
        )
        valor_bruto = round(float(pagamento.valor or 0), 2)
        valor_taxa, valor_liquido = _calcular_valores_pagamento(
            valor_bruto=valor_bruto,
            taxa_percentual=taxa_percentual,
            taxa_fixa=taxa_fixa,
        )

        data_item = pagamento.data_recebimento or dados.data_recebimento
        momento_recebimento_item = _montar_momento_recebimento(data_item, now)
        datas_recebimento.append(momento_recebimento_item)

        observacao_item = (
            f"{marker};ITEM={idx};OS_NUMERO={os_data.numero_os};SERVICO={servico_nome or ''};"
            f"DATA_RECEBIMENTO={momento_recebimento_item.date().isoformat()};VALOR_BRUTO={valor_bruto:.2f};"
            f"TAXA={valor_taxa:.2f};VALOR_LIQUIDO={valor_liquido:.2f}"
        )

        transacao = Transacao(
            tipo="entrada",
            categoria="consulta",
            valor=valor_bruto,
            desconto=valor_taxa,
            valor_final=valor_liquido,
            forma_pagamento=codigo_forma,
            forma_pagamento_config_id=forma_config.id if forma_config else None,
            adquirente_pagamento=adquirente,
            bandeira_pagamento=bandeira_nome,
            taxa_percentual=taxa_percentual,
            taxa_fixa=taxa_fixa,
            valor_taxa=valor_taxa,
            status="Recebido",
            descricao=f"Recebimento OS {os_data.numero_os} - {paciente_nome or 'Paciente'}",
            data_transacao=momento_recebimento_item,
            data_pagamento=momento_recebimento_item,
            observacoes=observacao_item,
            paciente_id=os_data.paciente_id,
            paciente_nome=paciente_nome or "",
            agendamento_id=os_data.agendamento_id,
            clinica_id=os_data.clinica_id,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
            created_at=now,
            updated_at=now,
        )
        db.add(transacao)
        db.flush()

        registro_pagamento = OrdemServicoPagamento(
            ordem_servico_id=os_data.id,
            transacao_id=transacao.id,
            forma_pagamento_config_id=forma_config.id if forma_config else None,
            forma_pagamento_codigo=codigo_forma,
            forma_pagamento_nome=nome_forma,
            adquirente=adquirente,
            bandeira_nome=bandeira_nome,
            valor_bruto=valor_bruto,
            taxa_percentual_aplicada=taxa_percentual,
            taxa_fixa_aplicada=taxa_fixa,
            valor_taxa=valor_taxa,
            valor_liquido=valor_liquido,
            data_recebimento=momento_recebimento_item,
            observacoes=pagamento.observacoes,
            created_at=now,
            updated_at=now,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )
        db.add(registro_pagamento)

        total_bruto += valor_bruto
        total_taxas += valor_taxa
        total_liquido += valor_liquido
        transacoes_criadas.append(transacao)

    total_cobertura = round(total_bruto + valor_credito_utilizado, 2)
    if round(total_cobertura + 1e-9, 2) < valor_os:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Total coberto ({total_cobertura:.2f}) menor que o valor da OS ({valor_os:.2f}). "
                "Use pagamentos e/ou credito que cubram integralmente a ordem."
            ),
        )

    credito_consumido: Optional[CreditoFinanceiro] = None
    if valor_credito_utilizado > 0:
        credito_consumido = CreditoFinanceiro(
            tipo_destino="cliente",
            clinica_id=None,
            paciente_id=os_data.paciente_id,
            tutor_id=tutor_id,
            valor=-valor_credito_utilizado,
            status="Ativo",
            origem="consumo_credito_os",
            descricao=f"Credito utilizado no recebimento da OS {os_data.numero_os}",
            ordem_servico_id=os_data.id,
            transacao_id=transacoes_criadas[-1].id if transacoes_criadas else None,
            data_movimento=max(datas_recebimento) if datas_recebimento else momento_recebimento_base,
            created_at=now,
            updated_at=now,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )
        db.add(credito_consumido)

    excedente = round(total_cobertura - valor_os, 2)
    credito_gerado: Optional[CreditoFinanceiro] = None
    if excedente > 0:
        destino_credito = str(dados.destino_credito_excedente or "cliente").strip().lower()
        if destino_credito == "nenhum":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Pagamento excede o valor da OS em R$ {excedente:.2f}. "
                    "Escolha cliente ou clinica para registrar credito."
                ),
            )
        if destino_credito == "clinica" and not os_data.clinica_id:
            raise HTTPException(
                status_code=400,
                detail="Nao foi possivel gerar credito para clinica porque a OS nao possui clinica vinculada.",
            )

        credito_gerado = CreditoFinanceiro(
            tipo_destino=destino_credito,
            clinica_id=os_data.clinica_id if destino_credito == "clinica" else None,
            paciente_id=os_data.paciente_id if destino_credito == "cliente" else None,
            tutor_id=tutor_id if destino_credito == "cliente" else None,
            valor=excedente,
            status="Ativo",
            origem="excedente_pagamento_os",
            descricao=(
                dados.observacoes_credito
                or f"Credito gerado por excedente no recebimento da OS {os_data.numero_os}"
            ),
            ordem_servico_id=os_data.id,
            transacao_id=transacoes_criadas[-1].id if transacoes_criadas else None,
            data_movimento=max(datas_recebimento) if datas_recebimento else now,
            created_at=now,
            updated_at=now,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )
        db.add(credito_gerado)

    db.commit()
    for transacao_item in transacoes_criadas:
        db.refresh(transacao_item)
    if credito_consumido:
        db.refresh(credito_consumido)
    if credito_gerado:
        db.refresh(credito_gerado)

    registrar_auditoria(
        current_user=current_user,
        modulo="ordens_servico",
        entidade="ordem_servico",
        entidade_id=os_data.id,
        acao="ORDEM_SERVICO_RECEBIDA",
        descricao=f"OS {os_data.numero_os or os_data.id} marcada como paga",
        detalhes={
            "numero_os": os_data.numero_os,
            "forma_pagamento_legacy": dados.forma_pagamento,
            "pagamentos_quantidade": len(transacoes_criadas),
            "valor_os": valor_os,
            "valor_bruto_total": round(total_bruto, 2),
            "valor_credito_utilizado": round(valor_credito_utilizado, 2),
            "saldo_credito_disponivel_antes": round(saldo_credito_disponivel, 2),
            "valor_taxas_total": round(total_taxas, 2),
            "valor_liquido_total": round(total_liquido, 2),
            "excedente_credito": excedente if excedente > 0 else 0,
            "credito_consumido_id": credito_consumido.id if credito_consumido else None,
            "credito_id": credito_gerado.id if credito_gerado else None,
            "transacoes_ids": [item.id for item in transacoes_criadas],
        },
        request=request,
    )

    formas_recebimento = sorted(
        {
            str(item.forma_pagamento or "")
            for item in transacoes_criadas
            if str(item.forma_pagamento or "").strip()
        }
    )
    if valor_credito_utilizado > 0:
        formas_recebimento.append("credito")

    try:
        send_financeiro_push_notification(
            db,
            action="payment_received",
            os_id=os_data.id,
            data={
                "numero_os": os_data.numero_os,
                "paciente_nome": paciente_nome,
                "clinica_nome": clinica_nome,
                "servico_nome": servico_nome,
                "valor_final": f"{round(total_liquido + valor_credito_utilizado, 2):.2f}",
                "forma_pagamento": ", ".join(formas_recebimento),
                "valor_taxas": f"{round(total_taxas, 2):.2f}",
            },
        )
    except Exception as exc:
        print(f"[financeiro-push] Falha ao enviar push de pagamento recebido: {exc}")
    try:
        cancel_pending_os_payment_reminder(
            db,
            os_id=os_data.id,
            reason="OS recebida; lembrete de pendencia cancelado.",
            commit=True,
        )
    except Exception as exc:
        print(f"[financeiro-push] Falha ao cancelar lembrete de OS recebida: {exc}")

    return {
        "mensagem": "Ordem de servico recebida com sucesso.",
        "os_id": os_data.id,
        "status": os_data.status,
        "transacoes_ids": [item.id for item in transacoes_criadas],
        "data_recebimento": max(datas_recebimento).isoformat() if datas_recebimento else now.isoformat(),
        "valor_os": valor_os,
        "valor_bruto_total": round(total_bruto, 2),
        "valor_credito_utilizado": round(valor_credito_utilizado, 2),
        "valor_taxas_total": round(total_taxas, 2),
        "valor_liquido_total": round(total_liquido, 2),
        "credito_consumido_id": credito_consumido.id if credito_consumido else None,
        "credito_gerado_id": credito_gerado.id if credito_gerado else None,
        "credito_gerado_valor": excedente if excedente > 0 else 0,
    }


@router.patch("/{os_id}/desfazer-recebimento")
def desfazer_recebimento_ordem(
    os_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desfaz recebimento da OS e cancela transacao vinculada."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")
    if os_data.status != "Pago":
        raise HTTPException(status_code=400, detail="Apenas OS com status Pago podem ser desfeitas.")

    marker = f"OS_ID={os_data.id};TIPO=RECEBIMENTO_OS"
    transacoes = (
        db.query(Transacao)
        .filter(
            Transacao.tipo == "entrada",
            Transacao.status.in_(["Recebido", "Pago"]),
            Transacao.observacoes.like(f"%{marker}%"),
        )
        .order_by(Transacao.id.asc())
        .all()
    )

    if not transacoes:
        transacoes = (
            db.query(Transacao)
            .filter(
                Transacao.tipo == "entrada",
                Transacao.status.in_(["Recebido", "Pago"]),
                Transacao.descricao.like(f"%{os_data.numero_os}%"),
            )
            .order_by(Transacao.id.asc())
            .all()
        )

    now = datetime.now()
    os_data.status = "Pendente"
    os_data.updated_at = now

    transacoes_ids: List[int] = []
    for transacao in transacoes:
        transacao.status = "Cancelado"
        transacao.data_pagamento = None
        transacao.updated_at = now
        transacao.observacoes = (transacao.observacoes or "") + f" | Recebimento desfeito em {now.isoformat()}"
        transacoes_ids.append(transacao.id)

    pagamentos_os = (
        db.query(OrdemServicoPagamento)
        .filter(OrdemServicoPagamento.ordem_servico_id == os_data.id)
        .all()
    )
    for pagamento_os in pagamentos_os:
        pagamento_os.updated_at = now
        pagamento_os.observacoes = (pagamento_os.observacoes or "") + f" | Recebimento desfeito em {now.isoformat()}"

    creditos_cancelados: List[int] = []
    creditos_relacionados = (
        db.query(CreditoFinanceiro)
        .filter(
            CreditoFinanceiro.ordem_servico_id == os_data.id,
            CreditoFinanceiro.origem.in_(["excedente_pagamento_os", "consumo_credito_os"]),
            CreditoFinanceiro.status == "Ativo",
        )
        .all()
    )
    for credito in creditos_relacionados:
        credito.status = "Cancelado"
        credito.updated_at = now
        creditos_cancelados.append(credito.id)

    db.commit()

    registrar_auditoria(
        current_user=current_user,
        modulo="ordens_servico",
        entidade="ordem_servico",
        entidade_id=os_data.id,
        acao="ORDEM_SERVICO_RECEBIMENTO_DESFEITO",
        descricao=f"Recebimento desfeito da OS {os_data.numero_os or os_data.id}",
        detalhes={
            "numero_os": os_data.numero_os,
            "transacoes_canceladas_ids": transacoes_ids,
            "creditos_cancelados_ids": creditos_cancelados,
            "status_novo": os_data.status,
        },
        request=request,
    )

    return {
        "mensagem": "Recebimento desfeito com sucesso.",
        "os_id": os_data.id,
        "status": os_data.status,
        "transacoes_canceladas_ids": transacoes_ids,
        "creditos_cancelados_ids": creditos_cancelados,
    }


@router.delete("/{os_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_ordem(
    os_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove uma ordem de servico."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    snapshot = {
        "numero_os": os_data.numero_os,
        "status": os_data.status,
        "valor_final": float(os_data.valor_final or 0),
        "paciente_id": os_data.paciente_id,
        "clinica_id": os_data.clinica_id,
        "servico_id": os_data.servico_id,
    }

    db.delete(os_data)
    db.commit()

    registrar_auditoria(
        current_user=current_user,
        modulo="ordens_servico",
        entidade="ordem_servico",
        entidade_id=os_id,
        acao="ORDEM_SERVICO_EXCLUIDA",
        descricao=f"OS {snapshot.get('numero_os') or os_id} excluida",
        detalhes=snapshot,
        request=request,
    )

    try:
        send_financeiro_push_notification(
            db,
            action="os_deleted",
            os_id=os_id,
            data={
                "numero_os": snapshot.get("numero_os"),
                "valor_final": f"{float(snapshot.get('valor_final') or 0):.2f}",
            },
        )
    except Exception as exc:
        print(f"[financeiro-push] Falha ao enviar push de OS excluida: {exc}")
    try:
        cancel_pending_os_payment_reminder(
            db,
            os_id=os_id,
            reason="OS excluida; lembrete de pendencia cancelado.",
            commit=True,
        )
    except Exception as exc:
        print(f"[financeiro-push] Falha ao cancelar lembrete de OS excluida: {exc}")

    return None


@router.get("/clinica/{clinica_id}/pendentes")
def ordens_pendentes_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista ordens pendentes de uma clinica."""
    ordens = (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
        .filter(
            OrdemServico.clinica_id == clinica_id,
            OrdemServico.status == "Pendente",
        )
        .order_by(OrdemServico.data_atendimento.desc())
        .all()
    )

    return {
        "total": len(ordens),
        "items": [
            {
                "id": os_data.id,
                "numero_os": os_data.numero_os,
                "paciente": paciente_nome or "",
                "tutor": tutor_nome or "",
                "servico": servico_nome or "",
                "data_atendimento": str(os_data.data_atendimento) if os_data.data_atendimento else None,
                "valor_final": float(os_data.valor_final) if os_data.valor_final else 0,
            }
            for os_data, paciente_nome, tutor_nome, servico_nome in ordens
        ],
    }


@router.get("/dashboard/resumo")
def resumo_os(
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumo de ordens de servico para dashboard."""
    query = db.query(OrdemServico)

    if mes and ano:
        data_inicio = f"{ano}-{mes:02d}-01"
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{mes + 1:02d}-01"

        query = query.filter(
            OrdemServico.data_atendimento >= data_inicio,
            OrdemServico.data_atendimento < data_fim,
        )

    pendentes = query.filter(OrdemServico.status == "Pendente").count()
    pagas = query.filter(OrdemServico.status == "Pago").count()
    canceladas = query.filter(OrdemServico.status == "Cancelado").count()

    valor_total = (
        db.query(func.sum(OrdemServico.valor_final))
        .filter(OrdemServico.status == "Pago")
        .scalar()
        or 0
    )
    valor_pendente = (
        db.query(func.sum(OrdemServico.valor_final))
        .filter(OrdemServico.status == "Pendente")
        .scalar()
        or 0
    )

    return {
        "total_os": pendentes + pagas + canceladas,
        "pendentes": pendentes,
        "pagas": pagas,
        "canceladas": canceladas,
        "valor_total_recebido": float(valor_total),
        "valor_pendente": float(valor_pendente),
    }
