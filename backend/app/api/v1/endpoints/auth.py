from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import Token, UserResponse
from app.core.config import settings
from app.core.security import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha - suporta bcrypt ou plain text (legado). Bcrypt limita a 72 bytes."""
    if hashed_password.startswith('$2'):
        # bcrypt não aceita senha > 72 bytes; trunca para evitar ValueError
        pwd_bytes = plain_password.encode("utf-8")[:72]
        plain_truncated = pwd_bytes.decode("utf-8", errors="ignore")
        return pwd_context.verify(plain_truncated, hashed_password)
    return plain_password == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.ativo != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    
    if not verify_password(form_data.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Pega os nomes dos papéis
    papeis_nomes = [p.nome for p in user.papeis]
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "nome": user.nome, "papeis": papeis_nomes}, 
        expires_delta=access_token_expires
    )
    
    user.ultimo_acesso = datetime.now()
    db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "nome": user.nome,
        "email": user.email,
        "papeis": papeis_nomes
    }

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
