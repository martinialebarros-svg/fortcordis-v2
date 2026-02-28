"""Endpoints para gerenciamento de ordens de servico."""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html import escape
from io import BytesIO
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.financeiro import Transacao
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor
from app.models.user import User
from app.services.precos_service import calcular_preco_servico

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


class OrdemServicoReceberInput(BaseModel):
    forma_pagamento: str = "dinheiro"
    data_recebimento: Optional[date] = None


def _to_decimal(value, default: Decimal = Decimal("0.00")) -> Decimal:
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza ordem de servico."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

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
    return payload


@router.patch("/{os_id}/receber")
def receber_ordem(
    os_id: int,
    dados: OrdemServicoReceberInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca OS como recebida e cria transacao vinculada."""
    os_row = _find_os_with_names(db, os_id)
    if not os_row:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    os_data, paciente_nome, _tutor_nome, _clinica_nome, servico_nome = os_row
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
    momento_recebimento = now
    if dados.data_recebimento is not None:
        momento_recebimento = datetime.combine(
            dados.data_recebimento,
            now.time().replace(microsecond=0),
        )

    os_data.status = "Pago"
    os_data.updated_at = now

    transacao = Transacao(
        tipo="entrada",
        categoria="consulta",
        valor=float(os_data.valor_final or 0),
        desconto=0,
        valor_final=float(os_data.valor_final or 0),
        forma_pagamento=dados.forma_pagamento,
        status="Recebido",
        descricao=f"Recebimento OS {os_data.numero_os} - {paciente_nome or 'Paciente'}",
        data_transacao=momento_recebimento,
        data_pagamento=momento_recebimento,
        observacoes=(
            f"{marker};OS_NUMERO={os_data.numero_os};SERVICO={servico_nome or ''};"
            f"DATA_RECEBIMENTO={momento_recebimento.date().isoformat()}"
        ),
        paciente_id=os_data.paciente_id,
        paciente_nome=paciente_nome or "",
        agendamento_id=os_data.agendamento_id,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=now,
        updated_at=now,
    )

    db.add(transacao)
    db.commit()
    db.refresh(transacao)

    return {
        "mensagem": "Ordem de servico recebida com sucesso.",
        "os_id": os_data.id,
        "status": os_data.status,
        "transacao_id": transacao.id,
        "data_recebimento": momento_recebimento.isoformat(),
    }


@router.patch("/{os_id}/desfazer-recebimento")
def desfazer_recebimento_ordem(
    os_id: int,
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
    transacao = (
        db.query(Transacao)
        .filter(
            Transacao.tipo == "entrada",
            Transacao.status.in_(["Recebido", "Pago"]),
            Transacao.observacoes.like(f"%{marker}%"),
        )
        .order_by(Transacao.id.desc())
        .first()
    )

    if not transacao:
        transacao = (
            db.query(Transacao)
            .filter(
                Transacao.tipo == "entrada",
                Transacao.status.in_(["Recebido", "Pago"]),
                Transacao.descricao.like(f"%{os_data.numero_os}%"),
            )
            .order_by(Transacao.id.desc())
            .first()
        )

    now = datetime.now()
    os_data.status = "Pendente"
    os_data.updated_at = now

    transacao_id = None
    if transacao:
        transacao.status = "Cancelado"
        transacao.data_pagamento = None
        transacao.updated_at = now
        transacao.observacoes = (transacao.observacoes or "") + f" | Recebimento desfeito em {now.isoformat()}"
        transacao_id = transacao.id

    db.commit()

    return {
        "mensagem": "Recebimento desfeito com sucesso.",
        "os_id": os_data.id,
        "status": os_data.status,
        "transacao_cancelada_id": transacao_id,
    }


@router.delete("/{os_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove uma ordem de servico."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    db.delete(os_data)
    db.commit()
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
