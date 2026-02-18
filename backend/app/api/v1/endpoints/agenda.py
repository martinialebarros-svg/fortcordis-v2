from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.user import User
from app.models.tutor import Tutor
from app.schemas.agendamento import AgendamentoCreate, AgendamentoUpdate, AgendamentoResponse, AgendamentoLista
from app.core.security import get_current_user, require_papel

router = APIRouter()

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
        Paciente.nome.label('paciente_nome'),
        Clinica.nome.label('clinica_nome'),
        Servico.nome.label('servico_nome'),
        Tutor.nome.label('tutor_nome'),
        Tutor.telefone.label('tutor_telefone')
    ).outerjoin(Paciente, Agendamento.paciente_id == Paciente.id)\
     .outerjoin(Clinica, Agendamento.clinica_id == Clinica.id)\
     .outerjoin(Servico, Agendamento.servico_id == Servico.id)\
     .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)

    # Converter strings para datetime para filtrar corretamente
    if data_inicio:
        try:
            dt_inicio = datetime.fromisoformat(data_inicio.replace('Z', '+00:00'))
            query = query.filter(Agendamento.inicio >= dt_inicio)
        except:
            # Se não conseguir converter, ignora o filtro
            pass
    if data_fim:
        try:
            dt_fim = datetime.fromisoformat(data_fim.replace('Z', '+00:00'))
            query = query.filter(Agendamento.inicio <= dt_fim)
        except:
            # Se não conseguir converter, ignora o filtro
            pass
    if status:
        query = query.filter(Agendamento.status == status)
    if clinica_id:
        query = query.filter(Agendamento.clinica_id == clinica_id)
    if paciente_id:
        query = query.filter(Agendamento.paciente_id == paciente_id)

    total = query.count()
    results = query.offset(skip).limit(limit).all()

    # Montar resposta com nomes
    items = []
    for ag, paciente_nome, clinica_nome, servico_nome, tutor_nome, tutor_telefone in results:
        items.append({
            "id": ag.id,
            "paciente_id": ag.paciente_id,
            "clinica_id": ag.clinica_id,
            "servico_id": ag.servico_id,
            "inicio": str(ag.inicio) if ag.inicio else None,
            "fim": str(ag.fim) if ag.fim else None,
            "status": ag.status,
            "observacoes": ag.observacoes,
            "data": ag.data,
            "hora": ag.hora,
            "paciente": paciente_nome or "Paciente não informado",
            "tutor": tutor_nome or "Tutor não informado",
            "telefone": tutor_telefone or "",
            "servico": servico_nome or "",
            "clinica": clinica_nome or "Clínica não informada",
            "criado_por_nome": ag.criado_por_nome,
            "confirmado_por_nome": ag.confirmado_por_nome,
            "created_at": str(ag.created_at) if ag.created_at else None,
        })

    return {"total": total, "items": items}

@router.get("/hoje", response_model=AgendamentoLista)
def agendamentos_hoje(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos de hoje"""
    hoje_str = datetime.now().strftime('%Y-%m-%d')

    agendamentos = db.query(Agendamento).filter(
        Agendamento.inicio.like(f"{hoje_str}%")
    ).all()

    return {"total": len(agendamentos), "items": agendamentos}

@router.get("/{agendamento_id}", response_model=AgendamentoResponse)
def obter_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um agendamento específico"""
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return agendamento

@router.post("", response_model=AgendamentoResponse, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    agendamento: AgendamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo agendamento"""
    now = datetime.now()

    db_agendamento = Agendamento(**agendamento.dict())
    db_agendamento.criado_por_id = current_user.id
    db_agendamento.criado_por_nome = current_user.nome
    db_agendamento.criado_em = now
    db_agendamento.created_at = now
    db_agendamento.updated_at = now
    
    # Preencher data e hora a partir do inicio
    if db_agendamento.inicio:
        db_agendamento.data = db_agendamento.inicio.strftime('%Y-%m-%d')
        db_agendamento.hora = db_agendamento.inicio.strftime('%H:%M')

    db.add(db_agendamento)
    db.commit()
    db.refresh(db_agendamento)
    
    # Buscar nomes para retornar no response
    paciente = db.query(Paciente).filter(Paciente.id == db_agendamento.paciente_id).first()
    clinica = db.query(Clinica).filter(Clinica.id == db_agendamento.clinica_id).first() if db_agendamento.clinica_id else None
    servico = db.query(Servico).filter(Servico.id == db_agendamento.servico_id).first() if db_agendamento.servico_id else None
    
    # Montar response manualmente para garantir compatibilidade
    return {
        "id": db_agendamento.id,
        "paciente_id": db_agendamento.paciente_id,
        "clinica_id": db_agendamento.clinica_id,
        "servico_id": db_agendamento.servico_id,
        "inicio": str(db_agendamento.inicio) if db_agendamento.inicio else None,
        "fim": str(db_agendamento.fim) if db_agendamento.fim else None,
        "status": db_agendamento.status,
        "observacoes": db_agendamento.observacoes,
        "data": db_agendamento.data,
        "hora": db_agendamento.hora,
        "paciente": paciente.nome if paciente else "Paciente não encontrado",
        "tutor": "",
        "telefone": "",
        "servico": servico.nome if servico else "",
        "clinica": clinica.nome if clinica else "Clínica não informada",
        "criado_por_nome": db_agendamento.criado_por_nome,
        "confirmado_por_nome": db_agendamento.confirmado_por_nome,
        "created_at": str(db_agendamento.created_at) if db_agendamento.created_at else None,
    }

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

    update_data = agendamento.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agendamento, field, value)
    
    # Atualizar data e hora se inicio foi alterado
    if 'inicio' in update_data and db_agendamento.inicio:
        db_agendamento.data = db_agendamento.inicio.strftime('%Y-%m-%d')
        db_agendamento.hora = db_agendamento.inicio.strftime('%H:%M')

    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    db.commit()
    db.refresh(db_agendamento)
    
    # Buscar nomes para retornar no response
    paciente = db.query(Paciente).filter(Paciente.id == db_agendamento.paciente_id).first()
    clinica = db.query(Clinica).filter(Clinica.id == db_agendamento.clinica_id).first() if db_agendamento.clinica_id else None
    servico = db.query(Servico).filter(Servico.id == db_agendamento.servico_id).first() if db_agendamento.servico_id else None
    
    return {
        "id": db_agendamento.id,
        "paciente_id": db_agendamento.paciente_id,
        "clinica_id": db_agendamento.clinica_id,
        "servico_id": db_agendamento.servico_id,
        "inicio": str(db_agendamento.inicio) if db_agendamento.inicio else None,
        "fim": str(db_agendamento.fim) if db_agendamento.fim else None,
        "status": db_agendamento.status,
        "observacoes": db_agendamento.observacoes,
        "data": db_agendamento.data,
        "hora": db_agendamento.hora,
        "paciente": paciente.nome if paciente else "Paciente não encontrado",
        "tutor": "",
        "telefone": "",
        "servico": servico.nome if servico else "",
        "clinica": clinica.nome if clinica else "Clínica não informada",
        "criado_por_nome": db_agendamento.criado_por_nome,
        "confirmado_por_nome": db_agendamento.confirmado_por_nome,
        "created_at": str(db_agendamento.created_at) if db_agendamento.created_at else None,
    }

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
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    # Validar status permitidos
    status_permitidos = ['Agendado', 'Confirmado', 'Em atendimento', 'Realizado', 'Cancelado', 'Faltou']
    if status not in status_permitidos:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(status_permitidos)}")

    db_agendamento.status = status
    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    if status == "Confirmado":
        db_agendamento.confirmado_por_id = current_user.id
        db_agendamento.confirmado_por_nome = current_user.nome
        db_agendamento.confirmado_em = datetime.now()

    os_gerada = None
    
    # Se status for "Realizado", gerar Ordem de Serviço automaticamente
    if status == "Realizado":
        # Buscar dados da clínica para obter a tabela de preço
        clinica = db.query(Clinica).filter(Clinica.id == db_agendamento.clinica_id).first()
        
        # Determinar valor do serviço
        valor_servico = Decimal("0.00")
        
        if clinica and db_agendamento.servico_id:
            # Buscar preço na tabela da clínica
            preco = db.query(PrecoServico).filter(
                PrecoServico.tabela_preco_id == clinica.tabela_preco_id,
                PrecoServico.servico_id == db_agendamento.servico_id
            ).first()
            
            if preco:
                if tipo_horario == 'plantao' and preco.preco_plantao:
                    valor_servico = preco.preco_plantao
                elif preco.preco_comercial:
                    valor_servico = preco.preco_comercial
        
        # Gerar número da OS (ANO + MES + SEQUENCIAL)
        hoje = datetime.now()
        mes_ano = hoje.strftime('%Y%m')
        
        # Buscar última OS do mês
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
        
        # Criar Ordem de Serviço
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
    """Deleta agendamento (só admin)"""
    from sqlalchemy import text
    papel = db.execute(
        text("SELECT p.nome FROM papeis p JOIN usuario_papel up ON p.id = up.papel_id WHERE up.usuario_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()
    if not papel or papel[0] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir agendamentos")

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    db.delete(db_agendamento)
    db.commit()
    return {"message": "Agendamento deletado com sucesso"}
