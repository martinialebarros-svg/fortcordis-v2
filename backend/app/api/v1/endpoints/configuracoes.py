"""Endpoints para configurações do sistema"""
import base64
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.configuracao import Configuracao, ConfiguracaoUsuario
from app.core.security import get_current_user

router = APIRouter()

# Tamanhos máximos
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def get_or_create_configuracao(db: Session) -> Configuracao:
    """Obtém ou cria a configuração padrão"""
    config = db.query(Configuracao).first()
    if not config:
        config = Configuracao()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/configuracoes", response_model=dict)
def obter_configuracoes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém todas as configurações do sistema"""
    config = get_or_create_configuracao(db)
    
    return {
        "id": config.id,
        "nome_empresa": config.nome_empresa,
        "endereco": config.endereco,
        "telefone": config.telefone,
        "email": config.email,
        "cidade": config.cidade,
        "estado": config.estado,
        "website": config.website,
        "tem_logomarca": config.logomarca_dados is not None,
        "tem_assinatura": config.assinatura_dados is not None,
        "texto_cabecalho_laudo": config.texto_cabecalho_laudo,
        "texto_rodape_laudo": config.texto_rodape_laudo,
        "mostrar_logomarca": config.mostrar_logomarca,
        "mostrar_assinatura": config.mostrar_assinatura,
        "horario_comercial_inicio": config.horario_comercial_inicio,
        "horario_comercial_fim": config.horario_comercial_fim,
        "dias_trabalho": config.dias_trabalho,
        "created_at": config.created_at.isoformat() if config.created_at else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@router.put("/configuracoes", response_model=dict)
def atualizar_configuracoes(
    dados: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza as configurações do sistema"""
    config = get_or_create_configuracao(db)
    
    campos_permitidos = [
        "nome_empresa", "endereco", "telefone", "email", "cidade", "estado",
        "website", "texto_cabecalho_laudo", "texto_rodape_laudo",
        "mostrar_logomarca", "mostrar_assinatura",
        "horario_comercial_inicio", "horario_comercial_fim", "dias_trabalho"
    ]
    
    for campo in campos_permitidos:
        if campo in dados:
            setattr(config, campo, dados[campo])
    
    config.updated_by_id = current_user.id
    db.commit()
    db.refresh(config)
    
    return {"message": "Configurações atualizadas com sucesso"}


@router.post("/configuracoes/logomarca", response_model=dict)
def upload_logomarca(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Faz upload da logomarca da empresa"""
    # Validar tipo
    if arquivo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de arquivo não permitido. Use: JPEG, PNG, GIF, WebP"
        )
    
    # Ler conteúdo
    conteudo = arquivo.file.read()
    
    if len(conteudo) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Arquivo muito grande. Máximo: {MAX_IMAGE_SIZE / 1024 / 1024}MB"
        )
    
    # Salvar no banco
    config = get_or_create_configuracao(db)
    config.logomarca_nome = arquivo.filename
    config.logomarca_tipo = arquivo.content_type
    config.logomarca_dados = conteudo
    config.updated_by_id = current_user.id
    
    db.commit()
    
    return {
        "message": "Logomarca atualizada com sucesso",
        "nome_arquivo": arquivo.filename,
        "tamanho": len(conteudo)
    }


@router.get("/configuracoes/logomarca")
def obter_logomarca(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém a logomarca da empresa"""
    from fastapi.responses import Response
    
    config = db.query(Configuracao).first()
    
    if not config or not config.logomarca_dados:
        raise HTTPException(status_code=404, detail="Logomarca não encontrada")
    
    return Response(
        content=config.logomarca_dados,
        media_type=config.logomarca_tipo or "image/png"
    )


@router.delete("/configuracoes/logomarca", response_model=dict)
def remover_logomarca(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a logomarca da empresa"""
    config = db.query(Configuracao).first()
    
    if config:
        config.logomarca_dados = None
        config.logomarca_nome = None
        config.logomarca_tipo = None
        config.updated_by_id = current_user.id
        db.commit()
    
    return {"message": "Logomarca removida com sucesso"}


@router.post("/configuracoes/assinatura", response_model=dict)
def upload_assinatura(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Faz upload da assinatura padrão do sistema"""
    # Validar tipo
    if arquivo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de arquivo não permitido. Use: JPEG, PNG, GIF, WebP"
        )
    
    # Ler conteúdo
    conteudo = arquivo.file.read()
    
    if len(conteudo) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Arquivo muito grande. Máximo: {MAX_IMAGE_SIZE / 1024 / 1024}MB"
        )
    
    # Salvar no banco
    config = get_or_create_configuracao(db)
    config.assinatura_nome = arquivo.filename
    config.assinatura_tipo = arquivo.content_type
    config.assinatura_dados = conteudo
    config.updated_by_id = current_user.id
    
    db.commit()
    
    return {
        "message": "Assinatura atualizada com sucesso",
        "nome_arquivo": arquivo.filename,
        "tamanho": len(conteudo)
    }


@router.get("/configuracoes/assinatura")
def obter_assinatura(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém a assinatura padrão do sistema"""
    from fastapi.responses import Response
    
    config = db.query(Configuracao).first()
    
    if not config or not config.assinatura_dados:
        raise HTTPException(status_code=404, detail="Assinatura não encontrada")
    
    return Response(
        content=config.assinatura_dados,
        media_type=config.assinatura_tipo or "image/png"
    )


@router.delete("/configuracoes/assinatura", response_model=dict)
def remover_assinatura(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a assinatura padrão do sistema"""
    config = db.query(Configuracao).first()
    
    if config:
        config.assinatura_dados = None
        config.assinatura_nome = None
        config.assinatura_tipo = None
        config.updated_by_id = current_user.id
        db.commit()
    
    return {"message": "Assinatura removida com sucesso"}


# Configurações do usuário
@router.get("/configuracoes/usuario", response_model=dict)
def obter_configuracoes_usuario(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém as configurações do usuário atual"""
    config = db.query(ConfiguracaoUsuario).filter(
        ConfiguracaoUsuario.user_id == current_user.id
    ).first()
    
    if not config:
        return {
            "user_id": current_user.id,
            "tema": "light",
            "idioma": "pt-BR",
            "notificacoes_email": True,
            "notificacoes_push": True,
            "tem_assinatura": False,
            "crmv": None,
            "especialidade": None
        }
    
    return {
        "user_id": config.user_id,
        "tema": config.tema,
        "idioma": config.idioma,
        "notificacoes_email": config.notificacoes_email,
        "notificacoes_push": config.notificacoes_push,
        "tem_assinatura": config.assinatura_dados is not None,
        "crmv": config.crmv,
        "especialidade": config.especialidade
    }


@router.put("/configuracoes/usuario", response_model=dict)
def atualizar_configuracoes_usuario(
    dados: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza as configurações do usuário"""
    config = db.query(ConfiguracaoUsuario).filter(
        ConfiguracaoUsuario.user_id == current_user.id
    ).first()
    
    if not config:
        config = ConfiguracaoUsuario(user_id=current_user.id)
        db.add(config)
    
    campos_permitidos = [
        "tema", "idioma", "notificacoes_email", "notificacoes_push",
        "crmv", "especialidade"
    ]
    
    for campo in campos_permitidos:
        if campo in dados:
            setattr(config, campo, dados[campo])
    
    db.commit()
    db.refresh(config)
    
    return {"message": "Configurações do usuário atualizadas com sucesso"}


@router.post("/configuracoes/usuario/assinatura", response_model=dict)
def upload_assinatura_usuario(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Faz upload da assinatura do usuário (veterinário)"""
    # Validar tipo
    if arquivo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de arquivo não permitido. Use: JPEG, PNG, GIF, WebP"
        )
    
    # Ler conteúdo
    conteudo = arquivo.file.read()
    
    if len(conteudo) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Arquivo muito grande. Máximo: {MAX_IMAGE_SIZE / 1024 / 1024}MB"
        )
    
    # Buscar ou criar configuração do usuário
    config = db.query(ConfiguracaoUsuario).filter(
        ConfiguracaoUsuario.user_id == current_user.id
    ).first()
    
    if not config:
        config = ConfiguracaoUsuario(user_id=current_user.id)
        db.add(config)
    
    config.assinatura_nome = arquivo.filename
    config.assinatura_tipo = arquivo.content_type
    config.assinatura_dados = conteudo
    
    db.commit()
    
    return {
        "message": "Assinatura pessoal atualizada com sucesso",
        "nome_arquivo": arquivo.filename,
        "tamanho": len(conteudo)
    }


@router.get("/configuracoes/usuario/assinatura")
def obter_assinatura_usuario(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém a assinatura do usuário"""
    from fastapi.responses import Response
    
    config = db.query(ConfiguracaoUsuario).filter(
        ConfiguracaoUsuario.user_id == current_user.id
    ).first()
    
    if not config or not config.assinatura_dados:
        raise HTTPException(status_code=404, detail="Assinatura não encontrada")
    
    return Response(
        content=config.assinatura_dados,
        media_type=config.assinatura_tipo or "image/png"
    )
