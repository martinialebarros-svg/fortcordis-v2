"""Serviço de exportação de notas fiscais para PDF, CSV e Excel."""
import csv
import io
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.fiscal import NotaFiscal
from app.models.configuracao import Configuracao

logger = logging.getLogger(__name__)

# Diretório temporário para arquivos gerados
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "fiscal"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

REGIME_DESCRICOES = {
    1: "MEI - Microempreendedor Individual",
    2: "Simples Nacional",
    3: "Lucro Presumido",
    4: "Lucro Real",
}


def _get_configuracao(db_session) -> dict:
    """Carrega dados da empresa (prestador) da configuração."""
    config = db_session.query(Configuracao).first()
    if not config:
        return {}
    return {
        "nome_empresa": config.nome_empresa or "",
        "endereco": config.endereco or "",
        "telefone": config.telefone or "",
        "email": config.email or "",
        "cidade": config.cidade or "",
        "estado": config.estado or "",
        "inscricao_municipal": config.inscricao_municipal or "",
        "inscricao_estadual": config.inscricao_estadual or "",
        "cnae": config.cnae or "",
        "regime_tributario": REGIME_DESCRICOES.get(
            config.regime_tributario, ""
        ) if config.regime_tributario else "",
        "codigo_municipio": config.codigo_municipio_servico or "230440",  # Fortaleza
    }


def _nota_to_dict(nota: NotaFiscal) -> dict:
    """Converte NotaFiscal em dict."""
    return {
        "numero": nota.numero or "",
        "serie": nota.serie or "1",
        "tipo_cliente": nota.tipo_cliente or "",
        "cliente_nome": nota.cliente_nome or "",
        "cliente_documento": nota.cliente_documento or "",
        "cliente_endereco": nota.cliente_endereco or "",
        "cliente_bairro": nota.cliente_bairro or "",
        "cliente_cidade": nota.cliente_cidade or "",
        "cliente_estado": nota.cliente_estado or "",
        "cliente_cep": nota.cliente_cep or "",
        "cliente_telefone": nota.cliente_telefone or "",
        "cliente_email": nota.cliente_email or "",
        "valor_servico": float(nota.valor_servico or 0),
        "valor_desconto": float(nota.valor_desconto or 0),
        "valor_final": float(nota.valor_final or 0),
        "aliquota_iss": nota.aliquota_iss or 5.0,
        "valor_iss": float(nota.valor_iss or 0),
        "atividade_cnae": nota.atividade_cnae or "",
        "descricao_servico": nota.descricao_servico or "",
        "natureza_operacao": nota.natureza_operacao or "Tributação no município",
        "os_id": nota.os_id,
        "created_at": nota.created_at or "",
    }


# ─── PDF ───────────────────────────────────────────────────────────────────────

def exportar_pdf(notas: list[NotaFiscal], db_session) -> tuple[bytes, str]:
    """
    Gera um PDF com uma ou mais notas fiscais em formato profissional.
    Retorna (bytes do PDF, nome do arquivo).
    """
    config = _get_configuracao(db_session)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=16,
        alignment=1,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=9,
        alignment=1,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading3"],
        fontSize=11,
        spaceAfter=6,
        spaceBefore=12,
        textColor=colors.HexColor("#2c3e50"),
    )
    field_style = ParagraphStyle(
        "Field",
        parent=styles["Normal"],
        fontSize=9,
        spaceAfter=2,
    )

    elements = []

    for i, nota in enumerate(notas):
        if i > 0:
            elements.append(Spacer(1, 1.5 * cm))
        nd = _nota_to_dict(nota)

        # Cabeçalho
        elements.append(Paragraph("NOTA FISCAL DE SERVIÇOS", title_style))
        elements.append(
            Paragraph(
                f"<b>Nº {nd['numero']}</b> &nbsp;&nbsp; Série: {nd['serie']}",
                subtitle_style,
            )
        )

        # Dados do Prestador
        elements.append(Paragraph("PRESTADOR DE SERVIÇOS", section_style))
        elements.append(
            Paragraph(f"<b>Razão Social:</b> {config.get('nome_empresa', 'N/A')}", field_style)
        )
        elements.append(
            Paragraph(
                f"<b>Endereço:</b> {config.get('endereco', 'N/A')} - "
                f"{config.get('cidade', '')}, {config.get('estado', '')}",
                field_style,
            )
        )
        elements.append(
            Paragraph(
                f"<b>CNPJ:</b> {config.get('inscricao_estadual', 'N/A')} &nbsp;&nbsp; "
                f"<b>IM:</b> {config.get('inscricao_municipal', 'N/A')} &nbsp;&nbsp; "
                f"<b>CNAE:</b> {config.get('cnae', 'N/A')}",
                field_style,
            )
        )
        elements.append(
            Paragraph(
                f"<b>Telefone:</b> {config.get('telefone', '')} &nbsp;&nbsp; "
                f"<b>Email:</b> {config.get('email', '')}",
                field_style,
            )
        )

        # Dados do Tomador
        elements.append(Paragraph("TOMADOR DE SERVIÇOS", section_style))
        elements.append(
            Paragraph(f"<b>Nome/Razão Social:</b> {nd['cliente_nome']}", field_style)
        )
        elements.append(
            Paragraph(
                f"<b>{'CPF' if nd['tipo_cliente'] == 'PF' else 'CNPJ'}:</b> "
                f"{nd['cliente_documento']}",
                field_style,
            )
        )
        elements.append(
            Paragraph(
                f"<b>Endereço:</b> {nd['cliente_endereco']}, {nd['cliente_bairro']} - "
                f"{nd['cliente_cidade']}, {nd['cliente_estado']} | CEP: {nd['cliente_cep']}",
                field_style,
            )
        )
        if nd["cliente_telefone"]:
            elements.append(
                Paragraph(
                    f"<b>Telefone:</b> {nd['cliente_telefone']} &nbsp;&nbsp; "
                    f"<b>Email:</b> {nd['cliente_email'] or 'N/A'}",
                    field_style,
                )
            )

        # Dados do Serviço
        elements.append(Paragraph("DISCRIMINAÇÃO DO(S) SERVIÇO(S)", section_style))
        elements.append(
            Paragraph(
                f"<b>CNAE:</b> {nd['atividade_cnae']} &nbsp;&nbsp; "
                f"<b>Natureza:</b> {nd['natureza_operacao']}",
                field_style,
            )
        )
        elements.append(
            Paragraph(
                f"<b>Descrição:</b> {nd['descricao_servico'] or 'Serviço veterinário especializado.'}",
                field_style,
            )
        )
        if nd.get("os_id"):
            elements.append(
                Paragraph(f"<b>OS Ref.:</b> #{nd['os_id']}", field_style)
            )

        # Tabela de Valores
        elements.append(Paragraph("VALORES", section_style))
        table_data = [
            ["Discriminação", "Valor (R$)"],
            ["Valor do Serviço", f"{nd['valor_servico']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")],
            ["(-) Desconto", f"({nd['valor_desconto']:,.2f})".replace(",", "X").replace(".", ",").replace("X", ".")],
            ["= Valor Final", f"{nd['valor_final']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")],
            [f"ISS ({nd['aliquota_iss']}%)", f"{nd['valor_iss']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")],
        ]
        table = Table(table_data, colWidths=[10 * cm, 6 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ecf0f1")),
                    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f9f9f9")]),
                ]
            )
        )
        elements.append(table)

        # Observações
        if nd.get("observacoes"):
            elements.append(Spacer(1, 0.3 * cm))
            elements.append(
                Paragraph(f"<b>Observações:</b> {nd['observacoes']}", field_style)
            )

        # Rodapé
        elements.append(Spacer(1, 0.5 * cm))
        elements.append(
            Paragraph(
                f"<i>Documento gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} | "
                f"{config.get('nome_empresa', 'Fort Cordis')}</i>",
                subtitle_style,
            )
        )

    doc.build(elements)
    buffer.seek(0)
    filename = f"notas_fiscais_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return buffer.read(), filename


# ─── CSV ───────────────────────────────────────────────────────────────────────

def exportar_csv(notas: list[NotaFiscal], db_session) -> tuple[bytes, str]:
    """
    Gera um arquivo CSV com os dados das notas fiscais.
    Colunas compatíveis com sistemas de importação contábil (NFX Manager).
    """
    config = _get_configuracao(db_session)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_ALL)

    # Cabeçalho
    writer.writerow([
        "Numero NF",
        "Serie",
        "Tipo Cliente",
        "Razao Social Tomador",
        "CNPJ/CPF Tomador",
        "Endereco Tomador",
        "Bairro Tomador",
        "Cidade Tomador",
        "UF Tomador",
        "CEP Tomador",
        "Telefone Tomador",
        "Email Tomador",
        "Valor Servico",
        "Desconto",
        "Valor Final",
        "Aliquota ISS",
        "Valor ISS",
        "CNAE Atividade",
        "Descricao Servico",
        "Natureza Operacao",
        "Municipio Servico",
        "Regime Tributario",
        "Prestador Nome",
        "Prestador CNPJ",
        "Prestador IM",
        "Data Emissao",
        "OS Referencia",
    ])

    for nota in notas:
        nd = _nota_to_dict(nota)
        writer.writerow([
            nd["numero"],
            nd["serie"],
            nd["tipo_cliente"],
            nd["cliente_nome"],
            nd["cliente_documento"],
            nd["cliente_endereco"],
            nd["cliente_bairro"],
            nd["cliente_cidade"],
            nd["cliente_estado"],
            nd["cliente_cep"],
            nd["cliente_telefone"],
            nd["cliente_email"],
            f"{nd['valor_servico']:.2f}".replace(".", ","),
            f"{nd['valor_desconto']:.2f}".replace(".", ","),
            f"{nd['valor_final']:.2f}".replace(".", ","),
            f"{nd['aliquota_iss']:.2f}".replace(".", ","),
            f"{nd['valor_iss']:.2f}".replace(".", ","),
            nd["atividade_cnae"],
            nd["descricao_servico"],
            nd["natureza_operacao"],
            config.get("codigo_municipio", "230440"),
            config.get("regime_tributario", ""),
            config.get("nome_empresa", ""),
            config.get("inscricao_estadual", ""),
            config.get("inscricao_municipal", ""),
            nd["created_at"][:10] if nd["created_at"] else "",
            str(nd.get("os_id", "")),
        ])

    content = output.getvalue().encode("utf-8-sig")
    filename = f"notas_fiscais_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return content, filename


# ─── Excel ────────────────────────────────────────────────────────────────────

def exportar_xlsx(notas: list[NotaFiscal], db_session) -> tuple[bytes, str]:
    """
    Gera um arquivo Excel com os dados das notas fiscais.
    """
    config = _get_configuracao(db_session)
    wb = Workbook()

    # Aba 1: Notas Fiscais
    ws = wb.active
    ws.title = "Notas Fiscais"

    headers = [
        "Numero NF", "Serie", "Tipo", "Cliente", "Documento",
        "Endereco", "Bairro", "Cidade", "UF", "CEP",
        "Telefone", "Email", "Valor Servico", "Desconto", "Valor Final",
        "Aliquota ISS (%)", "Valor ISS", "CNAE", "Descricao Servico",
        "Natureza", "Municipio", "Regime", "Data Emissao", "OS Ref.",
    ]
    ws.append(headers)

    header_fill = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for col, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for nota in notas:
        nd = _nota_to_dict(nota)
        row = [
            nd["numero"],
            nd["serie"],
            nd["tipo_cliente"],
            nd["cliente_nome"],
            nd["cliente_documento"],
            nd["cliente_endereco"],
            nd["cliente_bairro"],
            nd["cliente_cidade"],
            nd["cliente_estado"],
            nd["cliente_cep"],
            nd["cliente_telefone"],
            nd["cliente_email"],
            nd["valor_servico"],
            nd["valor_desconto"],
            nd["valor_final"],
            nd["aliquota_iss"],
            nd["valor_iss"],
            nd["atividade_cnae"],
            nd["descricao_servico"],
            nd["natureza_operacao"],
            config.get("codigo_municipio", ""),
            config.get("regime_tributario", ""),
            nd["created_at"][:10] if nd["created_at"] else "",
            str(nd.get("os_id", "")),
        ]
        ws.append(row)

    # Ajuste de largura das colunas
    for col in ws.columns:
        max_length = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except (TypeError, AttributeError):
                pass
        ws.column_dimensions[col_letter].width = min(max_length + 2, 40)

    # Aba 2: Resumo
    ws2 = wb.create_sheet("Resumo")
    ws2.append(["RESUMO FISCAL"])
    ws2.cell(row=1, column=1).font = Font(bold=True, size=14)
    ws2.append([])
    ws2.append(["Prestador de Serviços"])
    ws2.append(["Razão Social", config.get("nome_empresa", "")])
    ws2.append(["IM", config.get("inscricao_municipal", "")])
    ws2.append(["IE/CNPJ", config.get("inscricao_estadual", "")])
    ws2.append(["CNAE", config.get("cnae", "")])
    ws2.append(["Regime Tributário", config.get("regime_tributario", "")])
    ws2.append(["Município", f"{config.get('cidade', '')} ({config.get('estado', '')})"])
    ws2.append([])
    ws2.append(["Totais"])
    total_servico = sum(float(n.valor_servico or 0) for n in notas)
    total_desconto = sum(float(n.valor_desconto or 0) for n in notas)
    total_final = sum(float(n.valor_final or 0) for n in notas)
    total_iss = sum(float(n.valor_iss or 0) for n in notas)
    ws2.append(["Total Valor Serviço", f"R$ {total_servico:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")])
    ws2.append(["Total Desconto", f"R$ {total_desconto:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")])
    ws2.append(["Total Valor Final", f"R$ {total_final:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")])
    ws2.append(["Total ISS", f"R$ {total_iss:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")])
    ws2.append(["Quantidade de Notas", len(notas)])
    ws2.column_dimensions["A"].width = 25
    ws2.column_dimensions["B"].width = 40

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    filename = f"notas_fiscais_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return buffer.read(), filename
