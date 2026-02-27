from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.atendimento_clinico import (
    AtendimentoClinico,
    Medicamento,
    PrescricaoClinica,
    PrescricaoItem,
)
from app.models.clinica import Clinica
from app.models.laudo import Exame
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.user import User

router = APIRouter()


class ExameSolicitacaoPayload(BaseModel):
    id: Optional[int] = None
    tipo_exame: str = Field(..., min_length=2, max_length=120)
    prioridade: str = Field(default="Rotina", max_length=50)
    status: str = Field(default="Solicitado", max_length=50)
    observacoes: Optional[str] = ""
    valor: Optional[float] = 0.0
    laudo_id: Optional[int] = None


class PrescricaoItemPayload(BaseModel):
    id: Optional[int] = None
    medicamento_id: Optional[int] = None
    medicamento_nome: Optional[str] = ""
    dose: Optional[str] = ""
    frequencia: Optional[str] = ""
    duracao: Optional[str] = ""
    via: Optional[str] = ""
    instrucoes: Optional[str] = ""
    ordem: Optional[int] = 0


class PrescricaoPayload(BaseModel):
    orientacoes_gerais: Optional[str] = ""
    retorno_dias: Optional[int] = None
    itens: List[PrescricaoItemPayload] = Field(default_factory=list)


class AtendimentoCreatePayload(BaseModel):
    paciente_id: int
    clinica_id: Optional[int] = None
    agendamento_id: Optional[int] = None
    data_atendimento: Optional[str] = None
    status: str = Field(default="Em atendimento", max_length=50)
    queixa_principal: Optional[str] = ""
    anamnese: Optional[str] = ""
    exame_fisico: Optional[str] = ""
    dados_clinicos: Optional[str] = ""
    diagnostico: Optional[str] = ""
    plano_terapeutico: Optional[str] = ""
    retorno_recomendado: Optional[str] = ""
    observacoes: Optional[str] = ""
    exames: List[ExameSolicitacaoPayload] = Field(default_factory=list)
    prescricao: Optional[PrescricaoPayload] = None


class AtendimentoUpdatePayload(BaseModel):
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    agendamento_id: Optional[int] = None
    data_atendimento: Optional[str] = None
    status: Optional[str] = None
    queixa_principal: Optional[str] = None
    anamnese: Optional[str] = None
    exame_fisico: Optional[str] = None
    dados_clinicos: Optional[str] = None
    diagnostico: Optional[str] = None
    plano_terapeutico: Optional[str] = None
    retorno_recomendado: Optional[str] = None
    observacoes: Optional[str] = None
    exames: Optional[List[ExameSolicitacaoPayload]] = None
    prescricao: Optional[PrescricaoPayload] = None


class MedicamentoPayload(BaseModel):
    nome: str = Field(..., min_length=2, max_length=255)
    principio_ativo: Optional[str] = ""
    concentracao: Optional[str] = ""
    forma_farmaceutica: Optional[str] = ""
    categoria: Optional[str] = ""
    observacoes: Optional[str] = ""
    ativo: Optional[int] = 1


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _to_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


def _resolver_tutor_paciente(db: Session, paciente_id: int) -> Optional[int]:
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    return paciente.tutor_id


def _map_exame(exame: Exame) -> dict:
    return {
        "id": exame.id,
        "tipo_exame": exame.tipo_exame,
        "prioridade": exame.prioridade or "Rotina",
        "status": exame.status,
        "observacoes": exame.observacoes or "",
        "valor": exame.valor or 0,
        "laudo_id": exame.laudo_id,
        "data_solicitacao": _to_iso(exame.data_solicitacao),
        "data_resultado": _to_iso(exame.data_resultado),
    }


def _map_prescricao_item(item: PrescricaoItem) -> dict:
    return {
        "id": item.id,
        "medicamento_id": item.medicamento_id,
        "medicamento_nome": item.medicamento_nome,
        "dose": item.dose or "",
        "frequencia": item.frequencia or "",
        "duracao": item.duracao or "",
        "via": item.via or "",
        "instrucoes": item.instrucoes or "",
        "ordem": item.ordem or 0,
    }


def _obter_nome_medicamento(
    db: Session,
    medicamento_id: Optional[int],
    medicamento_nome: Optional[str],
) -> str:
    nome_limpo = (medicamento_nome or "").strip()
    if medicamento_id:
        medicamento = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
        if medicamento:
            return medicamento.nome
    if nome_limpo:
        return nome_limpo
    raise HTTPException(status_code=422, detail="Informe o nome do medicamento.")


def _sync_exames(
    db: Session,
    atendimento: AtendimentoClinico,
    exames_payload: List[ExameSolicitacaoPayload],
    current_user: User,
) -> None:
    existentes = {
        exame.id: exame
        for exame in db.query(Exame).filter(Exame.atendimento_id == atendimento.id).all()
    }
    recebidos_ids: set[int] = set()

    for payload in exames_payload:
        exame = None
        if payload.id and payload.id in existentes:
            exame = existentes[payload.id]
            recebidos_ids.add(payload.id)

        if exame is None:
            exame = Exame(
                atendimento_id=atendimento.id,
                paciente_id=atendimento.paciente_id,
                criado_por_id=current_user.id,
                criado_por_nome=current_user.nome,
            )
            db.add(exame)

        exame.atendimento_id = atendimento.id
        exame.paciente_id = atendimento.paciente_id
        exame.tipo_exame = payload.tipo_exame.strip()
        exame.prioridade = (payload.prioridade or "Rotina").strip() or "Rotina"
        exame.status = (payload.status or "Solicitado").strip() or "Solicitado"
        exame.observacoes = payload.observacoes or ""
        exame.valor = payload.valor or 0
        exame.laudo_id = payload.laudo_id
        exame.data_solicitacao = exame.data_solicitacao or datetime.now()
        if exame.status.lower() in {"concluido", "concluído"} and exame.data_resultado is None:
            exame.data_resultado = datetime.now()

    for exame_id, exame in existentes.items():
        if exame_id not in recebidos_ids:
            db.delete(exame)


def _sync_prescricao(
    db: Session,
    atendimento: AtendimentoClinico,
    prescricao_payload: Optional[PrescricaoPayload],
) -> Optional[PrescricaoClinica]:
    if prescricao_payload is None:
        return db.query(PrescricaoClinica).filter(PrescricaoClinica.atendimento_id == atendimento.id).first()

    prescricao = db.query(PrescricaoClinica).filter(PrescricaoClinica.atendimento_id == atendimento.id).first()
    if prescricao is None:
        prescricao = PrescricaoClinica(atendimento_id=atendimento.id)
        db.add(prescricao)
        db.flush()

    prescricao.orientacoes_gerais = prescricao_payload.orientacoes_gerais or ""
    prescricao.retorno_dias = prescricao_payload.retorno_dias
    prescricao.updated_at = datetime.now()

    itens_existentes = {
        item.id: item
        for item in db.query(PrescricaoItem).filter(PrescricaoItem.prescricao_id == prescricao.id).all()
    }
    itens_recebidos_ids: set[int] = set()

    for index, item_payload in enumerate(prescricao_payload.itens):
        item = None
        if item_payload.id and item_payload.id in itens_existentes:
            item = itens_existentes[item_payload.id]
            itens_recebidos_ids.add(item_payload.id)

        if item is None:
            item = PrescricaoItem(prescricao_id=prescricao.id)
            db.add(item)

        item.prescricao_id = prescricao.id
        item.medicamento_id = item_payload.medicamento_id
        item.medicamento_nome = _obter_nome_medicamento(
            db,
            item_payload.medicamento_id,
            item_payload.medicamento_nome,
        )
        item.dose = item_payload.dose or ""
        item.frequencia = item_payload.frequencia or ""
        item.duracao = item_payload.duracao or ""
        item.via = item_payload.via or ""
        item.instrucoes = item_payload.instrucoes or ""
        item.ordem = item_payload.ordem if item_payload.ordem is not None else index
        item.updated_at = datetime.now()

    for item_id, item in itens_existentes.items():
        if item_id not in itens_recebidos_ids:
            db.delete(item)

    return prescricao


def _montar_detalhe_atendimento(
    db: Session,
    atendimento: AtendimentoClinico,
) -> dict:
    paciente = db.query(Paciente).filter(Paciente.id == atendimento.paciente_id).first()
    tutor = None
    if atendimento.tutor_id:
        tutor = db.query(Tutor).filter(Tutor.id == atendimento.tutor_id).first()
    clinica = None
    if atendimento.clinica_id:
        clinica = db.query(Clinica).filter(Clinica.id == atendimento.clinica_id).first()

    exames = (
        db.query(Exame)
        .filter(Exame.atendimento_id == atendimento.id)
        .order_by(Exame.id.asc())
        .all()
    )

    prescricao = (
        db.query(PrescricaoClinica)
        .filter(PrescricaoClinica.atendimento_id == atendimento.id)
        .first()
    )
    prescricao_dict = None
    if prescricao:
        itens = (
            db.query(PrescricaoItem)
            .filter(PrescricaoItem.prescricao_id == prescricao.id)
            .order_by(PrescricaoItem.ordem.asc(), PrescricaoItem.id.asc())
            .all()
        )
        prescricao_dict = {
            "id": prescricao.id,
            "orientacoes_gerais": prescricao.orientacoes_gerais or "",
            "retorno_dias": prescricao.retorno_dias,
            "itens": [_map_prescricao_item(item) for item in itens],
        }

    return {
        "id": atendimento.id,
        "paciente_id": atendimento.paciente_id,
        "tutor_id": atendimento.tutor_id,
        "clinica_id": atendimento.clinica_id,
        "agendamento_id": atendimento.agendamento_id,
        "veterinario_id": atendimento.veterinario_id,
        "data_atendimento": _to_iso(atendimento.data_atendimento),
        "status": atendimento.status,
        "queixa_principal": atendimento.queixa_principal or "",
        "anamnese": atendimento.anamnese or "",
        "exame_fisico": atendimento.exame_fisico or "",
        "dados_clinicos": atendimento.dados_clinicos or "",
        "diagnostico": atendimento.diagnostico or "",
        "plano_terapeutico": atendimento.plano_terapeutico or "",
        "retorno_recomendado": atendimento.retorno_recomendado or "",
        "observacoes": atendimento.observacoes or "",
        "created_at": _to_iso(atendimento.created_at),
        "updated_at": _to_iso(atendimento.updated_at),
        "criado_por_id": atendimento.criado_por_id,
        "criado_por_nome": atendimento.criado_por_nome,
        "paciente_nome": paciente.nome if paciente else "",
        "tutor_nome": tutor.nome if tutor else "",
        "clinica_nome": clinica.nome if clinica else "",
        "exames": [_map_exame(exame) for exame in exames],
        "prescricao": prescricao_dict,
    }


@router.get("")
def listar_atendimentos(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    paciente_id: Optional[int] = None,
    clinica_id: Optional[int] = None,
    agendamento_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = (
        db.query(
            AtendimentoClinico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
        )
        .outerjoin(Paciente, AtendimentoClinico.paciente_id == Paciente.id)
        .outerjoin(Tutor, AtendimentoClinico.tutor_id == Tutor.id)
        .outerjoin(Clinica, AtendimentoClinico.clinica_id == Clinica.id)
    )

    dt_inicio = _parse_datetime(data_inicio)
    dt_fim = _parse_datetime(data_fim)
    if dt_inicio:
        query = query.filter(AtendimentoClinico.data_atendimento >= dt_inicio)
    if dt_fim:
        query = query.filter(AtendimentoClinico.data_atendimento < dt_fim + timedelta(days=1))
    if paciente_id:
        query = query.filter(AtendimentoClinico.paciente_id == paciente_id)
    if clinica_id:
        query = query.filter(AtendimentoClinico.clinica_id == clinica_id)
    if agendamento_id:
        query = query.filter(AtendimentoClinico.agendamento_id == agendamento_id)
    if status:
        query = query.filter(AtendimentoClinico.status == status)
    if search:
        termo = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Paciente.nome.ilike(termo),
                Tutor.nome.ilike(termo),
                Clinica.nome.ilike(termo),
                AtendimentoClinico.diagnostico.ilike(termo),
                AtendimentoClinico.queixa_principal.ilike(termo),
            )
        )

    total = query.count()
    rows = (
        query.order_by(
            AtendimentoClinico.data_atendimento.desc(),
            AtendimentoClinico.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    items = []
    for atendimento, paciente_nome, tutor_nome, clinica_nome in rows:
        total_exames = (
            db.query(Exame.id)
            .filter(Exame.atendimento_id == atendimento.id)
            .count()
        )
        prescricao_existe = (
            db.query(PrescricaoClinica.id)
            .filter(PrescricaoClinica.atendimento_id == atendimento.id)
            .first()
            is not None
        )
        items.append(
            {
                "id": atendimento.id,
                "paciente_id": atendimento.paciente_id,
                "clinica_id": atendimento.clinica_id,
                "agendamento_id": atendimento.agendamento_id,
                "data_atendimento": _to_iso(atendimento.data_atendimento),
                "status": atendimento.status,
                "queixa_principal": atendimento.queixa_principal or "",
                "diagnostico": atendimento.diagnostico or "",
                "paciente_nome": paciente_nome or "",
                "tutor_nome": tutor_nome or "",
                "clinica_nome": clinica_nome or "",
                "total_exames": total_exames,
                "tem_prescricao": prescricao_existe,
                "created_at": _to_iso(atendimento.created_at),
            }
        )

    return {"total": total, "items": items}


@router.get("/contexto")
def obter_contexto_agendamento(
    agendamento_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")

    paciente = db.query(Paciente).filter(Paciente.id == agendamento.paciente_id).first() if agendamento.paciente_id else None
    tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first() if paciente and paciente.tutor_id else None
    clinica = db.query(Clinica).filter(Clinica.id == agendamento.clinica_id).first() if agendamento.clinica_id else None

    return {
        "agendamento_id": agendamento.id,
        "paciente_id": agendamento.paciente_id,
        "paciente_nome": paciente.nome if paciente else (agendamento.paciente or ""),
        "tutor_id": tutor.id if tutor else None,
        "tutor_nome": tutor.nome if tutor else (agendamento.tutor or ""),
        "clinica_id": agendamento.clinica_id,
        "clinica_nome": clinica.nome if clinica else (agendamento.clinica or ""),
        "inicio": _to_iso(agendamento.inicio),
        "status": agendamento.status,
    }


@router.get("/{atendimento_id}")
def obter_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    return _montar_detalhe_atendimento(db, atendimento)


@router.post("", status_code=status.HTTP_201_CREATED)
def criar_atendimento(
    payload: AtendimentoCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data_atendimento = _parse_datetime(payload.data_atendimento) or datetime.now()
    tutor_id = _resolver_tutor_paciente(db, payload.paciente_id)

    atendimento = AtendimentoClinico(
        paciente_id=payload.paciente_id,
        tutor_id=tutor_id,
        clinica_id=payload.clinica_id,
        agendamento_id=payload.agendamento_id,
        veterinario_id=current_user.id,
        data_atendimento=data_atendimento,
        status=payload.status or "Em atendimento",
        queixa_principal=payload.queixa_principal or "",
        anamnese=payload.anamnese or "",
        exame_fisico=payload.exame_fisico or "",
        dados_clinicos=payload.dados_clinicos or "",
        diagnostico=payload.diagnostico or "",
        plano_terapeutico=payload.plano_terapeutico or "",
        retorno_recomendado=payload.retorno_recomendado or "",
        observacoes=payload.observacoes or "",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
    )
    db.add(atendimento)
    db.flush()

    _sync_exames(db, atendimento, payload.exames, current_user)
    _sync_prescricao(db, atendimento, payload.prescricao)

    db.commit()
    db.refresh(atendimento)
    return _montar_detalhe_atendimento(db, atendimento)


@router.put("/{atendimento_id}")
def atualizar_atendimento(
    atendimento_id: int,
    payload: AtendimentoUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    data = payload.model_dump(exclude_unset=True)

    if "paciente_id" in data and data["paciente_id"] is not None:
        atendimento.paciente_id = data["paciente_id"]
        atendimento.tutor_id = _resolver_tutor_paciente(db, atendimento.paciente_id)

    if "clinica_id" in data:
        atendimento.clinica_id = data["clinica_id"]
    if "agendamento_id" in data:
        atendimento.agendamento_id = data["agendamento_id"]
    if "status" in data and data["status"] is not None:
        atendimento.status = data["status"]

    if "data_atendimento" in data:
        atendimento.data_atendimento = _parse_datetime(data["data_atendimento"]) or atendimento.data_atendimento

    for field in [
        "queixa_principal",
        "anamnese",
        "exame_fisico",
        "dados_clinicos",
        "diagnostico",
        "plano_terapeutico",
        "retorno_recomendado",
        "observacoes",
    ]:
        if field in data and data[field] is not None:
            setattr(atendimento, field, data[field])

    atendimento.updated_at = datetime.now()

    if payload.exames is not None:
        _sync_exames(db, atendimento, payload.exames, current_user)
    if "prescricao" in data:
        _sync_prescricao(db, atendimento, payload.prescricao)

    db.commit()
    db.refresh(atendimento)
    return _montar_detalhe_atendimento(db, atendimento)


@router.delete("/{atendimento_id}")
def excluir_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    exames = db.query(Exame).filter(Exame.atendimento_id == atendimento_id).all()
    for exame in exames:
        db.delete(exame)

    prescricao = db.query(PrescricaoClinica).filter(PrescricaoClinica.atendimento_id == atendimento_id).first()
    if prescricao:
        itens = db.query(PrescricaoItem).filter(PrescricaoItem.prescricao_id == prescricao.id).all()
        for item in itens:
            db.delete(item)
        db.delete(prescricao)

    db.delete(atendimento)
    db.commit()
    return {"message": "Atendimento removido com sucesso.", "id": atendimento_id}


@router.get("/medicamentos/banco")
def listar_medicamentos(
    search: Optional[str] = None,
    ativos: int = 1,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = db.query(Medicamento)
    if ativos == 1:
        query = query.filter(Medicamento.ativo == 1)
    if search:
        termo = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Medicamento.nome.ilike(termo),
                Medicamento.principio_ativo.ilike(termo),
                Medicamento.categoria.ilike(termo),
            )
        )

    total = query.count()
    items = (
        query.order_by(Medicamento.nome.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "items": [
            {
                "id": item.id,
                "nome": item.nome,
                "principio_ativo": item.principio_ativo or "",
                "concentracao": item.concentracao or "",
                "forma_farmaceutica": item.forma_farmaceutica or "",
                "categoria": item.categoria or "",
                "observacoes": item.observacoes or "",
                "ativo": item.ativo,
            }
            for item in items
        ],
    }


@router.post("/medicamentos/banco", status_code=status.HTTP_201_CREATED)
def criar_medicamento(
    payload: MedicamentoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    nome_limpo = payload.nome.strip()
    if not nome_limpo:
        raise HTTPException(status_code=422, detail="Nome do medicamento e obrigatorio.")

    duplicado = (
        db.query(Medicamento)
        .filter(Medicamento.nome.ilike(nome_limpo))
        .first()
    )
    if duplicado:
        raise HTTPException(status_code=400, detail="Ja existe medicamento com esse nome.")

    medicamento = Medicamento(
        nome=nome_limpo,
        principio_ativo=payload.principio_ativo or "",
        concentracao=payload.concentracao or "",
        forma_farmaceutica=payload.forma_farmaceutica or "",
        categoria=payload.categoria or "",
        observacoes=payload.observacoes or "",
        ativo=1 if payload.ativo else 0,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(medicamento)
    db.commit()
    db.refresh(medicamento)
    return {
        "id": medicamento.id,
        "nome": medicamento.nome,
        "principio_ativo": medicamento.principio_ativo or "",
        "concentracao": medicamento.concentracao or "",
        "forma_farmaceutica": medicamento.forma_farmaceutica or "",
        "categoria": medicamento.categoria or "",
        "observacoes": medicamento.observacoes or "",
        "ativo": medicamento.ativo,
    }


@router.put("/medicamentos/banco/{medicamento_id}")
def atualizar_medicamento(
    medicamento_id: int,
    payload: MedicamentoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    medicamento = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
    if not medicamento:
        raise HTTPException(status_code=404, detail="Medicamento nao encontrado.")

    nome_limpo = payload.nome.strip()
    if not nome_limpo:
        raise HTTPException(status_code=422, detail="Nome do medicamento e obrigatorio.")

    duplicado = (
        db.query(Medicamento)
        .filter(Medicamento.id != medicamento_id, Medicamento.nome.ilike(nome_limpo))
        .first()
    )
    if duplicado:
        raise HTTPException(status_code=400, detail="Ja existe medicamento com esse nome.")

    medicamento.nome = nome_limpo
    medicamento.principio_ativo = payload.principio_ativo or ""
    medicamento.concentracao = payload.concentracao or ""
    medicamento.forma_farmaceutica = payload.forma_farmaceutica or ""
    medicamento.categoria = payload.categoria or ""
    medicamento.observacoes = payload.observacoes or ""
    medicamento.ativo = 1 if payload.ativo else 0
    medicamento.updated_at = datetime.now()

    db.commit()
    db.refresh(medicamento)
    return {
        "id": medicamento.id,
        "nome": medicamento.nome,
        "principio_ativo": medicamento.principio_ativo or "",
        "concentracao": medicamento.concentracao or "",
        "forma_farmaceutica": medicamento.forma_farmaceutica or "",
        "categoria": medicamento.categoria or "",
        "observacoes": medicamento.observacoes or "",
        "ativo": medicamento.ativo,
    }


@router.delete("/medicamentos/banco/{medicamento_id}")
def desativar_medicamento(
    medicamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    medicamento = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
    if not medicamento:
        raise HTTPException(status_code=404, detail="Medicamento nao encontrado.")

    medicamento.ativo = 0
    medicamento.updated_at = datetime.now()
    db.commit()
    return {"message": "Medicamento desativado com sucesso.", "id": medicamento_id}
