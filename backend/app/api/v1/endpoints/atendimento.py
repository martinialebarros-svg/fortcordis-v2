from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.atendimento_clinico import (
    AlertaClinico,
    AnexoAtendimento,
    AtendimentoClinico,
    EvolucaoClinica,
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


class TriagemPayload(BaseModel):
    peso: Optional[float] = None
    temperatura: Optional[float] = None
    frequencia_cardiaca: Optional[int] = None
    frequencia_respiratoria: Optional[int] = None
    pressao_arterial: Optional[str] = ""
    saturacao_oxigenio: Optional[int] = None
    escore_condicion_corpo: Optional[int] = None
    mucosas: Optional[str] = ""
    hidratacao: Optional[str] = ""
    triagem_observacoes: Optional[str] = ""


class DiagnosticoPayload(BaseModel):
    diagnostico_principal: Optional[str] = ""
    diagnostico_secundario: Optional[str] = ""
    diagnostico_diferencial: Optional[str] = ""
    prognostico: Optional[str] = ""


class EvolucaoPayload(BaseModel):
    descricao: str
    sinais_vitais: Optional[str] = ""


class AnexoPayload(BaseModel):
    tipo: str = Field(..., max_length=50)
    descricao: Optional[str] = ""
    url: str
    nome_original: Optional[str] = ""
    tamanho: Optional[int] = None
    mime_type: Optional[str] = ""


class AlertaPayload(BaseModel):
    tipo: str = Field(..., max_length=50)
    titulo: str
    descricao: Optional[str] = ""
    gravidade: Optional[str] = "media"


class AtendimentoCreatePayload(BaseModel):
    paciente_id: int
    clinica_id: Optional[int] = None
    agendamento_id: Optional[int] = None
    data_atendimento: Optional[str] = None
    status: str = Field(default="Triagem", max_length=50)
    triagem: Optional[TriagemPayload] = None
    queixa_principal: Optional[str] = ""
    anamnese: Optional[str] = ""
    exame_fisico: Optional[str] = ""
    dados_clinicos: Optional[str] = ""
    diagnostico: Optional[Union[DiagnosticoPayload, str]] = None
    plano_terapeutico: Optional[str] = ""
    retorno_recomendado: Optional[str] = ""
    motivo_retorno: Optional[str] = ""
    observacoes: Optional[str] = ""
    exames: List[ExameSolicitacaoPayload] = Field(default_factory=list)
    prescricao: Optional[PrescricaoPayload] = None


class AtendimentoUpdatePayload(BaseModel):
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    agendamento_id: Optional[int] = None
    data_atendimento: Optional[str] = None
    status: Optional[str] = None
    triagem: Optional[TriagemPayload] = None
    triagem_concluida: Optional[int] = None
    consulta_concluida: Optional[int] = None
    queixa_principal: Optional[str] = None
    anamnese: Optional[str] = None
    exame_fisico: Optional[str] = None
    dados_clinicos: Optional[str] = None
    diagnostico: Optional[Union[DiagnosticoPayload, str]] = None
    plano_terapeutico: Optional[str] = None
    retorno_recomendado: Optional[str] = None
    motivo_retorno: Optional[str] = None
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


def _normalizar_diagnostico(diagnostico: Optional[Union[DiagnosticoPayload, str]]) -> Dict[str, Optional[str]]:
    if isinstance(diagnostico, str):
        texto = diagnostico.strip()
        return {
            "diagnostico_principal": texto,
            "diagnostico_secundario": "",
            "diagnostico_diferencial": "",
            "prognostico": None,
        }

    if diagnostico is None:
        return {
            "diagnostico_principal": "",
            "diagnostico_secundario": "",
            "diagnostico_diferencial": "",
            "prognostico": None,
        }

    return {
        "diagnostico_principal": diagnostico.diagnostico_principal or "",
        "diagnostico_secundario": diagnostico.diagnostico_secundario or "",
        "diagnostico_diferencial": diagnostico.diagnostico_diferencial or "",
        "prognostico": diagnostico.prognostico or None,
    }


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

    # Buscar evoluções
    evolucoes = (
        db.query(EvolucaoClinica)
        .filter(EvolucaoClinica.atendimento_id == atendimento.id)
        .order_by(EvolucaoClinica.data_evolucao.desc())
        .all()
    )

    # Buscar anexos
    anexos = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.atendimento_id == atendimento.id)
        .order_by(AnexoAtendimento.created_at.desc())
        .all()
    )

    return {
        "id": atendimento.id,
        "paciente_id": atendimento.paciente_id,
        "tutor_id": atendimento.tutor_id,
        "clinica_id": atendimento.clinica_id,
        "agendamento_id": atendimento.agendamento_id,
        "veterinario_id": atendimento.veterinario_id,
        "data_atendimento": _to_iso(atendimento.data_atendimento),
        "status": atendimento.status,
        # Triagem
        "triagem": {
            "peso": atendimento.peso,
            "temperatura": atendimento.temperatura,
            "frequencia_cardiaca": atendimento.frequencia_cardiaca,
            "frequencia_respiratoria": atendimento.frequencia_respiratoria,
            "pressao_arterial": atendimento.pressao_arterial or "",
            "saturacao_oxigenio": atendimento.saturacao_oxigenio,
            "escore_condicion_corpo": atendimento.escore_condicion_corpo,
            "mucosas": atendimento.mucosas or "",
            "hidratacao": atendimento.hidratacao or "",
            "triagem_observacoes": atendimento.triagem_observacoes or "",
        },
        "triagem_concluida": atendimento.triagem_concluida or 0,
        "consulta_concluida": atendimento.consulta_concluida or 0,
        # Consulta
        "queixa_principal": atendimento.queixa_principal or "",
        "anamnese": atendimento.anamnese or "",
        "exame_fisico": atendimento.exame_fisico or "",
        "dados_clinicos": atendimento.dados_clinicos or "",
        # Diagnósticos
        "diagnostico_principal": atendimento.diagnostico_principal or "",
        "diagnostico_secundario": atendimento.diagnostico_secundario or "",
        "diagnostico_diferencial": atendimento.diagnostico_diferencial or "",
        "diagnostico": atendimento.diagnostico_principal or "",  # Compatibilidade
        "prognostico": atendimento.prognostico or "",
        # Tratamento
        "plano_terapeutico": atendimento.plano_terapeutico or "",
        # Retorno
        "retorno_recomendado": atendimento.retorno_recomendado or "",
        "motivo_retorno": atendimento.motivo_retorno or "",
        "observacoes": atendimento.observacoes or "",
        # Metadados
        "created_at": _to_iso(atendimento.created_at),
        "updated_at": _to_iso(atendimento.updated_at),
        "criado_por_id": atendimento.criado_por_id,
        "criado_por_nome": atendimento.criado_por_nome,
        # Relacionamentos
        "paciente_nome": paciente.nome if paciente else "",
        "tutor_nome": tutor.nome if tutor else "",
        "clinica_nome": clinica.nome if clinica else "",
        # Extras
        "exames": [_map_exame(exame) for exame in exames],
        "prescricao": prescricao_dict,
        "evolucoes": [
            {
                "id": e.id,
                "data_evolucao": _to_iso(e.data_evolucao),
                "descricao": e.descricao,
                "sinais_vitais": e.sinais_vitais or "",
                "responsavel_nome": e.responsavel_nome or "",
            }
            for e in evolucoes
        ],
        "anexos": [
            {
                "id": a.id,
                "tipo": a.tipo,
                "descricao": a.descricao or "",
                "url": a.url,
                "nome_original": a.nome_original or "",
                "tamanho": a.tamanho,
                "mime_type": a.mime_type or "",
                "created_at": _to_iso(a.created_at),
            }
            for a in anexos
        ],
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
                AtendimentoClinico.diagnostico_principal.ilike(termo),
                AtendimentoClinico.diagnostico_secundario.ilike(termo),
                AtendimentoClinico.diagnostico_diferencial.ilike(termo),
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
                "diagnostico": atendimento.diagnostico_principal or "",
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

    # Extrair dados de triagem
    triagem = payload.triagem
    diagnostico = _normalizar_diagnostico(payload.diagnostico)

    atendimento = AtendimentoClinico(
        paciente_id=payload.paciente_id,
        tutor_id=tutor_id,
        clinica_id=payload.clinica_id,
        agendamento_id=payload.agendamento_id,
        veterinario_id=current_user.id,
        data_atendimento=data_atendimento,
        status=payload.status or "Triagem",
        # Triagem
        peso=triagem.peso if triagem else None,
        temperatura=triagem.temperatura if triagem else None,
        frequencia_cardiaca=triagem.frequencia_cardiaca if triagem else None,
        frequencia_respiratoria=triagem.frequencia_respiratoria if triagem else None,
        pressao_arterial=triagem.pressao_arterial if triagem else None,
        saturacao_oxigenio=triagem.saturacao_oxigenio if triagem else None,
        escore_condicion_corpo=triagem.escore_condicion_corpo if triagem else None,
        mucosas=triagem.mucosas if triagem else None,
        hidratacao=triagem.hidratacao if triagem else None,
        triagem_observacoes=triagem.triagem_observacoes if triagem else None,
        triagem_concluida=1 if triagem else 0,
        # Consulta
        queixa_principal=payload.queixa_principal or "",
        anamnese=payload.anamnese or "",
        exame_fisico=payload.exame_fisico or "",
        dados_clinicos=payload.dados_clinicos or "",
        # Diagnósticos
        diagnostico_principal=diagnostico["diagnostico_principal"] or "",
        diagnostico_secundario=diagnostico["diagnostico_secundario"] or "",
        diagnostico_diferencial=diagnostico["diagnostico_diferencial"] or "",
        prognostico=diagnostico["prognostico"],
        # Tratamento
        plano_terapeutico=payload.plano_terapeutico or "",
        # Retorno
        retorno_recomendado=payload.retorno_recomendado or "",
        motivo_retorno=payload.motivo_retorno or "",
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

    data = payload.model_dump(exclude_unset=True, exclude={"triagem", "diagnostico"})

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

    # Triagem
    if payload.triagem:
        triagem = payload.triagem
        atendimento.peso = triagem.peso
        atendimento.temperatura = triagem.temperatura
        atendimento.frequencia_cardiaca = triagem.frequencia_cardiaca
        atendimento.frequencia_respiratoria = triagem.frequencia_respiratoria
        atendimento.pressao_arterial = triagem.pressao_arterial
        atendimento.saturacao_oxigenio = triagem.saturacao_oxigenio
        atendimento.escore_condicion_corpo = triagem.escore_condicion_corpo
        atendimento.mucosas = triagem.mucosas
        atendimento.hidratacao = triagem.hidratacao
        atendimento.triagem_observacoes = triagem.triagem_observacoes

    if "triagem_concluida" in data:
        atendimento.triagem_concluida = data["triagem_concluida"]
    if "consulta_concluida" in data:
        atendimento.consulta_concluida = data["consulta_concluida"]

    # Diagnósticos
    if payload.diagnostico is not None:
        diag = _normalizar_diagnostico(payload.diagnostico)
        atendimento.diagnostico_principal = diag["diagnostico_principal"] or ""
        atendimento.diagnostico_secundario = diag["diagnostico_secundario"] or ""
        atendimento.diagnostico_diferencial = diag["diagnostico_diferencial"] or ""
        atendimento.prognostico = diag["prognostico"]

    for field in [
        "queixa_principal",
        "anamnese",
        "exame_fisico",
        "dados_clinicos",
        "diagnostico_principal",
        "diagnostico_secundario",
        "diagnostico_diferencial",
        "plano_terapeutico",
        "retorno_recomendado",
        "motivo_retorno",
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


# === EVOLUÇÕES CLÍNICAS ===
@router.get("/{atendimento_id}/evolucoes")
def listar_evolucoes(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    evolucoes = (
        db.query(EvolucaoClinica)
        .filter(EvolucaoClinica.atendimento_id == atendimento_id)
        .order_by(EvolucaoClinica.data_evolucao.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": e.id,
                "atendimento_id": e.atendimento_id,
                "data_evolucao": _to_iso(e.data_evolucao),
                "descricao": e.descricao,
                "sinais_vitais": e.sinais_vitais or "",
                "responsavel_id": e.responsavel_id,
                "responsavel_nome": e.responsavel_nome or "",
                "created_at": _to_iso(e.created_at),
            }
            for e in evolucoes
        ]
    }


@router.post("/{atendimento_id}/evolucoes", status_code=status.HTTP_201_CREATED)
def criar_evolucao(
    atendimento_id: int,
    payload: EvolucaoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    evolucao = EvolucaoClinica(
        atendimento_id=atendimento_id,
        descricao=payload.descricao,
        sinais_vitais=payload.sinais_vitais,
        responsavel_id=current_user.id,
        responsavel_nome=current_user.nome,
    )
    db.add(evolucao)
    db.commit()
    db.refresh(evolucao)

    return {
        "id": evolucao.id,
        "atendimento_id": evolucao.atendimento_id,
        "data_evolucao": _to_iso(evolucao.data_evolucao),
        "descricao": evolucao.descricao,
        "sinais_vitais": evolucao.sinais_vitais or "",
        "responsavel_nome": evolucao.responsavel_nome,
    }


# === ANEXOS ===
@router.get("/{atendimento_id}/anexos")
def listar_anexos(
    atendimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    anexos = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.atendimento_id == atendimento_id)
        .order_by(AnexoAtendimento.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "atendimento_id": a.atendimento_id,
                "tipo": a.tipo,
                "descricao": a.descricao or "",
                "url": a.url,
                "nome_original": a.nome_original or "",
                "tamanho": a.tamanho,
                "mime_type": a.mime_type or "",
                "created_at": _to_iso(a.created_at),
            }
            for a in anexos
        ]
    }


@router.post("/{atendimento_id}/anexos", status_code=status.HTTP_201_CREATED)
def criar_anexo(
    atendimento_id: int,
    payload: AnexoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    anexo = AnexoAtendimento(
        atendimento_id=atendimento_id,
        tipo=payload.tipo,
        descricao=payload.descricao,
        url=payload.url,
        nome_original=payload.nome_original,
        tamanho=payload.tamanho,
        mime_type=payload.mime_type,
    )
    db.add(anexo)
    db.commit()
    db.refresh(anexo)

    return {
        "id": anexo.id,
        "atendimento_id": anexo.atendimento_id,
        "tipo": anexo.tipo,
        "descricao": anexo.descricao or "",
        "url": anexo.url,
        "nome_original": anexo.nome_original or "",
    }


@router.delete("/anexos/{anexo_id}")
def excluir_anexo(
    anexo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    anexo = db.query(AnexoAtendimento).filter(AnexoAtendimento.id == anexo_id).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo nao encontrado.")

    db.delete(anexo)
    db.commit()
    return {"message": "Anexo removido com sucesso.", "id": anexo_id}


# === ALERTAS CLÍNICOS ===
@router.get("/paciente/{paciente_id}/alertas")
def listar_alertas_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    alertas = (
        db.query(AlertaClinico)
        .filter(AlertaClinico.paciente_id == paciente_id, AlertaClinico.ativo == 1)
        .order_by(AlertaClinico.gravidade.desc(), AlertaClinico.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "paciente_id": a.paciente_id,
                "tipo": a.tipo,
                "titulo": a.titulo,
                "descricao": a.descricao or "",
                "gravidade": a.gravidade or "media",
                "data_inicio": _to_iso(a.data_inicio),
                "data_fim": _to_iso(a.data_fim),
            }
            for a in alertas
        ]
    }


@router.post("/paciente/{paciente_id}/alertas", status_code=status.HTTP_201_CREATED)
def criar_alerta(
    paciente_id: int,
    payload: AlertaPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    alerta = AlertaClinico(
        paciente_id=paciente_id,
        tipo=payload.tipo,
        titulo=payload.titulo,
        descricao=payload.descricao,
        gravidade=payload.gravidade or "media",
    )
    db.add(alerta)
    db.commit()
    db.refresh(alerta)

    return {
        "id": alerta.id,
        "paciente_id": alerta.paciente_id,
        "tipo": alerta.tipo,
        "titulo": alerta.titulo,
        "descricao": alerta.descricao or "",
        "gravidade": alerta.gravidade,
    }


@router.put("/alertas/{alerta_id}")
def atualizar_alerta(
    alerta_id: int,
    payload: AlertaPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    alerta = db.query(AlertaClinico).filter(AlertaClinico.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta nao encontrado.")

    alerta.tipo = payload.tipo
    alerta.titulo = payload.titulo
    alerta.descricao = payload.descricao or ""
    alerta.gravidade = payload.gravidade or "media"
    db.commit()
    db.refresh(alerta)

    return {
        "id": alerta.id,
        "paciente_id": alerta.paciente_id,
        "tipo": alerta.tipo,
        "titulo": alerta.titulo,
        "descricao": alerta.descricao or "",
        "gravidade": alerta.gravidade,
    }


@router.delete("/alertas/{alerta_id}")
def desativar_alerta(
    alerta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    alerta = db.query(AlertaClinico).filter(AlertaClinico.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta nao encontrado.")

    alerta.ativo = 0
    db.commit()
    return {"message": "Alerta desativado com sucesso.", "id": alerta_id}


# === HISTÓRICO DO PACIENTE ===
@router.get("/paciente/{paciente_id}/historico")
def historico_paciente(
    paciente_id: int,
    limite: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    # Buscar atendimentos anteriores
    atendimentos = (
        db.query(AtendimentoClinico)
        .filter(AtendimentoClinico.paciente_id == paciente_id)
        .order_by(AtendimentoClinico.data_atendimento.desc())
        .limit(limite)
        .all()
    )

    # Buscar alertas ativos
    alertas = (
        db.query(AlertaClinico)
        .filter(AlertaClinico.paciente_id == paciente_id, AlertaClinico.ativo == 1)
        .all()
    )

    return {
        "paciente": {
            "id": paciente.id,
            "nome": paciente.nome,
            "especie": paciente.especie or "",
            "raca": paciente.raca or "",
            "peso": paciente.peso or "",
            "nascimento": _to_iso(paciente.nascimento) if paciente.nascimento else None,
        },
        "alertas": [
            {
                "id": a.id,
                "tipo": a.tipo,
                "titulo": a.titulo,
                "descricao": a.descricao or "",
                "gravidade": a.gravidade or "media",
            }
            for a in alertas
        ],
        "atendimentos": [
            {
                "id": a.id,
                "data_atendimento": _to_iso(a.data_atendimento),
                "status": a.status,
                "queixa_principal": a.queixa_principal or "",
                "diagnostico_principal": a.diagnostico_principal or "",
                "veterinario": a.criado_por_nome or "",
            }
            for a in atendimentos
        ],
    }
