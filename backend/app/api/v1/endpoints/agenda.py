from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.user import User
from app.models.tutor import Tutor
from app.schemas.agendamento import (
    AgendamentoCreate,
    AgendamentoLista,
    AgendamentoResponse,
    AgendamentoUpdate,
)
from app.core.security import get_current_user

router = APIRouter()


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _extract_date_filter(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    parsed = _parse_iso_datetime(value)
    if parsed is not None:
        return parsed.date().isoformat()

    # Fallback para valores no formato YYYY-MM-DD...
    candidate = value.strip().split("T", 1)[0].split(" ", 1)[0]
    if len(candidate) == 10:
        return candidate
    return None


def _coerce_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return _parse_iso_datetime(value.replace(" ", "T", 1))
    return None


def _fill_data_hora_from_inicio(agendamento: Agendamento) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        return
    agendamento.data = inicio_dt.strftime("%Y-%m-%d")
    agendamento.hora = inicio_dt.strftime("%H:%M")


def _fetch_related_names(db: Session, agendamento: Agendamento) -> dict:
    paciente_nome = None
    tutor_nome = None
    tutor_telefone = None
    clinica_nome = None
    servico_nome = None

    if agendamento.paciente_id:
        paciente = db.query(Paciente).filter(Paciente.id == agendamento.paciente_id).first()
        if paciente:
            paciente_nome = paciente.nome
            if paciente.tutor_id:
                tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
                if tutor:
                    tutor_nome = tutor.nome
                    tutor_telefone = tutor.telefone

    if agendamento.clinica_id:
        clinica = db.query(Clinica).filter(Clinica.id == agendamento.clinica_id).first()
        if clinica:
            clinica_nome = clinica.nome

    if agendamento.servico_id:
        servico = db.query(Servico).filter(Servico.id == agendamento.servico_id).first()
        if servico:
            servico_nome = servico.nome

    return {
        "paciente_nome": paciente_nome,
        "tutor_nome": tutor_nome,
        "tutor_telefone": tutor_telefone,
        "clinica_nome": clinica_nome,
        "servico_nome": servico_nome,
    }


def _sync_denormalized_fields(agendamento: Agendamento, related: dict) -> None:
    paciente_nome = related.get("paciente_nome")
    tutor_nome = related.get("tutor_nome")
    tutor_telefone = related.get("tutor_telefone")
    clinica_nome = related.get("clinica_nome")
    servico_nome = related.get("servico_nome")

    if paciente_nome:
        agendamento.paciente = paciente_nome
    if tutor_nome:
        agendamento.tutor = tutor_nome
    if tutor_telefone:
        agendamento.telefone = tutor_telefone
    if clinica_nome:
        agendamento.clinica = clinica_nome
    if servico_nome:
        agendamento.servico = servico_nome


def _serialize_agendamento(
    agendamento: Agendamento,
    *,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    tutor_telefone: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
) -> dict:
    inicio = agendamento.inicio
    fim = agendamento.fim
    inicio_dt = _coerce_datetime(inicio)

    data = agendamento.data
    hora = agendamento.hora
    if inicio_dt is not None:
        if not data:
            data = inicio_dt.strftime("%Y-%m-%d")
        if not hora:
            hora = inicio_dt.strftime("%H:%M")

    return {
        "id": agendamento.id,
        "paciente_id": agendamento.paciente_id,
        "clinica_id": agendamento.clinica_id,
        "servico_id": agendamento.servico_id,
        "inicio": str(inicio) if inicio else None,
        "fim": str(fim) if fim else None,
        "status": agendamento.status,
        "observacoes": agendamento.observacoes,
        "data": data,
        "hora": hora,
        "paciente": paciente_nome or agendamento.paciente or "Paciente nao informado",
        "tutor": tutor_nome or agendamento.tutor or "Tutor nao informado",
        "telefone": tutor_telefone or agendamento.telefone or "",
        "servico": servico_nome or agendamento.servico or "",
        "clinica": clinica_nome or agendamento.clinica or "Clinica nao informada",
        "criado_por_nome": agendamento.criado_por_nome,
        "confirmado_por_nome": agendamento.confirmado_por_nome,
        "created_at": str(agendamento.created_at) if agendamento.created_at else None,
    }

@router.get("", response_model=AgendamentoLista)
def listar_agendamentos(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    paciente_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos com filtros e nomes dos relacionados"""
    query = db.query(
        Agendamento,
        Paciente.nome.label("paciente_nome"),
        Clinica.nome.label("clinica_nome"),
        Servico.nome.label("servico_nome"),
        Tutor.nome.label("tutor_nome"),
        Tutor.telefone.label("tutor_telefone"),
    ).outerjoin(Paciente, Agendamento.paciente_id == Paciente.id)\
     .outerjoin(Clinica, Agendamento.clinica_id == Clinica.id)\
     .outerjoin(Servico, Agendamento.servico_id == Servico.id)\
     .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)

    # Filtra por coluna data (YYYY-MM-DD) para evitar drift de timezone entre navegador e servidor.
    data_inicio_filtro = _extract_date_filter(data_inicio)
    data_fim_filtro = _extract_date_filter(data_fim)
    if data_inicio_filtro:
        query = query.filter(Agendamento.data >= data_inicio_filtro)
    if data_fim_filtro:
        query = query.filter(Agendamento.data <= data_fim_filtro)
    if status:
        query = query.filter(Agendamento.status == status)
    if clinica_id:
        query = query.filter(Agendamento.clinica_id == clinica_id)
    if paciente_id:
        query = query.filter(Agendamento.paciente_id == paciente_id)

    total = query.count()
    results = query.offset(skip).limit(limit).all()

    items = [
        _serialize_agendamento(
            ag,
            paciente_nome=paciente_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
            tutor_nome=tutor_nome,
            tutor_telefone=tutor_telefone,
        )
        for ag, paciente_nome, clinica_nome, servico_nome, tutor_nome, tutor_telefone in results
    ]

    return {"total": total, "items": items}

@router.get("/hoje", response_model=AgendamentoLista)
def agendamentos_hoje(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos de hoje"""
    hoje_str = datetime.now().strftime("%Y-%m-%d")
    agendamentos = db.query(Agendamento).filter(Agendamento.data == hoje_str).all()
    items = [_serialize_agendamento(agendamento) for agendamento in agendamentos]
    return {"total": len(items), "items": items}

@router.get("/{agendamento_id}", response_model=AgendamentoResponse)
def obter_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtem um agendamento especifico"""
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")
    related = _fetch_related_names(db, agendamento)
    return _serialize_agendamento(agendamento, **related)

@router.post("", response_model=AgendamentoResponse, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    agendamento: AgendamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo agendamento"""
    now = datetime.now()

    db_agendamento = Agendamento(**agendamento.model_dump())
    db_agendamento.criado_por_id = current_user.id
    db_agendamento.criado_por_nome = current_user.nome
    db_agendamento.criado_em = now
    db_agendamento.created_at = now
    db_agendamento.updated_at = now

    _fill_data_hora_from_inicio(db_agendamento)
    related = _fetch_related_names(db, db_agendamento)
    _sync_denormalized_fields(db_agendamento, related)

    db.add(db_agendamento)
    db.commit()
    db.refresh(db_agendamento)

    return _serialize_agendamento(db_agendamento, **related)

@router.put("/{agendamento_id}", response_model=AgendamentoResponse)
def atualizar_agendamento(
    agendamento_id: int,
    agendamento: AgendamentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza agendamento"""
    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    update_data = agendamento.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agendamento, field, value)

    if "inicio" in update_data:
        _fill_data_hora_from_inicio(db_agendamento)

    related = _fetch_related_names(db, db_agendamento)
    _sync_denormalized_fields(db_agendamento, related)

    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    db.commit()
    db.refresh(db_agendamento)

    return _serialize_agendamento(db_agendamento, **related)

@router.patch("/{agendamento_id}/status")
def atualizar_status(
    agendamento_id: int,
    status: str,
    tipo_horario: Optional[str] = "comercial",  # 'comercial' ou 'plantao'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza apenas o status do agendamento"""
    from app.models.ordem_servico import OrdemServico
    from app.models.tabela_preco import PrecoServico
    from decimal import Decimal
    
    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    # Validar status permitidos
    status_permitidos = ['Agendado', 'Confirmado', 'Em atendimento', 'Realizado', 'Cancelado', 'Faltou']
    if status not in status_permitidos:
        raise HTTPException(status_code=400, detail=f"Status invalido. Use: {', '.join(status_permitidos)}")

    db_agendamento.status = status
    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    if status == "Confirmado":
        db_agendamento.confirmado_por_id = current_user.id
        db_agendamento.confirmado_por_nome = current_user.nome
        db_agendamento.confirmado_em = datetime.now()

    os_gerada = None
    
    # Se status for "Realizado", gerar Ordem de ServiÃƒÂ§o automaticamente
    if status == "Realizado":
        # Buscar dados da clÃƒÂ­nica para determinar a regiÃƒÂ£o
        clinica = db.query(Clinica).filter(Clinica.id == db_agendamento.clinica_id).first()
        
        # Determinar valor do serviÃƒÂ§o
        valor_servico = Decimal("0.00")
        
        if clinica and db_agendamento.servico_id:
            # Buscar serviÃƒÂ§o com os novos preÃƒÂ§os por regiÃƒÂ£o
            servico = db.query(Servico).filter(Servico.id == db_agendamento.servico_id).first()
            
            if servico:
                # Determinar qual tabela de preÃƒÂ§o usar baseado na clÃƒÂ­nica
                tabela_id = clinica.tabela_preco_id if clinica.tabela_preco_id else 1
                
                # Mapear tabela_id para regiÃƒÂ£o
                # 1 = Fortaleza, 2 = RegiÃƒÂ£o Metropolitana, 3 = Domiciliar
                if tabela_id == 1:
                    # Fortaleza
                    if tipo_horario == 'plantao' and servico.preco_fortaleza_plantao:
                        valor_servico = servico.preco_fortaleza_plantao
                    elif servico.preco_fortaleza_comercial:
                        valor_servico = servico.preco_fortaleza_comercial
                elif tabela_id == 2:
                    # RegiÃƒÂ£o Metropolitana
                    if tipo_horario == 'plantao' and servico.preco_rm_plantao:
                        valor_servico = servico.preco_rm_plantao
                    elif servico.preco_rm_comercial:
                        valor_servico = servico.preco_rm_comercial
                elif tabela_id == 3:
                    # Domiciliar
                    if tipo_horario == 'plantao' and servico.preco_domiciliar_plantao:
                        valor_servico = servico.preco_domiciliar_plantao
                    elif servico.preco_domiciliar_comercial:
                        valor_servico = servico.preco_domiciliar_comercial
                else:
                    # Fallback: tentar buscar na tabela de preÃƒÂ§os antiga
                    preco = db.query(PrecoServico).filter(
                        PrecoServico.tabela_preco_id == tabela_id,
                        PrecoServico.servico_id == db_agendamento.servico_id
                    ).first()
                    
                    if preco:
                        if tipo_horario == 'plantao' and preco.preco_plantao:
                            valor_servico = preco.preco_plantao
                        elif preco.preco_comercial:
                            valor_servico = preco.preco_comercial
        
        # Gerar nÃƒÂºmero da OS (ANO + MES + SEQUENCIAL)
        hoje = datetime.now()
        mes_ano = hoje.strftime('%Y%m')
        
        # Buscar ÃƒÂºltima OS do mÃƒÂªs
        ultima_os = db.query(OrdemServico).filter(
            OrdemServico.numero_os.like(f"OS{mes_ano}%")
        ).order_by(OrdemServico.id.desc()).first()
        
        if ultima_os:
            # Extrair sequencial
            try:
                seq = int(ultima_os.numero_os[-4:]) + 1
            except:
                seq = 1
        else:
            seq = 1
        
        numero_os = f"OS{mes_ano}{seq:04d}"
        
        # Criar Ordem de ServiÃƒÂ§o
        nova_os = OrdemServico(
            numero_os=numero_os,
            agendamento_id=agendamento_id,
            paciente_id=db_agendamento.paciente_id,
            clinica_id=db_agendamento.clinica_id,
            servico_id=db_agendamento.servico_id,
            data_atendimento=db_agendamento.inicio,
            tipo_horario=tipo_horario,
            valor_servico=valor_servico,
            desconto=Decimal("0.00"),
            valor_final=valor_servico,
            status='Pendente',
            observacoes=f"OS gerada automaticamente do agendamento {agendamento_id}",
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome
        )
        
        db.add(nova_os)
        db.commit()
        db.refresh(nova_os)
        
        os_gerada = {
            "id": nova_os.id,
            "numero_os": nova_os.numero_os,
            "valor_final": float(nova_os.valor_final)
        }

    db.commit()
    db.refresh(db_agendamento)
    
    # Montar resposta
    paciente = db.query(Paciente).filter(Paciente.id == db_agendamento.paciente_id).first()
    clinica = db.query(Clinica).filter(Clinica.id == db_agendamento.clinica_id).first() if db_agendamento.clinica_id else None
    servico = db.query(Servico).filter(Servico.id == db_agendamento.servico_id).first() if db_agendamento.servico_id else None
    
    resposta = {
        "id": db_agendamento.id,
        "status": db_agendamento.status,
        "paciente": paciente.nome if paciente else "",
        "clinica": clinica.nome if clinica else "",
        "servico": servico.nome if servico else "",
        "mensagem": f"Status atualizado para {status}"
    }
    
    if os_gerada:
        resposta["os_gerada"] = os_gerada
        resposta["mensagem"] += f". OS {os_gerada['numero_os']} gerada com valor R$ {os_gerada['valor_final']:.2f}"
    
    return resposta

@router.delete("/{agendamento_id}")
def deletar_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deleta agendamento (sÃƒÂ³ admin)"""
    from sqlalchemy import text
    papel = db.execute(
        text("SELECT p.nome FROM papeis p JOIN usuario_papel up ON p.id = up.papel_id WHERE up.usuario_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()
    if not papel or papel[0] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir agendamentos")

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    db.delete(db_agendamento)
    db.commit()
    return {"message": "Agendamento deletado com sucesso"}
