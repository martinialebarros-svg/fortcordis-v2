"""Geração de PDF de laudos ecocardiográficos"""
import os
import tempfile
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

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


def formatar_referencia(ref_min: Optional[float], ref_max: Optional[float], unidade: str) -> str:
    """Formata faixa de referência incluindo unidade quando aplicável."""
    if ref_min is None or ref_max is None:
        return "--"
    if ref_min == 0 and ref_max == 0:
        return "--"
    sufixo = f" {unidade}" if unidade else ""
    return f"{ref_min:.2f} - {ref_max:.2f}{sufixo}"


# Mapeamento: chave da medida no laudo -> prefixo de campo na tabela referencias_eco
MAPEAMENTO_REFERENCIA_ECO = {
    "DIVEd": "lvid_d",
    "DIVES": "lvid_s",
    "SIVd": "ivs_d",
    "SIVs": "ivs_s",
    "PLVEd": "lvpw_d",
    "PLVES": "lvpw_s",
    "VDF": "edv",
    "VSF": "esv",
    "FE_Teicholz": "ef",
    "DeltaD_FS": "fs",
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
        atualizado["ref_min"] = None
        atualizado["ref_max"] = None

        prefixo = MAPEAMENTO_REFERENCIA_ECO.get(str(param.get("chave", "")))
        if prefixo:
            ref_min = referencia_eco.get(f"{prefixo}_min")
            ref_max = referencia_eco.get(f"{prefixo}_max")
            if ref_min is not None and ref_max is not None:
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


def criar_cabecalho(dados: Dict[str, Any], temp_logo_path: str = None) -> List:
    """Cria o cabeçalho do laudo com dados do paciente - formato do modelo de referência"""
    elements = []
    styles = create_pdf_styles()
    
    # Se tem logomarca, cria layout com imagem à esquerda + título centralizado
    if temp_logo_path and os.path.exists(temp_logo_path):
        try:
            # Calcular dimensões preservando aspect ratio
            MAX_LOGO_WIDTH = 35*mm
            MAX_LOGO_HEIGHT = 20*mm
            
            img_reader = ImageReader(temp_logo_path)
            img_width, img_height = img_reader.getSize()
            aspect = img_height / float(img_width) if img_width else 1
            
            # Ajustar para caber no espaço máximo mantendo proporção
            if aspect > (MAX_LOGO_HEIGHT / MAX_LOGO_WIDTH):
                # Altura é o fator limitante
                draw_height = MAX_LOGO_HEIGHT
                draw_width = MAX_LOGO_HEIGHT / aspect
            else:
                # Largura é o fator limitante
                draw_width = MAX_LOGO_WIDTH
                draw_height = MAX_LOGO_WIDTH * aspect
            
            logo = Image(temp_logo_path, width=draw_width, height=draw_height)
            logo.hAlign = 'LEFT'
            
            titulo = Paragraph("<b>LAUDO ECOCARDIOGRÁFICO</b>", styles['TituloPrincipal'])
            
            # Tabela: [logo] [título] - título sem fundo, texto preto centralizado
            header_data = [[logo, titulo]]
            header_table = Table(header_data, colWidths=[40*mm, 140*mm])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ]))
            elements.append(header_table)
        except Exception as e:
            print(f"Erro ao adicionar logomarca: {e}")
            elements.append(Paragraph("LAUDO ECOCARDIOGRÁFICO", styles['TituloPrincipal']))
    else:
        elements.append(Paragraph("LAUDO ECOCARDIOGRÁFICO", styles['TituloPrincipal']))
    
    elements.append(Spacer(1, 2*mm))
    
    # Dados do paciente em formato de linha única com pipe (|) como separador
    # Seguindo o modelo: Paciente: X | Espécie: X | Raça: X
    paciente = dados.get('paciente', {})
    clinica = dados.get('clinica', '')
    
    # Linha 1: Paciente | Espécie | Raça
    linha1 = f"<b>Paciente:</b> {paciente.get('nome', 'N/A')} | <b>Espécie:</b> {paciente.get('especie', 'N/A')} | <b>Raça:</b> {paciente.get('raca', 'N/A')}"
    elements.append(Paragraph(linha1, styles['Normal']))
    elements.append(Spacer(1, 1*mm))
    
    # Linha 2: Sexo | Idade | Peso
    peso = paciente.get('peso', 'N/A')
    peso_str = f"{peso} kg" if peso and peso != 'N/A' else 'N/A'
    linha2 = f"<b>Sexo:</b> {paciente.get('sexo', 'N/A')} | <b>Idade:</b> {paciente.get('idade', 'N/A')} | <b>Peso:</b> {peso_str}"
    elements.append(Paragraph(linha2, styles['Normal']))
    elements.append(Spacer(1, 1*mm))
    
    # Linha 3: Tutor | Solicitante
    solicitante = paciente.get('solicitante', '') or ''
    linha3 = f"<b>Tutor:</b> {paciente.get('tutor', 'N/A')} | <b>Solicitante:</b> {solicitante}"
    elements.append(Paragraph(linha3, styles['Normal']))
    elements.append(Spacer(1, 1*mm))
    
    # Linha 4: Clínica
    if clinica:
        elements.append(Paragraph(f"<b>Clínica:</b> {clinica}", styles['Normal']))
        elements.append(Spacer(1, 1*mm))
    
    # Linha 5: Data
    data_exame = paciente.get('data_exame', datetime.now().strftime('%d/%m/%Y'))
    elements.append(Paragraph(f"<b>Data:</b> {data_exame}", styles['Normal']))
    elements.append(Spacer(1, 1*mm))
    
    # Linha 6: Ritmo | FC | Estado
    ritmo = paciente.get('ritmo', 'Sinusal') or 'Sinusal'
    fc = paciente.get('fc', '') or ''
    fc_str = f"{fc} bpm" if fc else "bpm"
    estado = paciente.get('estado', 'Calmo') or 'Calmo'
    linha6 = f"<b>Ritmo:</b> {ritmo} | <b>FC:</b> {fc_str} | <b>Estado:</b> {estado}"
    elements.append(Paragraph(linha6, styles['Normal']))
    elements.append(Spacer(1, 3*mm))
    
    return elements


def interpretar_parametro(valor: float, ref_min: float, ref_max: float) -> Tuple[str, str]:
    """Interpreta o valor em relação à referência"""
    if valor < ref_min:
        return "Reduzido", colors.HexColor('#dc2626')  # Vermelho
    elif valor > ref_max:
        return "Aumentado", colors.HexColor('#dc2626')  # Vermelho
    else:
        return "Normal", colors.HexColor('#16a34a')  # Verde


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
        
        valor = dados.get('medidas', {}).get(chave, 0)
        valor_float = _to_float(valor) or 0
        
        # Formata valor
        if valor_float == 0:
            valor_str = "--"
            ref_str = formatar_referencia(ref_min, ref_max, unidade) if mostrar_referencia else ""
            interp_str = ""
            interp_color = COR_PRETO
        else:
            valor_str = f"{valor_float:.2f} {unidade}".strip()
            ref_str = formatar_referencia(ref_min, ref_max, unidade) if mostrar_referencia else ""
            
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
    elements.append(titulo_table)
    
    # Texto do AD/VD
    texto_data = [[Paragraph(texto.strip(), styles['Normal'])]]
    texto_table = Table(texto_data, colWidths=[180*mm])
    texto_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COR_BRANCO),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(texto_table)
    
    return elements


def criar_secao_qualitativa(qualitativa: Dict[str, str]) -> List:
    """Cria a seção de análise qualitativa - formato do modelo de referência
    
    No modelo de referência, os itens são apresentados com marcadores (*) em formato de lista.
    AD/VD é mostrado separadamente antes desta seção.
    """
    elements = []
    styles = create_pdf_styles()
    
    # Título da seção
    elements.append(Spacer(1, 4*mm))
    elements.append(criar_titulo_secao("ANÁLISE QUALITATIVA"))
    elements.append(Spacer(1, 2*mm))
    
    # Campos conforme modelo de referência (sem AD/VD, que é mostrado separadamente)
    campos = [
        ('valvas', 'Valvas'),
        ('camaras', 'Câmaras'),
        ('funcao', 'Função'),
        ('pericardio', 'Pericárdio'),
        ('vasos', 'Vasos sanguíneos'),
    ]
    
    for chave, label in campos:
        texto = qualitativa.get(chave, '').strip()
        if texto:
            # Formato com asterisco como no modelo: * Label: texto
            elements.append(Paragraph(f"<b>* {label}:</b> {texto}", styles['QualitativaTexto']))
            elements.append(Spacer(1, 1*mm))
    
    return elements


def criar_secao_conclusao(conclusao: str) -> List:
    """Cria a seção de conclusão"""
    elements = []
    styles = create_pdf_styles()
    
    if not conclusao or not conclusao.strip():
        return elements
    
    elements.append(Spacer(1, 4*mm))
    elements.append(criar_titulo_secao("CONCLUSÃO"))
    elements.append(Spacer(1, 2*mm))
    
    # Divide a conclusão em parágrafos
    paragrafos = conclusao.strip().split('\n')
    for para in paragrafos:
        if para.strip():
            elements.append(Paragraph(para.strip(), styles['Conclusao']))
    
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
    elements.append(Paragraph(f"<b>{nome_veterinario}</b>", styles['Normal']))
    if crmv:
        elements.append(Paragraph(f"Médico Veterinário - CRMV: {crmv}", styles['Normal']))
    else:
        elements.append(Paragraph("Médico Veterinário", styles['Normal']))
    
    return elements


def criar_rodape(texto_rodape: str = None) -> List:
    """Cria o rodapé para o final do conteúdo (não usado mais, ver footer_todas_paginas)"""
    elements = []
    styles = create_pdf_styles()
    
    texto = texto_rodape or "Fort Cordis Cardiologia Veterinária | Fortaleza-CE"
    
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(texto, styles['Rodape']))
    
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
        
        # 1. Cabeçalho com dados do paciente e logomarca
        dados_pdf = dict(dados)
        dados_pdf["medidas"] = normalizar_medidas_para_pdf(dados.get("medidas", {}))
        elements.extend(criar_cabecalho(dados_pdf, temp_logo_path))
        
        # 2. Análise Quantitativa (título com mesma largura das tabelas)
        elements.append(criar_titulo_secao("ANÁLISE QUANTITATIVA"))
        elements.append(Spacer(1, 2*mm))
        
        # =================================================================
        # Definição dos parâmetros - Layout conforme modelo de referência
        # =================================================================
        
        # Grupo: VE - Modo M (tabela única com todos os parâmetros)
        # Conforme solicitado: COM Referência, SEM Interpretação
        params_ve_modo_m = [
            {'chave': 'DIVEd', 'label': 'DIVEd (Diâmetro interno do VE em diástole)', 'unidade': 'mm', 'ref_min': 16.0, 'ref_max': 24.0},
            {'chave': 'DIVEd_normalizado', 'label': 'DIVEd normalizado (DIVEd / peso^0,294)', 'unidade': '', 'ref_min': 1.27, 'ref_max': 1.85},
            {'chave': 'SIVd', 'label': 'SIVd (Septo interventricular em diástole)', 'unidade': 'mm', 'ref_min': 3.5, 'ref_max': 5.5},
            {'chave': 'PLVEd', 'label': 'PLVEd (Parede livre do VE em diástole)', 'unidade': 'mm', 'ref_min': 3.5, 'ref_max': 5.5},
            {'chave': 'DIVES', 'label': 'DIVEs (Diâmetro interno do VE em sístole)', 'unidade': 'mm', 'ref_min': 9.0, 'ref_max': 16.0},
            {'chave': 'SIVs', 'label': 'SIVs (Septo interventricular em sístole)', 'unidade': 'mm', 'ref_min': 4.5, 'ref_max': 7.5},
            {'chave': 'PLVES', 'label': 'PLVEs (Parede livre do VE em sístole)', 'unidade': 'mm', 'ref_min': 5.0, 'ref_max': 8.0},
            {'chave': 'VDF', 'label': 'VDF (Teicholz)', 'unidade': 'ml', 'ref_min': 0, 'ref_max': 0},
            {'chave': 'VSF', 'label': 'VSF (Teicholz)', 'unidade': 'ml', 'ref_min': 0, 'ref_max': 0},
            {'chave': 'FE_Teicholz', 'label': 'FE (Teicholz)', 'unidade': '%', 'ref_min': 55, 'ref_max': 80},
            {'chave': 'DeltaD_FS', 'label': 'Delta D / %FS', 'unidade': '%', 'ref_min': 28, 'ref_max': 42},
            {'chave': 'TAPSE', 'label': 'TAPSE (excursão sistólica do plano anular tricúspide)', 'unidade': 'mm', 'ref_min': 15, 'ref_max': 20},
            {'chave': 'MAPSE', 'label': 'MAPSE (excursão sistólica do plano anular mitral)', 'unidade': 'mm', 'ref_min': 8, 'ref_max': 12},
        ]
        
        # Grupo: Átrio Esquerdo / Aorta - SEM Interpretação
        params_ae_aorta = [
            {'chave': 'Aorta', 'label': 'Aorta', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'Atrio_esquerdo', 'label': 'Átrio esquerdo', 'unidade': 'mm', 'ref_min': None, 'ref_max': None},
            {'chave': 'AE_Ao', 'label': 'AE/Ao (Átrio esquerdo/Aorta)', 'unidade': '', 'ref_min': 0.80, 'ref_max': 1.60},
        ]
        
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
            {'chave': 'MR_dp_dt', 'label': 'MR dp/dt', 'unidade': 'mmHg/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'doppler_tecidual_relacao', 'label': "Doppler tecidual (Relação e'/a')", 'unidade': '', 'ref_min': None, 'ref_max': None},
            {'chave': 'E_E_linha', 'label': "E/E'", 'unidade': '', 'ref_min': 0, 'ref_max': 12},
        ]
        
        # Grupo: Regurgitações - SEM Interpretação
        params_regurgitacoes = [
            {'chave': 'IM_Vmax', 'label': 'IM (insuficiência mitral) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IT_Vmax', 'label': 'IT (insuficiência tricúspide) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IA_Vmax', 'label': 'IA (insuficiência aórtica) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
            {'chave': 'IP_Vmax', 'label': 'IP (insuficiência pulmonar) Vmax', 'unidade': 'm/s', 'ref_min': None, 'ref_max': None},
        ]
        
        # Aplicar referências do banco de dados se disponíveis
        referencia_eco = dados_pdf.get("referencia_eco")
        params_ve_modo_m = aplicar_referencia_eco(params_ve_modo_m, referencia_eco)
        params_ae_aorta = aplicar_referencia_eco(params_ae_aorta, referencia_eco)
        params_ap_aorta = aplicar_referencia_eco(params_ap_aorta, referencia_eco)
        params_doppler_saidas = aplicar_referencia_eco(params_doppler_saidas, referencia_eco)
        params_diastolica = aplicar_referencia_eco(params_diastolica, referencia_eco)
        params_regurgitacoes = aplicar_referencia_eco(params_regurgitacoes, referencia_eco)
        
        # =================================================================
        # Montar tabelas conforme modelo de referência
        # =================================================================
        
        # VE - Modo M: COM Referência (diferença solicitada pelo usuário)
        elements.append(criar_tabela_medidas("VE - Modo M", params_ve_modo_m, dados_pdf, 
                                              mostrar_referencia=True, mostrar_interpretacao=False))
        elements.append(Spacer(1, 3*mm))
        
        # Átrio Esquerdo / Aorta: COM Referência, SEM Interpretação
        elements.append(criar_tabela_medidas("Átrio esquerdo/ Aorta", params_ae_aorta, dados_pdf,
                                              mostrar_referencia=True, mostrar_interpretacao=False))
        elements.append(Spacer(1, 3*mm))
        
        # Artéria Pulmonar / Aorta: COM Referência, SEM Interpretação
        elements.append(criar_tabela_medidas("Artéria pulmonar/ Aorta", params_ap_aorta, dados_pdf,
                                              mostrar_referencia=True, mostrar_interpretacao=False))
        elements.append(Spacer(1, 3*mm))
        
        # Doppler - Saídas: COM Referência, SEM Interpretação
        elements.append(criar_tabela_medidas("Doppler - Saídas", params_doppler_saidas, dados_pdf,
                                              mostrar_referencia=True, mostrar_interpretacao=False))
        elements.append(Spacer(1, 3*mm))
        
        # Diastólica: COM Referência, SEM Interpretação
        elements.append(criar_tabela_medidas("Diastólica", params_diastolica, dados_pdf,
                                              mostrar_referencia=True, mostrar_interpretacao=False))
        elements.append(Spacer(1, 3*mm))
        
        # Regurgitações: COM Referência, SEM Interpretação
        elements.append(criar_tabela_medidas("Regurgitações", params_regurgitacoes, dados_pdf,
                                              mostrar_referencia=True, mostrar_interpretacao=False))
        elements.append(Spacer(1, 3*mm))
        
        # 3. Análise Qualitativa e AD/VD
        qualitativa = dados_pdf.get('qualitativa', {})
        
        # AD/VD (Subjetivo) - Seção de texto antes da análise qualitativa
        ad_vd_texto = qualitativa.get('ad_vd', '').strip() if qualitativa else ''
        if ad_vd_texto:
            elements.extend(criar_secao_ad_vd(ad_vd_texto))
            elements.append(Spacer(1, 3*mm))
        
        # Análise Qualitativa (sem AD/VD, que já foi mostrado)
        if qualitativa and any(qualitativa.get(k, '').strip() for k in ['valvas', 'camaras', 'funcao', 'pericardio', 'vasos']):
            elements.extend(criar_secao_qualitativa(qualitativa))
        
        # 4. Conclusão
        conclusao = dados_pdf.get('conclusao', '')
        elements.extend(criar_secao_conclusao(conclusao))
        
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


# Mantém compatibilidade com código anterior
gerar_pdf_laudo = gerar_pdf_laudo_eco
