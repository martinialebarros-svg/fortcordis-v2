"""Endpoints para importação de XML de ecocardiograma"""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.utils.xml_parser import parse_xml_eco

router = APIRouter()


@router.post("/importar-eco", response_model=dict)
def importar_xml_eco(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Importa arquivo XML de ecocardiograma e extrai dados do paciente e medidas.
    """
    # Validar tipo do arquivo
    if not arquivo.filename.endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo deve ser um XML"
        )
    
    try:
        # Ler conteúdo do arquivo
        content = arquivo.file.read()
        
        # Fazer parse do XML
        dados = parse_xml_eco(content)
        
        return {
            "success": True,
            "dados": dados,
            "filename": arquivo.filename
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erro ao processar XML: {str(e)}"
        )


@router.post("/importar-eco/base64", response_model=dict)
def importar_xml_eco_base64(
    dados: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Importa XML de ecocardiograma via base64.
    Espera: {"filename": "exame.xml", "content": "base64encoded..."}
    """
    import base64
    
    filename = dados.get("filename", "exame.xml")
    content_b64 = dados.get("content", "")
    
    if not filename.endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo deve ser um XML"
        )
    
    try:
        # Decodificar base64
        content = base64.b64decode(content_b64)
        
        # Fazer parse do XML
        dados_exame = parse_xml_eco(content)
        
        return {
            "success": True,
            "dados": dados_exame,
            "filename": filename
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erro ao processar XML: {str(e)}"
        )
