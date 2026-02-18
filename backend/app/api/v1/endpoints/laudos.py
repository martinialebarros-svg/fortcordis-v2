from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.models.laudo import Laudo, Exame
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()


@router.get("/laudos")
def listar_laudos(
    paciente_id: Optional[int] = None,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista laudos com filtros"""
    query = db.query(Laudo)
    
    if paciente_id:
        query = query.filter(Laudo.paciente_id == paciente_id)
    if tipo:
        query = query.filter(Laudo.tipo == tipo)
    if status:
        query = query.filter(Laudo.status == status)
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}


@router.post("/laudos", status_code=status.HTTP_201_CREATED)
def criar_laudo(
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo laudo"""
    # Verificar se é um laudo de ecocardiograma (com estrutura complexa)
    if "paciente" in laudo_data and isinstance(laudo_data["paciente"], dict):
        return criar_laudo_ecocardiograma(laudo_data, db, current_user)
    
    # Laudo padrão
    laudo = Laudo(
        paciente_id=laudo_data.get("paciente_id"),
        agendamento_id=laudo_data.get("agendamento_id"),
        veterinario_id=current_user.id,
        tipo=laudo_data.get("tipo", "exame"),
        titulo=laudo_data.get("titulo"),
        descricao=laudo_data.get("descricao"),
        diagnostico=laudo_data.get("diagnostico"),
        observacoes=laudo_data.get("observacoes"),
        anexos=laudo_data.get("anexos"),
        status=laudo_data.get("status", "Rascunho"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(laudo)
    db.commit()
    db.refresh(laudo)
    
    return laudo


def criar_laudo_ecocardiograma(laudo_data: dict, db: Session, current_user: User):
    """Cria um laudo de ecocardiograma com a estrutura específica"""
    paciente = laudo_data.get("paciente", {})
    medidas = laudo_data.get("medidas", {})
    qualitativa = laudo_data.get("qualitativa", {})
    conteudo = laudo_data.get("conteudo", {})
    clinica = laudo_data.get("clinica", {})
    veterinario = laudo_data.get("veterinario", {})
    
    # Montar descrição com medidas
    descricao_parts = ["## Medidas Ecocardiográficas\n"]
    for key, value in medidas.items():
        if value:
            descricao_parts.append(f"- {key}: {value}")
    
    descricao_parts.append("\n## Avaliação Qualitativa\n")
    for key, value in qualitativa.items():
        if value:
            descricao_parts.append(f"- {key}: {value}")
    
    descricao = "\n".join(descricao_parts)
    
    # Montar diagnóstico com conclusões
    diagnostico = conteudo.get("conclusao", "")
    
    # Observações adicionais
    observacoes = conteudo.get("observacoes", "")
    
    # Criar o laudo
    laudo = Laudo(
        paciente_id=paciente.get("id") if isinstance(paciente, dict) else None,
        agendamento_id=None,
        veterinario_id=current_user.id,
        tipo="ecocardiograma",
        titulo=f"Laudo de Ecocardiograma - {paciente.get('nome', 'Paciente')}",
        descricao=descricao,
        diagnostico=diagnostico,
        observacoes=observacoes,
        anexos=None,
        status=laudo_data.get("status", "Finalizado"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(laudo)
    db.commit()
    db.refresh(laudo)
    
    return {
        "id": laudo.id,
        "mensagem": "Laudo de ecocardiograma salvo com sucesso",
        "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
        "tipo": "ecocardiograma"
    }


@router.get("/laudos/{laudo_id}")
def obter_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um laudo específico"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    return laudo


@router.put("/laudos/{laudo_id}")
def atualizar_laudo(
    laudo_id: int,
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um laudo"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    for field, value in laudo_data.items():
        if hasattr(laudo, field):
            setattr(laudo, field, value)
    
    laudo.updated_at = datetime.now()
    db.commit()
    db.refresh(laudo)
    return laudo


@router.delete("/laudos/{laudo_id}")
def deletar_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um laudo"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    db.delete(laudo)
    db.commit()
    
    return {"message": "Laudo removido com sucesso"}


# Endpoint para gerar PDF
@router.get("/laudos/{laudo_id}/pdf")
def gerar_pdf_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gera PDF de um laudo"""
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors
    from io import BytesIO
    
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    # Criar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    elements = []
    
    # Título
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=20,
        alignment=1  # Center
    )
    elements.append(Paragraph("LAUDO MÉDICO VETERINÁRIO", title_style))
    elements.append(Spacer(1, 20))
    
    # Informações do laudo
    info_data = [
        ["Título:", laudo.titulo or "Não informado"],
        ["Tipo:", laudo.tipo or "Não informado"],
        ["Data:", laudo.data_laudo.strftime("%d/%m/%Y") if laudo.data_laudo else "Não informada"],
        ["Status:", laudo.status or "Não informado"],
        ["Veterinário:", laudo.criado_por_nome or "Não informado"],
    ]
    
    info_table = Table(info_data, colWidths=[4*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Descrição
    if laudo.descricao:
        elements.append(Paragraph("<b>DESCRIÇÃO</b>", styles['Heading2']))
        # Converter markdown simples para HTML
        descricao_html = laudo.descricao.replace("\n", "<br/>")
        elements.append(Paragraph(descricao_html, styles['Normal']))
        elements.append(Spacer(1, 12))
    
    # Diagnóstico
    if laudo.diagnostico:
        elements.append(Paragraph("<b>DIAGNÓSTICO</b>", styles['Heading2']))
        diagnostico_html = laudo.diagnostico.replace("\n", "<br/>")
        elements.append(Paragraph(diagnostico_html, styles['Normal']))
        elements.append(Spacer(1, 12))
    
    # Observações
    if laudo.observacoes:
        elements.append(Paragraph("<b>OBSERVAÇÕES</b>", styles['Heading2']))
        observacoes_html = laudo.observacoes.replace("\n", "<br/>")
        elements.append(Paragraph(observacoes_html, styles['Normal']))
    
    # Rodapé
    elements.append(Spacer(1, 40))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.grey,
        alignment=1
    )
    elements.append(Paragraph("Este laudo foi gerado eletronicamente pelo sistema FortCordis.", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=laudo_{laudo_id}.pdf"}
    )


# Exames
@router.get("/exames")
def listar_exames(
    paciente_id: Optional[int] = None,
    tipo_exame: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista exames com filtros"""
    query = db.query(Exame)
    
    if paciente_id:
        query = query.filter(Exame.paciente_id == paciente_id)
    if tipo_exame:
        query = query.filter(Exame.tipo_exame == tipo_exame)
    if status:
        query = query.filter(Exame.status == status)
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}


@router.post("/exames", status_code=status.HTTP_201_CREATED)
def criar_exame(
    exame_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo exame"""
    exame = Exame(
        laudo_id=exame_data.get("laudo_id"),
        paciente_id=exame_data.get("paciente_id"),
        tipo_exame=exame_data.get("tipo_exame"),
        resultado=exame_data.get("resultado"),
        valor_referencia=exame_data.get("valor_referencia"),
        unidade=exame_data.get("unidade"),
        status=exame_data.get("status", "Solicitado"),
        valor=exame_data.get("valor", 0),
        observacoes=exame_data.get("observacoes"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(exame)
    db.commit()
    db.refresh(exame)
    
    return exame


@router.patch("/exames/{exame_id}/resultado")
def atualizar_resultado_exame(
    exame_id: int,
    resultado_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza resultado de um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    
    exame.resultado = resultado_data.get("resultado")
    exame.valor_referencia = resultado_data.get("valor_referencia")
    exame.unidade = resultado_data.get("unidade")
    exame.status = "Concluido"
    exame.data_resultado = datetime.now()
    
    db.commit()
    db.refresh(exame)
    return exame
