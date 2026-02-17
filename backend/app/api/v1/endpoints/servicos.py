from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal

from app.db.database import get_db
from app.models.servico import Servico
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

# Schemas
class ServicoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = ""
    preco: Optional[float] = 0.0
    duracao_minutos: Optional[int] = 30

class ServicoResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    preco: Optional[float] = None
    duracao_minutos: Optional[int] = None

@router.get("")
def listar_servicos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista servicos"""
    query = db.query(
        Servico.id,
        Servico.nome,
        Servico.descricao,
        Servico.preco,
        Servico.duracao_minutos
    ).filter(Servico.ativo == True)
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    servicos = [{
        "id": s.id,
        "nome": s.nome,
        "descricao": s.descricao,
        "preco": float(s.preco) if s.preco else 0.0,
        "duracao_minutos": s.duracao_minutos
    } for s in items]
    
    return {"total": total, "items": servicos}


@router.post("", response_model=ServicoResponse, status_code=status.HTTP_201_CREATED)
def criar_servico(
    servico: ServicoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria um novo servico"""
    try:
        db_servico = Servico(
            nome=servico.nome,
            descricao=servico.descricao,
            preco=Decimal(str(servico.preco)) if servico.preco else Decimal("0.00"),
            duracao_minutos=servico.duracao_minutos,
            ativo=True
        )
        
        db.add(db_servico)
        db.commit()
        db.refresh(db_servico)
        
        return {
            "id": db_servico.id,
            "nome": db_servico.nome,
            "descricao": db_servico.descricao,
            "preco": float(db_servico.preco) if db_servico.preco else 0.0,
            "duracao_minutos": db_servico.duracao_minutos
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar servico: {str(e)}")


@router.get("/{servico_id}")
def obter_servico(
    servico_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtem detalhes de um servico"""
    servico = db.query(Servico).filter(
        Servico.id == servico_id,
        Servico.ativo == True
    ).first()
    
    if not servico:
        raise HTTPException(status_code=404, detail="Servico nao encontrado")
    
    return {
        "id": servico.id,
        "nome": servico.nome,
        "descricao": servico.descricao,
        "preco": float(servico.preco) if servico.preco else 0.0,
        "duracao_minutos": servico.duracao_minutos
    }


@router.put("/{servico_id}")
def atualizar_servico(
    servico_id: int,
    servico: ServicoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um servico existente"""
    db_servico = db.query(Servico).filter(Servico.id == servico_id).first()
    
    if not db_servico:
        raise HTTPException(status_code=404, detail="Servico nao encontrado")
    
    try:
        db_servico.nome = servico.nome
        db_servico.descricao = servico.descricao
        db_servico.preco = Decimal(str(servico.preco)) if servico.preco else Decimal("0.00")
        db_servico.duracao_minutos = servico.duracao_minutos
        
        db.commit()
        db.refresh(db_servico)
        
        return {
            "id": db_servico.id,
            "nome": db_servico.nome,
            "descricao": db_servico.descricao,
            "preco": float(db_servico.preco) if db_servico.preco else 0.0,
            "duracao_minutos": db_servico.duracao_minutos
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar servico: {str(e)}")


@router.delete("/{servico_id}")
def deletar_servico(
    servico_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um servico (soft delete)"""
    db_servico = db.query(Servico).filter(Servico.id == servico_id).first()
    
    if not db_servico:
        raise HTTPException(status_code=404, detail="Servico nao encontrado")
    
    try:
        db_servico.ativo = False
        db.commit()
        
        return {"message": "Servico removido com sucesso"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao excluir servico: {str(e)}")
