from collections import defaultdict
from datetime import date, datetime, timedelta
from io import BytesIO
import json
import logging
import os
import re
import tempfile
import unicodedata
from typing import Any, Dict, List, Optional, Union
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from jose import JWTError, jwt
from app.schemas.atendimento import (
    AnexoPayload,
    AlertaPayload,
    AtendimentoCreatePayload,
    AtendimentoUpdatePayload,
    ClinicalPhrasePayload,
    DiagnosticoPayload,
    DocumentoAtendimentoCreatePayload,
    DocumentoAtendimentoUpdatePayload,
    DocumentoTemplatePayload,
    ExameSolicitacaoPayload,
    EvolucaoPayload,
    MedicamentoPayload,
    PainelExamePayload,
    PrescricaoItemPayload,
    PrescricaoPayload,
    PrescricaoPreviewPayload,
    TriagemPayload,
)
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.portal_release import PORTAL_RELEASED_STATUS
from app.core.security import _authorize_request_by_matrix, get_current_user, get_request_token
from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.atendimento_clinico import (
    AlertaClinico,
    AnexoAtendimento,
    AtendimentoClinico,
    DocumentoAtendimento,
    DocumentoAtendimentoTemplate,
    EvolucaoClinica,
    Medicamento,
    PrescricaoClinica,
    PrescricaoItem,
    PrescricaoItemAjuste,
    UploadDedupeMetrica,
)
from app.models.catalogo_exame import CatalogoExame, PainelExame
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao, ConfiguracaoUsuario
from app.models.laudo import Exame, Laudo
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.user import User
from app.services.clinical_phrase_service import montar_contexto_frases_clinicas
from app.services.atendimento.clinical_phrase_crud_service import (
    atualizar_frase_clinica,
    criar_frase_clinica,
    desativar_frase_clinica,
    restaurar_frase_clinica,
)
from app.services.atendimento.document_template_crud_service import (
    atualizar_template_documento,
    criar_template_documento,
    desativar_template_documento,
    listar_templates_documento,
    obter_template_documento_ou_404,
    restaurar_template_documento,
)
from app.services.atendimento.document_crud_service import (
    atualizar_documento_atendimento as atualizar_documento_atendimento_service,
    excluir_documento_atendimento as excluir_documento_atendimento_service,
    listar_documentos_atendimento as listar_documentos_atendimento_service,
    obter_documento_atendimento_ou_404 as obter_documento_atendimento_ou_404_service,
    serializar_documento_atendimento as serializar_documento_atendimento_service,
)
from app.services.atendimento.document_context_service import (
    atualizar_documento_template_se_contexto_mudou as atualizar_documento_template_se_contexto_mudou_service,
    carregar_contexto_entidades_documento as carregar_contexto_entidades_documento_service,
    montar_contexto_template_documento as montar_contexto_template_documento_service,
    renderizar_template_documento as renderizar_template_documento_service,
)
from app.services.exam_catalog_service import montar_contexto_catalogo_exames
from app.services.atendimento.painel_service import (
    CUSTOM_PAINEL_EXAME_PREFIX,
    gerar_codigo_unico_painel_exame,
    obter_painel_exame_customizado,
    resolver_ids_catalogo_exames,
    serializar_painel_exame_com_itens,
    substituir_itens_painel_exame,
)
from app.services.atendimento_upload_service import (
    AttachmentTooLargeError,
    AttachmentTypeError,
    build_upload_dedupe_key,
    calculate_attachment_sha256,
    store_atendimento_attachment_file,
    remove_atendimento_attachment_file,
)
from app.services.attachment_download_service import build_attachment_download_response
from app.services.upload_dedupe_cleanup_service import (
    UploadDedupeCleanupBusyError,
    UploadDedupeCleanupExecutionError,
    get_upload_dedupe_cleanup_status,
    run_upload_dedupe_cleanup,
    UPLOAD_DEDUPE_CLEANUP_EXECUTOR_MANUAL,
)
from app.services.medication_automation import analyze_prescription_items, medication_to_dict
from app.utils.paciente_helpers import extrair_idade_paciente, normalizar_sexo_paciente
from app.utils.pdf_laudo import (
    create_pdf_styles,
    criar_cabecalho,
    criar_secao_assinatura,
    criar_titulo_secao,
    footer_todas_paginas,
)

router = APIRouter()
logger = logging.getLogger(__name__)

PORTAL_EXAME_RELEASE_MESSAGE = "Exame liberado no portal da clinica parceira."

UPLOAD_DEDUPE_EVENT_UPLOAD_NOVO = "upload_novo"
UPLOAD_DEDUPE_EVENT_PRECHECK = "dedupe_precheck"
UPLOAD_DEDUPE_EVENT_COLLISION = "dedupe_collision"
UPLOAD_DEDUPE_EVENTS_VALIDOS = {
    UPLOAD_DEDUPE_EVENT_UPLOAD_NOVO,
    UPLOAD_DEDUPE_EVENT_PRECHECK,
    UPLOAD_DEDUPE_EVENT_COLLISION,
}


def _serialize_medicamento(item: Medicamento) -> dict:
    return medication_to_dict(item)


def _resolver_peso_referencia(
    atendimento: Optional[AtendimentoClinico],
    paciente: Optional[Paciente],
) -> Optional[float]:
    if atendimento and atendimento.peso is not None:
        return float(atendimento.peso)
    if paciente and paciente.peso_kg is not None:
        return float(paciente.peso_kg)
    return None


def _registrar_ajuste_prescricao(
    db: Session,
    *,
    item: PrescricaoItem,
    atendimento_id: int,
    campo: str,
    valor_anterior: Any,
    valor_novo: Any,
    current_user: User,
    motivo: str = "Atualizacao manual da prescricao",
) -> None:
    anterior = "" if valor_anterior is None else str(valor_anterior).strip()
    novo = "" if valor_novo is None else str(valor_novo).strip()
    if anterior == novo:
        return

    db.add(
        PrescricaoItemAjuste(
            prescricao_item_id=item.id,
            atendimento_id=atendimento_id,
            campo=campo,
            valor_anterior=anterior,
            valor_novo=novo,
            motivo=motivo,
            responsavel_id=current_user.id,
            responsavel_nome=current_user.nome,
        )
    )


def _map_ajustes_por_item(
    db: Session,
    item_ids: List[int],
) -> Dict[int, List[dict]]:
    if not item_ids:
        return {}

    ajustes = (
        db.query(PrescricaoItemAjuste)
        .filter(PrescricaoItemAjuste.prescricao_item_id.in_(item_ids))
        .order_by(PrescricaoItemAjuste.created_at.desc(), PrescricaoItemAjuste.id.desc())
        .all()
    )
    grouped: Dict[int, List[dict]] = defaultdict(list)
    for ajuste in ajustes:
        grouped[ajuste.prescricao_item_id].append(
            {
                "id": ajuste.id,
                "campo": ajuste.campo,
                "valor_anterior": ajuste.valor_anterior or "",
                "valor_novo": ajuste.valor_novo or "",
                "motivo": ajuste.motivo or "",
                "responsavel_id": ajuste.responsavel_id,
                "responsavel_nome": ajuste.responsavel_nome or "",
                "created_at": _to_iso(ajuste.created_at),
            }
        )
    return grouped


def _normalizar_diagnostico(diagnostico: Optional[Union[DiagnosticoPayload, str]]) -> Dict[str, Optional[str]]:
    if isinstance(diagnostico, str):
        texto = diagnostico.strip()
        return {
            "diagnostico_principal": texto,
            "diagnostico_secundario": "",
            "diagnostico_diferencial": "",
            "prognostico": None,
        }

    if diagnostico is None:
        return {
            "diagnostico_principal": "",
            "diagnostico_secundario": "",
            "diagnostico_diferencial": "",
            "prognostico": None,
        }

    return {
        "diagnostico_principal": diagnostico.diagnostico_principal or "",
        "diagnostico_secundario": diagnostico.diagnostico_secundario or "",
        "diagnostico_diferencial": diagnostico.diagnostico_diferencial or "",
        "prognostico": diagnostico.prognostico or None,
    }


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _to_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


def _formatar_data_hora(value: Any) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    try:
        parsed = _parse_datetime(str(value))
        if parsed:
            return parsed.strftime("%d/%m/%Y %H:%M")
    except Exception:
        pass
    return str(value)


def _nome_arquivo_limpo(raw: str, fallback: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (raw or "").strip()).strip("_")
    return cleaned or fallback


def _formatar_data_curta(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    try:
        parsed = _parse_datetime(str(value))
        if parsed:
            return parsed.strftime("%d/%m/%Y")
    except Exception:
        pass
    return str(value)


def _pdf_escape(value: Any) -> str:
    if value is None:
        return ""
    return xml_escape(str(value))


def _texto_pdf_html(value: Any, fallback: str = "-") -> str:
    texto = str(value or "").strip()
    if not texto:
        return fallback
    return _pdf_escape(texto).replace("\r\n", "\n").replace("\n", "<br/>")


def _formatar_moeda_brl(value: Any) -> str:
    if value in (None, ""):
        return "-"
    try:
        numero = float(value)
    except Exception:
        return str(value)
    formatado = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatado}"


def _obter_branding_pdf_documento(
    db: Session,
    current_user: User,
) -> Dict[str, Any]:
    config_sistema = None
    config_usuario = None
    try:
        config_sistema = db.query(Configuracao).first()
    except Exception:
        db.rollback()
    try:
        config_usuario = db.query(ConfiguracaoUsuario).filter(
            ConfiguracaoUsuario.user_id == current_user.id
        ).first()
    except Exception:
        db.rollback()

    logomarca_bytes = None
    assinatura_bytes = None
    texto_rodape = None
    crmv = ""

    if config_sistema:
        if config_sistema.mostrar_logomarca and config_sistema.logomarca_dados:
            logomarca_bytes = config_sistema.logomarca_dados
        texto_rodape = config_sistema.texto_rodape_laudo

    if config_usuario and config_usuario.assinatura_dados:
        assinatura_bytes = config_usuario.assinatura_dados
    elif config_sistema and config_sistema.mostrar_assinatura and config_sistema.assinatura_dados:
        assinatura_bytes = config_sistema.assinatura_dados

    if config_usuario and config_usuario.crmv:
        crmv = config_usuario.crmv

    return {
        "nome_veterinario": current_user.nome or "",
        "crmv": crmv,
        "logomarca_bytes": logomarca_bytes,
        "assinatura_bytes": assinatura_bytes,
        "texto_rodape": texto_rodape,
    }


def _atualizar_documento_template_se_contexto_mudou(
    db: Session,
    atendimento: AtendimentoClinico,
    documento: DocumentoAtendimento,
    branding: Dict[str, Any],
) -> tuple[Optional[Paciente], Optional[Tutor], Optional[Clinica]]:
    return atualizar_documento_template_se_contexto_mudou_service(
        db,
        atendimento,
        documento,
        branding,
    )


def _montar_dados_pdf_documento(
    atendimento: AtendimentoClinico,
    paciente: Optional[Paciente],
    tutor: Optional[Tutor],
    clinica: Optional[Clinica],
    nome_veterinario: str,
) -> Dict[str, Any]:
    peso = _resolver_peso_referencia(atendimento, paciente)
    return {
        "paciente": {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else (atendimento.especie or ""),
            "raca": paciente.raca if paciente else "",
            "sexo": normalizar_sexo_paciente(paciente.sexo if paciente else ""),
            "idade": extrair_idade_paciente(
                paciente.nascimento if paciente else None,
                paciente.observacoes if paciente else None,
            ),
            "peso": f"{peso:.1f}" if peso is not None else "",
            "tutor": tutor.nome if tutor else "",
            "solicitante": atendimento.criado_por_nome or nome_veterinario or "",
            "data_exame": _formatar_data_curta(atendimento.data_atendimento),
        },
        "clinica": clinica.nome if clinica else "",
    }


def _gerar_pdf_documento_atendimento_bytes(
    atendimento: AtendimentoClinico,
    paciente: Optional[Paciente],
    tutor: Optional[Tutor],
    clinica: Optional[Clinica],
    documento: DocumentoAtendimento,
    *,
    nome_veterinario: str = "",
    crmv: str = "",
    logomarca_bytes: Optional[bytes] = None,
    assinatura_bytes: Optional[bytes] = None,
    texto_rodape: Optional[str] = None,
) -> bytes:
    styles = create_pdf_styles()
    corpo_style = ParagraphStyle(
        "DocumentoAtendimentoCorpo",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.8,
        leading=16,
        textColor=colors.HexColor("#111827"),
        spaceAfter=0,
    )
    dados_pdf = _montar_dados_pdf_documento(
        atendimento,
        paciente,
        tutor,
        clinica,
        nome_veterinario,
    )

    temp_files: List[str] = []
    try:
        temp_logo_path = None
        temp_assinatura_path = None
        if logomarca_bytes:
            temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_logo.write(logomarca_bytes)
            temp_logo.close()
            temp_logo_path = temp_logo.name
            temp_files.append(temp_logo_path)
        if assinatura_bytes:
            temp_assinatura = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_assinatura.write(assinatura_bytes)
            temp_assinatura.close()
            temp_assinatura_path = temp_assinatura.name
            temp_files.append(temp_assinatura_path)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            title=documento.titulo or f"Documento - Atendimento {atendimento.id}",
        )

        story: List[Any] = []
        story.extend(
            criar_cabecalho(
                dados_pdf,
                temp_logo_path=temp_logo_path,
                titulo_principal=(documento.titulo or "Documento Clinico").upper(),
                mostrar_linha_ritmo=False,
                label_data_exame="Data",
            )
        )

        blocos = [bloco.strip() for bloco in re.split(r"\n\s*\n", documento.corpo or "") if bloco.strip()]
        if not blocos:
            blocos = ["Sem conteudo registrado."]
        for bloco in blocos:
            story.append(Paragraph(_texto_pdf_html(bloco, ""), corpo_style))
            story.append(Spacer(1, 4 * mm))

        if nome_veterinario:
            story.extend(
                criar_secao_assinatura(
                    nome_veterinario,
                    crmv=crmv,
                    temp_assinatura_path=temp_assinatura_path,
                )
            )

        def add_footer(canvas_obj, pdf_doc):
            footer_todas_paginas(canvas_obj, pdf_doc, texto_rodape)

        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        pdf = buffer.getvalue()
        buffer.close()
        return pdf
    finally:
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass


def _autenticar_usuario_pdf(
    request: Request,
    db: Session,
) -> User:
    if "access_token" in request.query_params:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao use access_token na URL. Use Authorization: Bearer <token>.",
        )

    token = get_request_token(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise ValueError("sub ausente")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.ativo != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")

    _authorize_request_by_matrix(request, db, user)
    return user


def _excluir_anexo_registro(db: Session, anexo: AnexoAtendimento) -> None:
    remove_atendimento_attachment_file(anexo.caminho_arquivo)
    db.delete(anexo)


def _excluir_anexos_por_exame(db: Session, exame_id: int) -> None:
    anexos = db.query(AnexoAtendimento).filter(AnexoAtendimento.exame_id == exame_id).all()
    for anexo in anexos:
        _excluir_anexo_registro(db, anexo)


def _excluir_anexos_por_atendimento(db: Session, atendimento_id: int) -> None:
    anexos = db.query(AnexoAtendimento).filter(AnexoAtendimento.atendimento_id == atendimento_id).all()
    for anexo in anexos:
        _excluir_anexo_registro(db, anexo)


def _montar_story_cabecalho_atendimento(
    atendimento: AtendimentoClinico,
    paciente: Optional[Paciente],
    tutor: Optional[Tutor],
    clinica: Optional[Clinica],
    titulo: str,
) -> list:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "AtendimentoPdfTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        spaceAfter=8,
    )
    normal = ParagraphStyle(
        "AtendimentoPdfNormal",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
    )

    story: list = []
    story.append(Paragraph(titulo, title_style))
    story.append(Paragraph(f"<b>Atendimento:</b> #{atendimento.id}", normal))
    story.append(Paragraph(f"<b>Data:</b> {_formatar_data_hora(atendimento.data_atendimento)}", normal))
    story.append(Paragraph(f"<b>Status:</b> {atendimento.status or '-'}", normal))
    story.append(Paragraph(f"<b>Paciente:</b> {(paciente.nome if paciente else '-')}", normal))
    story.append(Paragraph(f"<b>Tutor:</b> {(tutor.nome if tutor else '-')}", normal))
    story.append(Paragraph(f"<b>Clinica:</b> {(clinica.nome if clinica else '-')}", normal))
    story.append(Paragraph(f"<b>Veterinario:</b> {atendimento.criado_por_nome or '-'}", normal))
    story.append(Spacer(1, 4 * mm))
    return story


# Helpers compartilhados para prescricao (usados por PDF final e preview)
def _prescricao_criar_box_texto(titulo: str, corpo_html: str, bg: str, border: str) -> Table:
    """Cria box de texto com titulo e corpo HTML."""
    styles = create_pdf_styles()
    label_style = ParagraphStyle(
        "PrescricaoBoxLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        textColor=colors.HexColor("#6b7280"),
        leading=10,
    )
    texto_style = ParagraphStyle(
        "PrescricaoBoxTexto",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        textColor=colors.HexColor("#111827"),
        leading=13,
    )
    conteudo = [
        Paragraph(
            f"<font name='Helvetica-Bold' size='7' color='#6b7280'>{_pdf_escape(titulo.upper())}</font>",
            label_style,
        ),
        Spacer(1, 1.2 * mm),
        Paragraph(corpo_html, texto_style),
    ]
    tabela = Table([[conteudo]], colWidths=[180 * mm])
    tabela.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(border)),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return tabela


def _prescricao_criar_card_info(label: str, valor: str) -> Paragraph:
    """Cria card de informacao para item de prescricao."""
    styles = create_pdf_styles()
    obs_style = ParagraphStyle(
        "PrescricaoCardObs",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.2,
        textColor=colors.HexColor("#111827"),
        leading=12.5,
    )
    return Paragraph(
        f"<font name='Helvetica-Bold' size='7' color='#6b7280'>{_pdf_escape(label.upper())}</font><br/>{_texto_pdf_html(valor)}",
        obs_style,
    )


def _prescricao_criar_card_prescricao(idx: int, nome: str, dose: str, frequencia: str, duracao: str, via: str, apresentacao: str = "", instrucoes: str = "") -> Table:
    """Cria card de prescricao (item) - versao generica."""
    styles = create_pdf_styles()
    titulo_style = ParagraphStyle(
        "PrescricaoItemTitulo",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        textColor=colors.HexColor("#111827"),
        leading=14,
        spaceAfter=1,
    )
    obs_style = ParagraphStyle(
        "PrescricaoItemObs",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.2,
        textColor=colors.HexColor("#111827"),
        leading=12.5,
    )

    nome_item = nome.strip() or "Medicamento sem nome"
    formula_manipulada = "formula manipulada" in nome_item.lower()
    apres = apresentacao.strip()
    if formula_manipulada and not apres:
        apres = "Formula manipulada"
    titulo_html = f"{idx}. {_pdf_escape(nome_item)}"
    if formula_manipulada:
        titulo_html += " <font name='Helvetica-Bold' size='7' color='#9a3412'>FORMULA MANIPULADA</font>"

    info_table = Table(
        [[
            _prescricao_criar_card_info("Dose", dose or "-"),
            _prescricao_criar_card_info("Frequencia", frequencia or "-"),
            _prescricao_criar_card_info("Duracao", duracao or "-"),
            _prescricao_criar_card_info("Via", via or "-"),
        ]],
        colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm],
    )
    info_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    conteudo: List[Any] = [Paragraph(titulo_html, titulo_style)]
    if apres:
        conteudo.extend([
            Spacer(1, 1.2 * mm),
            Paragraph(
                f"<font name='Helvetica-Bold' size='7' color='#6b7280'>APRESENTACAO</font><br/>{_texto_pdf_html(apres)}",
                obs_style,
            ),
        ])
    conteudo.extend([Spacer(1, 2 * mm), info_table])
    if instrucoes.strip():
        conteudo.extend([
            Spacer(1, 2.2 * mm),
            Paragraph(
                f"<font name='Helvetica-Bold' size='7' color='#6b7280'>INSTRUCOES ESPECIFICAS</font><br/>{_texto_pdf_html(instrucoes)}",
                obs_style,
            ),
        ])
    card_bg = "#fff7ed" if formula_manipulada else "#fafafa"
    card_border = "#fdba74" if formula_manipulada else "#e5e7eb"
    card = Table([[conteudo]], colWidths=[180 * mm])
    card.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(card_border)),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(card_bg)),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return card


def _gerar_pdf_prescricao_bytes(
    atendimento: AtendimentoClinico,
    paciente: Optional[Paciente],
    tutor: Optional[Tutor],
    clinica: Optional[Clinica],
    prescricao: PrescricaoClinica,
    itens: List[PrescricaoItem],
    *,
    nome_veterinario: str = "",
    crmv: str = "",
    logomarca_bytes: Optional[bytes] = None,
    assinatura_bytes: Optional[bytes] = None,
    texto_rodape: Optional[str] = None,
) -> bytes:
    styles = create_pdf_styles()
    resumo_label_style = ParagraphStyle(
        "PrescricaoResumoLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        textColor=colors.HexColor("#6b7280"),
        leading=10,
    )
    card_texto_style = ParagraphStyle(
        "PrescricaoCardTexto",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        textColor=colors.HexColor("#111827"),
        leading=13,
    )
    item_titulo_style = ParagraphStyle(
        "PrescricaoItemTitulo",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        textColor=colors.HexColor("#111827"),
        leading=14,
        spaceAfter=1,
    )
    data_referencia = atendimento.data_atendimento if isinstance(atendimento.data_atendimento, datetime) else datetime.now()
    peso_referencia = _resolver_peso_referencia(atendimento, paciente)
    dados_pdf = {
        "paciente": {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else "",
            "raca": paciente.raca if paciente else "",
            "sexo": normalizar_sexo_paciente(paciente.sexo if paciente else ""),
            "idade": extrair_idade_paciente(
                paciente.nascimento if paciente else None,
                paciente.observacoes if paciente else None,
            ),
            "peso": f"{peso_referencia:.1f}" if peso_referencia is not None else "",
            "tutor": tutor.nome if tutor else "",
            "solicitante": atendimento.criado_por_nome or nome_veterinario or "",
            "data_exame": data_referencia.strftime("%d/%m/%Y"),
        },
        "clinica": clinica.nome if clinica else "",
    }

    orientacoes_bloco: List[str] = []
    if (prescricao.orientacoes_gerais or "").strip():
        orientacoes_bloco.append(_texto_pdf_html(prescricao.orientacoes_gerais, ""))
    if prescricao.retorno_dias:
        orientacoes_bloco.append(f"<b>Retorno sugerido:</b> {prescricao.retorno_dias} dia(s)")

    temp_files: List[str] = []
    try:
        temp_logo_path = None
        temp_assinatura_path = None
        if logomarca_bytes:
            temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_logo.write(logomarca_bytes)
            temp_logo.close()
            temp_logo_path = temp_logo.name
            temp_files.append(temp_logo_path)
        if assinatura_bytes:
            temp_assinatura = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_assinatura.write(assinatura_bytes)
            temp_assinatura.close()
            temp_assinatura_path = temp_assinatura.name
            temp_files.append(temp_assinatura_path)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            title=f"Receita - Atendimento {atendimento.id}",
        )

        story: List[Any] = []
        story.extend(
            criar_cabecalho(
                dados_pdf,
                temp_logo_path=temp_logo_path,
                titulo_principal="RECEITA VETERINARIA",
                mostrar_linha_ritmo=False,
                label_data_exame="Data",
            )
        )

        if orientacoes_bloco:
            story.append(
                _prescricao_criar_box_texto(
                    "Orientacoes gerais",
                    "<br/><br/>".join(orientacoes_bloco),
                    "#fafafa",
                    "#e5e7eb",
                )
            )
            story.append(Spacer(1, 4 * mm))

        story.append(criar_titulo_secao("ITENS PRESCRITOS"))
        if itens:
            for idx, item in enumerate(itens, start=1):
                story.append(_prescricao_criar_card_prescricao(
                    idx,
                    item.medicamento_nome or "",
                    item.dose or "",
                    item.frequencia or "",
                    item.duracao or "",
                    item.via or "",
                    item.apresentacao_selecionada or "",
                    item.instrucoes or "",
                ))
                story.append(Spacer(1, 3 * mm))
        else:
            story.append(Paragraph("Nenhum item de medicacao foi registrado.", card_texto_style))

        if nome_veterinario:
            story.extend(criar_secao_assinatura(nome_veterinario, crmv=crmv, temp_assinatura_path=temp_assinatura_path))

        def add_footer(canvas_obj, pdf_doc):
            footer_todas_paginas(canvas_obj, pdf_doc, texto_rodape)

        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        pdf = buffer.getvalue()
        buffer.close()
        return pdf
    finally:
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass


def _gerar_pdf_exames_bytes(
    atendimento: AtendimentoClinico,
    paciente: Optional[Paciente],
    tutor: Optional[Tutor],
    clinica: Optional[Clinica],
    exames: List[Exame],
    *,
    nome_veterinario: str = "",
    crmv: str = "",
    logomarca_bytes: Optional[bytes] = None,
    assinatura_bytes: Optional[bytes] = None,
    texto_rodape: Optional[str] = None,
) -> bytes:
    styles = create_pdf_styles()
    resumo_label_style = ParagraphStyle(
        "SolicitacaoResumoLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        textColor=colors.HexColor("#6b7280"),
        leading=10,
    )
    card_texto_style = ParagraphStyle(
        "SolicitacaoExameTexto",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        textColor=colors.HexColor("#111827"),
        leading=13,
    )
    exame_item_style = ParagraphStyle(
        "SolicitacaoExameItem",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=colors.HexColor("#111827"),
        leading=14,
        spaceAfter=2,
    )

    def _criar_box_texto(titulo: str, corpo_html: str, bg: str, border: str) -> Table:
        conteudo = [
            Paragraph(
                f"<font name='Helvetica-Bold' size='7' color='#6b7280'>{_pdf_escape(titulo.upper())}</font>",
                resumo_label_style,
            ),
            Spacer(1, 1.2 * mm),
            Paragraph(corpo_html, card_texto_style),
        ]
        tabela = Table([[conteudo]], colWidths=[180 * mm])
        tabela.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(border)),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        return tabela

    datas_solicitacao_validas = [
        exame.data_solicitacao
        for exame in exames
        if isinstance(exame.data_solicitacao, datetime)
    ]
    if datas_solicitacao_validas:
        data_solicitacao_ref = min(datas_solicitacao_validas)
    elif isinstance(atendimento.data_atendimento, datetime):
        data_solicitacao_ref = atendimento.data_atendimento
    else:
        data_solicitacao_ref = datetime.now()

    peso_referencia = _resolver_peso_referencia(atendimento, paciente)
    dados_pdf = {
        "paciente": {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else "",
            "raca": paciente.raca if paciente else "",
            "sexo": normalizar_sexo_paciente(paciente.sexo if paciente else ""),
            "idade": extrair_idade_paciente(
                paciente.nascimento if paciente else None,
                paciente.observacoes if paciente else None,
            ),
            "peso": f"{peso_referencia:.1f}" if peso_referencia is not None else "",
            "tutor": tutor.nome if tutor else "",
            "solicitante": atendimento.criado_por_nome or nome_veterinario or "",
            "data_exame": data_solicitacao_ref.strftime("%d/%m/%Y"),
        },
        "clinica": clinica.nome if clinica else "",
    }

    contexto_clinico = []
    if atendimento.queixa_principal:
        contexto_clinico.append(f"<b>Queixa principal:</b> {_texto_pdf_html(atendimento.queixa_principal, '')}")

    temp_files: List[str] = []
    try:
        temp_logo_path = None
        temp_assinatura_path = None
        if logomarca_bytes:
            temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_logo.write(logomarca_bytes)
            temp_logo.close()
            temp_logo_path = temp_logo.name
            temp_files.append(temp_logo_path)
        if assinatura_bytes:
            temp_assinatura = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_assinatura.write(assinatura_bytes)
            temp_assinatura.close()
            temp_assinatura_path = temp_assinatura.name
            temp_files.append(temp_assinatura_path)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            title=f"Solicitacao de exames - Atendimento {atendimento.id}",
        )

        story: List[Any] = []
        story.extend(
            criar_cabecalho(
                dados_pdf,
                temp_logo_path=temp_logo_path,
                titulo_principal="SOLICITACAO DE EXAMES",
                mostrar_linha_ritmo=False,
                label_data_exame="Data",
            )
        )

        if contexto_clinico:
            story.append(
                _criar_box_texto(
                    "Contexto clinico",
                    "<br/><br/>".join(contexto_clinico),
                    "#fafafa",
                    "#e5e7eb",
                )
            )
            story.append(Spacer(1, 4 * mm))

        story.append(criar_titulo_secao("EXAMES SOLICITADOS"))
        if exames:
            for idx, exame in enumerate(exames, start=1):
                nome_exame = (exame.tipo_exame or "").strip() or "Exame sem descricao"
                story.append(Paragraph(f"{idx}. {_pdf_escape(nome_exame)}", exame_item_style))
        else:
            story.append(Paragraph("Nenhum exame solicitado para este atendimento.", card_texto_style))

        if nome_veterinario:
            story.extend(criar_secao_assinatura(nome_veterinario, crmv=crmv, temp_assinatura_path=temp_assinatura_path))

        def add_footer(canvas_obj, pdf_doc):
            footer_todas_paginas(canvas_obj, pdf_doc, texto_rodape)

        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        pdf = buffer.getvalue()
        buffer.close()
        return pdf
    finally:
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass


def _resolver_tutor_paciente(db: Session, paciente_id: int) -> Optional[int]:
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    return paciente.tutor_id


def _resolver_especie_paciente(db: Session, paciente_id: int) -> Optional[str]:
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        return None
    return (paciente.especie or "").strip() or None


def _map_exame(exame: Exame) -> dict:
    return {
        "id": exame.id,
        "catalogo_exame_id": exame.catalogo_exame_id,
        "painel_exame_id": exame.painel_exame_id,
        "painel_exame_nome": exame.painel_exame_nome or "",
        "tipo_exame": exame.tipo_exame,
        "categoria_exame": exame.categoria_exame or "",
        "preparo": exame.preparo or "",
        "prioridade": exame.prioridade or "Rotina",
        "status": exame.status,
        "resultado": exame.resultado or "",
        "valor_referencia": exame.valor_referencia or "",
        "unidade": exame.unidade or "",
        "observacoes": exame.observacoes or "",
        "valor": exame.valor or 0,
        "laudo_id": exame.laudo_id,
        "data_solicitacao": _to_iso(exame.data_solicitacao),
        "data_resultado": _to_iso(exame.data_resultado),
    }


def _normalizar_tipo_exame_portal_externo(value: Optional[str]) -> str:
    raw = (value or "").strip()
    if not raw:
        return "Exame"
    normalizado = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    normalizado = " ".join(normalizado.lower().split())
    if normalizado in {"ecg", "eletro", "eletrocardiograma"} or "eletrocardio" in normalizado:
        return "Eletrocardiograma"
    return raw


def _normalizar_status(value: Optional[str]) -> str:
    status = (value or "").strip().lower()
    if not status:
        return ""
    normalizado = unicodedata.normalize("NFKD", status)
    normalizado = "".join(ch for ch in normalizado if not unicodedata.combining(ch))
    normalizado = normalizado.replace("\u00ad", "")
    return " ".join(normalizado.split())


def _status_exame_concluido(value: Optional[str]) -> bool:
    status = _normalizar_status(value)
    return status in {"concluido", "concluida"} or status.startswith("concluid")


def _anexo_eh_pdf(anexo: AnexoAtendimento) -> bool:
    mime = (anexo.mime_type or "").strip().lower()
    nome = (anexo.nome_original or anexo.url or anexo.caminho_arquivo or "").strip().lower()
    return mime == "application/pdf" or nome.endswith(".pdf")


def _serialize_anexo(anexo: AnexoAtendimento) -> dict:
    download_url = None
    if anexo.caminho_arquivo:
        download_url = f"/api/v1/atendimentos/anexos/{anexo.id}/arquivo"

    mime = anexo.mime_type or ""
    preview_disponivel = bool(
        download_url and (mime.startswith("image/") or mime == "application/pdf")
    )

    return {
        "id": anexo.id,
        "atendimento_id": anexo.atendimento_id,
        "exame_id": anexo.exame_id,
        "tipo": anexo.tipo,
        "descricao": anexo.descricao or "",
        "url": anexo.url,
        "nome_original": anexo.nome_original or "",
        "tamanho": anexo.tamanho,
        "mime_type": mime,
        "origem": anexo.origem or "externo",
        "download_url": download_url,
        "preview_disponivel": preview_disponivel,
        "created_at": _to_iso(anexo.created_at),
    }


def _find_existing_upload_anexo_by_dedupe_key(
    db: Session,
    *,
    atendimento_id: int,
    dedupe_key: str,
) -> Optional[AnexoAtendimento]:
    return (
        db.query(AnexoAtendimento)
        .filter(
            AnexoAtendimento.atendimento_id == atendimento_id,
            AnexoAtendimento.origem == "upload",
            AnexoAtendimento.dedupe_key == dedupe_key,
        )
        .order_by(AnexoAtendimento.id.desc())
        .first()
    )


def _parse_upload_metrics_date(value: Optional[str], param_name: str) -> Optional[date]:
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} invalido. Use o formato YYYY-MM-DD.",
        ) from exc


def _require_admin_cleanup_access(current_user: User) -> None:
    if not current_user.tem_papel("admin"):
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas administradores podem executar cleanup de metricas.",
        )


def _registrar_upload_dedupe_metrica(
    db: Session,
    *,
    atendimento: AtendimentoClinico,
    evento: str,
    dedupe_key: Optional[str] = None,
) -> None:
    if evento not in UPLOAD_DEDUPE_EVENTS_VALIDOS:
        return
    if not isinstance(db, Session):
        return
    try:
        db.add(
            UploadDedupeMetrica(
                atendimento_id=atendimento.id,
                clinica_id=atendimento.clinica_id,
                evento=evento,
                dedupe_key=(dedupe_key or "").strip()[:120] or None,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Falha ao registrar metrica de upload dedupe (atendimento_id=%s, clinica_id=%s, evento=%s)",
            atendimento.id,
            atendimento.clinica_id,
            evento,
        )


def _map_prescricao_item(item: PrescricaoItem) -> dict:
    return {
        "id": item.id,
        "medicamento_id": item.medicamento_id,
        "medicamento_nome": item.medicamento_nome,
        "apresentacao_selecionada": item.apresentacao_selecionada or "",
        "dose": item.dose or "",
        "frequencia": item.frequencia or "",
        "duracao": item.duracao or "",
        "via": item.via or "",
        "instrucoes": item.instrucoes or "",
        "ordem": item.ordem or 0,
    }


def _obter_nome_medicamento(
    db: Session,
    medicamento_id: Optional[int],
    medicamento_nome: Optional[str],
) -> str:
    nome_limpo = (medicamento_nome or "").strip()
    if nome_limpo:
        return nome_limpo
    if medicamento_id:
        medicamento = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
        if medicamento:
            return medicamento.nome
    raise HTTPException(status_code=422, detail="Informe o nome do medicamento.")


def _sync_exames(
    db: Session,
    atendimento: AtendimentoClinico,
    exames_payload: List[ExameSolicitacaoPayload],
    current_user: User,
) -> None:
    existentes = {
        exame.id: exame
        for exame in db.query(Exame).filter(Exame.atendimento_id == atendimento.id).all()
    }
    recebidos_ids: set[int] = set()

    for payload in exames_payload:
        exame = None
        if payload.id and payload.id in existentes:
            exame = existentes[payload.id]
            recebidos_ids.add(payload.id)

        if exame is None:
            exame = Exame(
                atendimento_id=atendimento.id,
                paciente_id=atendimento.paciente_id,
                criado_por_id=current_user.id,
                criado_por_nome=current_user.nome,
            )
            db.add(exame)

        catalogo_exame = None
        if payload.catalogo_exame_id:
            catalogo_exame = db.query(CatalogoExame).filter(CatalogoExame.id == payload.catalogo_exame_id).first()

        painel_exame = None
        if payload.painel_exame_id:
            painel_exame = db.query(PainelExame).filter(PainelExame.id == payload.painel_exame_id).first()

        exame.atendimento_id = atendimento.id
        exame.paciente_id = atendimento.paciente_id
        exame.catalogo_exame_id = catalogo_exame.id if catalogo_exame else None
        exame.painel_exame_id = painel_exame.id if painel_exame else None
        exame.painel_exame_nome = (
            (payload.painel_exame_nome or "").strip()
            or (painel_exame.nome if painel_exame else "")
            or None
        )
        exame.tipo_exame = (
            (payload.tipo_exame or "").strip()
            or (catalogo_exame.nome if catalogo_exame else "").strip()
        )
        exame.categoria_exame = (
            (payload.categoria_exame or "").strip()
            or (catalogo_exame.categoria if catalogo_exame else "")
            or None
        )
        exame.preparo = (
            (payload.preparo or "").strip()
            or (catalogo_exame.preparo if catalogo_exame else "")
            or None
        )
        exame.prioridade = (payload.prioridade or "Rotina").strip() or "Rotina"
        exame.status = (payload.status or "Solicitado").strip() or "Solicitado"
        exame.resultado = (payload.resultado or "").strip() or None
        exame.valor_referencia = (payload.valor_referencia or "").strip() or None
        exame.unidade = (payload.unidade or "").strip() or None
        exame.observacoes = (
            (payload.observacoes or "").strip()
            or (catalogo_exame.observacoes_padrao if catalogo_exame else "")
            or ""
        )
        exame.valor = payload.valor if payload.valor not in (None, "") else (catalogo_exame.valor_padrao if catalogo_exame else 0)
        exame.laudo_id = payload.laudo_id
        exame.data_solicitacao = exame.data_solicitacao or datetime.now()
        exame.data_resultado = _parse_datetime(payload.data_resultado) if payload.data_resultado else exame.data_resultado
        if _status_exame_concluido(exame.status) and exame.data_resultado is None:
            exame.data_resultado = datetime.now()

    for exame_id, exame in existentes.items():
        if exame_id not in recebidos_ids:
            _excluir_anexos_por_exame(db, exame.id)
            db.delete(exame)


def _sync_prescricao(
    db: Session,
    atendimento: AtendimentoClinico,
    prescricao_payload: Optional[PrescricaoPayload],
    current_user: User,
) -> Optional[PrescricaoClinica]:
    if prescricao_payload is None:
        return db.query(PrescricaoClinica).filter(PrescricaoClinica.atendimento_id == atendimento.id).first()

    prescricao = db.query(PrescricaoClinica).filter(PrescricaoClinica.atendimento_id == atendimento.id).first()
    if prescricao is None:
        prescricao = PrescricaoClinica(atendimento_id=atendimento.id)
        db.add(prescricao)
        db.flush()

    prescricao.orientacoes_gerais = prescricao_payload.orientacoes_gerais or ""
    prescricao.retorno_dias = prescricao_payload.retorno_dias
    prescricao.updated_at = datetime.now()

    itens_existentes = {
        item.id: item
        for item in db.query(PrescricaoItem).filter(PrescricaoItem.prescricao_id == prescricao.id).all()
    }
    itens_recebidos_ids: set[int] = set()

    for index, item_payload in enumerate(prescricao_payload.itens):
        item = None
        if item_payload.id and item_payload.id in itens_existentes:
            item = itens_existentes[item_payload.id]
            itens_recebidos_ids.add(item_payload.id)

        if item is None:
            item = PrescricaoItem(prescricao_id=prescricao.id)
            db.add(item)

        previous_values = {
            "medicamento_nome": item.medicamento_nome,
            "apresentacao_selecionada": item.apresentacao_selecionada,
            "dose": item.dose,
            "frequencia": item.frequencia,
            "duracao": item.duracao,
            "via": item.via,
            "instrucoes": item.instrucoes,
        }
        item.prescricao_id = prescricao.id
        item.medicamento_id = item_payload.medicamento_id
        item.medicamento_nome = _obter_nome_medicamento(
            db,
            item_payload.medicamento_id,
            item_payload.medicamento_nome,
        )
        item.apresentacao_selecionada = item_payload.apresentacao_selecionada or ""
        item.dose = item_payload.dose or ""
        item.frequencia = item_payload.frequencia or ""
        item.duracao = item_payload.duracao or ""
        item.via = item_payload.via or ""
        item.instrucoes = item_payload.instrucoes or ""
        item.ordem = item_payload.ordem if item_payload.ordem is not None else index
        item.updated_at = datetime.now()

        if item_payload.id and item.id:
            for field_name, previous in previous_values.items():
                _registrar_ajuste_prescricao(
                    db,
                    item=item,
                    atendimento_id=atendimento.id,
                    campo=field_name,
                    valor_anterior=previous,
                    valor_novo=getattr(item, field_name),
                    current_user=current_user,
                )

    for item_id, item in itens_existentes.items():
        if item_id not in itens_recebidos_ids:
            db.delete(item)

    return prescricao


def _montar_detalhe_atendimento(
    db: Session,
    atendimento: AtendimentoClinico,
) -> dict:
    paciente = db.query(Paciente).filter(Paciente.id == atendimento.paciente_id).first()
    tutor = None
    if atendimento.tutor_id:
        tutor = db.query(Tutor).filter(Tutor.id == atendimento.tutor_id).first()
    clinica = None
    if atendimento.clinica_id:
        clinica = db.query(Clinica).filter(Clinica.id == atendimento.clinica_id).first()

    exames = (
        db.query(Exame)
        .filter(Exame.atendimento_id == atendimento.id)
        .order_by(Exame.id.asc())
        .all()
    )

    prescricao = (
        db.query(PrescricaoClinica)
        .filter(PrescricaoClinica.atendimento_id == atendimento.id)
        .first()
    )
    prescricao_dict = None
    if prescricao:
        itens = (
            db.query(PrescricaoItem)
            .filter(PrescricaoItem.prescricao_id == prescricao.id)
            .order_by(PrescricaoItem.ordem.asc(), PrescricaoItem.id.asc())
            .all()
        )
        historico_por_item = _map_ajustes_por_item(db, [item.id for item in itens if item.id])
        medicamentos_ids = [item.medicamento_id for item in itens if item.medicamento_id]
        medicamentos = (
            db.query(Medicamento)
            .filter(Medicamento.id.in_(medicamentos_ids))
            .all()
            if medicamentos_ids
            else []
        )
        medicamentos_map = {med.id: _serialize_medicamento(med) for med in medicamentos}
        itens_dict = []
        for item in itens:
            mapped_item = _map_prescricao_item(item)
            mapped_item["historico_ajustes"] = historico_por_item.get(item.id, [])
            itens_dict.append(mapped_item)

        peso_referencia = _resolver_peso_referencia(atendimento, paciente)
        apoio_prescricao = analyze_prescription_items(
            peso_kg=peso_referencia,
            medicamentos=medicamentos_map,
            itens=itens_dict,
        )
        prescricao_dict = {
            "id": prescricao.id,
            "orientacoes_gerais": prescricao.orientacoes_gerais or "",
            "retorno_dias": prescricao.retorno_dias,
            "peso_referencia_kg": peso_referencia,
            "itens": itens_dict,
            "apoio_clinico": apoio_prescricao,
        }

    # Buscar evoluÃ§Ãµes
    evolucoes = (
        db.query(EvolucaoClinica)
        .filter(EvolucaoClinica.atendimento_id == atendimento.id)
        .order_by(EvolucaoClinica.data_evolucao.desc())
        .all()
    )

    # Buscar anexos
    anexos = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.atendimento_id == atendimento.id)
        .order_by(AnexoAtendimento.created_at.desc())
        .all()
    )
    anexos_por_exame: Dict[int, List[dict]] = defaultdict(list)
    for anexo in anexos:
        if anexo.exame_id:
            anexos_por_exame[anexo.exame_id].append(_serialize_anexo(anexo))

    documentos = (
        db.query(DocumentoAtendimento)
        .filter(DocumentoAtendimento.atendimento_id == atendimento.id)
        .order_by(DocumentoAtendimento.updated_at.desc(), DocumentoAtendimento.created_at.desc(), DocumentoAtendimento.id.desc())
        .all()
    )

    return {
        "id": atendimento.id,
        "paciente_id": atendimento.paciente_id,
        "tutor_id": atendimento.tutor_id,
        "clinica_id": atendimento.clinica_id,
        "agendamento_id": atendimento.agendamento_id,
        "veterinario_id": atendimento.veterinario_id,
        "especie": atendimento.especie or "",
        "data_atendimento": _to_iso(atendimento.data_atendimento),
        "status": atendimento.status,
        # Triagem
        "triagem": {
            "peso": atendimento.peso,
            "temperatura": atendimento.temperatura,
            "frequencia_cardiaca": atendimento.frequencia_cardiaca,
            "frequencia_respiratoria": atendimento.frequencia_respiratoria,
            "pressao_arterial": atendimento.pressao_arterial or "",
            "saturacao_oxigenio": atendimento.saturacao_oxigenio,
            "escore_condicion_corpo": atendimento.escore_condicion_corpo,
            "mucosas": atendimento.mucosas or "",
            "hidratacao": atendimento.hidratacao or "",
            "triagem_observacoes": atendimento.triagem_observacoes or "",
        },
        "triagem_concluida": atendimento.triagem_concluida or 0,
        "consulta_concluida": atendimento.consulta_concluida or 0,
        # Consulta
        "queixa_principal": atendimento.queixa_principal or "",
        "anamnese": atendimento.anamnese or "",
        "exame_fisico": atendimento.exame_fisico or "",
        "dados_clinicos": atendimento.dados_clinicos or "",
        # DiagnÃ³sticos
        "diagnostico_principal": atendimento.diagnostico_principal or "",
        "diagnostico_secundario": atendimento.diagnostico_secundario or "",
        "diagnostico_diferencial": atendimento.diagnostico_diferencial or "",
        "diagnostico": atendimento.diagnostico_principal or "",  # Compatibilidade
        "prognostico": atendimento.prognostico or "",
        # Tratamento
        "plano_terapeutico": atendimento.plano_terapeutico or "",
        # Retorno
        "retorno_recomendado": atendimento.retorno_recomendado or "",
        "motivo_retorno": atendimento.motivo_retorno or "",
        "observacoes": atendimento.observacoes or "",
        # Metadados
        "created_at": _to_iso(atendimento.created_at),
        "updated_at": _to_iso(atendimento.updated_at),
        "criado_por_id": atendimento.criado_por_id,
        "criado_por_nome": atendimento.criado_por_nome,
        # Relacionamentos
        "paciente_nome": paciente.nome if paciente else "",
        "tutor_nome": tutor.nome if tutor else "",
        "clinica_nome": clinica.nome if clinica else "",
        "peso_referencia_kg": _resolver_peso_referencia(atendimento, paciente),
        # Extras
        "exames": [
            {
                **_map_exame(exame),
                "anexos_resultado": anexos_por_exame.get(exame.id, []),
            }
            for exame in exames
        ],
        "prescricao": prescricao_dict,
        "evolucoes": [
            {
                "id": e.id,
                "data_evolucao": _to_iso(e.data_evolucao),
                "descricao": e.descricao,
                "sinais_vitais": e.sinais_vitais or "",
                "responsavel_nome": e.responsavel_nome or "",
            }
            for e in evolucoes
        ],
        "anexos": [_serialize_anexo(a) for a in anexos],
        "documentos": [serializar_documento_atendimento_service(documento) for documento in documentos],
    }


@router.get("")
def listar_atendimentos(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    paciente_id: Optional[int] = None,
    clinica_id: Optional[int] = None,
    agendamento_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = (
        db.query(
            AtendimentoClinico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
        )
        .outerjoin(Paciente, AtendimentoClinico.paciente_id == Paciente.id)
        .outerjoin(Tutor, AtendimentoClinico.tutor_id == Tutor.id)
        .outerjoin(Clinica, AtendimentoClinico.clinica_id == Clinica.id)
    )

    dt_inicio = _parse_datetime(data_inicio)
    dt_fim = _parse_datetime(data_fim)
    if dt_inicio:
        query = query.filter(AtendimentoClinico.data_atendimento >= dt_inicio)
    if dt_fim:
        query = query.filter(AtendimentoClinico.data_atendimento < dt_fim + timedelta(days=1))
    if paciente_id:
        query = query.filter(AtendimentoClinico.paciente_id == paciente_id)
    if clinica_id:
        query = query.filter(AtendimentoClinico.clinica_id == clinica_id)
    if agendamento_id:
        query = query.filter(AtendimentoClinico.agendamento_id == agendamento_id)
    if status:
        query = query.filter(AtendimentoClinico.status == status)
    if search:
        termo = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Paciente.nome.ilike(termo),
                Tutor.nome.ilike(termo),
                Clinica.nome.ilike(termo),
                AtendimentoClinico.diagnostico_principal.ilike(termo),
                AtendimentoClinico.diagnostico_secundario.ilike(termo),
                AtendimentoClinico.diagnostico_diferencial.ilike(termo),
                AtendimentoClinico.queixa_principal.ilike(termo),
            )
        )

    total = query.count()
    rows = (
        query.order_by(
            AtendimentoClinico.data_atendimento.desc(),
            AtendimentoClinico.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    atendimento_ids = [atendimento.id for atendimento, *_ in rows]
    exames_por_atendimento: Dict[int, int] = {}
    prescricoes_atendimento_ids = set()
    if atendimento_ids:
        exames_por_atendimento = {
            int(atendimento_id): int(total_exames)
            for atendimento_id, total_exames in (
                db.query(
                    Exame.atendimento_id,
                    func.count(Exame.id),
                )
                .filter(Exame.atendimento_id.in_(atendimento_ids))
                .group_by(Exame.atendimento_id)
                .all()
            )
            if atendimento_id is not None
        }
        prescricoes_atendimento_ids = {
            int(atendimento_id)
            for atendimento_id, in (
                db.query(PrescricaoClinica.atendimento_id)
                .filter(PrescricaoClinica.atendimento_id.in_(atendimento_ids))
                .distinct()
                .all()
            )
            if atendimento_id is not None
        }

    items = []
    for atendimento, paciente_nome, tutor_nome, clinica_nome in rows:
        total_exames = exames_por_atendimento.get(atendimento.id, 0)
        prescricao_existe = atendimento.id in prescricoes_atendimento_ids
        items.append(
            {
                "id": atendimento.id,
                "paciente_id": atendimento.paciente_id,
                "especie": atendimento.especie or "",
                "clinica_id": atendimento.clinica_id,
                "agendamento_id": atendimento.agendamento_id,
                "data_atendimento": _to_iso(atendimento.data_atendimento),
                "status": atendimento.status,
                "queixa_principal": atendimento.queixa_principal or "",
                "diagnostico": atendimento.diagnostico_principal or "",
                "paciente_nome": paciente_nome or "",
                "tutor_nome": tutor_nome or "",
                "clinica_nome": clinica_nome or "",
                "total_exames": total_exames,
                "tem_prescricao": prescricao_existe,
                "created_at": _to_iso(atendimento.created_at),
            }
        )

    return {"total": total, "items": items}


@router.get("/exames/catalogo")
def listar_catalogo_exames_atendimento(
    search: Optional[str] = None,
    categoria: Optional[str] = None,
    ativos: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return montar_contexto_catalogo_exames(
        db,
        search=search,
        categoria=categoria,
        ativos=ativos,
    )


@router.get("/paineis")
def listar_paineis_customizados_atendimento(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    paineis = (
        db.query(PainelExame)
        .filter(PainelExame.ativo == 1, PainelExame.codigo.like(f"{CUSTOM_PAINEL_EXAME_PREFIX}%"))
        .order_by(PainelExame.categoria.asc(), PainelExame.nome.asc())
        .all()
    )
    return [serializar_painel_exame_com_itens(db, painel) for painel in paineis]


@router.post("/paineis", status_code=status.HTTP_201_CREATED)
def criar_painel_customizado_atendimento(
    payload: PainelExamePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    nome = (payload.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=422, detail="Nome do painel e obrigatorio.")

    ordered_exam_ids = resolver_ids_catalogo_exames(db, payload)
    codigo = gerar_codigo_unico_painel_exame(db, nome)
    now = datetime.now()

    painel = PainelExame(
        codigo=codigo,
        nome=nome,
        categoria=(payload.categoria or "").strip(),
        especie_alvo=(payload.especie_alvo or "").strip(),
        observacoes=(payload.observacoes or "").strip(),
        ativo=1 if payload.ativo is None else int(payload.ativo),
        created_at=now,
        updated_at=now,
    )
    db.add(painel)
    db.flush()
    substituir_itens_painel_exame(db, painel.id, ordered_exam_ids)
    db.commit()
    db.refresh(painel)
    return serializar_painel_exame_com_itens(db, painel)


@router.put("/paineis/{painel_id}")
def atualizar_painel_customizado_atendimento(
    painel_id: int,
    payload: PainelExamePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    painel = obter_painel_exame_customizado(db, painel_id)
    nome = (payload.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=422, detail="Nome do painel e obrigatorio.")

    ordered_exam_ids = resolver_ids_catalogo_exames(db, payload)
    painel.codigo = gerar_codigo_unico_painel_exame(db, nome, ignore_id=painel.id)
    painel.nome = nome
    painel.categoria = (payload.categoria or "").strip()
    painel.especie_alvo = (payload.especie_alvo or "").strip()
    painel.observacoes = (payload.observacoes or "").strip()
    painel.ativo = 1 if payload.ativo is None else int(payload.ativo)
    painel.updated_at = datetime.now()

    substituir_itens_painel_exame(db, painel.id, ordered_exam_ids)
    db.commit()
    db.refresh(painel)
    return serializar_painel_exame_com_itens(db, painel)


@router.delete("/paineis/{painel_id}")
def excluir_painel_customizado_atendimento(
    painel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    painel = obter_painel_exame_customizado(db, painel_id)
    painel.ativo = 0
    painel.updated_at = datetime.now()
    db.commit()
    return {"message": "Painel removido com sucesso.", "id": painel_id}


@router.get("/frases-clinicas")
def listar_frases_clinicas_atendimento(
    secao: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive: int = 0,
    limit: int = Query(default=500, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return montar_contexto_frases_clinicas(
        db,
        secao=(secao or "").strip() or None,
        search=(search or "").strip() or None,
        include_inactive=bool(include_inactive),
        limit=limit,
    )


@router.post("/frases-clinicas", status_code=status.HTTP_201_CREATED)
def criar_frase_clinica_atendimento(
    payload: ClinicalPhrasePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return criar_frase_clinica(db, payload, created_by=current_user.id)


@router.put("/frases-clinicas/{phrase_id}")
def atualizar_frase_clinica_atendimento(
    phrase_id: int,
    payload: ClinicalPhrasePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return atualizar_frase_clinica(db, phrase_id, payload)


@router.delete("/frases-clinicas/{phrase_id}")
def desativar_frase_clinica_atendimento(
    phrase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return desativar_frase_clinica(db, phrase_id)


@router.post("/frases-clinicas/{phrase_id}/restaurar")
def restaurar_frase_clinica_atendimento(
    phrase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return restaurar_frase_clinica(db, phrase_id)


@router.get("/documentos/templates")
def listar_templates_documentos_atendimento(
    include_inactive: int = 0,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return listar_templates_documento(
        db,
        include_inactive=include_inactive,
        search=search,
    )


@router.post("/documentos/templates", status_code=status.HTTP_201_CREATED)
def criar_template_documento_atendimento(
    payload: DocumentoTemplatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return criar_template_documento(
        db,
        payload,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
    )


@router.put("/documentos/templates/{template_id}")
def atualizar_template_documento_atendimento(
    template_id: int,
    payload: DocumentoTemplatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return atualizar_template_documento(db, template_id, payload)


@router.delete("/documentos/templates/{template_id}")
def desativar_template_documento_atendimento(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return desativar_template_documento(db, template_id)


@router.post("/documentos/templates/{template_id}/restaurar")
def restaurar_template_documento_atendimento(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return restaurar_template_documento(db, template_id)


@router.get("/{atendimento_id}/documentos")
def listar_documentos_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    return listar_documentos_atendimento_service(db, atendimento_id)


@router.post("/{atendimento_id}/documentos", status_code=status.HTTP_201_CREATED)
def criar_documento_atendimento(
    atendimento_id: int,
    payload: DocumentoAtendimentoCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    paciente, tutor, clinica = carregar_contexto_entidades_documento_service(db, atendimento)
    branding = _obter_branding_pdf_documento(db, current_user)
    contexto = montar_contexto_template_documento_service(atendimento, paciente, tutor, clinica, branding)

    template = None
    titulo_base = ""
    corpo_base = ""
    if payload.template_id:
        template = obter_template_documento_ou_404(db, payload.template_id)
        if template.ativo != 1:
            raise HTTPException(status_code=422, detail="Template inativo nao pode gerar novo documento.")
        titulo_base = renderizar_template_documento_service(template.titulo_padrao or "", contexto)
        corpo_base = renderizar_template_documento_service(template.corpo_template or "", contexto)

    titulo = (payload.titulo or "").strip() or titulo_base
    corpo = (payload.corpo or "").strip() or corpo_base
    if not titulo or not corpo:
        raise HTTPException(status_code=422, detail="Informe um template ativo ou preencha titulo e corpo do documento.")

    documento = DocumentoAtendimento(
        atendimento_id=atendimento.id,
        template_id=template.id if template else None,
        titulo=titulo,
        corpo=corpo,
        status="rascunho",
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(documento)
    atendimento.updated_at = datetime.now()
    db.commit()
    db.refresh(documento)
    return serializar_documento_atendimento_service(documento)


@router.put("/{atendimento_id}/documentos/{documento_id}")
def atualizar_documento_atendimento(
    atendimento_id: int,
    documento_id: int,
    payload: DocumentoAtendimentoUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    return atualizar_documento_atendimento_service(
        db,
        atendimento,
        atendimento_id,
        documento_id,
        payload,
    )


@router.delete("/{atendimento_id}/documentos/{documento_id}")
def excluir_documento_atendimento(
    atendimento_id: int,
    documento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return excluir_documento_atendimento_service(db, atendimento_id, documento_id)


@router.get("/contexto")
def obter_contexto_agendamento(
    agendamento_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")

    paciente = db.query(Paciente).filter(Paciente.id == agendamento.paciente_id).first() if agendamento.paciente_id else None
    tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first() if paciente and paciente.tutor_id else None
    clinica = db.query(Clinica).filter(Clinica.id == agendamento.clinica_id).first() if agendamento.clinica_id else None

    return {
        "agendamento_id": agendamento.id,
        "paciente_id": agendamento.paciente_id,
        "especie": (paciente.especie or "").strip() if paciente else "",
        "paciente_nome": paciente.nome if paciente else (agendamento.paciente or ""),
        "tutor_id": tutor.id if tutor else None,
        "tutor_nome": tutor.nome if tutor else (agendamento.tutor or ""),
        "clinica_id": agendamento.clinica_id,
        "clinica_nome": clinica.nome if clinica else (agendamento.clinica or ""),
        "inicio": _to_iso(agendamento.inicio),
        "status": agendamento.status,
    }


@router.get("/{atendimento_id}")
def obter_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    return _montar_detalhe_atendimento(db, atendimento)


@router.get("/{atendimento_id}/prescricao/pdf")
def gerar_pdf_prescricao(
    atendimento_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    current_user = _autenticar_usuario_pdf(request, db)
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    paciente = db.query(Paciente).filter(Paciente.id == atendimento.paciente_id).first()
    tutor = db.query(Tutor).filter(Tutor.id == atendimento.tutor_id).first() if atendimento.tutor_id else None
    clinica = db.query(Clinica).filter(Clinica.id == atendimento.clinica_id).first() if atendimento.clinica_id else None
    prescricao = (
        db.query(PrescricaoClinica)
        .filter(PrescricaoClinica.atendimento_id == atendimento.id)
        .first()
    )
    if not prescricao:
        raise HTTPException(status_code=404, detail="Prescricao nao encontrada para este atendimento.")

    itens = (
        db.query(PrescricaoItem)
        .filter(PrescricaoItem.prescricao_id == prescricao.id)
        .order_by(PrescricaoItem.ordem.asc(), PrescricaoItem.id.asc())
        .all()
    )
    if not itens:
        raise HTTPException(status_code=404, detail="Prescricao sem itens para gerar PDF.")

    branding = _obter_branding_pdf_documento(db, current_user)
    pdf_bytes = _gerar_pdf_prescricao_bytes(
        atendimento,
        paciente,
        tutor,
        clinica,
        prescricao,
        itens,
        nome_veterinario=branding["nome_veterinario"],
        crmv=branding["crmv"],
        logomarca_bytes=branding["logomarca_bytes"],
        assinatura_bytes=branding["assinatura_bytes"],
        texto_rodape=branding["texto_rodape"],
    )
    paciente_nome = _nome_arquivo_limpo(paciente.nome if paciente else "", f"paciente_{atendimento.paciente_id}")
    filename = f"receita_atendimento_{atendimento.id}_{paciente_nome}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _gerar_pdf_prescricao_preview_bytes(
    dados: PrescricaoPreviewPayload,
    *,
    logomarca_bytes: Optional[bytes] = None,
) -> bytes:
    """Gera PDF da prescricao a partir de dados dict (sem modelo SQLAlchemy).
    Usa a mesma estrutura e helpers do PDF final para garantir visual consistente."""
    # Montar dados_pdf no mesmo formato usado pelo PDF final
    data_exame = dados.data_atendimento or ""
    peso_str = f"{dados.paciente_peso:.1f}" if dados.paciente_peso else ""

    dados_pdf = {
        "paciente": {
            "nome": dados.paciente_nome or "N/A",
            "especie": dados.paciente_especie or "",
            "raca": dados.paciente_raca or "",
            "sexo": dados.paciente_sexo or "",
            "idade": dados.paciente_idade or "",
            "peso": peso_str,
            "tutor": dados.tutor_nome or "",
            "solicitante": dados.veterinario_nome or "",
            "data_exame": data_exame,
        },
        "clinica": "",
    }

    # Orientacoes (mesmo formato do PDF final)
    orientacoes_bloco: List[str] = []
    if (dados.orientacoes_gerais or "").strip():
        orientacoes_bloco.append(_texto_pdf_html(dados.orientacoes_gerais, ""))
    if dados.retorno_dias:
        orientacoes_bloco.append(f"<b>Retorno sugerido:</b> {dados.retorno_dias} dia(s)")

    # Criar temp file para logo (mesmo padrao do PDF final)
    temp_files: List[str] = []
    temp_logo_path = None
    if logomarca_bytes:
        temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        temp_logo.write(logomarca_bytes)
        temp_logo.close()
        temp_logo_path = temp_logo.name
        temp_files.append(temp_logo_path)

    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            title=f"Receita - {dados.paciente_nome or 'Preview'}",
        )

        story: List[Any] = []

        # Cabecalho padrao com logo (mesmo do PDF final)
        story.extend(
            criar_cabecalho(
                dados_pdf,
                temp_logo_path=temp_logo_path,
                titulo_principal="RECEITA VETERINARIA",
                mostrar_linha_ritmo=False,
                label_data_exame="Data",
            )
        )

        # Orientacoes antes dos itens (mesma posicao do PDF final)
        if orientacoes_bloco:
            story.append(
                _prescricao_criar_box_texto(
                    "Orientacoes gerais",
                    "<br/><br/>".join(orientacoes_bloco),
                    "#fafafa",
                    "#e5e7eb",
                )
            )
            story.append(Spacer(1, 4 * mm))

        # Titulo da secao de itens (fundo preto, mesma estrutura do PDF final)
        story.append(criar_titulo_secao("ITENS PRESCRITOS"))

        if dados.itens:
            for idx, item in enumerate(dados.itens, start=1):
                story.append(_prescricao_criar_card_prescricao(
                    idx,
                    item.medicamento_nome or "",
                    item.dose or "",
                    item.frequencia or "",
                    item.duracao or "",
                    item.via or "",
                    item.apresentacao_selecionada or "",
                    item.instrucoes or "",
                ))
                story.append(Spacer(1, 3 * mm))
        else:
            styles = create_pdf_styles()
            story.append(Paragraph("Nenhum item de medicacao foi registrado.", styles["Normal"]))

        doc.build(story)
        return buffer.getvalue()
    finally:
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except OSError:
                pass


@router.post("/prescricao/preview")
def preview_pdf_prescricao(
    payload: PrescricaoPreviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera preview da prescricao em PDF (nao salva no banco)."""
    if not payload.itens:
        raise HTTPException(status_code=400, detail="Adicione pelo menos um item para gerar o preview.")

    # Filter out empty items
    itens_validos = [i for i in payload.itens if (i.medicamento_nome or "").strip()]
    if not itens_validos:
        raise HTTPException(status_code=400, detail="Adicione pelo menos um medicamento para gerar o preview.")

    branding = _obter_branding_pdf_documento(db, current_user)
    import base64
    pdf_bytes = _gerar_pdf_prescricao_preview_bytes(
        payload,
        logomarca_bytes=branding.get("logomarca_bytes"),
    )
    return {"pdf_base64": base64.b64encode(pdf_bytes).decode()}


@router.get("/{atendimento_id}/exames/pdf")
def gerar_pdf_solicitacao_exames(
    atendimento_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    current_user = _autenticar_usuario_pdf(request, db)
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    paciente = db.query(Paciente).filter(Paciente.id == atendimento.paciente_id).first()
    tutor = db.query(Tutor).filter(Tutor.id == atendimento.tutor_id).first() if atendimento.tutor_id else None
    clinica = db.query(Clinica).filter(Clinica.id == atendimento.clinica_id).first() if atendimento.clinica_id else None
    exames = (
        db.query(Exame)
        .filter(Exame.atendimento_id == atendimento.id)
        .order_by(Exame.id.asc())
        .all()
    )
    if not exames:
        raise HTTPException(status_code=404, detail="Nao ha exames para este atendimento.")

    branding = _obter_branding_pdf_documento(db, current_user)
    pdf_bytes = _gerar_pdf_exames_bytes(
        atendimento,
        paciente,
        tutor,
        clinica,
        exames,
        nome_veterinario=branding["nome_veterinario"],
        crmv=branding["crmv"],
        logomarca_bytes=branding["logomarca_bytes"],
        assinatura_bytes=branding["assinatura_bytes"],
        texto_rodape=branding["texto_rodape"],
    )
    paciente_nome = _nome_arquivo_limpo(paciente.nome if paciente else "", f"paciente_{atendimento.paciente_id}")
    filename = f"solicitacao_exames_atendimento_{atendimento.id}_{paciente_nome}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{atendimento_id}/documentos/{documento_id}/pdf")
def gerar_pdf_documento_atendimento(
    atendimento_id: int,
    documento_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    current_user = _autenticar_usuario_pdf(request, db)
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    branding = _obter_branding_pdf_documento(db, current_user)
    documento = obter_documento_atendimento_ou_404_service(db, atendimento_id, documento_id)
    paciente, tutor, clinica = atualizar_documento_template_se_contexto_mudou_service(
        db,
        atendimento,
        documento,
        branding,
    )
    pdf_bytes = _gerar_pdf_documento_atendimento_bytes(
        atendimento,
        paciente,
        tutor,
        clinica,
        documento,
        nome_veterinario=branding["nome_veterinario"],
        crmv=branding["crmv"],
        logomarca_bytes=branding["logomarca_bytes"],
        assinatura_bytes=branding["assinatura_bytes"],
        texto_rodape=branding["texto_rodape"],
    )

    documento.status = "emitido"
    documento.emitido_at = datetime.now()
    documento.updated_at = datetime.now()
    db.commit()

    paciente_nome = _nome_arquivo_limpo(paciente.nome if paciente else "", f"paciente_{atendimento.paciente_id}")
    titulo = _nome_arquivo_limpo(documento.titulo or "", f"documento_{documento.id}")
    filename = f"{titulo}_atendimento_{atendimento.id}_{paciente_nome}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def criar_atendimento(
    payload: AtendimentoCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data_atendimento = _parse_datetime(payload.data_atendimento) or datetime.now()
    tutor_id = _resolver_tutor_paciente(db, payload.paciente_id)
    especie = _resolver_especie_paciente(db, payload.paciente_id)

    # Extrair dados de triagem
    triagem = payload.triagem
    diagnostico = _normalizar_diagnostico(payload.diagnostico)

    atendimento = AtendimentoClinico(
        paciente_id=payload.paciente_id,
        tutor_id=tutor_id,
        clinica_id=payload.clinica_id,
        agendamento_id=payload.agendamento_id,
        veterinario_id=current_user.id,
        especie=especie,
        data_atendimento=data_atendimento,
        status=payload.status or "Triagem",
        # Triagem
        peso=triagem.peso if triagem else None,
        temperatura=triagem.temperatura if triagem else None,
        frequencia_cardiaca=triagem.frequencia_cardiaca if triagem else None,
        frequencia_respiratoria=triagem.frequencia_respiratoria if triagem else None,
        pressao_arterial=triagem.pressao_arterial if triagem else None,
        saturacao_oxigenio=triagem.saturacao_oxigenio if triagem else None,
        escore_condicion_corpo=triagem.escore_condicion_corpo if triagem else None,
        mucosas=triagem.mucosas if triagem else None,
        hidratacao=triagem.hidratacao if triagem else None,
        triagem_observacoes=triagem.triagem_observacoes if triagem else None,
        triagem_concluida=1 if triagem else 0,
        # Consulta
        queixa_principal=payload.queixa_principal or "",
        anamnese=payload.anamnese or "",
        exame_fisico=payload.exame_fisico or "",
        dados_clinicos=payload.dados_clinicos or "",
        # DiagnÃ³sticos
        diagnostico_principal=diagnostico["diagnostico_principal"] or "",
        diagnostico_secundario=diagnostico["diagnostico_secundario"] or "",
        diagnostico_diferencial=diagnostico["diagnostico_diferencial"] or "",
        prognostico=diagnostico["prognostico"],
        # Tratamento
        plano_terapeutico=payload.plano_terapeutico or "",
        # Retorno
        retorno_recomendado=payload.retorno_recomendado or "",
        motivo_retorno=payload.motivo_retorno or "",
        observacoes=payload.observacoes or "",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
    )
    db.add(atendimento)
    db.flush()

    _sync_exames(db, atendimento, payload.exames, current_user)
    _sync_prescricao(db, atendimento, payload.prescricao, current_user)

    db.commit()
    db.refresh(atendimento)
    return _montar_detalhe_atendimento(db, atendimento)


@router.put("/{atendimento_id}")
def atualizar_atendimento(
    atendimento_id: int,
    payload: AtendimentoUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    data = payload.model_dump(exclude_unset=True, exclude={"triagem", "diagnostico"})

    if "paciente_id" in data and data["paciente_id"] is not None:
        atendimento.paciente_id = data["paciente_id"]
        atendimento.tutor_id = _resolver_tutor_paciente(db, atendimento.paciente_id)
        atendimento.especie = _resolver_especie_paciente(db, atendimento.paciente_id)

    if "clinica_id" in data:
        atendimento.clinica_id = data["clinica_id"]
    if "agendamento_id" in data:
        atendimento.agendamento_id = data["agendamento_id"]
    if "status" in data and data["status"] is not None:
        atendimento.status = data["status"]

    if "data_atendimento" in data:
        atendimento.data_atendimento = _parse_datetime(data["data_atendimento"]) or atendimento.data_atendimento

    # Triagem
    if payload.triagem:
        triagem = payload.triagem
        atendimento.peso = triagem.peso
        atendimento.temperatura = triagem.temperatura
        atendimento.frequencia_cardiaca = triagem.frequencia_cardiaca
        atendimento.frequencia_respiratoria = triagem.frequencia_respiratoria
        atendimento.pressao_arterial = triagem.pressao_arterial
        atendimento.saturacao_oxigenio = triagem.saturacao_oxigenio
        atendimento.escore_condicion_corpo = triagem.escore_condicion_corpo
        atendimento.mucosas = triagem.mucosas
        atendimento.hidratacao = triagem.hidratacao
        atendimento.triagem_observacoes = triagem.triagem_observacoes

    if "triagem_concluida" in data:
        atendimento.triagem_concluida = data["triagem_concluida"]
    if "consulta_concluida" in data:
        atendimento.consulta_concluida = data["consulta_concluida"]

    # DiagnÃ³sticos
    if payload.diagnostico is not None:
        diag = _normalizar_diagnostico(payload.diagnostico)
        atendimento.diagnostico_principal = diag["diagnostico_principal"] or ""
        atendimento.diagnostico_secundario = diag["diagnostico_secundario"] or ""
        atendimento.diagnostico_diferencial = diag["diagnostico_diferencial"] or ""
        atendimento.prognostico = diag["prognostico"]

    for field in [
        "queixa_principal",
        "anamnese",
        "exame_fisico",
        "dados_clinicos",
        "diagnostico_principal",
        "diagnostico_secundario",
        "diagnostico_diferencial",
        "plano_terapeutico",
        "retorno_recomendado",
        "motivo_retorno",
        "observacoes",
    ]:
        if field in data and data[field] is not None:
            setattr(atendimento, field, data[field])

    atendimento.updated_at = datetime.now()

    if payload.exames is not None:
        _sync_exames(db, atendimento, payload.exames, current_user)
    if "prescricao" in data:
        _sync_prescricao(db, atendimento, payload.prescricao, current_user)

    db.commit()
    db.refresh(atendimento)
    return _montar_detalhe_atendimento(db, atendimento)


@router.delete("/{atendimento_id}")
def excluir_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    exames = db.query(Exame).filter(Exame.atendimento_id == atendimento_id).all()
    for exame in exames:
        _excluir_anexos_por_exame(db, exame.id)
        db.delete(exame)

    _excluir_anexos_por_atendimento(db, atendimento_id)

    prescricao = db.query(PrescricaoClinica).filter(PrescricaoClinica.atendimento_id == atendimento_id).first()
    if prescricao:
        itens = db.query(PrescricaoItem).filter(PrescricaoItem.prescricao_id == prescricao.id).all()
        for item in itens:
            db.delete(item)
        db.delete(prescricao)

    documentos = db.query(DocumentoAtendimento).filter(DocumentoAtendimento.atendimento_id == atendimento_id).all()
    for documento in documentos:
        db.delete(documento)

    db.delete(atendimento)
    db.commit()
    return {"message": "Atendimento removido com sucesso.", "id": atendimento_id}


@router.get("/medicamentos/banco")
def listar_medicamentos(
    search: Optional[str] = None,
    ativos: int = 1,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = db.query(Medicamento)
    if ativos == 1:
        query = query.filter(Medicamento.ativo == 1)
    if search:
        termo = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Medicamento.nome.ilike(termo),
                Medicamento.principio_ativo.ilike(termo),
                Medicamento.categoria.ilike(termo),
                Medicamento.classe_terapeutica.ilike(termo),
            )
        )

    total = query.count()
    items = (
        query.order_by(Medicamento.nome.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "items": [_serialize_medicamento(item) for item in items],
    }


@router.post("/medicamentos/banco", status_code=status.HTTP_201_CREATED)
def criar_medicamento(
    payload: MedicamentoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    nome_limpo = payload.nome.strip()
    if not nome_limpo:
        raise HTTPException(status_code=422, detail="Nome do medicamento e obrigatorio.")

    duplicado = (
        db.query(Medicamento)
        .filter(Medicamento.nome.ilike(nome_limpo))
        .first()
    )
    if duplicado:
        raise HTTPException(status_code=400, detail="Ja existe medicamento com esse nome.")

    medicamento = Medicamento(
        nome=nome_limpo,
        principio_ativo=payload.principio_ativo or "",
        concentracao=payload.concentracao or "",
        forma_farmaceutica=payload.forma_farmaceutica or "",
        categoria=payload.categoria or "",
        classe_terapeutica=payload.classe_terapeutica or "",
        especie_alvo=payload.especie_alvo or "Canina,Felina",
        dose_min_mg_kg=payload.dose_min_mg_kg,
        dose_max_mg_kg=payload.dose_max_mg_kg,
        dose_intervalo_horas=payload.dose_intervalo_horas,
        dose_unidade=payload.dose_unidade or "mg/kg",
        via_padrao=payload.via_padrao or "",
        duracao_padrao=payload.duracao_padrao or "",
        concentracao_mg_ml=payload.concentracao_mg_ml,
        concentracao_mg_comprimido=payload.concentracao_mg_comprimido,
        indicacoes=payload.indicacoes or "",
        contraindicacoes=payload.contraindicacoes or "",
        interacoes_json=json.dumps(payload.interacoes or []),
        observacao_seguranca=payload.observacao_seguranca or "",
        parametrizacao_origem=payload.parametrizacao_origem or "manual",
        observacoes=payload.observacoes or "",
        ativo=1 if payload.ativo else 0,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(medicamento)
    db.commit()
    db.refresh(medicamento)
    return _serialize_medicamento(medicamento)


@router.put("/medicamentos/banco/{medicamento_id}")
def atualizar_medicamento(
    medicamento_id: int,
    payload: MedicamentoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    medicamento = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
    if not medicamento:
        raise HTTPException(status_code=404, detail="Medicamento nao encontrado.")

    nome_limpo = payload.nome.strip()
    if not nome_limpo:
        raise HTTPException(status_code=422, detail="Nome do medicamento e obrigatorio.")

    duplicado = (
        db.query(Medicamento)
        .filter(Medicamento.id != medicamento_id, Medicamento.nome.ilike(nome_limpo))
        .first()
    )
    if duplicado:
        raise HTTPException(status_code=400, detail="Ja existe medicamento com esse nome.")

    medicamento.nome = nome_limpo
    medicamento.principio_ativo = payload.principio_ativo or ""
    medicamento.concentracao = payload.concentracao or ""
    medicamento.forma_farmaceutica = payload.forma_farmaceutica or ""
    medicamento.categoria = payload.categoria or ""
    medicamento.classe_terapeutica = payload.classe_terapeutica or ""
    medicamento.especie_alvo = payload.especie_alvo or "Canina,Felina"
    medicamento.dose_min_mg_kg = payload.dose_min_mg_kg
    medicamento.dose_max_mg_kg = payload.dose_max_mg_kg
    medicamento.dose_intervalo_horas = payload.dose_intervalo_horas
    medicamento.dose_unidade = payload.dose_unidade or "mg/kg"
    medicamento.via_padrao = payload.via_padrao or ""
    medicamento.duracao_padrao = payload.duracao_padrao or ""
    medicamento.concentracao_mg_ml = payload.concentracao_mg_ml
    medicamento.concentracao_mg_comprimido = payload.concentracao_mg_comprimido
    medicamento.indicacoes = payload.indicacoes or ""
    medicamento.contraindicacoes = payload.contraindicacoes or ""
    medicamento.interacoes_json = json.dumps(payload.interacoes or [])
    medicamento.observacao_seguranca = payload.observacao_seguranca or ""
    medicamento.parametrizacao_origem = payload.parametrizacao_origem or medicamento.parametrizacao_origem or "manual"
    medicamento.observacoes = payload.observacoes or ""
    medicamento.ativo = 1 if payload.ativo else 0
    medicamento.updated_at = datetime.now()

    db.commit()
    db.refresh(medicamento)
    return _serialize_medicamento(medicamento)


@router.delete("/medicamentos/banco/{medicamento_id}")
def desativar_medicamento(
    medicamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    medicamento = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
    if not medicamento:
        raise HTTPException(status_code=404, detail="Medicamento nao encontrado.")

    medicamento.ativo = 0
    medicamento.updated_at = datetime.now()
    db.commit()
    return {"message": "Medicamento desativado com sucesso.", "id": medicamento_id}


# === EVOLUÃ‡Ã•ES CLÃNICAS ===
@router.get("/{atendimento_id}/evolucoes")
def listar_evolucoes(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    evolucoes = (
        db.query(EvolucaoClinica)
        .filter(EvolucaoClinica.atendimento_id == atendimento_id)
        .order_by(EvolucaoClinica.data_evolucao.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": e.id,
                "atendimento_id": e.atendimento_id,
                "data_evolucao": _to_iso(e.data_evolucao),
                "descricao": e.descricao,
                "sinais_vitais": e.sinais_vitais or "",
                "responsavel_id": e.responsavel_id,
                "responsavel_nome": e.responsavel_nome or "",
                "created_at": _to_iso(e.created_at),
            }
            for e in evolucoes
        ]
    }


@router.post("/{atendimento_id}/evolucoes", status_code=status.HTTP_201_CREATED)
def criar_evolucao(
    atendimento_id: int,
    payload: EvolucaoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    evolucao = EvolucaoClinica(
        atendimento_id=atendimento_id,
        descricao=payload.descricao,
        sinais_vitais=payload.sinais_vitais,
        responsavel_id=current_user.id,
        responsavel_nome=current_user.nome,
    )
    db.add(evolucao)
    db.commit()
    db.refresh(evolucao)

    return {
        "id": evolucao.id,
        "atendimento_id": evolucao.atendimento_id,
        "data_evolucao": _to_iso(evolucao.data_evolucao),
        "descricao": evolucao.descricao,
        "sinais_vitais": evolucao.sinais_vitais or "",
        "responsavel_nome": evolucao.responsavel_nome,
    }


# === ANEXOS ===
@router.get("/upload-metrics/dedupe")
def consultar_metricas_upload_dedupe(
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    clinica_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    inicio = _parse_upload_metrics_date(data_inicio, "data_inicio")
    fim = _parse_upload_metrics_date(data_fim, "data_fim")
    if inicio and fim and inicio > fim:
        raise HTTPException(status_code=400, detail="data_inicio nao pode ser maior que data_fim.")

    params = {
        "data_inicio": inicio.isoformat() if inicio else None,
        "data_fim": fim.isoformat() if fim else None,
        "clinica_id": clinica_id,
    }
    rows = db.execute(
        text(
            """
            SELECT
                DATE(created_at) AS dia,
                SUM(CASE WHEN evento = 'upload_novo' THEN 1 ELSE 0 END) AS uploads_novos,
                SUM(CASE WHEN evento = 'dedupe_precheck' THEN 1 ELSE 0 END) AS dedupe_precheck,
                SUM(CASE WHEN evento = 'dedupe_collision' THEN 1 ELSE 0 END) AS dedupe_collision,
                COUNT(*) AS total_uploads
            FROM upload_dedupe_metricas
            WHERE (:data_inicio IS NULL OR DATE(created_at) >= :data_inicio)
              AND (:data_fim IS NULL OR DATE(created_at) <= :data_fim)
              AND (:clinica_id IS NULL OR clinica_id = :clinica_id)
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) DESC
            """
        ),
        params,
    ).fetchall()

    items = []
    for row in rows:
        mapping = row._mapping if hasattr(row, "_mapping") else None
        dia_raw = mapping["dia"] if mapping is not None else row[0]
        dia = dia_raw.isoformat() if hasattr(dia_raw, "isoformat") else str(dia_raw)
        uploads_novos = int((mapping["uploads_novos"] if mapping is not None else row[1]) or 0)
        dedupe_precheck = int((mapping["dedupe_precheck"] if mapping is not None else row[2]) or 0)
        dedupe_collision = int((mapping["dedupe_collision"] if mapping is not None else row[3]) or 0)
        total_uploads = int((mapping["total_uploads"] if mapping is not None else row[4]) or 0)
        items.append(
            {
                "date": dia,
                "uploads_novos": uploads_novos,
                "dedupe_precheck": dedupe_precheck,
                "dedupe_collision": dedupe_collision,
                "total_uploads": total_uploads,
            }
        )

    return {
        "items": items,
        "filters": {
            "data_inicio": params["data_inicio"],
            "data_fim": params["data_fim"],
            "clinica_id": clinica_id,
        },
    }


@router.post("/upload-metrics/dedupe/cleanup")
def executar_cleanup_upload_dedupe_metricas(
    current_user: User = Depends(get_current_user),
):
    _require_admin_cleanup_access(current_user)

    try:
        return run_upload_dedupe_cleanup(executor=UPLOAD_DEDUPE_CLEANUP_EXECUTOR_MANUAL)
    except UploadDedupeCleanupBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UploadDedupeCleanupExecutionError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/upload-metrics/dedupe/cleanup/status")
def consultar_status_cleanup_upload_dedupe_metricas(
    current_user: User = Depends(get_current_user),
):
    _require_admin_cleanup_access(current_user)
    return get_upload_dedupe_cleanup_status()


@router.post("/exames/{exame_id}/portal/liberar")
def liberar_exame_no_portal(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame nao encontrado.")
    if not exame.atendimento_id:
        raise HTTPException(status_code=422, detail="Exame sem atendimento vinculado.")

    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == exame.atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento do exame nao encontrado.")
    if not atendimento.clinica_id:
        raise HTTPException(status_code=422, detail="Vincule uma clinica ao atendimento antes de liberar no portal.")
    if not exame.paciente_id:
        raise HTTPException(status_code=422, detail="Exame sem paciente vinculado.")

    anexos = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.exame_id == exame.id)
        .order_by(AnexoAtendimento.created_at.desc(), AnexoAtendimento.id.desc())
        .all()
    )
    if not any(_anexo_eh_pdf(anexo) for anexo in anexos):
        raise HTTPException(status_code=422, detail="Anexe o PDF do resultado antes de liberar no portal.")

    released_at = datetime.utcnow()
    exame.tipo_exame = _normalizar_tipo_exame_portal_externo(exame.tipo_exame)
    if exame.tipo_exame == "Eletrocardiograma" and not (exame.categoria_exame or "").strip():
        exame.categoria_exame = "Cardiologia"
    exame.status = PORTAL_RELEASED_STATUS
    exame.data_resultado = released_at
    exame.observacoes = PORTAL_EXAME_RELEASE_MESSAGE
    if not exame.criado_por_id:
        exame.criado_por_id = getattr(current_user, "id", None)
    if not exame.criado_por_nome:
        exame.criado_por_nome = getattr(current_user, "nome", None)

    db.commit()
    db.refresh(exame)
    anexos_atualizados = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.exame_id == exame.id)
        .order_by(AnexoAtendimento.created_at.desc(), AnexoAtendimento.id.desc())
        .all()
    )
    exame_payload = {
        **_map_exame(exame),
        "anexos_resultado": [_serialize_anexo(anexo) for anexo in anexos_atualizados],
    }
    return {
        "message": "Exame liberado no portal da clinica parceira.",
        "exame_id": exame.id,
        "paciente_id": exame.paciente_id,
        "atendimento_id": exame.atendimento_id,
        "clinic_id": atendimento.clinica_id,
        "status": exame.status,
        "released_at": _to_iso(exame.data_resultado),
        "exame": exame_payload,
    }


@router.get("/{atendimento_id}/anexos")
def listar_anexos(
    atendimento_id: int,
    exame_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = db.query(AnexoAtendimento).filter(AnexoAtendimento.atendimento_id == atendimento_id)
    if exame_id is not None:
        query = query.filter(AnexoAtendimento.exame_id == exame_id)
    anexos = query.order_by(AnexoAtendimento.created_at.desc()).all()
    return {"items": [_serialize_anexo(a) for a in anexos]}


@router.post("/{atendimento_id}/anexos", status_code=status.HTTP_201_CREATED)
def criar_anexo(
    atendimento_id: int,
    payload: AnexoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    if payload.exame_id:
        exame = (
            db.query(Exame)
            .filter(Exame.id == payload.exame_id, Exame.atendimento_id == atendimento_id)
            .first()
        )
        if not exame:
            raise HTTPException(status_code=404, detail="Exame nao encontrado para este atendimento.")

    anexo = AnexoAtendimento(
        atendimento_id=atendimento_id,
        exame_id=payload.exame_id,
        tipo=payload.tipo,
        descricao=payload.descricao,
        url=payload.url,
        nome_original=payload.nome_original,
        tamanho=payload.tamanho,
        mime_type=payload.mime_type,
        origem="externo",
    )
    db.add(anexo)
    db.commit()
    db.refresh(anexo)

    return _serialize_anexo(anexo)


@router.post("/{atendimento_id}/anexos/upload", status_code=status.HTTP_201_CREATED)
async def upload_anexo(
    atendimento_id: int,
    arquivo: UploadFile = File(...),
    tipo: str = Form(...),
    descricao: str = Form(""),
    exame_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    exame = None
    if exame_id is not None:
        exame = db.query(Exame).filter(Exame.id == exame_id, Exame.atendimento_id == atendimento_id).first()
        if not exame:
            raise HTTPException(status_code=404, detail="Exame nao encontrado para este atendimento.")

    content = await arquivo.read()
    if not content:
        logger.warning(
            "Upload de anexo rejeitado: arquivo vazio (atendimento_id=%s, user_id=%s, filename=%s)",
            atendimento_id,
            current_user.id,
            arquivo.filename,
        )
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    arquivo_hash = calculate_attachment_sha256(content)
    dedupe_key = build_upload_dedupe_key(exame.id if exame else None, arquivo_hash)
    anexo_existente = _find_existing_upload_anexo_by_dedupe_key(
        db,
        atendimento_id=atendimento_id,
        dedupe_key=dedupe_key,
    )
    if anexo_existente:
        logger.info(
            "Upload de anexo deduplicado (atendimento_id=%s, exame_id=%s, user_id=%s, anexo_id=%s, dedupe_key=%s)",
            atendimento_id,
            exame.id if exame else None,
            current_user.id,
            anexo_existente.id,
            dedupe_key,
        )
        _registrar_upload_dedupe_metrica(
            db,
            atendimento=atendimento,
            evento=UPLOAD_DEDUPE_EVENT_PRECHECK,
            dedupe_key=dedupe_key,
        )
        payload = _serialize_anexo(anexo_existente)
        payload["deduplicado"] = True
        return JSONResponse(status_code=status.HTTP_200_OK, content=payload)

    try:
        storage_path, normalized_name, normalized_mime_type = store_atendimento_attachment_file(
            atendimento_id,
            arquivo.filename,
            content,
            arquivo.content_type,
        )
    except AttachmentTooLargeError as exc:
        logger.warning(
            "Upload de anexo rejeitado: arquivo acima do limite (atendimento_id=%s, user_id=%s, filename=%s, size_bytes=%s)",
            atendimento_id,
            current_user.id,
            arquivo.filename,
            len(content),
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except AttachmentTypeError as exc:
        logger.warning(
            "Upload de anexo rejeitado: tipo invalido (atendimento_id=%s, user_id=%s, filename=%s, content_type=%s)",
            atendimento_id,
            current_user.id,
            arquivo.filename,
            arquivo.content_type,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception(
            "Upload de anexo falhou por erro de storage (atendimento_id=%s, user_id=%s, filename=%s)",
            atendimento_id,
            current_user.id,
            arquivo.filename,
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    anexo = AnexoAtendimento(
        atendimento_id=atendimento_id,
        exame_id=exame.id if exame else None,
        tipo=(tipo or "documento").strip() or "documento",
        descricao=(descricao or "").strip() or None,
        url="",
        nome_original=normalized_name,
        tamanho=len(content),
        mime_type=normalized_mime_type,
        arquivo_hash=arquivo_hash,
        dedupe_key=dedupe_key,
        caminho_arquivo=storage_path,
        origem="upload",
    )
    db.add(anexo)
    try:
        db.flush()
        anexo.url = f"/api/v1/atendimentos/anexos/{anexo.id}/arquivo"

        if exame and not _status_exame_concluido(exame.status):
            exame.status = "Em andamento"
        if exame and not exame.data_resultado:
            exame.data_resultado = datetime.now()

        db.commit()
        db.refresh(anexo)

        _registrar_upload_dedupe_metrica(
            db,
            atendimento=atendimento,
            evento=UPLOAD_DEDUPE_EVENT_UPLOAD_NOVO,
            dedupe_key=dedupe_key,
        )
        payload = _serialize_anexo(anexo)
        payload["deduplicado"] = False
        return payload
    except IntegrityError:
        db.rollback()
        remove_atendimento_attachment_file(storage_path)
        anexo_concorrente = _find_existing_upload_anexo_by_dedupe_key(
            db,
            atendimento_id=atendimento_id,
            dedupe_key=dedupe_key,
        )
        if anexo_concorrente:
            logger.info(
                "Upload deduplicado por corrida de concorrencia (atendimento_id=%s, exame_id=%s, user_id=%s, anexo_id=%s, dedupe_key=%s)",
                atendimento_id,
                exame.id if exame else None,
                current_user.id,
                anexo_concorrente.id,
                dedupe_key,
            )
            _registrar_upload_dedupe_metrica(
                db,
                atendimento=atendimento,
                evento=UPLOAD_DEDUPE_EVENT_COLLISION,
                dedupe_key=dedupe_key,
            )
            payload = _serialize_anexo(anexo_concorrente)
            payload["deduplicado"] = True
            return JSONResponse(status_code=status.HTTP_200_OK, content=payload)

        logger.exception(
            "Falha ao resolver colisao de upload por dedupe_key (atendimento_id=%s, exame_id=%s, user_id=%s, dedupe_key=%s)",
            atendimento_id,
            exame.id if exame else None,
            current_user.id,
            dedupe_key,
        )
        raise HTTPException(status_code=409, detail="Conflito ao processar upload duplicado. Tente novamente.")


@router.get("/anexos/{anexo_id}/arquivo")
def baixar_arquivo_anexo(
    anexo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    anexo = db.query(AnexoAtendimento).filter(AnexoAtendimento.id == anexo_id).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo nao encontrado.")
    return build_attachment_download_response(
        anexo,
        missing_detail="Arquivo nao encontrado no armazenamento.",
    )


@router.delete("/anexos/{anexo_id}")
def excluir_anexo(
    anexo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    anexo = db.query(AnexoAtendimento).filter(AnexoAtendimento.id == anexo_id).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo nao encontrado.")

    _excluir_anexo_registro(db, anexo)
    db.commit()
    return {"message": "Anexo removido com sucesso.", "id": anexo_id}


# === ALERTAS CLÃNICOS ===
@router.get("/paciente/{paciente_id}/alertas")
def listar_alertas_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    alertas = (
        db.query(AlertaClinico)
        .filter(AlertaClinico.paciente_id == paciente_id, AlertaClinico.ativo == 1)
        .order_by(AlertaClinico.gravidade.desc(), AlertaClinico.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "paciente_id": a.paciente_id,
                "tipo": a.tipo,
                "titulo": a.titulo,
                "descricao": a.descricao or "",
                "gravidade": a.gravidade or "media",
                "data_inicio": _to_iso(a.data_inicio),
                "data_fim": _to_iso(a.data_fim),
            }
            for a in alertas
        ]
    }


@router.post("/paciente/{paciente_id}/alertas", status_code=status.HTTP_201_CREATED)
def criar_alerta(
    paciente_id: int,
    payload: AlertaPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    alerta = AlertaClinico(
        paciente_id=paciente_id,
        tipo=payload.tipo,
        titulo=payload.titulo,
        descricao=payload.descricao,
        gravidade=payload.gravidade or "media",
    )
    db.add(alerta)
    db.commit()
    db.refresh(alerta)

    return {
        "id": alerta.id,
        "paciente_id": alerta.paciente_id,
        "tipo": alerta.tipo,
        "titulo": alerta.titulo,
        "descricao": alerta.descricao or "",
        "gravidade": alerta.gravidade,
    }


@router.put("/alertas/{alerta_id}")
def atualizar_alerta(
    alerta_id: int,
    payload: AlertaPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    alerta = db.query(AlertaClinico).filter(AlertaClinico.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta nao encontrado.")

    alerta.tipo = payload.tipo
    alerta.titulo = payload.titulo
    alerta.descricao = payload.descricao or ""
    alerta.gravidade = payload.gravidade or "media"
    db.commit()
    db.refresh(alerta)

    return {
        "id": alerta.id,
        "paciente_id": alerta.paciente_id,
        "tipo": alerta.tipo,
        "titulo": alerta.titulo,
        "descricao": alerta.descricao or "",
        "gravidade": alerta.gravidade,
    }


@router.delete("/alertas/{alerta_id}")
def desativar_alerta(
    alerta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    alerta = db.query(AlertaClinico).filter(AlertaClinico.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta nao encontrado.")

    alerta.ativo = 0
    db.commit()
    return {"message": "Alerta desativado com sucesso.", "id": alerta_id}


def _resumir_texto_timeline(value: Optional[str], fallback: str) -> str:
    text = (value or "").strip()
    if not text:
        return fallback
    compact = re.sub(r"\s+", " ", text)
    return compact[:140]


def _montar_timeline_paciente(db: Session, paciente_id: int) -> List[dict]:
    atendimentos = (
        db.query(AtendimentoClinico)
        .filter(AtendimentoClinico.paciente_id == paciente_id)
        .order_by(AtendimentoClinico.data_atendimento.asc(), AtendimentoClinico.id.asc())
        .all()
    )
    atendimento_ids = [item.id for item in atendimentos if item.id]

    evolucoes = (
        db.query(EvolucaoClinica)
        .filter(EvolucaoClinica.atendimento_id.in_(atendimento_ids))
        .order_by(EvolucaoClinica.data_evolucao.asc(), EvolucaoClinica.id.asc())
        .all()
        if atendimento_ids
        else []
    )
    anexos = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.atendimento_id.in_(atendimento_ids))
        .order_by(AnexoAtendimento.created_at.asc(), AnexoAtendimento.id.asc())
        .all()
        if atendimento_ids
        else []
    )
    exames = (
        db.query(Exame)
        .filter(Exame.paciente_id == paciente_id)
        .order_by(Exame.data_solicitacao.asc(), Exame.id.asc())
        .all()
    )
    laudos = (
        db.query(Laudo)
        .filter(Laudo.paciente_id == paciente_id)
        .order_by(Laudo.data_laudo.asc(), Laudo.id.asc())
        .all()
    )

    events: List[dict] = []
    exame_map = {exame.id: exame for exame in exames if exame.id}
    for atendimento in atendimentos:
        data_evento = atendimento.data_atendimento or atendimento.created_at
        if not data_evento:
            continue
        events.append(
            {
                "data": _to_iso(data_evento),
                "tipo": "atendimento",
                "titulo": atendimento.diagnostico_principal or atendimento.status or "Atendimento clinico",
                "descricao": _resumir_texto_timeline(
                    atendimento.queixa_principal or atendimento.observacoes,
                    "Registro de atendimento clinico.",
                ),
                "status": atendimento.status or "",
                "referencia_id": atendimento.id,
            }
        )

    for evolucao in evolucoes:
        data_evento = evolucao.data_evolucao or evolucao.created_at
        if not data_evento:
            continue
        events.append(
            {
                "data": _to_iso(data_evento),
                "tipo": "evolucao",
                "titulo": "Evolucao clinica",
                "descricao": _resumir_texto_timeline(evolucao.descricao, "Acompanhamento clinico registrado."),
                "status": evolucao.responsavel_nome or "",
                "referencia_id": evolucao.id,
            }
        )

    for exame in exames:
        data_solicitacao = exame.data_solicitacao or exame.created_at
        if data_solicitacao:
            events.append(
                {
                    "data": _to_iso(data_solicitacao),
                    "tipo": "exame_solicitado",
                    "titulo": f"Solicitacao: {exame.tipo_exame or 'Exame'}",
                    "descricao": _resumir_texto_timeline(
                        exame.preparo or exame.observacoes,
                        "Exame solicitado para acompanhamento clinico.",
                    ),
                    "status": exame.prioridade or "",
                    "referencia_id": exame.id,
                }
            )

        if exame.resultado or exame.data_resultado or _status_exame_concluido(exame.status):
            data_resultado = exame.data_resultado or exame.created_at
            if data_resultado:
                events.append(
                    {
                        "data": _to_iso(data_resultado),
                        "tipo": "exame_resultado",
                        "titulo": f"Resultado: {exame.tipo_exame or 'Exame'}",
                        "descricao": _resumir_texto_timeline(
                            exame.resultado or exame.observacoes,
                            "Resultado ou andamento de exame registrado.",
                        ),
                        "status": exame.status or "",
                        "referencia_id": exame.id,
                    }
                )

    for anexo in anexos:
        data_evento = anexo.created_at
        if not data_evento:
            continue
        exam_prefix = ""
        if anexo.exame_id:
            exame = exame_map.get(anexo.exame_id)
            if exame:
                exam_prefix = f"{exame.tipo_exame}: "
        events.append(
            {
                "data": _to_iso(data_evento),
                "tipo": "anexo",
                "titulo": "Arquivo anexado",
                "descricao": _resumir_texto_timeline(
                    f"{exam_prefix}{anexo.nome_original or anexo.descricao or anexo.tipo}",
                    "Arquivo clinico anexado ao prontuario.",
                ),
                "status": anexo.tipo or "",
                "referencia_id": anexo.id,
            }
        )

    for laudo in laudos:
        data_evento = laudo.data_laudo or laudo.created_at
        if not data_evento:
            continue
        events.append(
            {
                "data": _to_iso(data_evento),
                "tipo": "laudo",
                "titulo": laudo.titulo or laudo.tipo or "Laudo",
                "descricao": _resumir_texto_timeline(laudo.diagnostico or laudo.descricao, "Documento clinico registrado."),
                "status": laudo.status or "",
                "referencia_id": laudo.id,
            }
        )

    grouped: Dict[str, List[dict]] = defaultdict(list)
    for event in sorted(events, key=lambda item: item.get("data") or ""):
        year = "Sem data"
        if event.get("data"):
            parsed = _parse_datetime(event["data"])
            if parsed:
                year = str(parsed.year)
        grouped[year].append(event)

    ordered_years = sorted(grouped.keys(), key=lambda value: (value == "Sem data", value))
    return [{"ano": year, "eventos": grouped[year]} for year in ordered_years]


# === HISTÃ“RICO DO PACIENTE ===
@router.get("/paciente/{paciente_id}/historico")
def historico_paciente(
    paciente_id: int,
    limite: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    # Buscar atendimentos anteriores
    atendimentos = (
        db.query(AtendimentoClinico)
        .filter(AtendimentoClinico.paciente_id == paciente_id)
        .order_by(AtendimentoClinico.data_atendimento.desc())
        .limit(limite)
        .all()
    )

    # Buscar alertas ativos
    alertas = (
        db.query(AlertaClinico)
        .filter(AlertaClinico.paciente_id == paciente_id, AlertaClinico.ativo == 1)
        .all()
    )

    return {
        "paciente": {
            "id": paciente.id,
            "nome": paciente.nome,
            "especie": paciente.especie or "",
            "raca": paciente.raca or "",
            "peso": paciente.peso_kg,
            "nascimento": paciente.nascimento or None,
        },
        "alertas": [
            {
                "id": a.id,
                "tipo": a.tipo,
                "titulo": a.titulo,
                "descricao": a.descricao or "",
                "gravidade": a.gravidade or "media",
            }
            for a in alertas
        ],
        "atendimentos": [
            {
                "id": a.id,
                "data_atendimento": _to_iso(a.data_atendimento),
                "status": a.status,
                "queixa_principal": a.queixa_principal or "",
                "diagnostico_principal": a.diagnostico_principal or "",
                "veterinario": a.criado_por_nome or "",
                "peso": a.peso,
            }
            for a in atendimentos
        ],
        "pesos": [
            {
                "atendimento_id": a.id,
                "data_atendimento": _to_iso(a.data_atendimento),
                "peso": a.peso,
            }
            for a in atendimentos
            if a.peso is not None
        ],
        "timeline": _montar_timeline_paciente(db, paciente_id),
    }


@router.get("/paciente/{paciente_id}/timeline")
def timeline_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    return {
        "paciente": {
            "id": paciente.id,
            "nome": paciente.nome,
            "especie": paciente.especie or "",
            "raca": paciente.raca or "",
        },
        "timeline": _montar_timeline_paciente(db, paciente_id),
    }
