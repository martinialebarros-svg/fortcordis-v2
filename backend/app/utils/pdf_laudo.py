"""Geração de PDF de laudos ecocardiográficos"""
import os
import tempfile
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
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


# Cores do tema
COR_PRIMARIA = colors.HexColor('#1e40af')  # Azul escuro
COR_SECUNDARIA = colors.HexColor('#3b82f6')  # Azul médio
COR_CINZA_ESCURO = colors.HexColor('#374151')
COR_CINZA_MEDIO = colors.HexColor('#6b7280')
COR_CINZA_CLARO = colors.HexColor('#f3f4f6')
COR_BRANCO = colors.white
COR_PRETO = colors.black


def create_pdf_styles():
    """Cria estilos para o PDF"""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'TituloPrincipal',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=COR_PRIMARIA,
        spaceAfter=6,
        alignment=1,  # Center
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        'Subtitulo',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=COR_CINZA_ESCURO,
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
        fontSize=11,
        textColor=COR_BRANCO,
        backColor=COR_PRIMARIA,
        spaceAfter=6,
        spaceBefore=12,
        leftIndent=6,
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


def criar_cabecalho(dados: Dict[str, Any], temp_logo_path: str = None) -> List:
    """Cria o cabeçalho do laudo com dados do paciente"""
    elements = []
    styles = create_pdf_styles()
    
    # Se tem logomarca, cria layout com imagem + título
    if temp_logo_path and os.path.exists(temp_logo_path):
        try:
            # Criar tabela com logo e título
            logo = Image(temp_logo_path, width=35*mm, height=20*mm)
            logo.hAlign = 'LEFT'
            
            titulo = Paragraph("<b>LAUDO ECOCARDIOGRÁFICO</b>", styles['TituloPrincipal'])
            
            # Tabela: [logo] [título]
            header_data = [[logo, titulo]]
            header_table = Table(header_data, colWidths=[40*mm, 140*mm])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ]))
            elements.append(header_table)
        except Exception as e:
            print(f"Erro ao adicionar logomarca: {e}")
            # Título principal sem logo
            elements.append(Paragraph("LAUDO ECOCARDIOGRÁFICO", styles['TituloPrincipal']))
    else:
        # Título principal sem logo
        elements.append(Paragraph("LAUDO ECOCARDIOGRÁFICO", styles['TituloPrincipal']))
    
    elements.append(Spacer(1, 3*mm))
    
    # Dados do paciente em formato de tabela
    paciente = dados.get('paciente', {})
    
    info_data = [
        [
            Paragraph(f"<b>Paciente:</b> {paciente.get('nome', 'N/A')}", styles['Normal']),
            Paragraph(f"<b>Espécie:</b> {paciente.get('especie', 'N/A')}", styles['Normal']),
            Paragraph(f"<b>Raça:</b> {paciente.get('raca', 'N/A')}", styles['Normal'])
        ],
        [
            Paragraph(f"<b>Sexo:</b> {paciente.get('sexo', 'N/A')}", styles['Normal']),
            Paragraph(f"<b>Idade:</b> {paciente.get('idade', 'N/A')}", styles['Normal']),
            Paragraph(f"<b>Peso:</b> {paciente.get('peso', 'N/A')} kg", styles['Normal'])
        ],
        [
            Paragraph(f"<b>Tutor:</b> {paciente.get('tutor', 'N/A')}", styles['Normal']),
            Paragraph(f"<b>Data:</b> {paciente.get('data_exame', datetime.now().strftime('%d/%m/%Y'))}", styles['Normal']),
            ""
        ]
    ]
    
    # Adiciona clínica se existir
    clinica = dados.get('clinica', '')
    if clinica:
        info_data.append([
            Paragraph(f"<b>Clínica:</b> {clinica}", styles['Normal']),
            "",
            ""
        ])
    
    info_table = Table(info_data, colWidths=[65*mm, 50*mm, 50*mm])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 2*mm))
    
    # Linha divisória
    line_data = [['']]
    line_table = Table(line_data, colWidths=[180*mm])
    line_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 1, COR_PRIMARIA),
    ]))
    elements.append(line_table)
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


def criar_tabela_medidas(titulo: str, parametros: List[Dict], dados: Dict[str, Any]) -> Table:
    """Cria uma tabela de medidas ecocardiográficas"""
    styles = create_pdf_styles()
    
    # Cabeçalho da tabela
    data = [[
        Paragraph(f"<b>{titulo}</b>", styles['Normal']),
        '',
        '',
        ''
    ]]
    
    # Sub-cabeçalho
    data.append([
        Paragraph("<b>Parâmetro</b>", styles['Normal']),
        Paragraph("<b>Valor</b>", styles['Normal']),
        Paragraph("<b>Referência</b>", styles['Normal']),
        Paragraph("<b>Interpretação</b>", styles['Normal'])
    ])
    
    # Dados
    for param in parametros:
        chave = param['chave']
        label = param['label']
        unidade = param.get('unidade', '')
        ref_min = param.get('ref_min')
        ref_max = param.get('ref_max')
        
        valor = dados.get('medidas', {}).get(chave, 0)
        
        try:
            valor_float = float(valor) if valor else 0
        except:
            valor_float = 0
        
        # Formata valor
        if valor_float == 0:
            valor_str = "--"
            ref_str = f"{ref_min:.2f} - {ref_max:.2f}" if ref_min and ref_max else "--"
            interp_str = ""
            interp_color = COR_PRETO
        else:
            valor_str = f"{valor_float:.2f} {unidade}".strip()
            ref_str = f"{ref_min:.2f} - {ref_max:.2f}" if ref_min and ref_max else "--"
            
            if ref_min and ref_max:
                interp_str, interp_color = interpretar_parametro(valor_float, ref_min, ref_max)
            else:
                interp_str = ""
                interp_color = COR_PRETO
        
        data.append([
            Paragraph(label, styles['Normal']),
            Paragraph(valor_str, styles['Normal']),
            Paragraph(ref_str, styles['Normal']),
            Paragraph(f"<font color='{interp_color.hexval()}'>{interp_str}</font>", styles['Normal'])
        ])
    
    # Criar tabela
    table = Table(data, colWidths=[55*mm, 35*mm, 45*mm, 35*mm])
    table.setStyle(TableStyle([
        # Título da seção
        ('BACKGROUND', (0, 0), (-1, 0), COR_PRIMARIA),
        ('TEXTCOLOR', (0, 0), (-1, 0), COR_BRANCO),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, 0), 6),
        
        # Cabeçalho
        ('BACKGROUND', (0, 1), (-1, 1), COR_CINZA_CLARO),
        ('TEXTCOLOR', (0, 1), (-1, 1), COR_CINZA_ESCURO),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 9),
        ('ALIGN', (1, 1), (-1, 1), 'CENTER'),
        
        # Linhas de dados
        ('FONTSIZE', (0, 2), (-1, -1), 9),
        ('ALIGN', (1, 2), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        
        # Grade
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BOX', (0, 0), (-1, -1), 1, COR_PRIMARIA),
        
        # Alternância de cores nas linhas
        ('ROWBACKGROUNDS', (0, 2), (-1, -1), [COR_BRANCO, COR_CINZA_CLARO]),
    ]))
    
    return table


def criar_secao_qualitativa(qualitativa: Dict[str, str]) -> List:
    """Cria a seção de análise qualitativa"""
    elements = []
    styles = create_pdf_styles()
    
    # Título da seção
    elements.append(Spacer(1, 4*mm))
    elements.append(Paragraph("ANÁLISE QUALITATIVA", styles['SecaoTitulo']))
    elements.append(Spacer(1, 2*mm))
    
    campos = [
        ('valvas', 'Válvulas'),
        ('camaras', 'Câmaras'),
        ('funcao', 'Função'),
        ('pericardio', 'Pericárdio'),
        ('vasos', 'Vasos'),
        ('ad_vd', 'AD/VD')
    ]
    
    for chave, label in campos:
        texto = qualitativa.get(chave, '').strip()
        if texto:
            data = [[
                Paragraph(f"<b>{label}:</b>", styles['QualitativaLabel']),
                Paragraph(texto, styles['QualitativaTexto'])
            ]]
            table = Table(data, colWidths=[25*mm, 155*mm])
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(table)
    
    return elements


def criar_secao_conclusao(conclusao: str) -> List:
    """Cria a seção de conclusão"""
    elements = []
    styles = create_pdf_styles()
    
    if not conclusao or not conclusao.strip():
        return elements
    
    elements.append(Spacer(1, 4*mm))
    elements.append(Paragraph("CONCLUSÃO", styles['SecaoTitulo']))
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
            # Adicionar imagem da assinatura
            ass_img = Image(temp_assinatura_path, width=50*mm, height=20*mm)
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
    """Cria o rodapé"""
    elements = []
    styles = create_pdf_styles()
    
    texto = texto_rodape or "Fort Cordis Cardiologia Veterinária | Fortaleza-CE"
    
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(texto, styles['Rodape']))
    elements.append(Paragraph(
        f"Documento gerado eletronicamente em {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        styles['Rodape']
    ))
    
    return elements


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
        elements.extend(criar_cabecalho(dados, temp_logo_path))
        
        # 2. Análise Quantitativa
        elements.append(Paragraph("ANÁLISE QUANTITATIVA", create_pdf_styles()['SecaoTitulo']))
        elements.append(Spacer(1, 2*mm))
        
        # Definição dos parâmetros por grupo
        # Grupo: Câmaras
        params_camaras = [
            {'chave': 'Ao', 'label': 'Ao (Diâmetro Aórtico)', 'unidade': 'cm', 'ref_min': 0.87, 'ref_max': 1.15},
            {'chave': 'LA', 'label': 'LA (Átrio Esquerdo)', 'unidade': 'cm', 'ref_min': 0.77, 'ref_max': 1.20},
            {'chave': 'LA_Ao', 'label': 'LA/Ao', 'unidade': '', 'ref_min': 0.83, 'ref_max': 1.17},
            {'chave': 'LVIDd', 'label': 'LVIDd (DIVEd)', 'unidade': 'cm', 'ref_min': 1.60, 'ref_max': 2.40},
            {'chave': 'LVIDs', 'label': 'LVIDs (DIVEs)', 'unidade': 'cm', 'ref_min': 0.90, 'ref_max': 1.60},
        ]
        
        # Grupo: Paredes
        params_paredes = [
            {'chave': 'IVSd', 'label': 'IVSd (SEVd)', 'unidade': 'cm', 'ref_min': 0.35, 'ref_max': 0.55},
            {'chave': 'IVSs', 'label': 'IVSs (SEVs)', 'unidade': 'cm', 'ref_min': 0.45, 'ref_max': 0.75},
            {'chave': 'LVPWd', 'label': 'LVPWd (PPVEd)', 'unidade': 'cm', 'ref_min': 0.35, 'ref_max': 0.55},
            {'chave': 'LVPWs', 'label': 'LVPWs (PPVEs)', 'unidade': 'cm', 'ref_min': 0.50, 'ref_max': 0.80},
        ]
        
        # Grupo: Função
        params_funcao = [
            {'chave': 'EF', 'label': 'EF (Fração de Ejeção)', 'unidade': '%', 'ref_min': 55, 'ref_max': 80},
            {'chave': 'FS', 'label': 'FS (Encurtamento)', 'unidade': '%', 'ref_min': 28, 'ref_max': 42},
            {'chave': 'TAPSE', 'label': 'TAPSE', 'unidade': 'cm', 'ref_min': 0.16, 'ref_max': 0.26},
            {'chave': 'MAPSE', 'label': 'MAPSE', 'unidade': 'cm', 'ref_min': 0.40, 'ref_max': 0.60},
        ]
        
        # Grupo: Fluxos Doppler
        params_fluxos = [
            {'chave': 'MV_E', 'label': 'MV E (Velocidade E)', 'unidade': 'm/s', 'ref_min': 0.50, 'ref_max': 0.90},
            {'chave': 'MV_A', 'label': 'MV A (Velocidade A)', 'unidade': 'm/s', 'ref_min': 0.30, 'ref_max': 0.60},
            {'chave': 'MV_E_A', 'label': 'MV E/A', 'unidade': '', 'ref_min': 1.0, 'ref_max': 2.5},
            {'chave': 'Vmax_Ao', 'label': 'Vmax Ao', 'unidade': 'm/s', 'ref_min': 0.80, 'ref_max': 1.40},
            {'chave': 'Vmax_Pulm', 'label': 'Vmax Pulm', 'unidade': 'm/s', 'ref_min': 0.60, 'ref_max': 1.00},
        ]
        
        # Adicionar tabelas
        elements.append(criar_tabela_medidas("CÂMARAS", params_camaras, dados))
        elements.append(Spacer(1, 3*mm))
        elements.append(criar_tabela_medidas("PAREDES", params_paredes, dados))
        elements.append(Spacer(1, 3*mm))
        elements.append(criar_tabela_medidas("FUNÇÃO", params_funcao, dados))
        elements.append(Spacer(1, 3*mm))
        elements.append(criar_tabela_medidas("FLUXOS DOPPLER", params_fluxos, dados))
        
        # 3. Análise Qualitativa
        qualitativa = dados.get('qualitativa', {})
        if any(v.strip() for v in qualitativa.values()):
            elements.extend(criar_secao_qualitativa(qualitativa))
        
        # 4. Conclusão
        conclusao = dados.get('conclusao', '')
        elements.extend(criar_secao_conclusao(conclusao))
        
        # 5. Assinatura
        vet_nome = nome_veterinario or dados.get('veterinario_nome') or "Médico Veterinário"
        vet_crmv = crmv or dados.get('veterinario_crmv') or ""
        elements.extend(criar_secao_assinatura(vet_nome, vet_crmv, temp_assinatura_path))
        
        # 6. Rodapé
        elements.extend(criar_rodape(texto_rodape))
        
        # 7. Imagens (se houver)
        imagens = dados.get('imagens', [])
        if imagens:
            elements.append(PageBreak())
            elements.append(Paragraph("IMAGENS DO EXAME", create_pdf_styles()['SecaoTitulo']))
            elements.append(Spacer(1, 5*mm))
            
            # Layout 3x3 (9 imagens por página) - ocupa mais a página
            # Tamanho de cada imagem maior para preencher melhor
            IMG_WIDTH = 58*mm
            IMG_HEIGHT = 45*mm
            ESPACAMENTO = 4*mm  # Espaço entre imagens
            
            # Processar imagens em grupos de 9
            for page_idx in range(0, len(imagens), 9):
                if page_idx > 0:
                    elements.append(PageBreak())
                    elements.append(Paragraph("IMAGENS DO EXAME (continuação)", create_pdf_styles()['SecaoTitulo']))
                    elements.append(Spacer(1, 5*mm))
                
                # Pegar até 9 imagens para esta página
                page_imagens = imagens[page_idx:page_idx + 9]
                
                # Criar grid 3x3 (3 colunas, 3 linhas)
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
                                # Altura limita
                                draw_height = IMG_HEIGHT
                                draw_width = IMG_HEIGHT / aspect if aspect else IMG_WIDTH
                            else:
                                # Largura limita
                                draw_width = IMG_WIDTH
                                draw_height = IMG_WIDTH * aspect
                        except:
                            # Se falhar ao obter dimensões, usar tamanho padrão
                            draw_width = IMG_WIDTH
                            draw_height = IMG_HEIGHT
                        
                        img = Image(temp_img.name, width=draw_width, height=draw_height)
                        
                        row.append(img)
                        
                        # Cada linha tem 3 imagens
                        if len(row) == 3:
                            table_data.append(row)
                            row = []
                    except Exception as e:
                        print(f"Erro ao adicionar imagem {page_idx + idx}: {e}")
                        import traceback
                        traceback.print_exc()
                
                # Adicionar última linha se incompleta
                if row:
                    # Preencher células vazias para completar a linha
                    while len(row) < 3:
                        row.append("")
                    table_data.append(row)
                
                # Completar até 3 linhas se necessário para manter o grid
                while len(table_data) < 3:
                    table_data.append(["", "", ""])
                
                # Criar tabela com as imagens
                if table_data:
                    col_widths = [IMG_WIDTH, IMG_WIDTH, IMG_WIDTH]
                    
                    img_table = Table(table_data, colWidths=col_widths)
                    img_table.setStyle(TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('LEFTPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        ('RIGHTPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        ('TOPPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), ESPACAMENTO),
                        # Grid completo com linhas cinzas
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                        # Cor de fundo branca para todas as células
                        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                    ]))
                    elements.append(img_table)
                    elements.append(Spacer(1, 5*mm))
        
        # Gerar PDF
        doc.build(elements)
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
