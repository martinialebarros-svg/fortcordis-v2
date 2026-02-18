from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from io import BytesIO

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
    import traceback
    try:
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
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


def criar_laudo_ecocardiograma(laudo_data: dict, db: Session, current_user: User):
    """Cria um laudo de ecocardiograma com a estrutura específica"""
    import traceback
    from app.models.paciente import Paciente
    
    try:
        paciente = laudo_data.get("paciente", {})
        medidas = laudo_data.get("medidas", {})
        qualitativa = laudo_data.get("qualitativa", {})
        conteudo = laudo_data.get("conteudo", {})
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})
        
        print(f"Criando laudo eco para paciente: {paciente.get('nome')}")
        
        # Verificar se o paciente tem ID, senão criar um novo
        paciente_id = paciente.get("id")
        if not paciente_id and paciente.get("nome"):
            print(f"Criando novo paciente: {paciente.get('nome')}")
            # Criar novo paciente
            novo_paciente = Paciente(
                nome=paciente.get("nome", "Paciente sem nome"),
                especie=paciente.get("especie", ""),
                raca=paciente.get("raca", ""),
                sexo=paciente.get("sexo", ""),
                peso_kg=float(paciente.get("peso", 0)) if paciente.get("peso") else None,
                observacoes=f"Tutor: {paciente.get('tutor', '')}\nTelefone: {paciente.get('telefone', '')}",
                ativo=1
            )
            db.add(novo_paciente)
            db.commit()
            db.refresh(novo_paciente)
            paciente_id = novo_paciente.id
            print(f"Paciente criado com ID: {paciente_id}")
        
        if not paciente_id:
            raise ValueError("Não foi possível determinar o paciente para o laudo")
        
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
            paciente_id=paciente_id,
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
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO ECO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar laudo: {str(e)}")


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
    """Gera PDF profissional de um laudo ecocardiográfico"""
    from fastapi.responses import StreamingResponse
    from app.utils.pdf_laudo import gerar_pdf_laudo_eco
    from app.models.paciente import Paciente
    import traceback
    
    try:
        laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
        if not laudo:
            raise HTTPException(status_code=404, detail="Laudo não encontrado")
        
        # Buscar paciente
        paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()
        
        # Extrair dados do paciente
        dados_paciente = {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else "Canina",
            "raca": paciente.raca if paciente else "",
            "sexo": paciente.sexo if paciente else "",
            "idade": "",
            "peso": f"{paciente.peso_kg:.1f}" if paciente and paciente.peso_kg else "",
            "tutor": "",
            "data_exame": laudo.data_laudo.strftime("%d/%m/%Y") if laudo.data_laudo else datetime.now().strftime("%d/%m/%Y")
        }
        
        # Extrair medidas da descrição (formato markdown)
        medidas = {}
        qualitativa = {}
        
        if laudo.descricao:
            import re
            descricao = laudo.descricao
            
            # Extrair medidas (formato: - Ao: 1.50) - aceita números decimais
            for match in re.finditer(r'-\s*(\w+):\s*([\d.]+)', descricao):
                chave = match.group(1)
                valor = match.group(2)
                medidas[chave] = valor
            
            # Extrair qualitativa - procura por seção "Avaliação Qualitativa"
            qualitativa_match = re.search(r'Avaliação Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)', descricao, re.DOTALL)
            if qualitativa_match:
                qualitativa_texto = qualitativa_match.group(1)
                for match in re.finditer(r'-\s*(\w+):?\s*(.+?)(?=\n-|\Z)', qualitativa_texto, re.DOTALL):
                    campo = match.group(1).lower().strip()
                    valor = match.group(2).strip()
                    if campo in ['valvas', 'camaras', 'funcao', 'pericardio', 'vasos', 'ad_vd']:
                        qualitativa[campo] = valor
            
            # Se não achou nada, tenta extrair direto das linhas
            if not qualitativa:
                for match in re.finditer(r'-\s*(valvas|camaras|funcao|pericardio|vasos|ad_vd):\s*(.+?)(?=\n-|\Z)', descricao, re.IGNORECASE | re.DOTALL):
                    campo = match.group(1).lower().strip()
                    valor = match.group(2).strip()
                    qualitativa[campo] = valor
        
        # Preparar dados para o PDF
        dados = {
            "paciente": dados_paciente,
            "medidas": medidas,
            "qualitativa": qualitativa,
            "conclusao": laudo.diagnostico or "",
            "clinica": "",
            "imagens": []
        }
        
        # Gerar PDF
        pdf_bytes = gerar_pdf_laudo_eco(dados)
        
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=laudo_{laudo_id}_{dados_paciente['nome'].replace(' ', '_')}.pdf"}
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO GERAR PDF: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")


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
        paciente_id=exame_data["paciente_id"],
        tipo_exame=exame_data["tipo_exame"],
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


@router.get("/exames/{exame_id}")
def obter_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um exame específico"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    return exame


@router.put("/exames/{exame_id}")
def atualizar_exame(
    exame_id: int,
    exame_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    
    for field, value in exame_data.items():
        if hasattr(exame, field):
            setattr(exame, field, value)
    
    db.commit()
    db.refresh(exame)
    return exame


@router.delete("/exames/{exame_id}")
def deletar_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    
    db.delete(exame)
    db.commit()
    
    return {"message": "Exame removido com sucesso"}
