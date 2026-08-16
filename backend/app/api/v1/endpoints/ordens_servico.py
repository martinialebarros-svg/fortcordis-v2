"""Endpoints para gerenciamento de ordens de servico."""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html import escape
from io import BytesIO
from typing import Any, Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.configuracao import ConfiguracaoUsuario
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
from app.services.whatsapp_agenda_service import normalize_whatsapp_number
from app.services.whatsapp_template_delivery_service import (
    WhatsAppTemplateDeliveryError,
    send_approved_utility_template,
)

router = APIRouter()

OS_STATUSES = {"Pendente", "Pago", "Cancelado"}
ORIGENS_ATENDIMENTO_OS = {"clinica_parceira", "domiciliar"}


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
    desconto: Optional[float] = Field(default=None, ge=0)
    valor_credito_utilizado: float = Field(default=0, ge=0)
    destino_credito_excedente: str = Field(default="cliente", pattern="^(cliente|clinica|nenhum)$")
    observacoes_credito: Optional[str] = None


class OrdemServicoWhatsAppInput(BaseModel):
    idempotency_key: str = Field(..., min_length=8, max_length=128)
    destination: Optional[str] = Field(default=None, max_length=32)


OrdemServicoWhatsAppTemplateKey = Literal["receiptAvailable", "pendingPaymentReminder"]


def _to_decimal(value, default: Decimal = Decimal("0.00")) -> Decimal:
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _normalizar_codigo_pagamento(valor: Optional[str]) -> str:
    return str(valor or "").strip().lower().replace(" ", "_")


def _normalizar_origem_atendimento_os(valor: Optional[str]) -> Optional[str]:
    raw = str(valor or "").strip().lower()
    if not raw or raw == "todos":
        return None
    aliases = {
        "clinica": "clinica_parceira",
        "clinica_parceira": "clinica_parceira",
        "parceira": "clinica_parceira",
        "domiciliar": "domiciliar",
    }
    origem = aliases.get(raw, raw)
    if origem not in ORIGENS_ATENDIMENTO_OS:
        raise HTTPException(
            status_code=400,
            detail="Origem de atendimento invalida. Use clinica_parceira ou domiciliar.",
        )
    return origem


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
    tutor_id: Optional[int] = None,
    tutor_nome: Optional[str] = None,
    tutor_telefone: Optional[str] = None,
    tutor_whatsapp: Optional[str] = None,
    tutor_email: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    clinica_telefone: Optional[str] = None,
    clinica_email: Optional[str] = None,
    servico_nome: Optional[str] = None,
) -> dict:
    origem_atendimento = str(getattr(os_data, "origem_atendimento", None) or "clinica_parceira").strip() or "clinica_parceira"
    clinica_label = (clinica_nome or "").strip()
    if not clinica_label and origem_atendimento == "domiciliar":
        clinica_label = "Atendimento domiciliar"
    tutor_nome_limpo = str(tutor_nome or "").strip()
    tutor_telefone_limpo = str(tutor_whatsapp or tutor_telefone or "").strip()
    tutor_email_limpo = str(tutor_email or "").strip()
    clinica_telefone_limpo = str(clinica_telefone or "").strip()
    clinica_email_limpo = str(clinica_email or "").strip()

    if origem_atendimento == "domiciliar":
        destinatario_tipo = "tutor"
        destinatario_nome = tutor_nome_limpo or "Tutor nao informado"
        destinatario_telefone = tutor_telefone_limpo
        destinatario_email = tutor_email_limpo
    else:
        destinatario_tipo = "clinica"
        destinatario_nome = clinica_label or "Clinica nao informada"
        destinatario_telefone = clinica_telefone_limpo
        destinatario_email = clinica_email_limpo

    return {
        "id": os_data.id,
        "numero_os": os_data.numero_os,
        "agendamento_id": os_data.agendamento_id,
        "paciente_id": os_data.paciente_id,
        "clinica_id": os_data.clinica_id,
        "servico_id": os_data.servico_id,
        "origem_atendimento": origem_atendimento,
        "paciente": paciente_nome or "",
        "tutor_id": tutor_id,
        "tutor": tutor_nome_limpo,
        "tutor_telefone": str(tutor_telefone or "").strip(),
        "tutor_whatsapp": str(tutor_whatsapp or "").strip(),
        "tutor_email": tutor_email_limpo,
        "clinica": clinica_label,
        "clinica_telefone": clinica_telefone_limpo,
        "clinica_email": clinica_email_limpo,
        "destinatario_tipo": destinatario_tipo,
        "destinatario_nome": destinatario_nome,
        "destinatario_telefone": destinatario_telefone,
        "destinatario_email": destinatario_email,
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
    clinica_id: Optional[int],
    servico_id: int,
    tipo_horario: str,
    origem_atendimento: Optional[str] = None,
) -> Decimal:
    return calcular_preco_servico(
        db=db,
        clinica_id=clinica_id,
        servico_id=servico_id,
        tipo_horario=tipo_horario,
        usar_preco_clinica=True,
        origem_atendimento=origem_atendimento,
    )


def _find_os_with_names(db: Session, os_id: int):
    return (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.id.label("tutor_id"),
            Tutor.nome.label("tutor_nome"),
            Tutor.telefone.label("tutor_telefone"),
            Tutor.whatsapp.label("tutor_whatsapp"),
            Tutor.email.label("tutor_email"),
            Clinica.nome.label("clinica_nome"),
            Clinica.telefone.label("clinica_telefone"),
            Clinica.email.label("clinica_email"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
        .filter(OrdemServico.id == os_id)
        .first()
    )


def _serialize_os_row(row: Any) -> dict:
    (
        os_data,
        paciente_nome,
        tutor_id,
        tutor_nome,
        tutor_telefone,
        tutor_whatsapp,
        tutor_email,
        clinica_nome,
        clinica_telefone,
        clinica_email,
        servico_nome,
    ) = row
    return _serialize_os(
        os_data,
        paciente_nome=paciente_nome,
        tutor_id=tutor_id,
        tutor_nome=tutor_nome,
        tutor_telefone=tutor_telefone,
        tutor_whatsapp=tutor_whatsapp,
        tutor_email=tutor_email,
        clinica_nome=clinica_nome,
        clinica_telefone=clinica_telefone,
        clinica_email=clinica_email,
        servico_nome=servico_nome,
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
    largura_pagina = doc.pagesize[0]
    canvas.line(doc.leftMargin, 12 * mm, largura_pagina - doc.rightMargin, 12 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(doc.leftMargin, 8 * mm, (texto_rodape or "")[:120])
    canvas.drawRightString(largura_pagina - doc.rightMargin, 8 * mm, f"Pagina {canvas.getPageNumber()}")
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
                "destinatario_tipo": item["destinatario_tipo"],
                "destinatario_nome": item["destinatario_nome"],
                "destinatario_telefone": item["destinatario_telefone"],
                "destinatario_email": item["destinatario_email"],
                "ordens": [],
                "total": 0.0,
            }
            grupos[chave] = grupo

        grupo["ordens"].append(item)
        grupo["total"] += float(item["valor_final"] or 0)

    total_geral = 0.0
    grupos_ordenados = sorted(
        grupos.values(),
        key=lambda grupo: str(grupo["destinatario_nome"] or "").lower(),
    )
    for grupo in grupos_ordenados:
        rotulo_destinatario = "Tutor responsavel" if grupo["destinatario_tipo"] == "tutor" else "Clinica"
        story.append(Spacer(1, 3 * mm))
        story.append(
            Paragraph(
                f"{rotulo_destinatario}: {_texto_pdf(grupo['destinatario_nome'], 'Nao informado')}",
                style_secao,
            )
        )
        contatos_grupo = []
        if grupo["destinatario_tipo"] == "tutor":
            contatos_grupo.append("Origem: Atendimento domiciliar")
        contatos_grupo.append(
            f"Telefone: {_texto_pdf(grupo['destinatario_telefone'], 'nao informado')}"
        )
        if grupo["destinatario_email"]:
            contatos_grupo.append(f"E-mail: {_texto_pdf(grupo['destinatario_email'], '')}")
        story.append(Paragraph(" | ".join(contatos_grupo), style_normal))

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


def _parse_os_ids_param(os_ids: Optional[str]) -> List[int]:
    ids: List[int] = []
    for parte in str(os_ids or "").split(","):
        texto = parte.strip()
        if not texto:
            continue
        try:
            valor = int(texto)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Parametro os_ids invalido.") from exc
        if valor > 0 and valor not in ids:
            ids.append(valor)
    if not ids:
        raise HTTPException(status_code=400, detail="Informe ao menos uma OS para gerar o recibo.")
    return ids


def _resumir_formas_pagamento_recibo(
    pagamentos: List[Dict[str, Any]],
    valor_credito_utilizado: float,
    possui_detalhamento_legacy: bool = False,
) -> str:
    partes = []
    for pagamento in pagamentos:
        nome_forma = str(pagamento.get("forma_pagamento_nome") or "Pagamento").strip()
        partes.append(f"{nome_forma} ({_formatar_moeda_brl(pagamento.get('valor_bruto'))})")
    if valor_credito_utilizado > 0:
        partes.append(f"Credito do cliente ({_formatar_moeda_brl(valor_credito_utilizado)})")
    if not partes and possui_detalhamento_legacy:
        partes.append("Recebimento legado sem composicao detalhada")
    return ", ".join(partes) if partes else "-"


def _gerar_pdf_recibos_ordens(
    recibos: List[Dict[str, Any]],
    nome_empresa: str,
    contato_empresa: str,
    texto_rodape: str,
    agrupar: bool,
    nome_emitente: str,
    crmv_emitente: str,
    assinatura_emitente_dados: Optional[bytes] = None,
    logomarca_dados: Optional[bytes] = None,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4) if agrupar else A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=18 * mm,
        title="Recibo de Ordem de Servico",
    )

    styles = getSampleStyleSheet()
    style_titulo = ParagraphStyle(
        "ReciboTitulo",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    style_subtitulo = ParagraphStyle(
        "ReciboSubtitulo",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        textColor=colors.HexColor("#1F2937"),
        spaceAfter=3,
        spaceBefore=6,
    )
    style_normal = ParagraphStyle(
        "ReciboNormal",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#111827"),
    )
    style_tabela = ParagraphStyle(
        "ReciboTabela",
        parent=style_normal,
        fontName="Helvetica",
        fontSize=8.2,
        leading=10,
    )
    style_tabela_cabecalho = ParagraphStyle(
        "ReciboTabelaCabecalho",
        parent=style_tabela,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0F172A"),
    )
    style_tabela_direita = ParagraphStyle(
        "ReciboTabelaDireita",
        parent=style_tabela,
        alignment=2,
    )

    def _celula_tabela(
        valor: Any,
        *,
        cabecalho: bool = False,
        alinhar_direita: bool = False,
        quebrar_linhas: bool = False,
    ) -> Paragraph:
        texto = _texto_pdf(valor, "-")
        if quebrar_linhas:
            texto = texto.replace(", ", "<br/>")
        estilo = (
            style_tabela_cabecalho
            if cabecalho
            else style_tabela_direita
            if alinhar_direita
            else style_tabela
        )
        return Paragraph(texto, estilo)

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

    assinatura = None
    if assinatura_emitente_dados:
        try:
            assinatura_reader = ImageReader(BytesIO(assinatura_emitente_dados))
            largura, altura = assinatura_reader.getSize()
            max_largura = 50 * mm
            max_altura = 25 * mm
            escala = min(max_largura / largura, max_altura / altura)
            assinatura = Image(
                BytesIO(assinatura_emitente_dados),
                width=largura * escala,
                height=altura * escala,
            )
            assinatura.hAlign = "LEFT"
        except Exception:
            assinatura = None

    def _adicionar_cabecalho(titulo: str, subtitulo: str):
        emissao = datetime.now().strftime("%d/%m/%Y %H:%M")
        linhas_info = [
            _texto_pdf(nome_empresa, "Fort Cordis"),
            f"Emissao: {emissao}",
        ]
        if contato_empresa:
            linhas_info.append(_texto_pdf(contato_empresa, ""))
        linhas_info.append(_texto_pdf(subtitulo, ""))

        cabecalho_info = [
            Paragraph(titulo, style_titulo),
            Paragraph("<br/>".join(linhas_info), style_normal),
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

    if agrupar:
        total_geral = sum(float(item["valor_final"] or 0) for item in recibos)
        total_credito = sum(float(item["valor_credito_utilizado"] or 0) for item in recibos)
        _adicionar_cabecalho(
            "Recibo consolidado de ordens de servico recebidas",
            f"{len(recibos)} OS quitada(s)",
        )
        story.append(
            Paragraph(
                (
                    "Declaramos o recebimento das ordens de servico abaixo, "
                    f"totalizando <b>{_formatar_moeda_brl(total_geral)}</b>."
                ),
                style_normal,
            )
        )
        if total_credito > 0:
            story.append(
                Paragraph(
                    f"Parte da quitacao utilizou credito do cliente no total de {_formatar_moeda_brl(total_credito)}.",
                    style_normal,
                )
            )

        linhas_tabela = [[
            _celula_tabela("OS", cabecalho=True),
            _celula_tabela("Data receb.", cabecalho=True),
            _celula_tabela("Paciente", cabecalho=True),
            _celula_tabela("Clinica", cabecalho=True),
            _celula_tabela("Servico", cabecalho=True),
            _celula_tabela("Formas", cabecalho=True),
            _celula_tabela("Valor", cabecalho=True, alinhar_direita=True),
        ]]
        for item in recibos:
            linhas_tabela.append(
                [
                    _celula_tabela(item["numero_os"]),
                    _celula_tabela(_formatar_data_ddmmaa(item["data_recebimento"])),
                    _celula_tabela(item["paciente"]),
                    _celula_tabela(item["clinica"]),
                    _celula_tabela(item["servico"]),
                    _celula_tabela(
                        _resumir_formas_pagamento_recibo(
                            item["pagamentos"],
                            float(item["valor_credito_utilizado"] or 0),
                            bool(item["possui_detalhamento_legacy"]),
                        ),
                        quebrar_linhas=True,
                    ),
                    _celula_tabela(_formatar_moeda_brl(item["valor_final"]), alinhar_direita=True),
                ]
            )
        linhas_tabela.append(
            [
                _celula_tabela(""),
                _celula_tabela(""),
                _celula_tabela(""),
                _celula_tabela(""),
                _celula_tabela(""),
                _celula_tabela("Total recebido", cabecalho=True),
                _celula_tabela(_formatar_moeda_brl(total_geral), cabecalho=True, alinhar_direita=True),
            ]
        )
        subtotal_row = len(linhas_tabela) - 1
        tabela = Table(
            linhas_tabela,
            colWidths=[24 * mm, 24 * mm, 30 * mm, 34 * mm, 34 * mm, 90 * mm, 24 * mm],
            repeatRows=1,
        )
        tabela.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF8")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                    ("FONTNAME", (0, subtotal_row), (-1, subtotal_row), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.2),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                    ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, subtotal_row), (-1, subtotal_row), colors.HexColor("#F3F4F6")),
                ]
            )
        )
        story.append(Spacer(1, 3 * mm))
        story.append(tabela)
    else:
        for idx, item in enumerate(recibos):
            if idx > 0:
                story.append(PageBreak())
            _adicionar_cabecalho(
                "Recibo de ordem de servico recebida",
                f"OS {item['numero_os']} | Paciente {item['paciente'] or '-'}",
            )
            story.append(
                Paragraph(
                    (
                        "Declaramos o recebimento referente a ordem de servico abaixo, "
                        f"no valor de <b>{_formatar_moeda_brl(item['valor_final'])}</b>."
                    ),
                    style_normal,
                )
            )
            story.append(Spacer(1, 3 * mm))
            story.append(Paragraph("Dados da ordem", style_subtitulo))
            story.append(
                Paragraph(
                    "<br/>".join(
                        [
                            f"OS: {_texto_pdf(item['numero_os'])}",
                            f"Paciente: {_texto_pdf(item['paciente'])}",
                            f"Tutor: {_texto_pdf(item['tutor'])}",
                            f"Clinica: {_texto_pdf(item['clinica'])}",
                            f"Servico: {_texto_pdf(item['servico'])}",
                            f"Data do atendimento: {_texto_pdf(_formatar_data_ddmmaa(item['data_atendimento']))}",
                            f"Data do recebimento: {_texto_pdf(_formatar_data_ddmmaa(item['data_recebimento']))}",
                        ]
                    ),
                    style_normal,
                )
            )

            linhas_pagamento = [["Forma", "Data", "Valor bruto", "Taxa", "Valor liquido"]]
            for pagamento in item["pagamentos"]:
                linhas_pagamento.append(
                    [
                        str(pagamento["forma_pagamento_nome"] or "-"),
                        _formatar_data_ddmmaa(pagamento["data_recebimento"]),
                        _formatar_moeda_brl(pagamento["valor_bruto"]),
                        _formatar_moeda_brl(pagamento["valor_taxa"]),
                        _formatar_moeda_brl(pagamento["valor_liquido"]),
                    ]
                )
            if item["valor_credito_utilizado"] > 0:
                linhas_pagamento.append(
                    [
                        "Credito do cliente",
                        _formatar_data_ddmmaa(item["data_recebimento"]),
                        _formatar_moeda_brl(item["valor_credito_utilizado"]),
                        _formatar_moeda_brl(0),
                        _formatar_moeda_brl(item["valor_credito_utilizado"]),
                    ]
                )
            linhas_pagamento.append(
                [
                    "Total quitado",
                    "",
                    _formatar_moeda_brl(item["valor_final"]),
                    _formatar_moeda_brl(item["valor_taxa_total"]),
                    _formatar_moeda_brl(item["valor_liquido_exibido"]),
                ]
            )
            total_row = len(linhas_pagamento) - 1
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph("Composicao do recebimento", style_subtitulo))
            tabela_pagamentos = Table(
                linhas_pagamento,
                colWidths=[52 * mm, 24 * mm, 28 * mm, 22 * mm, 28 * mm],
                repeatRows=1,
            )
            tabela_pagamentos.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF8")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTNAME", (0, total_row), (-1, total_row), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("BACKGROUND", (0, total_row), (-1, total_row), colors.HexColor("#F3F4F6")),
                    ]
                )
            )
            story.append(tabela_pagamentos)
            if float(item["desconto"] or 0) > 0:
                story.append(Spacer(1, 2 * mm))
                story.append(
                    Paragraph(
                        f"Desconto aplicado na OS: {_formatar_moeda_brl(item['desconto'])}.",
                        style_normal,
                    )
                )

    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Atenciosamente,", style_normal))
    if assinatura:
        story.append(Spacer(1, 2 * mm))
        story.append(assinatura)
    story.append(Spacer(1, 2 * mm))
    story.append(
        Table(
            [[""]],
            colWidths=[70 * mm],
            style=TableStyle([("LINEABOVE", (0, 0), (-1, -1), 0.8, colors.HexColor("#9CA3AF"))]),
        )
    )
    story.append(Paragraph(f"<b>{_texto_pdf(nome_empresa, 'Fort Cordis')}</b>", style_normal))
    story.append(Paragraph(f"Emitido por: <b>{_texto_pdf(nome_emitente, '-')}</b>", style_normal))
    if crmv_emitente:
        story.append(Paragraph(f"Medico Veterinario - CRMV: {_texto_pdf(crmv_emitente, '-')}", style_normal))

    rodape_final = texto_rodape.strip() if texto_rodape else nome_empresa
    doc.build(
        story,
        onFirstPage=lambda c, d: _desenhar_rodape_relatorio(c, d, rodape_final),
        onLaterPages=lambda c, d: _desenhar_rodape_relatorio(c, d, rodape_final),
    )
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def _carregar_configuracao_usuario_recibo(
    db: Session,
    user_id: int,
) -> Optional[ConfiguracaoUsuario]:
    try:
        return (
            db.query(ConfiguracaoUsuario)
            .filter(ConfiguracaoUsuario.user_id == user_id)
            .first()
        )
    except SQLAlchemyError as exc:
        print(f"[recibo-os] Aviso: falha ao carregar configuracao do usuario {user_id}: {exc}")
        return None


def _numeros_whatsapp_os(
    os_data: OrdemServico,
    *,
    clinica: Optional[Clinica],
    tutor: Optional[Tutor],
) -> tuple[str, list[str]]:
    origem = str(os_data.origem_atendimento or "clinica_parceira").strip().lower()
    if origem == "domiciliar":
        nome = str(getattr(tutor, "nome", None) or "").strip()
        values = [getattr(tutor, "whatsapp", None), getattr(tutor, "telefone", None)]
        destinatario = "tutor"
    else:
        nome = str(getattr(clinica, "nome", None) or "").strip()
        values = list(getattr(clinica, "whatsapps", None) or [])
        values.append(getattr(clinica, "telefone", None))
        destinatario = "clinica"

    if not nome:
        raise HTTPException(status_code=409, detail=f"A OS nao possui {destinatario} vinculado para o envio.")

    numbers: list[str] = []
    for value in values:
        try:
            normalized = normalize_whatsapp_number(value)
        except HTTPException:
            continue
        if normalized not in numbers:
            numbers.append(normalized)
    if not numbers:
        raise HTTPException(status_code=409, detail=f"O {destinatario} nao possui WhatsApp cadastrado.")
    return nome, numbers


def _send_ordem_servico_whatsapp(
    *,
    os_id: int,
    template_key: OrdemServicoWhatsAppTemplateKey,
    required_status: str,
    payload: OrdemServicoWhatsAppInput,
    request: Request,
    db: Session,
    current_user: User,
) -> dict:
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if os_data is None:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada.")
    if os_data.status != required_status:
        action = "avisar o recibo" if required_status == "Pago" else "enviar a cobranca"
        raise HTTPException(status_code=409, detail=f"A OS precisa estar como {required_status} para {action}.")

    paciente = db.query(Paciente).filter(Paciente.id == os_data.paciente_id).first()
    if paciente is None:
        raise HTTPException(status_code=409, detail="A OS nao possui paciente vinculado.")
    tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first() if paciente.tutor_id else None
    clinica = db.query(Clinica).filter(Clinica.id == os_data.clinica_id).first() if os_data.clinica_id else None
    recipient_name, registered_numbers = _numeros_whatsapp_os(os_data, clinica=clinica, tutor=tutor)

    destination = normalize_whatsapp_number(payload.destination) if payload.destination else registered_numbers[0]
    if destination not in registered_numbers:
        raise HTTPException(status_code=422, detail="O numero informado nao pertence ao destinatario da OS.")

    try:
        result = send_approved_utility_template(
            template_key=template_key,
            subject_type="ordem_servico",
            subject_id=os_data.id,
            destination=destination,
            parameters=[
                recipient_name[:120],
                str(os_data.numero_os or os_data.id)[:120],
                str(paciente.nome or "Paciente").strip()[:120],
                _formatar_moeda_brl(os_data.valor_final)[:120],
            ],
            idempotency_key=payload.idempotency_key,
        )
    except WhatsAppTemplateDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    action = "ORDEM_SERVICO_RECIBO_WHATSAPP_ENVIADO" if required_status == "Pago" else "ORDEM_SERVICO_COBRANCA_WHATSAPP_ENVIADA"
    registrar_auditoria(
        current_user=current_user,
        modulo="ordens_servico",
        entidade="ordem_servico",
        entidade_id=os_data.id,
        acao=action,
        descricao=f"Modelo oficial {template_key} enviado pelo WhatsApp.",
        detalhes={
            "destination_suffix": destination[-4:],
            "provider_message_id": result.get("message_id"),
            "idempotent": bool(result.get("idempotent")),
        },
        request=request,
    )
    return result


@router.post("/{os_id}/whatsapp/recibo")
def enviar_aviso_recibo_whatsapp(
    os_id: int,
    payload: OrdemServicoWhatsAppInput,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envia o modelo aprovado de recibo para uma OS paga."""
    return _send_ordem_servico_whatsapp(
        os_id=os_id,
        template_key="receiptAvailable",
        required_status="Pago",
        payload=payload,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post("/{os_id}/whatsapp/cobranca")
def enviar_cobranca_whatsapp(
    os_id: int,
    payload: OrdemServicoWhatsAppInput,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envia o modelo aprovado de pendencia para uma unica OS pendente."""
    return _send_ordem_servico_whatsapp(
        os_id=os_id,
        template_key="pendingPaymentReminder",
        required_status="Pendente",
        payload=payload,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.get("")
def listar_ordens(
    status: Optional[str] = None,
    origem_atendimento: Optional[str] = None,
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
            Tutor.id.label("tutor_id"),
            Tutor.nome.label("tutor_nome"),
            Tutor.telefone.label("tutor_telefone"),
            Tutor.whatsapp.label("tutor_whatsapp"),
            Tutor.email.label("tutor_email"),
            Clinica.nome.label("clinica_nome"),
            Clinica.telefone.label("clinica_telefone"),
            Clinica.email.label("clinica_email"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
    )

    origem_atendimento_norm = _normalizar_origem_atendimento_os(origem_atendimento)
    if status:
        query = query.filter(OrdemServico.status == status)
    if origem_atendimento_norm:
        query = query.filter(OrdemServico.origem_atendimento == origem_atendimento_norm)
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

    items = [_serialize_os_row(row) for row in results]

    return {"total": total, "items": items}


@router.get("/relatorios/pendencias/pdf")
def gerar_relatorio_pendencias_pdf(
    status: Optional[str] = Query("Pendente"),
    origem_atendimento: Optional[str] = None,
    clinica_id: Optional[int] = None,
    clinica_nome: Optional[str] = None,
    tutor_id: Optional[int] = None,
    tutor_nome: Optional[str] = None,
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
            Tutor.id.label("tutor_id"),
            Tutor.nome.label("tutor_nome"),
            Tutor.telefone.label("tutor_telefone"),
            Tutor.whatsapp.label("tutor_whatsapp"),
            Tutor.email.label("tutor_email"),
            Clinica.nome.label("clinica_nome"),
            Clinica.telefone.label("clinica_telefone"),
            Clinica.email.label("clinica_email"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
    )

    origem_atendimento_norm = _normalizar_origem_atendimento_os(origem_atendimento)
    if status and status != "todos":
        query = query.filter(OrdemServico.status == status)
    if origem_atendimento_norm:
        query = query.filter(OrdemServico.origem_atendimento == origem_atendimento_norm)
    if tutor_id:
        query = query.filter(
            OrdemServico.origem_atendimento == "domiciliar",
            Tutor.id == tutor_id,
        )
    elif tutor_nome:
        nome_tutor_limpo = tutor_nome.strip().lower()
        query = query.filter(OrdemServico.origem_atendimento == "domiciliar")
        if nome_tutor_limpo == "tutor nao informado":
            query = query.filter(or_(Tutor.id.is_(None), func.trim(func.coalesce(Tutor.nome, "")) == ""))
        else:
            query = query.filter(func.lower(func.trim(Tutor.nome)) == nome_tutor_limpo)
    elif clinica_id:
        query = query.filter(OrdemServico.clinica_id == clinica_id)
    elif clinica_nome:
        nome_limpo = clinica_nome.strip().lower()
        if nome_limpo == "atendimento domiciliar":
            query = query.filter(
                OrdemServico.clinica_id.is_(None),
                OrdemServico.origem_atendimento == "domiciliar",
            )
        elif nome_limpo == "clinica nao informada":
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

    resultados = query.order_by(OrdemServico.data_atendimento.asc(), OrdemServico.id.asc()).all()
    if not resultados:
        raise HTTPException(
            status_code=404,
            detail="Nao ha ordens para gerar relatorio com os filtros selecionados.",
        )

    itens_relatorio: List[Dict[str, Any]] = []
    for row in resultados:
        (
            os_data,
            paciente_nome,
            tutor_id_row,
            tutor_nome_row,
            tutor_telefone_row,
            tutor_whatsapp_row,
            tutor_email_row,
            clinica_nome_row,
            clinica_telefone_row,
            clinica_email_row,
            servico_nome,
        ) = row
        payload_os = _serialize_os(
            os_data,
            paciente_nome=paciente_nome,
            tutor_id=tutor_id_row,
            tutor_nome=tutor_nome_row,
            tutor_telefone=tutor_telefone_row,
            tutor_whatsapp=tutor_whatsapp_row,
            tutor_email=tutor_email_row,
            clinica_nome=clinica_nome_row,
            clinica_telefone=clinica_telefone_row,
            clinica_email=clinica_email_row,
            servico_nome=servico_nome,
        )
        itens_relatorio.append(
            {
                "chave": (
                    f"tutor:{tutor_id_row}"
                    if payload_os["destinatario_tipo"] == "tutor" and tutor_id_row
                    else f"tutor-nome:{payload_os['destinatario_nome'].lower()}"
                    if payload_os["destinatario_tipo"] == "tutor"
                    else f"clinica:{os_data.clinica_id}"
                    if os_data.clinica_id
                    else f"clinica-nome:{payload_os['destinatario_nome'].lower()}"
                ),
                "numero_os": os_data.numero_os or "",
                "paciente": paciente_nome or "",
                "tutor": tutor_nome_row or "",
                "destinatario_tipo": payload_os["destinatario_tipo"],
                "destinatario_nome": payload_os["destinatario_nome"],
                "destinatario_telefone": payload_os["destinatario_telefone"],
                "destinatario_email": payload_os["destinatario_email"],
                "servico": servico_nome or "",
                "data_atendimento": os_data.data_atendimento,
                "valor_final": float(os_data.valor_final or 0),
            }
        )

    configuracao = db.query(Configuracao).first()
    configuracao_usuario = (
        db.query(ConfiguracaoUsuario)
        .filter(ConfiguracaoUsuario.user_id == current_user.id)
        .first()
    )
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
    if origem_atendimento_norm:
        filtros_aplicados.append(f"origem={origem_atendimento_norm}")
    if tutor_id:
        tutor_ref = db.query(Tutor).filter(Tutor.id == tutor_id).first()
        filtros_aplicados.append(f"tutor={tutor_ref.nome if tutor_ref and tutor_ref.nome else tutor_id}")
    elif tutor_nome:
        filtros_aplicados.append(f"tutor={tutor_nome}")
    elif clinica_id:
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


def _montar_recibos_os(db: Session, ids: List[int]) -> List[Dict[str, Any]]:
    """Monta os dicionarios de recibo para as OS informadas (somente as ja Pagas sao incluidas)."""
    resultados = (
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
        .filter(OrdemServico.id.in_(ids), OrdemServico.status == "Pago")
        .order_by(OrdemServico.data_atendimento.asc(), OrdemServico.id.asc())
        .all()
    )

    pagamentos_rows = (
        db.query(OrdemServicoPagamento)
        .filter(OrdemServicoPagamento.ordem_servico_id.in_(ids))
        .order_by(OrdemServicoPagamento.ordem_servico_id.asc(), OrdemServicoPagamento.data_recebimento.asc())
        .all()
    )
    pagamentos_por_os: Dict[int, List[OrdemServicoPagamento]] = {}
    for pagamento in pagamentos_rows:
        pagamentos_por_os.setdefault(pagamento.ordem_servico_id, []).append(pagamento)

    creditos_rows = (
        db.query(CreditoFinanceiro)
        .filter(
            CreditoFinanceiro.ordem_servico_id.in_(ids),
            CreditoFinanceiro.origem == "consumo_credito_os",
            CreditoFinanceiro.status == "Ativo",
        )
        .all()
    )
    credito_por_os: Dict[int, float] = {}
    for credito in creditos_rows:
        credito_por_os[credito.ordem_servico_id] = round(
            credito_por_os.get(credito.ordem_servico_id, 0.0) + abs(float(credito.valor or 0)),
            2,
        )

    recibos: List[Dict[str, Any]] = []
    for os_data, paciente_nome, tutor_nome, clinica_nome, servico_nome in resultados:
        pagamentos_os = pagamentos_por_os.get(os_data.id, [])
        pagamentos = [
            {
                "forma_pagamento_nome": pagamento.forma_pagamento_nome,
                "valor_bruto": float(pagamento.valor_bruto or 0),
                "valor_taxa": float(pagamento.valor_taxa or 0),
                "valor_liquido": float(pagamento.valor_liquido or 0),
                "data_recebimento": pagamento.data_recebimento,
            }
            for pagamento in pagamentos_os
        ]
        datas_recebimento = [pagamento.data_recebimento for pagamento in pagamentos_os if pagamento.data_recebimento]
        valor_credito_utilizado = round(float(credito_por_os.get(os_data.id, 0.0)), 2)
        valor_liquido_total = round(sum(float(item["valor_liquido"] or 0) for item in pagamentos), 2)
        possui_detalhamento_legacy = not pagamentos and valor_credito_utilizado <= 0
        valor_liquido_exibido = (
            float(os_data.valor_final or 0)
            if possui_detalhamento_legacy
            else round(valor_liquido_total + valor_credito_utilizado, 2)
        )
        recibos.append(
            {
                "id": os_data.id,
                "numero_os": os_data.numero_os,
                "paciente": paciente_nome or "",
                "tutor": tutor_nome or "",
                "clinica": _serialize_os(
                    os_data,
                    paciente_nome=paciente_nome,
                    tutor_nome=tutor_nome,
                    clinica_nome=clinica_nome,
                    servico_nome=servico_nome,
                ).get("clinica", ""),
                "servico": servico_nome or "",
                "data_atendimento": os_data.data_atendimento,
                "data_recebimento": max(datas_recebimento) if datas_recebimento else os_data.updated_at or os_data.created_at,
                "valor_servico": float(os_data.valor_servico or 0),
                "desconto": float(os_data.desconto or 0),
                "valor_final": float(os_data.valor_final or 0),
                "pagamentos": pagamentos,
                "valor_credito_utilizado": valor_credito_utilizado,
                "possui_detalhamento_legacy": possui_detalhamento_legacy,
                "valor_taxa_total": round(sum(float(item["valor_taxa"] or 0) for item in pagamentos), 2),
                "valor_liquido_total": valor_liquido_total,
                "valor_liquido_exibido": valor_liquido_exibido,
            }
        )

    return recibos


def _carregar_dados_emissor_recibo_empresa(db: Session) -> Dict[str, Any]:
    """Dados de identidade/contato da empresa para o cabecalho do recibo (sem dados de usuario)."""
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

    logomarca = None
    texto_rodape = ""
    assinatura_emitente = None
    if configuracao:
        if configuracao.mostrar_logomarca and configuracao.logomarca_dados:
            logomarca = configuracao.logomarca_dados
        texto_rodape = (configuracao.texto_rodape_laudo or "").strip()
        if configuracao.mostrar_assinatura and configuracao.assinatura_dados:
            assinatura_emitente = configuracao.assinatura_dados

    return {
        "nome_empresa": nome_empresa,
        "contato_empresa": contato_empresa,
        "logomarca": logomarca,
        "texto_rodape": texto_rodape,
        "assinatura_emitente": assinatura_emitente,
    }


@router.get("/relatorios/recibos/pdf")
def gerar_recibos_os_pdf(
    os_ids: str,
    agrupar: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera recibo PDF para OS recebidas, individual ou agrupado."""
    ids = _parse_os_ids_param(os_ids)

    recibos = _montar_recibos_os(db, ids)
    encontrados_ids = {item["id"] for item in recibos}
    faltantes = [os_id for os_id in ids if os_id not in encontrados_ids]
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=(
                "Algumas OS informadas nao foram encontradas ou ainda nao estao recebidas: "
                + ", ".join(str(item) for item in faltantes)
            ),
        )

    dados_empresa = _carregar_dados_emissor_recibo_empresa(db)
    configuracao_usuario = _carregar_configuracao_usuario_recibo(db, current_user.id)
    assinatura_emitente = dados_empresa["assinatura_emitente"]
    crmv_emitente = ""
    if configuracao_usuario:
        if configuracao_usuario.assinatura_dados:
            assinatura_emitente = configuracao_usuario.assinatura_dados
        crmv_emitente = str(configuracao_usuario.crmv or "").strip()

    pdf_bytes = _gerar_pdf_recibos_ordens(
        recibos=recibos,
        nome_empresa=dados_empresa["nome_empresa"],
        contato_empresa=dados_empresa["contato_empresa"],
        texto_rodape=dados_empresa["texto_rodape"],
        agrupar=agrupar,
        nome_emitente=str(current_user.nome or "").strip() or "Usuario emissor",
        crmv_emitente=crmv_emitente,
        assinatura_emitente_dados=assinatura_emitente,
        logomarca_dados=dados_empresa["logomarca"],
    )

    if agrupar:
        filename = f"recibo_os_agrupado_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    elif len(recibos) == 1:
        filename = f"recibo_os_{recibos[0]['numero_os']}.pdf"
    else:
        filename = f"recibos_os_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
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

    return _serialize_os_row(os_row)


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
            origem_atendimento=getattr(os_data, "origem_atendimento", None),
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
    payload = _serialize_os_row(os_row)
    os_updated = os_row[0]
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

    (
        os_data,
        paciente_nome,
        _tutor_id,
        _tutor_nome,
        _tutor_telefone,
        _tutor_whatsapp,
        _tutor_email,
        clinica_nome,
        _clinica_telefone,
        _clinica_email,
        servico_nome,
    ) = os_row
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
    valor_servico = round(float(os_data.valor_servico or 0), 2)
    desconto_base = round(float(os_data.desconto or 0), 2)
    desconto_informado = (
        desconto_base
        if dados.desconto is None
        else round(float(dados.desconto or 0), 2)
    )
    if desconto_informado > valor_servico + 1e-9:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Desconto informado ({desconto_informado:.2f}) maior que o valor do servico "
                f"({valor_servico:.2f})."
            ),
        )
    valor_os = round(max(0.0, valor_servico - desconto_informado), 2)
    os_data.desconto = _to_decimal(desconto_informado)
    os_data.valor_final = _to_decimal(valor_os)
    momento_recebimento_base = _montar_momento_recebimento(dados.data_recebimento, now)
    valor_credito_solicitado = round(float(dados.valor_credito_utilizado or 0), 2)
    pagamentos_input = list(dados.pagamentos or [])
    if not pagamentos_input and valor_credito_solicitado <= 0 and valor_os > 0:
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

    if not pagamentos_input and valor_credito_utilizado <= 0 and valor_os > 0:
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
            "valor_servico": valor_servico,
            "desconto_aplicado": round(desconto_informado, 2),
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
        clinica_label = _serialize_os(
            os_data,
            paciente_nome=paciente_nome,
            tutor_nome=_tutor_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
        ).get("clinica")
        send_financeiro_push_notification(
            db,
            action="payment_received",
            os_id=os_data.id,
            data={
                "numero_os": os_data.numero_os,
                "paciente_nome": paciente_nome,
                "clinica_nome": clinica_label,
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
        "valor_servico": valor_servico,
        "desconto_aplicado": round(desconto_informado, 2),
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
