"""Geração de PDF de laudos ecocardiográficos"""
import os
import re
import tempfile
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader


# Cores do tema - preto e cinza com fontes brancas (teste)
COR_PRIMARIA = colors.HexColor('#000000')   # Preto - títulos de seção
COR_SECUNDARIA = colors.HexColor('#374151') # Cinza escuro
COR_CINZA_ESCURO = colors.HexColor('#374151')   # Cinza escuro
COR_CINZA_MEDIO = colors.HexColor('#6b7280')
COR_CINZA_CLARO = colors.HexColor('#e5e7eb')    # Cinza claro para linhas alternadas
COR_HEADER_BG = colors.HexColor('#4b5563')      # Cinza médio - cabeçalhos de coluna (texto branco)
COR_BRANCO = colors.white
COR_PRETO = colors.black

# Largura do conteúdo (igual à soma das colunas das tabelas de dados)
LARGURA_TABELAS = 180 * mm


# Campos de comprimento que devem ser exibidos/comparados em mm.
CHAVES_COMPRIMENTO_MM = {
    "DIVEd",
    "SIVd",
    "PLVEd",
    "DIVES",
    "SIVs",
    "PLVES",
    "DIVEd_2D",
    "SIVd_2D",
    "PLVEd_2D",
    "DIVES_2D",
    "SIVs_2D",
    "PLVES_2D",
    "TAPSE",
    "MAPSE",
    "Aorta",
    "Atrio_esquerdo",
    "Ao_nivel_AP",
    "AP",
}


def _to_float(valor: Any) -> Optional[float]:
    """Converte valor para float de forma tolerante (aceita string com vírgula)."""
    if valor is None or valor == "":
        return None
    try:
        if isinstance(valor, str):
            return float(valor.replace(",", "."))
        return float(valor)
    except (TypeError, ValueError):
        return None


def _to_float_peso(valor: Any) -> Optional[float]:
    """Converte peso para float (aceita sufixo kg e virgula)."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float)):
        try:
            return float(valor)
        except (TypeError, ValueError):
            return None

    texto = str(valor).strip().lower().replace(",", ".")
    texto = texto.replace("kgs", "").replace("kg", "").strip()
    match = re.search(r"-?\d+(?:\.\d+)?", texto)
    if not match:
        return None
    try:
        return float(match.group(0))
    except (TypeError, ValueError):
        return None


def _esc(valor: Any) -> str:
    """Escapa texto para uso seguro em reportlab Paragraph."""
    if valor is None:
        return ""
    return xml_escape(str(valor))


def normalizar_medidas_para_pdf(medidas: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normaliza medidas para garantir consistência de unidade no PDF.

    - Padrão atual: comprimentos em mm.
    - Compatibilidade: converte automaticamente de cm->mm quando detectar
      conjunto claramente em cm (laudos antigos).
    """
    medidas_norm = dict(medidas or {})

    valores_comprimento = []
    for chave in CHAVES_COMPRIMENTO_MM:
        valor = _to_float(medidas_norm.get(chave))
        if valor and valor > 0:
            valores_comprimento.append(valor)

    if len(valores_comprimento) < 3:
        return medidas_norm

    qtd_cm_like = sum(1 for v in valores_comprimento if 0.3 <= v <= 3.5)
    qtd_mm_like = sum(1 for v in valores_comprimento if v >= 5.0)

    # Heurística: maioria em faixa típica de cm e sem sinais fortes de mm.
    if qtd_cm_like >= 3 and qtd_cm_like >= (qtd_mm_like * 2):
        for chave in CHAVES_COMPRIMENTO_MM:
            valor = _to_float(medidas_norm.get(chave))
            if valor and valor > 0:
                medidas_norm[chave] = round(valor * 10, 2)

    return medidas_norm


def recalcular_dived_normalizado_para_pdf(dados_pdf: Dict[str, Any]) -> None:
    """
    Recalcula DIVEd normalizado no PDF:
    DIVEd normalizado = (DIVEd em cm) / (peso^0,294).
    """
    medidas = dados_pdf.get("medidas")
    if not isinstance(medidas, dict):
        return

    paciente = dados_pdf.get("paciente")
    paciente_dict = paciente if isinstance(paciente, dict) else {}

    peso_kg = _to_float_peso(paciente_dict.get("peso"))
    if peso_kg is None or peso_kg <= 0:
        return
    for diameter_key, normalized_key in (
        ("DIVEd", "DIVEd_normalizado"),
        ("DIVEd_2D", "DIVEd_normalizado_2D"),
    ):
        dived_mm = _to_float(medidas.get(diameter_key))
        if dived_mm is None or dived_mm <= 0:
            continue
        dived_cm = dived_mm / 10.0
        medidas[normalized_key] = round(dived_cm / (peso_kg ** 0.294), 2)


def _bloco_sem_quebra(*flowables):
    """
    Retorna um bloco que tenta manter os elementos juntos na mesma pagina.
    Se nao houver espaco suficiente, o bloco inicia na pagina seguinte.
    """
    itens = [f for f in flowables if f is not None]
    return KeepTogether(itens)


def formatar_referencia(ref_min: Optional[float], ref_max: Optional[float], unidade: str) -> str:
    """Formata faixa de referência incluindo unidade quando aplicável."""
    if ref_min is None or ref_max is None:
        return "--"
    if ref_min == 0 and ref_max == 0:
        return "--"
    sufixo = f" {unidade}" if unidade else ""
    return f"{ref_min:.2f} - {ref_max:.2f}{sufixo}"


def interpretar_parametro(valor: float, ref_min: float, ref_max: float) -> Tuple[str, colors.Color]:
    """
    Retorna interpretação textual e cor com base na faixa de referência.
    """
    if ref_min is None or ref_max is None:
        return "", COR_PRETO

    if valor < ref_min:
        return "Abaixo", colors.HexColor("#2563eb")
    if valor > ref_max:
        return "Acima", colors.HexColor("#dc2626")
    return "Normal", colors.HexColor("#15803d")


# Mapeamento: chave da medida no laudo -> prefixo de campo na tabela referencias_eco
MAPEAMENTO_REFERENCIA_ECO = {
    "DIVEd": "lvid_d",
    "DIVES": "lvid_s",
    "SIVd": "ivs_d",
    "SIVs": "ivs_s",
    "PLVEd": "lvpw_d",
    "PLVES": "lvpw_s",
    "DIVEd_2D": "lvid_d",
    "DIVES_2D": "lvid_s",
    "SIVd_2D": "ivs_d",
    "SIVs_2D": "ivs_s",
    "PLVEd_2D": "lvpw_d",
    "PLVES_2D": "lvpw_s",
    "VDF": "edv",
    "VDF_2D": "edv",
    "VSF": "esv",
    "VSF_2D": "esv",
    "FE_Teicholz": "ef",
    "FE_Teicholz_2D": "ef",
    "DeltaD_FS": "fs",
    "DeltaD_FS_2D": "fs",
    "TAPSE": "tapse",
    "MAPSE": "mapse",
    "Aorta": "ao",
    "Atrio_esquerdo": "la",
    "AE_Ao": "la_ao",
    "Ao_nivel_AP": "ao",
    "AP": "ap",
    "AP_Ao": "ap_ao",
    "Onda_E": "mv_e",
    "Onda_A": "mv_a",
    "E_A": "mv_ea",
    "TD": "mv_dt",
    "TRIV": "ivrt",
    "e_doppler": "tdi_e",
    "a_doppler": "tdi_a",
    "E_E_linha": "e_e_linha",
    "Vmax_aorta": "vmax_ao",
    "Vmax_pulmonar": "vmax_pulm",
}


def aplicar_referencia_eco(parametros: List[Dict], referencia_eco: Optional[Dict[str, Any]]) -> List[Dict]:
    """
    Aplica os valores de referência vindos da tabela referencias_eco aos parâmetros do PDF.

    Quando a referência existe, qualquer faixa fixa hardcoded é removida e só permanecem
    os campos realmente presentes na tabela para evitar mostrar valores inexistentes.
    """
    if not referencia_eco:
        return parametros

    params_atualizados: List[Dict] = []
    for param in parametros:
        atualizado = dict(param)

        prefixo = MAPEAMENTO_REFERENCIA_ECO.get(str(param.get("chave", "")))
        if prefixo:
            ref_min = referencia_eco.get(f"{prefixo}_min")
            ref_max = referencia_eco.get(f"{prefixo}_max")
            if ref_min is not None and ref_max is not None:
                if str(param.get("chave")) in {"e_doppler", "a_doppler"}:
                    ref_min = float(ref_min) / 100
                    ref_max = float(ref_max) / 100
                atualizado["ref_min"] = ref_min
                atualizado["ref_max"] = ref_max

        params_atualizados.append(atualizado)

    return params_atualizados


def create_pdf_styles():
    """Cria estilos para o PDF"""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'TituloPrincipal',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=COR_PRETO,
        spaceAfter=6,
        alignment=1,  # Center
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        'TituloPrincipalLeft',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=COR_PRETO,
        spaceAfter=6,
        alignment=0,  # Left (alinhado às tabelas no cabeçalho)
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        'Subtitulo',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=COR_PRETO,
        spaceAfter=12,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        'InfoLabel',
        parent=styles['Normal'],
        fontSize=9,
        textColor=COR_CINZA_MEDIO,
        fontName='Helvetica'
    ))
    
    styles.add(ParagraphStyle(
        'InfoValue',
        parent=styles['Normal'],
        fontSize=9,
        textColor=COR_PRETO,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        'SecaoTitulo',
        parent=styles['Heading3'],
        fontSize=13,
        textColor=COR_BRANCO,
        backColor=COR_PRIMARIA,
        spaceAfter=6,
        spaceBefore=12,
        leftIndent=0,
        rightIndent=0,
        fontName='Helvetica-Bold'
    ))
    
    # Estilo para títulos de tabela (texto branco em fundo preto)
    styles.add(ParagraphStyle(
        'TabelaTitulo',
        parent=styles['Normal'],
        fontSize=10,
        textColor=COR_BRANCO,
        fontName='Helvetica-Bold'
    ))
    
    # Estilo para cabeçalhos de coluna (texto branco em fundo cinza)
    styles.add(ParagraphStyle(
        'TabelaHeader',
        parent=styles['Normal'],
        fontSize=9,
        textColor=COR_BRANCO,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        'QualitativaLabel',
        parent=styles['Normal'],
        fontSize=10,
        textColor=COR_CINZA_ESCURO,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        'QualitativaTexto',
        parent=styles['Normal'],
        fontSize=10,
        textColor=COR_PRETO,
        fontName='Helvetica'
    ))
    
    styles.add(ParagraphStyle(
        'Conclusao',
        parent=styles['Normal'],
        fontSize=11,
        textColor=COR_PRETO,
        fontName='Helvetica',
        spaceAfter=6,
        leading=14
    ))
    
    styles.add(ParagraphStyle(
        'Rodape',
        parent=styles['Normal'],
        fontSize=8,
        textColor=COR_CINZA_MEDIO,
        alignment=1,
        fontName='Helvetica-Oblique'
    ))
    
    return styles


def criar_titulo_secao(texto: str) -> Table:
    """Cria o título de seção (ANÁLISE QUANTITATIVA, etc.) como tabela de uma célula
    com a mesma largura das tabelas de dados, para alinhar a linha e o bloco."""
    styles = create_pdf_styles()
    data = [[Paragraph(texto, styles['SecaoTitulo'])]]
    table = Table(data, colWidths=[LARGURA_TABELAS])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COR_PRIMARIA),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return table


# Dimensões da logo (tamanho original no cabeçalho)
MAX_LOGO_WIDTH = 55 * mm
MAX_LOGO_HEIGHT = 40 * mm
# Coluna da logo menor para o título "LAUDO ECOCARDIOGRÁFICO" ficar alinhado à esquerda com as tabelas
LARGURA_COLUNA_LOGO =50 * mm


def criar_cabecalho(
    dados: Dict[str, Any],
    temp_logo_path: str = None,
    titulo_principal: str = "LAUDO ECOCARDIOGRAFICO",
    mostrar_linha_ritmo: bool = True,
    label_data_exame: str = "Data do exame",
) -> List:
    """Cria o cabecalho do laudo com bloco de titulo e grade de informacoes."""
    elements = []
    styles = create_pdf_styles()
    paciente = dados.get("paciente", {})
    clinica = dados.get("clinica", "")
    data_exame = paciente.get("data_exame", datetime.now().strftime("%d/%m/%Y"))

    titulo_bloco_style = ParagraphStyle(
        "CabecalhoTituloBloco",
        parent=styles["TituloPrincipalLeft"],
        fontSize=17,
        leading=19,
        spaceAfter=0,
    )
    info_card_style = ParagraphStyle(
        "CabecalhoInfoCard",
        parent=styles["Normal"],
        fontSize=10,
        leading=12,
        textColor=COR_PRETO,
    )

    def _valor_padrao(valor: Any) -> str:
        texto = str(valor).strip() if valor not in (None, "") else ""
        return texto or "-"

    def _montar_linha(*partes: str) -> str:
        partes_validas = [parte for parte in partes if parte and parte != "-"]
        return " | ".join(partes_validas) if partes_validas else "-"

    def _criar_card_info(label: str, valor: str) -> Paragraph:
        return Paragraph(
            f"<font name='Helvetica-Bold' size='7' color='#6b7280'>{_esc(label.upper())}</font><br/>"
            f"{_esc(valor)}",
            info_card_style,
        )

    def _adicionar_card(cards: List[Tuple[str, str]], label: str, valor: str, obrigatorio: bool = False) -> None:
        if obrigatorio or valor != "-":
            cards.append((label, valor))

    if temp_logo_path and os.path.exists(temp_logo_path):
        try:
            img_reader = ImageReader(temp_logo_path)
            img_width, img_height = img_reader.getSize()
            aspect = img_height / float(img_width) if img_width else 1
            if aspect > (MAX_LOGO_HEIGHT / MAX_LOGO_WIDTH):
                draw_height = MAX_LOGO_HEIGHT
                draw_width = MAX_LOGO_HEIGHT / aspect
            else:
                draw_width = MAX_LOGO_WIDTH
                draw_height = MAX_LOGO_WIDTH * aspect
            logo = Image(temp_logo_path, width=draw_width, height=draw_height)
            logo.hAlign = "LEFT"
            subtitulo_linhas = [
                "<font size='8' color='#6b7280'>CARDIOLOGIA VETERINARIA</font>",
                f"<font size='17'><b>{_esc(titulo_principal)}</b></font>",
            ]
            linha_secundaria = _montar_linha(_valor_padrao(clinica), _valor_padrao(data_exame))
            if linha_secundaria != "-":
                subtitulo_linhas.append(
                    f"<font size='9' color='#374151'>{_esc(linha_secundaria)}</font>"
                )
            titulo = Paragraph("<br/>".join(subtitulo_linhas), titulo_bloco_style)
            largura_titulo = LARGURA_TABELAS - LARGURA_COLUNA_LOGO
            header_data = [[logo, titulo]]
            header_table = Table(header_data, colWidths=[LARGURA_COLUNA_LOGO, largura_titulo])
            header_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "LEFT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, -1), 0.8, COR_CINZA_CLARO),
            ]))
            elements.append(header_table)
        except Exception as e:
            print(f"Erro ao adicionar logomarca: {e}")
            elements.append(Paragraph(_esc(titulo_principal), styles["TituloPrincipal"]))
    else:
        titulo_sem_logo = [
            "<font size='8' color='#6b7280'>CARDIOLOGIA VETERINARIA</font>",
            f"<font size='17'><b>{_esc(titulo_principal)}</b></font>",
        ]
        linha_secundaria = _montar_linha(_valor_padrao(clinica), _valor_padrao(data_exame))
        if linha_secundaria != "-":
            titulo_sem_logo.append(
                f"<font size='9' color='#374151'>{_esc(linha_secundaria)}</font>"
            )
        elements.append(Paragraph("<br/>".join(titulo_sem_logo), titulo_bloco_style))

    elements.append(Spacer(1, 2.5 * mm))

    peso = paciente.get("peso", "")
    peso_str = f"{peso} kg" if peso not in (None, "", "N/A") else "-"
    ritmo = (paciente.get("ritmo", "") or "").strip()
    fc = (paciente.get("fc", "") or "").strip()
    estado = (paciente.get("estado", "") or "").strip()
    fc_str = f"{fc} bpm" if fc else ""

    cards: List[Tuple[str, str]] = []
    _adicionar_card(cards, "Paciente", _valor_padrao(paciente.get("nome")), obrigatorio=True)
    _adicionar_card(cards, "Tutor", _valor_padrao(paciente.get("tutor")), obrigatorio=True)
    _adicionar_card(
        cards,
        "Especie | Raca",
        _montar_linha(_valor_padrao(paciente.get("especie")), _valor_padrao(paciente.get("raca"))),
        obrigatorio=True,
    )
    _adicionar_card(
        cards,
        "Sexo | Idade | Peso",
        _montar_linha(_valor_padrao(paciente.get("sexo")), _valor_padrao(paciente.get("idade")), peso_str),
        obrigatorio=True,
    )
    _adicionar_card(cards, "Solicitante", _valor_padrao(paciente.get("solicitante")))
    _adicionar_card(cards, "Clinica", _valor_padrao(clinica))
    _adicionar_card(cards, label_data_exame, _valor_padrao(data_exame), obrigatorio=True)

    if mostrar_linha_ritmo and any([ritmo, fc_str, estado]):
        cards.append(("Ritmo | FC | Estado", _montar_linha(ritmo, fc_str, estado)))

    if len(cards) % 2 != 0:
        cards.append(("", ""))

    info_data = []
    for idx in range(0, len(cards), 2):
        linha = []
        for label, valor in cards[idx:idx + 2]:
            if label:
                linha.append(_criar_card_info(label, valor))
            else:
                linha.append(Paragraph("", info_card_style))
        info_data.append(linha)

    info_table = Table(info_data, colWidths=[90 * mm, 90 * mm])
    info_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, COR_CINZA_CLARO),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, COR_CINZA_CLARO),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(_bloco_sem_quebra(info_table))
    elements.append(Spacer(1, 3 * mm))

    return elements


def criar_tabela_medidas(titulo: str, parametros: List[Dict], dados: Dict[str, Any], 
                         mostrar_referencia: bool = True, mostrar_interpretacao: bool = False) -> Table:
    """Cria uma tabela de medidas ecocardiográficas
    
    Args:
        titulo: Título da seção
        parametros: Lista de parâmetros com chave, label, unidade, ref_min, ref_max
        dados: Dicionário com os valores das medidas
        mostrar_referencia: Se True, mostra coluna de referência
        mostrar_interpretacao: Se True, mostra coluna de interpretação
    """
    styles = create_pdf_styles()
    
    # Determinar colunas a exibir
    colunas = ["Parâmetro", "Valor"]
    if mostrar_referencia:
        colunas.append("Referência")
    if mostrar_interpretacao:
        colunas.append("Interpretação")
    
    # Calcular larguras das colunas - ajustado para layout do modelo
    num_colunas = len(colunas)
    if num_colunas == 2:
        col_widths = [130*mm, 50*mm]
    elif num_colunas == 3:
        col_widths = [100*mm, 40*mm, 40*mm]
    else:  # 4 colunas
        col_widths = [80*mm, 35*mm, 35*mm, 30*mm]
    
    # Cabeçalho da tabela (título da seção) - texto branco em fundo azul
    header_cells = [Paragraph(f"<b>{titulo}</b>", styles['TabelaTitulo'])] + [''] * (num_colunas - 1)
    data = [header_cells]
    
    # Sub-cabeçalho com nomes das colunas - texto escuro em fundo claro
    subheader_cells = [Paragraph(f"<b>{col}</b>", styles['TabelaHeader']) for col in colunas]
    data.append(subheader_cells)
    
    # Dados
    for param in parametros:
        chave = param['chave']
        label = param['label']
        unidade = param.get('unidade', '')
        ref_min = param.get('ref_min')
        ref_max = param.get('ref_max')
        ref_text = param.get('ref_text')  # Referência em texto fixo (ex: ">0,25 m/s")
        
        valor = dados.get('medidas', {}).get(chave, 0)
        valor_float = _to_float(valor) or 0
        
        # Formata valor
        if valor_float == 0:
            valor_str = "--"
            ref_str = (ref_text if ref_text else formatar_referencia(ref_min, ref_max, unidade)) if mostrar_referencia else ""
            interp_str = ""
            interp_color = COR_PRETO
        else:
            valor_str = f"{valor_float:.2f} {unidade}".strip()
            ref_str = (ref_text if ref_text else formatar_referencia(ref_min, ref_max, unidade)) if mostrar_referencia else ""
            
            if ref_min is not None and ref_max is not None and not (ref_min == 0 and ref_max == 0):
                interp_str, interp_color = interpretar_parametro(valor_float, ref_min, ref_max)
            else:
                interp_str = ""
                interp_color = COR_PRETO
        
        # Construir linha conforme colunas visíveis
        row = [
            Paragraph(label, styles['Normal']),
            Paragraph(valor_str, styles['Normal'])
        ]
        if mostrar_referencia:
            row.append(Paragraph(ref_str, styles['Normal']))
        if mostrar_interpretacao:
            row.append(Paragraph(f"<font color='{interp_color.hexval()}'>{interp_str}</font>", styles['Normal']))
        
        data.append(row)
    
    # Criar tabela
    table = Table(data, colWidths=col_widths)
    
    # Estilos base - cores do modelo original
    table_style = [
        # Título da seção (fundo azul escuro)
        ('BACKGROUND', (0, 0), (-1, 0), COR_PRIMARIA),
        ('TEXTCOLOR', (0, 0), (-1, 0), COR_BRANCO),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, 0), 6),
        
        # Cabeçalho das colunas (fundo cinza, texto branco)
        ('BACKGROUND', (0, 1), (-1, 1), COR_HEADER_BG),
        ('TEXTCOLOR', (0, 1), (-1, 1), COR_BRANCO),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 9),
        ('ALIGN', (1, 1), (-1, 1), 'CENTER'),
        
        # Linhas de dados
        ('FONTSIZE', (0, 2), (-1, -1), 9),
        ('ALIGN', (1, 2), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        
        # Grade
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BOX', (0, 0), (-1, -1), 1, COR_PRIMARIA),
        
        # Alternância de cores nas linhas de dados
        ('ROWBACKGROUNDS', (0, 2), (-1, -1), [COR_BRANCO, COR_CINZA_CLARO]),
    ]
    
    table.setStyle(TableStyle(table_style))
    
    return table


def criar_tabela_medidas_com_interpretacao(titulo: str, parametros: List[Dict], dados: Dict[str, Any]) -> Table:
    """Cria uma tabela de medidas com colunas Valor, Referência e Interpretação
    
    Usado para seções como Átrio Esquerdo/Aorta, Doppler-Saídas, etc.
    """
    styles = create_pdf_styles()
    
    colunas = ["Parâmetro", "Valor", "Referência", "Interpretação"]
    col_widths = [80*mm, 30*mm, 35*mm, 35*mm]
    
    # Cabeçalho da tabela - texto branco em fundo azul
    header_cells = [Paragraph(f"<b>{titulo}</b>", styles['TabelaTitulo'])] + [''] * 3
    data = [header_cells]
    
    # Sub-cabeçalho - texto escuro em fundo claro
    subheader_cells = [Paragraph(f"<b>{col}</b>", styles['TabelaHeader']) for col in colunas]
    data.append(subheader_cells)
    
    # Dados
    for param in parametros:
        chave = param['chave']
        label = param['label']
        unidade = param.get('unidade', '')
        ref_min = param.get('ref_min')
        ref_max = param.get('ref_max')
        
        valor = dados.get('medidas', {}).get(chave, 0)
        valor_float = _to_float(valor) or 0
        
        if valor_float == 0:
            valor_str = "--"
            ref_str = "--"
            interp_str = ""
            interp_color = COR_PRETO
        else:
            valor_str = f"{valor_float:.2f} {unidade}".strip()
            ref_str = formatar_referencia(ref_min, ref_max, "")
            
            if ref_min is not None and ref_max is not None and not (ref_min == 0 and ref_max == 0):
                interp_str, interp_color = interpretar_parametro(valor_float, ref_min, ref_max)
            else:
                interp_str = "--"
                interp_color = COR_PRETO
        
        row = [
            Paragraph(label, styles['Normal']),
            Paragraph(valor_str, styles['Normal']),
            Paragraph(ref_str, styles['Normal']),
            Paragraph(f"<font color='{interp_color.hexval()}'>{interp_str}</font>", styles['Normal'])
        ]
        data.append(row)
    
    table = Table(data, colWidths=col_widths)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), COR_PRIMARIA),
        ('TEXTCOLOR', (0, 0), (-1, 0), COR_BRANCO),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, 0), 6),
        
        ('BACKGROUND', (0, 1), (-1, 1), COR_HEADER_BG),
        ('TEXTCOLOR', (0, 1), (-1, 1), COR_BRANCO),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 9),
        ('ALIGN', (1, 1), (-1, 1), 'CENTER'),
        
        ('FONTSIZE', (0, 2), (-1, -1), 9),
        ('ALIGN', (1, 2), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BOX', (0, 0), (-1, -1), 1, COR_PRIMARIA),
        ('ROWBACKGROUNDS', (0, 2), (-1, -1), [COR_BRANCO, COR_CINZA_CLARO]),
    ]
    
    table.setStyle(TableStyle(table_style))
    return table


def criar_secao_ad_vd(texto: str) -> List:
    """Cria a seção AD/VD como texto (não tabela) - conforme modelo de referência"""
    elements = []
    styles = create_pdf_styles()
    
    if not texto or not texto.strip():
        return elements
    
    # Título da seção - texto branco em fundo azul
    titulo_data = [[Paragraph("<b>AD/VD (Subjetivo)</b>", styles['TabelaTitulo'])]]
    titulo_table = Table(titulo_data, colWidths=[180*mm])
    titulo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COR_PRIMARIA),
        ('LEFTPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
    ]))
    # Texto do AD/VD
    texto_data = [[Paragraph(_esc(texto.strip()), styles['Normal'])]]
    texto_table = Table(texto_data, colWidths=[180*mm])
    texto_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COR_BRANCO),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    elements.append(_bloco_sem_quebra(titulo_table, texto_table))
    
    return elements


def criar_secao_qualitativa(qualitativa: Dict[str, str]) -> List:
    """Cria a seção de análise qualitativa com hierarquia visual por grupo."""
    elements = []
    styles = create_pdf_styles()
    grupo_style = ParagraphStyle(
        "QualitativaGrupo",
        parent=styles["QualitativaLabel"],
        fontSize=10.5,
        textColor=COR_PRETO,
        spaceAfter=1,
    )
    item_label_style = ParagraphStyle(
        "QualitativaItemLabel",
        parent=styles["QualitativaTexto"],
        leftIndent=4 * mm,
        spaceAfter=0.5 * mm,
    )
    item_body_style = ParagraphStyle(
        "QualitativaItemBody",
        parent=styles["QualitativaTexto"],
        leftIndent=9 * mm,
        spaceAfter=1.5 * mm,
        leading=12,
    )
    bloco_texto_style = ParagraphStyle(
        "QualitativaBlocoTexto",
        parent=styles["QualitativaTexto"],
        leftIndent=4 * mm,
        spaceAfter=1.5 * mm,
        leading=12,
    )

    def _quebrar_itens(texto_bruto: str) -> List[str]:
        itens: List[str] = []
        atual = ""
        for linha in texto_bruto.splitlines():
            linha_limpa = linha.strip()
            if not linha_limpa:
                continue
            if linha_limpa.startswith(("-", "*", "•")):
                if atual:
                    itens.append(atual.strip())
                atual = linha_limpa[1:].strip()
            elif atual:
                atual = f"{atual} {linha_limpa}"
            else:
                atual = linha_limpa
        if atual:
            itens.append(atual.strip())
        return itens

    campos = [
        ("valvas", "Valvas"),
        ("camaras", "Câmaras esquerdas"),
        ("ad_vd", "Câmaras direitas"),
        ("funcao", "Função"),
        ("pericardio", "Pericárdio"),
        ("vasos", "Vasos sanguíneos"),
    ]
    grupos_renderizados = []

    for chave, label in campos:
        texto = qualitativa.get(chave, "").strip()
        if not texto:
            continue

        bloco = [Paragraph(_esc(label), grupo_style)]
        itens = _quebrar_itens(texto)

        if itens:
            for item in itens:
                titulo_item, separador, corpo_item = item.partition(":")
                titulo_item = titulo_item.strip()
                corpo_item = corpo_item.strip()

                if separador:
                    bloco.append(
                        Paragraph(f"&bull; <b>{_esc(titulo_item)}</b>", item_label_style)
                    )
                    bloco.append(Paragraph(_esc(corpo_item), item_body_style))
                else:
                    bloco.append(Paragraph(f"&bull; {_esc(item)}", bloco_texto_style))
        else:
            bloco.append(Paragraph(_esc(texto), bloco_texto_style))

        grupos_renderizados.append(_bloco_sem_quebra(*bloco))

    if not grupos_renderizados:
        return elements

    elements.append(
        _bloco_sem_quebra(
            Spacer(1, 4 * mm),
            criar_titulo_secao("ANÁLISE QUALITATIVA"),
            Spacer(1, 2 * mm),
            grupos_renderizados[0],
        )
    )
    elements.append(Spacer(1, 1.5 * mm))

    for grupo in grupos_renderizados[1:]:
        elements.append(grupo)
        elements.append(Spacer(1, 1.5 * mm))

    return elements


def criar_secao_pressao_arterial(pressao: Optional[Dict[str, Any]]) -> List:
    """Cria secao de pressao arterial para laudo eco quando houver dados anexados."""
    elements = []
    styles = create_pdf_styles()

    if not pressao:
        return elements

    def _to_int(value: Any) -> Optional[int]:
        try:
            if value is None or value == "":
                return None
            if isinstance(value, str):
                value = value.replace(",", ".").strip()
            return int(round(float(value)))
        except Exception:
            return None

    pas_1 = _to_int(pressao.get("pas_1"))
    pas_2 = _to_int(pressao.get("pas_2"))
    pas_3 = _to_int(pressao.get("pas_3"))
    pas_media = _to_int(pressao.get("pas_media"))

    valores = [v for v in [pas_1, pas_2, pas_3] if v is not None and v > 0]
    if pas_media is None and valores:
        pas_media = int(round(sum(valores) / len(valores)))

    metodo = (pressao.get("metodo") or "Doppler").strip() or "Doppler"
    manguito = (pressao.get("manguito") or "").strip()
    membro = (pressao.get("membro") or "").strip()
    decubito = (pressao.get("decubito") or "").strip()
    obs_extra = (pressao.get("obs_extra") or "").strip()

    tem_medicoes = bool(valores or (pas_media is not None and pas_media > 0))
    if not tem_medicoes:
        return elements

    classificacao = "Sem classificacao (media indisponivel)."
    if pas_media is not None and pas_media > 0:
        if pas_media <= 140:
            classificacao = "Normal (110 a 140 mmHg)"
        elif pas_media <= 159:
            classificacao = "Levemente elevada (141 a 159 mmHg)"
        elif pas_media <= 179:
            classificacao = "Moderadamente elevada (160 a 179 mmHg)"
        else:
            classificacao = "Severamente elevada (>= 180 mmHg)"

    resumo_label_style = ParagraphStyle(
        "PressaoResumoLabel",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=COR_CINZA_ESCURO,
        alignment=1,
        fontName="Helvetica-Bold",
    )
    resumo_valor_style = ParagraphStyle(
        "PressaoResumoValor",
        parent=styles["Normal"],
        fontSize=11,
        textColor=COR_PRETO,
        alignment=1,
        fontName="Helvetica-Bold",
        leading=13,
    )
    detalhe_label_style = ParagraphStyle(
        "PressaoDetalheLabel",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=COR_CINZA_ESCURO,
        alignment=1,
        fontName="Helvetica-Bold",
    )
    detalhe_valor_style = ParagraphStyle(
        "PressaoDetalheValor",
        parent=styles["Normal"],
        fontSize=9.5,
        textColor=COR_PRETO,
        alignment=1,
        leading=12,
    )
    texto_box_style = ParagraphStyle(
        "PressaoTextoBox",
        parent=styles["Normal"],
        fontSize=10,
        textColor=COR_PRETO,
        leading=13,
    )

    classificacao_bg = colors.HexColor("#ecfdf5")
    classificacao_border = colors.HexColor("#15803d")
    if pas_media is not None and pas_media > 0:
        if pas_media <= 140:
            classificacao_bg = colors.HexColor("#ecfdf5")
            classificacao_border = colors.HexColor("#15803d")
        elif pas_media <= 159:
            classificacao_bg = colors.HexColor("#fefce8")
            classificacao_border = colors.HexColor("#ca8a04")
        elif pas_media <= 179:
            classificacao_bg = colors.HexColor("#fff7ed")
            classificacao_border = colors.HexColor("#ea580c")
        else:
            classificacao_bg = colors.HexColor("#fef2f2")
            classificacao_border = colors.HexColor("#dc2626")

    bloco_secao = [Spacer(1, 4 * mm), criar_titulo_secao("PRESSAO ARTERIAL (ANEXO)"), Spacer(1, 2 * mm)]

    tabela_resumo = Table(
        [[
            Paragraph("1a afericao", resumo_label_style),
            Paragraph("2a afericao", resumo_label_style),
            Paragraph("3a afericao", resumo_label_style),
            Paragraph("PAS media", resumo_label_style),
        ], [
            Paragraph(f"{pas_1 or '-'} mmHg", resumo_valor_style),
            Paragraph(f"{pas_2 or '-'} mmHg", resumo_valor_style),
            Paragraph(f"{pas_3 or '-'} mmHg", resumo_valor_style),
            Paragraph(f"{pas_media or '-'} mmHg", resumo_valor_style),
        ]],
        colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm],
    )
    tabela_resumo.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, COR_CINZA_CLARO),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, COR_CINZA_CLARO),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    bloco_secao.append(tabela_resumo)
    bloco_secao.append(Spacer(1, 2 * mm))

    tabela_procedimento = Table(
        [[
            Paragraph("Metodo", detalhe_label_style),
            Paragraph("Manguito", detalhe_label_style),
            Paragraph("Membro", detalhe_label_style),
            Paragraph("Decubito", detalhe_label_style),
        ], [
            Paragraph(_esc(metodo or "-"), detalhe_valor_style),
            Paragraph(_esc(manguito or "-"), detalhe_valor_style),
            Paragraph(_esc(membro or "-"), detalhe_valor_style),
            Paragraph(_esc(decubito or "-"), detalhe_valor_style),
        ]],
        colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm],
    )
    tabela_procedimento.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, COR_CINZA_CLARO),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, COR_CINZA_CLARO),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    bloco_secao.append(tabela_procedimento)
    bloco_secao.append(Spacer(1, 2 * mm))

    tabela_classificacao = Table(
        [[Paragraph(f"<b>Classificacao PAS</b><br/>{_esc(classificacao)}", texto_box_style)]],
        colWidths=[180 * mm],
    )
    tabela_classificacao.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, classificacao_border),
        ("BACKGROUND", (0, 0), (-1, -1), classificacao_bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    bloco_secao.append(tabela_classificacao)

    if obs_extra:
        bloco_secao.append(Spacer(1, 2 * mm))
        tabela_obs = Table(
            [[Paragraph("<b>Observacoes adicionais</b><br/>" + _esc(obs_extra), texto_box_style)]],
            colWidths=[180 * mm],
        )
        tabela_obs.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, COR_CINZA_CLARO),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        bloco_secao.append(tabela_obs)

    elements.append(_bloco_sem_quebra(*bloco_secao))

    return elements


def criar_secao_conclusao(conclusao: str) -> List:
    """Cria a seção de conclusão"""
    elements = []
    styles = create_pdf_styles()
    
    if not conclusao or not conclusao.strip():
        return elements
    
    conclusao_box_style = ParagraphStyle(
        "ConclusaoBox",
        parent=styles["Conclusao"],
        fontSize=10.5,
        leading=14,
        spaceAfter=1.5 * mm,
    )
    conclusao_item_label_style = ParagraphStyle(
        "ConclusaoItemLabel",
        parent=styles["Conclusao"],
        leftIndent=4 * mm,
        spaceAfter=0.5 * mm,
    )
    conclusao_item_body_style = ParagraphStyle(
        "ConclusaoItemBody",
        parent=styles["Conclusao"],
        leftIndent=9 * mm,
        leading=14,
        spaceAfter=1.5 * mm,
    )

    def _separar_blocos(texto_bruto: str) -> List[str]:
        blocos: List[str] = []
        atual: List[str] = []
        for linha in texto_bruto.splitlines():
            if linha.strip():
                atual.append(linha.strip())
            elif atual:
                blocos.append("\n".join(atual).strip())
                atual = []
        if atual:
            blocos.append("\n".join(atual).strip())
        return blocos

    def _quebrar_itens(texto_bruto: str) -> List[str]:
        itens: List[str] = []
        atual = ""
        for linha in texto_bruto.splitlines():
            linha_limpa = linha.strip()
            if not linha_limpa:
                continue
            if linha_limpa.startswith(("-", "*", "•")):
                if atual:
                    itens.append(atual.strip())
                atual = linha_limpa[1:].strip()
            elif atual:
                atual = f"{atual} {linha_limpa}"
            else:
                atual = linha_limpa
        if atual:
            itens.append(atual.strip())
        return itens

    elements.append(Spacer(1, 4*mm))
    elements.append(criar_titulo_secao("CONCLUSÃO"))
    elements.append(Spacer(1, 2*mm))

    conteudo = []
    for bloco in _separar_blocos(conclusao.strip()):
        linhas_validas = [linha.strip() for linha in bloco.splitlines() if linha.strip()]
        tem_marcadores = any(linha.startswith(("-", "*", "•")) for linha in linhas_validas)

        if tem_marcadores:
            for item in _quebrar_itens(bloco):
                titulo_item, separador, corpo_item = item.partition(":")
                titulo_item = titulo_item.strip()
                corpo_item = corpo_item.strip()

                if separador:
                    conteudo.append(
                        Paragraph(f"&bull; <b>{_esc(titulo_item)}</b>", conclusao_item_label_style)
                    )
                    conteudo.append(Paragraph(_esc(corpo_item), conclusao_item_body_style))
                else:
                    conteudo.append(Paragraph(f"&bull; {_esc(item)}", conclusao_box_style))
        else:
            conteudo.append(
                Paragraph(_esc(bloco).replace("\n", "<br/>"), conclusao_box_style)
            )

    caixa_conclusao = Table([[conteudo]], colWidths=[180 * mm])
    caixa_conclusao.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, COR_CINZA_CLARO),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(_bloco_sem_quebra(caixa_conclusao))
    
    return elements


def criar_secao_assinatura(nome_veterinario: str, crmv: str = "", temp_assinatura_path: str = None) -> List:
    """Cria a seção de assinatura"""
    elements = []
    styles = create_pdf_styles()
    
    elements.append(Spacer(1, 10*mm))
    
    # Linha divisória antes da assinatura
    line_data = [['']]
    line_table = Table(line_data, colWidths=[180*mm])
    line_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 5*mm))
    
    # Se tem assinatura em imagem
    if temp_assinatura_path and os.path.exists(temp_assinatura_path):
        try:
            # Calcular dimensões preservando aspect ratio
            MAX_ASS_WIDTH = 50*mm
            MAX_ASS_HEIGHT = 25*mm
            
            img_reader = ImageReader(temp_assinatura_path)
            img_width, img_height = img_reader.getSize()
            aspect = img_height / float(img_width) if img_width else 1
            
            # Ajustar para caber no espaço máximo mantendo proporção
            if aspect > (MAX_ASS_HEIGHT / MAX_ASS_WIDTH):
                # Altura é o fator limitante
                draw_height = MAX_ASS_HEIGHT
                draw_width = MAX_ASS_HEIGHT / aspect
            else:
                # Largura é o fator limitante
                draw_width = MAX_ASS_WIDTH
                draw_height = MAX_ASS_WIDTH * aspect
            
            ass_img = Image(temp_assinatura_path, width=draw_width, height=draw_height)
            ass_img.hAlign = 'LEFT'
            elements.append(ass_img)
        except Exception as e:
            print(f"Erro ao adicionar assinatura: {e}")
    
    # Nome e CRMV
    elements.append(Paragraph(f"<b>{_esc(nome_veterinario)}</b>", styles['Normal']))
    if crmv:
        elements.append(Paragraph(f"Médico Veterinário - CRMV: {_esc(crmv)}", styles['Normal']))
    else:
        elements.append(Paragraph("Médico Veterinário", styles['Normal']))
    
    return elements


def criar_rodape(texto_rodape: str = None) -> List:
    """Cria o rodapé para o final do conteúdo (não usado mais, ver footer_todas_paginas)"""
    elements = []
    styles = create_pdf_styles()
    
    texto = texto_rodape or "Fort Cordis Cardiologia Veterinária | Fortaleza-CE"
    
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(_esc(texto), styles['Rodape']))
    
    return elements


def footer_todas_paginas(canvas_obj, doc, texto_rodape: str = None):
    """Adiciona rodapé em todas as páginas do PDF - conforme modelo de referência"""
    canvas_obj.saveState()
    
    texto = texto_rodape or "Fort Cordis Cardiologia Veterinária | Fortaleza-CE"
    
    # Configurações do rodapé
    canvas_obj.setFont('Helvetica-Oblique', 8)
    canvas_obj.setFillColor(COR_CINZA_MEDIO)
    
    # Posição do rodapé (centralizado na parte inferior)
    page_width = A4[0]
    y_position = 10*mm
    
    # Texto do rodapé centralizado
    canvas_obj.drawCentredString(page_width / 2, y_position, texto)
    
    canvas_obj.restoreState()


def gerar_pdf_laudo_eco(
    dados: Dict[str, Any],
    logomarca_bytes: bytes = None,
    assinatura_bytes: bytes = None,
    nome_veterinario: str = None,
    crmv: str = None,
    texto_rodape: str = None
) -> bytes:
    """
    Gera o PDF completo do laudo ecocardiográfico.
    
    Args:
        dados: Dicionário com:
            - paciente: dict com nome, especie, raca, sexo, idade, peso, tutor, data_exame
            - medidas: dict com valores das medidas
            - qualitativa: dict com valvas, camaras, funcao, pericardio, vasos, ad_vd
            - conclusao: string
            - clinica: string (opcional)
            - imagens: list de bytes (opcional)
        logomarca_bytes: bytes da imagem da logomarca
        assinatura_bytes: bytes da imagem da assinatura
        nome_veterinario: nome do veterinário para assinatura
        crmv: número do CRMV do veterinário
        texto_rodape: texto personalizado para o rodapé
    
    Returns:
        bytes: Conteúdo do PDF
    """
    temp_files = []
    
    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )
        
        elements = []
        
        # Criar arquivos temporários para imagens
        temp_logo_path = None
        temp_assinatura_path = None
        
        if logomarca_bytes:
            temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_logo.write(logomarca_bytes)
            temp_logo.close()
            temp_logo_path = temp_logo.name
            temp_files.append(temp_logo_path)
        
        if assinatura_bytes:
            temp_ass = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_ass.write(assinatura_bytes)
            temp_ass.close()
            temp_assinatura_path = temp_ass.name
            temp_files.append(temp_assinatura_path)
        
        # 1. Cabeçalho: logo + título, depois dados do paciente
        dados_pdf = dict(dados)
        dados_pdf["medidas"] = normalizar_medidas_para_pdf(dados.get("medidas", {}))
        recalcular_dived_normalizado_para_pdf(dados_pdf)
        elements.extend(criar_cabecalho(dados_pdf, temp_logo_path))

        # 2. Análise Quantitativa (título com mesma largura das tabelas)
        elements.append(criar_titulo_secao("ANÁLISE QUANTITATIVA"))
        elements.append(Spacer(1, 2*mm))
        
        # =================================================================
        # Definição dos parâmetros - Layout conforme modelo de referência
        # =================================================================
        
        # Grupo: VE - Modo B e Modo M (tabela única com todos os parâmetros)
        # Conforme solicitado: COM Referência, SEM Interpretação
        params_ve_modo_m = [
            {'chave': 'DIVEd', 'label': 'DIVEd (Diâmetro interno do VE em diástole)', 'unidade': 'mm', 'ref_min': 16.0, 'ref_max': 24.0},
            {'chave': 'DIVEd_normalizado', 'label': 'DIVEd normalizado (DIVEd [cm] / peso^0,294)', 'unidade': '', 'ref_min': 1.27, 'ref_max': 1.73},
            {'chave': 'SIVd', 'label': 'SIVd (Septo interventricular em diástole)', 'unidade': 'mm', 'ref_min': 3.5, 'ref_max': 5.5},
            {'chave': 'PLVEd', 'label': 'PLVEd (Parede livre do VE em diástole)', 'unidade': 'mm', 'ref_min': 3.5, 'ref_max': 5.5},
            {'chave': 'DIVES', 'label': 'DIVEs (Diâmetro interno do VE em sístole)', 'unidade': 'mm', 'ref_min': 9.0, 'ref_max': 16.0},
            {'chave': 'SIVs', 'label': 'SIVs (Septo interventricular em sístole)', 'unidade': 'mm', 'ref_min': 4.5, 'ref_max': 7.5},
            {'chave': 'PLVES', 'label': 'PLVEs (Parede livre do VE em sístole)', 'unidade': 'mm', 'ref_min': 5.0, 'ref_max': 8.0},
            {'chave': 'VDF', 'label': 'VDF (Teicholz)', 'unidade': 'ml', 'ref_min': 0, 'ref_max': 0},
            {'chave': 'VSF', 'label': 'VSF (Teicholz)', 'unidade': 'ml', 'ref_min': 0, 'ref_max': 0},
            {'chave': 'FE_Teicholz', 'label': 'FE (Teicholz)', 'unidade': '%', 'ref_min': 55, 'ref_max': 80},
            {'chave': 'DeltaD_FS', 'label': 'Delta D / %FS', 'unidade': '%', 'ref_min': 28, 'ref_max': 42},
            {'chave': 'TAPSE', 'label': 'TAPSE (excursão sistólica do plano anular tricúspide)', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'MAPSE', 'label': 'MAPSE (excursão sistólica do plano anular mitral)', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
        ]
        params_ve_modo_2d = [
            {'chave': 'DIVEd_2D', 'label': 'DIVEd 2D (Diâmetro interno do VE em diástole)', 'unidade': 'mm', 'ref_min': 16.0, 'ref_max': 24.0},
            {'chave': 'DIVEd_normalizado_2D', 'label': 'DIVEd normalizado 2D (DIVEd [cm] / peso^0,294)', 'unidade': '', 'ref_min': 1.27, 'ref_max': 1.73},
            {'chave': 'SIVd_2D', 'label': 'SIVd 2D (Septo interventricular em diástole)', 'unidade': 'mm', 'ref_min': 3.5, 'ref_max': 5.5},
            {'chave': 'PLVEd_2D', 'label': 'PLVEd 2D (Parede livre do VE em diástole)', 'unidade': 'mm', 'ref_min': 3.5, 'ref_max': 5.5},
            {'chave': 'DIVES_2D', 'label': 'DIVEs 2D (Diâmetro interno do VE em sístole)', 'unidade': 'mm', 'ref_min': 9.0, 'ref_max': 16.0},
            {'chave': 'SIVs_2D', 'label': 'SIVs 2D (Septo interventricular em sístole)', 'unidade': 'mm', 'ref_min': 4.5, 'ref_max': 7.5},
            {'chave': 'PLVES_2D', 'label': 'PLVEs 2D (Parede livre do VE em sístole)', 'unidade': 'mm', 'ref_min': 5.0, 'ref_max': 8.0},
            {'chave': 'VDF_2D', 'label': 'VDF 2D (Teicholz)', 'unidade': 'ml', 'ref_min': 0, 'ref_max': 0},
            {'chave': 'VSF_2D', 'label': 'VSF 2D (Teicholz)', 'unidade': 'ml', 'ref_min': 0, 'ref_max': 0},
            {'chave': 'FE_Teicholz_2D', 'label': 'FE 2D (Teicholz)', 'unidade': '%', 'ref_min': 55, 'ref_max': 80},
            {'chave': 'DeltaD_FS_2D', 'label': 'Delta D / %FS 2D', 'unidade': '%', 'ref_min': 28, 'ref_max': 42},
        ]
        
        # Grupo: Átrio Esquerdo / Aorta - SEM Interpretação
        params_ae_aorta = [
            {'chave': 'Aorta', 'label': 'Aorta', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'Atrio_esquerdo', 'label': 'Átrio esquerdo', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'AE_Ao', 'label': 'AE/Ao (Átrio esquerdo/Aorta)', 'unidade': '', 'ref_min': 0.80, 'ref_max': 1.60},
        ]
        # Medidas específicas felinos (dentro da mesma tabela AE/Ao)
        paciente_especie = (dados_pdf.get("paciente") or {}).get("especie") or ""
        if paciente_especie.lower() == "felina":
            params_ae_aorta.extend([
                {'chave': 'Fracao_encurtamento_AE', 'label': 'Fração de encurtamento do AE (átrio esquerdo)', 'unidade': '%', 'ref_min': 21.0, 'ref_max': 25.0},
                {'chave': 'Fluxo_auricular', 'label': 'Fluxo auricular', 'unidade': 'm/s', 'ref_text': '>0,25 m/s'},
            ])
        
        # Grupo: Artéria Pulmonar / Aorta - SEM Interpretação
        params_ap_aorta = [
            {'chave': 'AP', 'label': 'AP (Artéria pulmonar)', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'Ao_nivel_AP', 'label': 'Ao (Aorta - nível AP)', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'AP_Ao', 'label': 'AP/Ao (Artéria pulmonar/Aorta)', 'unidade': '', 'ref_min': None, 'ref_max': None},
        ]
        
        # Grupo: Doppler - Saídas - SEM Interpretação
        params_doppler_saidas = [
            {'chave': 'Vmax_aorta', 'label': 'Vmax aorta', 'unidade': 'm/s', 'ref_min': 0.00, 'ref_max': 2.20},
            {'chave': 'Grad_aorta', 'label': 'Gradiente aorta', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
            {'chave': 'Vmax_pulmonar', 'label': 'Vmax pulmonar', 'unidade': 'm/s', 'ref_min': 0.00, 'ref_max': 2.20},
            {'chave': 'Grad_pulmonar', 'label': 'Gradiente pulmonar', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
        ]
        
        # Grupo: Diastólica - SEM Interpretação
        params_diastolica = [
            {'chave': 'Onda_E', 'label': 'Onda E', 'unidade': 'm/s', 'ref_min': 0.50, 'ref_max': 1.09},
            {'chave': 'Onda_A', 'label': 'Onda A', 'unidade': 'm/s', 'ref_min': 0.30, 'ref_max': 0.80},
            {'chave': 'E_A', 'label': 'E/A (relação E/A)', 'unidade': '', 'ref_min': 1.00, 'ref_max': 2.00},
            {'chave': 'TD', 'label': 'TD (tempo desaceleração)', 'unidade': 'ms', 'ref_min': 0.00, 'ref_max': 160.00},
            {'chave': 'TRIV', 'label': 'TRIV (tempo relaxamento isovolumétrico)', 'unidade': 'ms', 'ref_min': None, 'ref_max': None},
            {'chave': 'E_TRIV', 'label': 'E/TRIV (relação E/TRIV)', 'unidade': '', 'ref_text': '≤12; >12 sugestivo de congestão venosa pulmonar'},
            {'chave': 'MR_dp_dt', 'label': 'MR dp/dt', 'unidade': 'mmHg/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'e_doppler', 'label': "e' (Doppler tecidual)", 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'a_doppler', 'label': "a' (Doppler tecidual)", 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'doppler_tecidual_relacao', 'label': "Doppler tecidual (Relação e'/a')", 'unidade': '', 'ref_min': None, 'ref_max': None},
            {'chave': 'E_E_linha', 'label': "E/E'", 'unidade': '', 'ref_min': 0, 'ref_max': 12},
        ]
        
        # Grupo: Regurgitações - SEM Interpretação
        params_regurgitacoes = [
            {'chave': 'IM_Vmax', 'label': 'IM (insuficiência mitral) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IM_Grad', 'label': 'Gradiente da insuficiência mitral (4 × V²)', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
            {'chave': 'IT_Vmax', 'label': 'IT (insuficiência tricúspide) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IT_Grad', 'label': 'Gradiente da insuficiência tricúspide (4 × V²)', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
            {'chave': 'PAD_estimada', 'label': 'Pressão atrial direita estimada', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
            {'chave': 'PSAP', 'label': 'PSAP estimada (gradiente IT + PAD estimada)', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
            {'chave': 'IA_Vmax', 'label': 'IA (insuficiência aórtica) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IA_Grad', 'label': 'Gradiente da insuficiência aórtica (4 × V²)', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
            {'chave': 'IP_Vmax', 'label': 'IP (insuficiência pulmonar) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IP_Grad', 'label': 'Gradiente da insuficiência pulmonar (4 × V²)', 'unidade': 'mmHg', 'ref_min': None, 'ref_max': None},
        ]
        
        # Aplicar referências do banco de dados se disponíveis
        referencia_eco = dados_pdf.get("referencia_eco")
        params_ve_modo_m = aplicar_referencia_eco(params_ve_modo_m, referencia_eco)
        params_ve_modo_2d = aplicar_referencia_eco(params_ve_modo_2d, referencia_eco)
        params_ae_aorta = aplicar_referencia_eco(params_ae_aorta, referencia_eco)
        params_ap_aorta = aplicar_referencia_eco(params_ap_aorta, referencia_eco)
        params_doppler_saidas = aplicar_referencia_eco(params_doppler_saidas, referencia_eco)
        params_diastolica = aplicar_referencia_eco(params_diastolica, referencia_eco)
        params_regurgitacoes = aplicar_referencia_eco(params_regurgitacoes, referencia_eco)
        
        # =================================================================
        # Montar tabelas conforme modelo de referência
        # =================================================================
        
        medidas_pdf = dados_pdf.get("medidas") or {}
        tecnica_ve = str(medidas_pdf.get("VE_tecnica_relatorio") or "").lower()
        tem_modo_m = any(_to_float(medidas_pdf.get(item["chave"])) for item in params_ve_modo_m)
        tem_modo_2d = any(_to_float(medidas_pdf.get(item["chave"])) for item in params_ve_modo_2d)
        if tecnica_ve == "2d" or (tem_modo_2d and not tem_modo_m):
            titulo_ve = "VE - Modo 2D"
            params_ve_relatorio = params_ve_modo_2d
        else:
            titulo_ve = "VE - Modo M"
            params_ve_relatorio = params_ve_modo_m

        elements.append(
            _bloco_sem_quebra(
                criar_tabela_medidas(
                    titulo_ve,
                    params_ve_relatorio,
                    dados_pdf,
                    mostrar_referencia=True,
                    mostrar_interpretacao=False,
                ),
                Spacer(1, 3 * mm),
            )
        )
        
        # Átrio Esquerdo / Aorta: COM Referência, SEM Interpretação
        elements.append(
            _bloco_sem_quebra(
                criar_tabela_medidas(
                    "Átrio esquerdo/ Aorta",
                    params_ae_aorta,
                    dados_pdf,
                    mostrar_referencia=True,
                    mostrar_interpretacao=False,
                ),
                Spacer(1, 3 * mm),
            )
        )
        
        # Artéria Pulmonar / Aorta: COM Referência, SEM Interpretação
        elements.append(
            _bloco_sem_quebra(
                criar_tabela_medidas(
                    "Artéria pulmonar/ Aorta",
                    params_ap_aorta,
                    dados_pdf,
                    mostrar_referencia=True,
                    mostrar_interpretacao=False,
                ),
                Spacer(1, 3 * mm),
            )
        )
        
        # Doppler - Saídas: COM Referência, SEM Interpretação
        elements.append(
            _bloco_sem_quebra(
                criar_tabela_medidas(
                    "Doppler - Saídas",
                    params_doppler_saidas,
                    dados_pdf,
                    mostrar_referencia=True,
                    mostrar_interpretacao=False,
                ),
                Spacer(1, 3 * mm),
            )
        )
        
        # Diastólica: COM Referência, SEM Interpretação
        elements.append(
            _bloco_sem_quebra(
                criar_tabela_medidas(
                    "Diastólica",
                    params_diastolica,
                    dados_pdf,
                    mostrar_referencia=True,
                    mostrar_interpretacao=False,
                ),
                Spacer(1, 3 * mm),
            )
        )
        
        # Regurgitações: COM Referência, SEM Interpretação
        elements.append(
            _bloco_sem_quebra(
                criar_tabela_medidas(
                    "Regurgitações",
                    params_regurgitacoes,
                    dados_pdf,
                    mostrar_referencia=True,
                    mostrar_interpretacao=False,
                ),
                Spacer(1, 3 * mm),
            )
        )
        
        # 3. Análise Qualitativa
        qualitativa = dados_pdf.get('qualitativa', {})

        if qualitativa and any(qualitativa.get(k, '').strip() for k in ['valvas', 'camaras', 'ad_vd', 'funcao', 'pericardio', 'vasos']):
            elements.extend(criar_secao_qualitativa(qualitativa))

        # 4. Conclusao
        conclusao = dados_pdf.get('conclusao', '')
        elements.extend(criar_secao_conclusao(conclusao))

        # Pressao arterial anexada ao laudo ecocardiografico (quando existir)
        # Deve aparecer apos a conclusao no PDF.
        elements.extend(criar_secao_pressao_arterial(dados_pdf.get("pressao_arterial")))
        
        # 5. Assinatura
        vet_nome = nome_veterinario or dados_pdf.get('veterinario_nome') or "Médico Veterinário"
        vet_crmv = crmv or dados_pdf.get('veterinario_crmv') or ""
        elements.extend(criar_secao_assinatura(vet_nome, vet_crmv, temp_assinatura_path))
        
        # 6. Espaço antes das imagens (rodapé será adicionado automaticamente em todas as páginas)
        elements.append(Spacer(1, 5*mm))
        
        # 7. Imagens (se houver) - Layout conforme modelo de referência
        imagens = dados_pdf.get('imagens', [])
        if imagens:
            elements.append(PageBreak())
            elements.append(criar_titulo_secao("IMAGENS"))
            elements.append(Spacer(1, 5*mm))
            
            # Layout 2x3 (6 imagens por página) - similar ao modelo de referência
            IMG_WIDTH = 85*mm
            IMG_HEIGHT = 70*mm
            ESPACAMENTO = 3*mm
            
            # Processar imagens em grupos de 6
            for page_idx in range(0, len(imagens), 6):
                if page_idx > 0:
                    elements.append(PageBreak())
                    elements.append(criar_titulo_secao("IMAGENS"))
                    elements.append(Spacer(1, 5*mm))
                
                # Pegar até 6 imagens para esta página
                page_imagens = imagens[page_idx:page_idx + 6]
                
                # Criar grid 2x3 (2 colunas, 3 linhas)
                table_data = []
                row = []
                
                for idx, img_bytes in enumerate(page_imagens):
                    try:
                        if not img_bytes:
                            continue
                            
                        # Criar arquivo temporário para a imagem
                        temp_img = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                        temp_img.write(img_bytes)
                        temp_img.close()
                        temp_files.append(temp_img.name)
                        
                        # Adicionar imagem ao grid com proporção preservada
                        try:
                            img_reader = ImageReader(temp_img.name)
                            img_width, img_height = img_reader.getSize()
                            
                            # Calcular proporção para caber no espaço
                            aspect = img_height / float(img_width) if img_width else 1
                            if aspect > (IMG_HEIGHT / IMG_WIDTH):
                                draw_height = IMG_HEIGHT
                                draw_width = IMG_HEIGHT / aspect if aspect else IMG_WIDTH
                            else:
                                draw_width = IMG_WIDTH
                                draw_height = IMG_WIDTH * aspect
                        except:
                            draw_width = IMG_WIDTH
                            draw_height = IMG_HEIGHT
                        
                        img = Image(temp_img.name, width=draw_width, height=draw_height)
                        row.append(img)
                        
                        # Cada linha tem 2 imagens
                        if len(row) == 2:
                            table_data.append(row)
                            row = []
                    except Exception as e:
                        print(f"Erro ao adicionar imagem {page_idx + idx}: {e}")
                        import traceback
                        traceback.print_exc()
                
                # Adicionar última linha se incompleta
                if row:
                    while len(row) < 2:
                        row.append("")
                    table_data.append(row)
                
                # Criar tabela com as imagens
                if table_data:
                    col_widths = [IMG_WIDTH + ESPACAMENTO, IMG_WIDTH + ESPACAMENTO]
                    
                    img_table = Table(table_data, colWidths=col_widths)
                    img_table.setStyle(TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('LEFTPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        ('RIGHTPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        ('TOPPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                    ]))
                    elements.append(img_table)
                    elements.append(Spacer(1, 3*mm))
        
        # Gerar PDF com rodapé em todas as páginas
        rodape_texto = texto_rodape or "Fort Cordis Cardiologia Veterinária | Fortaleza-CE"
        
        def add_footer(canvas_obj, doc):
            footer_todas_paginas(canvas_obj, doc, rodape_texto)
        
        doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
        buffer.seek(0)
        return buffer.getvalue()
        
    finally:
        # Limpar arquivos temporários
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                print(f"Erro ao remover arquivo temporário {temp_file}: {e}")



def gerar_pdf_laudo_pressao(
    dados: Dict[str, Any],
    logomarca_bytes: bytes = None,
    assinatura_bytes: bytes = None,
    nome_veterinario: str = None,
    crmv: str = None,
    texto_rodape: str = None,
) -> bytes:
    """Gera PDF para laudo de pressao arterial."""
    temp_files = []

    def _to_int(value: Any) -> Optional[int]:
        try:
            if value is None or value == "":
                return None
            if isinstance(value, str):
                value = value.replace(",", ".").strip()
            return int(round(float(value)))
        except Exception:
            return None

    def _classificar_pas(pas_media: Optional[int]) -> str:
        if pas_media is None or pas_media <= 0:
            return "Sem classificacao (media indisponivel)."
        if pas_media <= 140:
            return "Normal (110 a 140 mmHg)"
        if pas_media <= 159:
            return "Levemente elevada (141 a 159 mmHg)"
        if pas_media <= 179:
            return "Moderadamente elevada (160 a 179 mmHg)"
        return "Severamente elevada (>=180 mmHg)"

    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        elements = []
        styles = create_pdf_styles()

        temp_logo_path = None
        temp_assinatura_path = None

        if logomarca_bytes:
            temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_logo.write(logomarca_bytes)
            temp_logo.close()
            temp_logo_path = temp_logo.name
            temp_files.append(temp_logo_path)

        if assinatura_bytes:
            temp_ass = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_ass.write(assinatura_bytes)
            temp_ass.close()
            temp_assinatura_path = temp_ass.name
            temp_files.append(temp_assinatura_path)

        dados_pdf = dict(dados or {})
        pressao = dados_pdf.get("pressao_arterial") or {}

        pas_1 = _to_int(pressao.get("pas_1")) or 0
        pas_2 = _to_int(pressao.get("pas_2")) or 0
        pas_3 = _to_int(pressao.get("pas_3")) or 0
        valores = [v for v in [pas_1, pas_2, pas_3] if v > 0]
        pas_media = _to_int(pressao.get("pas_media"))
        if pas_media is None and valores:
            pas_media = int(round(sum(valores) / len(valores)))

        metodo = (pressao.get("metodo") or "Doppler").strip() or "Doppler"
        manguito = (pressao.get("manguito") or "").strip()
        membro = (pressao.get("membro") or "").strip()
        decubito = (pressao.get("decubito") or "").strip()
        obs_extra = (pressao.get("obs_extra") or "").strip()

        elements.extend(
            criar_cabecalho(
                dados_pdf,
                temp_logo_path,
                titulo_principal="LAUDO DE PRESSAO ARTERIAL",
                mostrar_linha_ritmo=False,
            )
        )

        elements.append(_bloco_sem_quebra(criar_titulo_secao("LAUDO PRESSAO ARTERIAL"), Spacer(1, 2 * mm)))

        afericoes_txt = "<br/>".join([
            f"1a afericao: Pressao Sistolica {pas_1} mmHg",
            f"2a afericao: Pressao Sistolica {pas_2} mmHg",
            f"3a afericao: Pressao Sistolica {pas_3} mmHg",
            f"<b>PA Sistolica Media: {pas_media or 0} mmHg</b>",
            f"Metodo: {metodo}",
        ])

        observacoes_proc = []
        if manguito:
            observacoes_proc.append(f"Manguito: {manguito}")
        if membro:
            observacoes_proc.append(f"Membro: {membro}")
        if decubito:
            observacoes_proc.append(f"Decubito: {decubito}")
        if not observacoes_proc:
            observacoes_proc.append("Sem observacoes de procedimento.")

        box_data = [
            [Paragraph("<b>Afericao de Pressao Arterial</b>", styles['Normal']), Paragraph("<b>Observacoes do Procedimento</b>", styles['Normal'])],
            [Paragraph(afericoes_txt, styles['Normal']), Paragraph("<br/>".join(_esc(v) for v in observacoes_proc), styles['Normal'])],
        ]
        box_table = Table(box_data, colWidths=[90 * mm, 90 * mm])
        box_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.7, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        classificacao = dados_pdf.get("conclusao") or _classificar_pas(pas_media)
        bloco_pressao = [
            box_table,
            Spacer(1, 3 * mm),
            Paragraph(f"<b>Classificacao:</b> {_esc(classificacao)}", styles['Conclusao']),
        ]

        if obs_extra:
            bloco_pressao.extend([
                Spacer(1, 2 * mm),
                Paragraph(f"<b>Outras observacoes:</b> {_esc(obs_extra)}", styles['Normal']),
            ])

        bloco_pressao.append(Spacer(1, 4 * mm))
        elements.append(_bloco_sem_quebra(*bloco_pressao))

        refs = [
            "<b>Valores de Referencia (PAS)</b>",
            "Normal: 110 a 140 mmHg",
            "Levemente elevada: 141 a 159 mmHg",
            "Moderadamente elevada: 160 a 179 mmHg",
            "Severamente elevada: >=180 mmHg",
        ]
        ref_table = Table([[Paragraph("<br/>".join(refs), styles['Normal'])]], colWidths=[180 * mm])
        ref_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#15803d')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(_bloco_sem_quebra(ref_table))

        elements.append(Spacer(1, 4 * mm))
        elements.append(
            Paragraph(
                "<i>* Os valores de pressao arterial devem ser correlacionados com o quadro clinico e reavaliados quando necessario.</i>",
                styles['Normal'],
            )
        )
        elements.append(Spacer(1, 1 * mm))
        elements.append(
            Paragraph(
                "<i>* A pressao foi aferida por metodo Doppler e pode apresentar variacao em relacao ao metodo invasivo.</i>",
                styles['Normal'],
            )
        )

        vet_nome = nome_veterinario or dados_pdf.get('veterinario_nome') or "Medico Veterinario"
        vet_crmv = crmv or dados_pdf.get('veterinario_crmv') or ""
        elements.extend(criar_secao_assinatura(vet_nome, vet_crmv, temp_assinatura_path))

        rodape_texto = texto_rodape or "Fort Cordis Cardiologia Veterinaria | Fortaleza-CE"

        def add_footer(canvas_obj, doc_obj):
            footer_todas_paginas(canvas_obj, doc_obj, rodape_texto)

        doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
        buffer.seek(0)
        return buffer.getvalue()
    finally:
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                print(f"Erro ao remover arquivo temporario {temp_file}: {e}")



# Mantém compatibilidade com código anterior
gerar_pdf_laudo = gerar_pdf_laudo_eco


def gerar_pdf_laudo_ultrassom_abdominal(
    dados: Dict[str, Any],
    logomarca_bytes: bytes = None,
    assinatura_bytes: bytes = None,
    nome_veterinario: str = None,
    crmv: str = None,
    texto_rodape: str = None,
) -> bytes:
    """Gera PDF para laudo de ultrassonografia abdominal."""
    temp_files = []
    orgaos_ordenados = [
        ("figado", "Figado"),
        ("vesicula_biliar", "Vesicula biliar"),
        ("estomago", "Estomago"),
        ("alcas_intestinais", "Alcas intestinais"),
        ("duodeno", "Duodeno"),
        ("colon", "Colon"),
        ("juncao_ileo_ceco_colica", "Juncao ileo-ceco-colica"),
        ("baco", "Baco"),
        ("rins", "Rins"),
        ("bexiga", "Bexiga"),
        ("pancreas", "Pancreas"),
        ("adrenais", "Adrenais"),
        ("prostata", "Prostata"),
        ("testiculos", "Testiculos"),
        ("utero", "Utero"),
        ("ovarios", "Ovarios"),
    ]

    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        elements = []
        styles = create_pdf_styles()

        temp_logo_path = None
        temp_assinatura_path = None

        if logomarca_bytes:
            temp_logo = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_logo.write(logomarca_bytes)
            temp_logo.close()
            temp_logo_path = temp_logo.name
            temp_files.append(temp_logo_path)

        if assinatura_bytes:
            temp_ass = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            temp_ass.write(assinatura_bytes)
            temp_ass.close()
            temp_assinatura_path = temp_ass.name
            temp_files.append(temp_assinatura_path)

        dados_pdf = dict(dados or {})
        ultrassom = dados_pdf.get("ultrassonografia_abdominal") or {}
        qualitativa = ultrassom.get("qualitativa") or {}
        observacoes = (
            ultrassom.get("observacoes_gerais")
            or dados_pdf.get("observacoes")
            or ""
        ).strip()

        elements.extend(
            criar_cabecalho(
                dados_pdf,
                temp_logo_path,
                titulo_principal="LAUDO DE ULTRASSONOGRAFIA ABDOMINAL",
                mostrar_linha_ritmo=False,
            )
        )

        elements.append(
            _bloco_sem_quebra(
                criar_titulo_secao("AVALIACAO ULTRASSONOGRAFICA"),
                Spacer(1, 2 * mm),
            )
        )

        linhas = [
            [
                Paragraph("<b>Estrutura avaliada</b>", styles["Normal"]),
                Paragraph("<b>Descricao</b>", styles["Normal"]),
            ]
        ]

        for chave, label in orgaos_ordenados:
            texto = str(qualitativa.get(chave) or "").strip()
            if not texto:
                continue
            linhas.append(
                [
                    Paragraph(f"<b>{_esc(label)}</b>", styles["Normal"]),
                    Paragraph(_esc(texto).replace("\n", "<br/>"), styles["Normal"]),
                ]
            )

        if len(linhas) == 1:
            linhas.append(
                [
                    Paragraph("<b>Descricao</b>", styles["Normal"]),
                    Paragraph("Nenhum achado qualitativo informado.", styles["Normal"]),
                ]
            )

        tabela = Table(linhas, colWidths=[48 * mm, 132 * mm], repeatRows=1)
        tabela.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        elements.append(tabela)

        if observacoes:
            elements.append(Spacer(1, 4 * mm))
            elements.append(criar_titulo_secao("OBSERVACOES GERAIS"))
            elements.append(Spacer(1, 2 * mm))
            elements.append(
                Paragraph(_esc(observacoes).replace("\n", "<br/>"), styles["Conclusao"])
            )

        elements.append(Spacer(1, 4 * mm))
        elements.append(
            Paragraph(
                "<i>Os achados ultrassonograficos devem ser interpretados em conjunto com o quadro clinico, exames laboratoriais e demais exames complementares.</i>",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 1 * mm))
        elements.append(
            Paragraph(
                "<i>Este exame descreve as alteracoes identificadas ao metodo ultrassonografico no momento da avaliacao.</i>",
                styles["Normal"],
            )
        )

        vet_nome = nome_veterinario or dados_pdf.get("veterinario_nome") or "Medico Veterinario"
        vet_crmv = crmv or dados_pdf.get("veterinario_crmv") or ""
        elements.extend(criar_secao_assinatura(vet_nome, vet_crmv, temp_assinatura_path))

        imagens = dados_pdf.get("imagens", [])
        if imagens:
            elements.append(PageBreak())
            elements.append(criar_titulo_secao("IMAGENS"))
            elements.append(Spacer(1, 5 * mm))

            img_width_limite = 85 * mm
            img_height_limite = 70 * mm
            espacamento = 3 * mm

            for page_idx in range(0, len(imagens), 6):
                if page_idx > 0:
                    elements.append(PageBreak())
                    elements.append(criar_titulo_secao("IMAGENS"))
                    elements.append(Spacer(1, 5 * mm))

                page_imagens = imagens[page_idx : page_idx + 6]
                table_data = []
                row = []

                for idx, img_bytes in enumerate(page_imagens):
                    try:
                        if not img_bytes:
                            continue

                        temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                        temp_img.write(img_bytes)
                        temp_img.close()
                        temp_files.append(temp_img.name)

                        try:
                            img_reader = ImageReader(temp_img.name)
                            img_width, img_height = img_reader.getSize()
                            aspect = img_height / float(img_width) if img_width else 1
                            if aspect > (img_height_limite / img_width_limite):
                                draw_height = img_height_limite
                                draw_width = img_height_limite / aspect if aspect else img_width_limite
                            else:
                                draw_width = img_width_limite
                                draw_height = img_width_limite * aspect
                        except Exception:
                            draw_width = img_width_limite
                            draw_height = img_height_limite

                        row.append(Image(temp_img.name, width=draw_width, height=draw_height))
                        if len(row) == 2:
                            table_data.append(row)
                            row = []
                    except Exception as e:
                        print(f"Erro ao adicionar imagem {page_idx + idx}: {e}")

                if row:
                    while len(row) < 2:
                        row.append("")
                    table_data.append(row)

                if table_data:
                    img_table = Table(
                        table_data,
                        colWidths=[img_width_limite + espacamento, img_width_limite + espacamento],
                    )
                    img_table.setStyle(
                        TableStyle(
                            [
                                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                ("LEFTPADDING", (0, 0), (-1, -1), espacamento),
                                ("RIGHTPADDING", (0, 0), (-1, -1), espacamento),
                                ("TOPPADDING", (0, 0), (-1, -1), espacamento),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), espacamento),
                            ]
                        )
                    )
                    elements.append(img_table)
                    elements.append(Spacer(1, 3 * mm))

        rodape_texto = texto_rodape or "Fort Cordis Cardiologia Veterinaria | Fortaleza-CE"

        def add_footer(canvas_obj, doc_obj):
            footer_todas_paginas(canvas_obj, doc_obj, rodape_texto)

        doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
        buffer.seek(0)
        return buffer.getvalue()
    finally:
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                print(f"Erro ao remover arquivo temporario {temp_file}: {e}")
