from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract
from typing import List, Optional
from datetime import datetime, date, timedelta
from calendar import monthrange

from app.db.database import get_db
from app.models.financeiro import (
    Transacao,
    ContaPagar,
    ContaReceber,
    CustoFrota,
    VeiculoFrota,
    TelemetriaFrotaMensal,
    ConfigRateioFrota,
    CategoriaTransacao,
)
from app.models.user import User
from app.core.security import get_current_user
from app.services.auditoria_service import registrar_auditoria
from app.schemas.financeiro import (
    TransacaoCreate, TransacaoUpdate, TransacaoResponse, TransacaoLista,
    ContaPagarCreate, ContaPagarUpdate, ContaPagarResponse, ContaPagarLista,
    ContaReceberCreate, ContaReceberUpdate, ContaReceberResponse, ContaReceberLista,
    CustoFrotaCreate, CustoFrotaUpdate, CustoFrotaResponse, CustoFrotaLista,
    VeiculoFrotaCreate, VeiculoFrotaUpdate, VeiculoFrotaResponse, VeiculoFrotaLista,
    TelemetriaFrotaMensalCreate, TelemetriaFrotaMensalUpdate, TelemetriaFrotaMensalResponse, TelemetriaFrotaMensalLista,
    ConfigRateioFrotaUpdate, ConfigRateioFrotaResponse,
    ResumoFinanceiro, DadosGrafico, RelatorioCategoria, CategoriaResumo,
    RelatorioFluxoCaixa, FluxoCaixaItem, RelatorioComparativo, ComparativoMes,
    RelatorioDRE, DREItem
)

router = APIRouter()


def _obter_ou_criar_config_rateio_frota(db: Session) -> ConfigRateioFrota:
    config = db.query(ConfigRateioFrota).order_by(ConfigRateioFrota.id.asc()).first()
    if config:
        return config

    config = ConfigRateioFrota(
        peso_km=0.7,
        peso_atendimento=0.3,
        auto_gerar_depreciacao=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def _validar_pesos_rateio(peso_km: float, peso_atendimento: float) -> tuple[float, float]:
    total = float(peso_km or 0) + float(peso_atendimento or 0)
    if total <= 0:
        raise HTTPException(status_code=422, detail="A soma dos pesos de rateio deve ser maior que zero.")
    return round(float(peso_km) / total, 6), round(float(peso_atendimento) / total, 6)


def _parse_competencia_intervalo(competencia: str) -> tuple[date, date]:
    try:
        ano = int(competencia[:4])
        mes = int(competencia[5:7])
        if len(competencia) != 7 or competencia[4] != "-":
            raise ValueError("formato")
        inicio = date(ano, mes, 1)
        fim = date(ano, mes, monthrange(ano, mes)[1])
        return inicio, fim
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Competencia invalida. Use YYYY-MM.") from exc


# ==================== TRANSAÇÕES - CRUD COMPLETO ====================

@router.get("/transacoes", response_model=TransacaoLista)
def listar_transacoes(
    tipo: Optional[str] = Query(None, pattern="^(entrada|saida)$"),
    categoria: Optional[str] = None,
    forma_pagamento: Optional[str] = None,
    status: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    paciente_id: Optional[int] = None,
    clinica_id: Optional[int] = Query(None, description="Filtrar por clínica (centro de custo)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista transações financeiras com filtros avançados"""
    query = db.query(Transacao)

    if tipo:
        query = query.filter(Transacao.tipo == tipo)
    if categoria:
        query = query.filter(Transacao.categoria == categoria)
    if forma_pagamento:
        query = query.filter(Transacao.forma_pagamento == forma_pagamento)
    if status:
        query = query.filter(Transacao.status == status)
    if paciente_id:
        query = query.filter(Transacao.paciente_id == paciente_id)
    if clinica_id:
        query = query.filter(Transacao.clinica_id == clinica_id)
    if data_inicio:
        query = query.filter(Transacao.data_transacao >= data_inicio)
    if data_fim:
        query = query.filter(Transacao.data_transacao <= data_fim)
    
    total = query.count()
    items = query.order_by(Transacao.data_transacao.desc()).offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}


@router.get("/transacoes/{transacao_id}", response_model=TransacaoResponse)
def obter_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém uma transação específica"""
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return transacao


@router.post("/transacoes", response_model=TransacaoResponse, status_code=status.HTTP_201_CREATED)
def criar_transacao(
    transacao_data: TransacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria nova transação financeira"""
    transacao = Transacao(
        tipo=transacao_data.tipo,
        categoria=transacao_data.categoria,
        valor=transacao_data.valor,
        desconto=transacao_data.desconto,
        valor_final=transacao_data.valor - transacao_data.desconto,
        forma_pagamento=transacao_data.forma_pagamento,
        status=transacao_data.status,
        descricao=transacao_data.descricao,
        data_transacao=transacao_data.data_transacao,
        data_vencimento=transacao_data.data_vencimento,
        observacoes=transacao_data.observacoes,
        paciente_id=transacao_data.paciente_id,
        paciente_nome=transacao_data.paciente_nome,
        agendamento_id=transacao_data.agendamento_id,
        parcelas=transacao_data.parcelas,
        parcela_atual=transacao_data.parcela_atual,
        clinica_id=transacao_data.clinica_id,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(transacao)
    db.commit()
    db.refresh(transacao)
    
    return transacao


@router.put("/transacoes/{transacao_id}", response_model=TransacaoResponse)
def atualizar_transacao(
    transacao_id: int,
    transacao_data: TransacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma transação existente"""
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    # Atualiza campos
    for field, value in transacao_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(transacao, field, value)
    
    # Recalcula valor_final se valor ou desconto mudou
    if transacao_data.valor is not None or transacao_data.desconto is not None:
        transacao.valor_final = transacao.valor - transacao.desconto
    
    transacao.updated_at = datetime.now()
    
    db.commit()
    db.refresh(transacao)
    return transacao


@router.delete("/transacoes/{transacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_transacao(
    transacao_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma transação"""
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    data_transacao_str = (
        transacao.data_transacao.strftime("%d/%m/%Y")
        if transacao.data_transacao
        else "-"
    )
    valor_referencia = transacao.valor_final if transacao.valor_final is not None else transacao.valor
    valor_float = float(valor_referencia or 0)
    valor_formatado = f"R$ {valor_float:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    db.delete(transacao)
    db.commit()

    registrar_auditoria(
        current_user=current_user,
        modulo="financeiro",
        entidade="transacao",
        entidade_id=transacao_id,
        acao="TRANSACAO_EXCLUIDA",
        descricao=(
            f"Transacao excluida: {transacao.tipo} | {transacao.categoria} | "
            f"{valor_formatado} | {data_transacao_str} | status {transacao.status}"
        ),
        detalhes={
            "transacao_id": transacao_id,
            "tipo": transacao.tipo,
            "categoria": transacao.categoria,
            "descricao": transacao.descricao,
            "paciente_nome": transacao.paciente_nome,
            "status": transacao.status,
            "data_transacao": transacao.data_transacao.isoformat() if transacao.data_transacao else None,
            "valor": float(transacao.valor or 0),
            "desconto": float(transacao.desconto or 0),
            "valor_final": float(transacao.valor_final or 0),
        },
        request=request,
    )

    return None


@router.patch("/transacoes/{transacao_id}/pagar", response_model=TransacaoResponse)
def pagar_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marca transação como paga/recebida"""
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    transacao.status = "Pago" if transacao.tipo == "saida" else "Recebido"
    transacao.data_pagamento = datetime.now()
    transacao.updated_at = datetime.now()
    
    db.commit()
    db.refresh(transacao)
    return transacao


@router.patch("/transacoes/{transacao_id}/cancelar", response_model=TransacaoResponse)
def cancelar_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancela uma transação"""
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    transacao.status = "Cancelado"
    transacao.updated_at = datetime.now()
    
    db.commit()
    db.refresh(transacao)
    return transacao


# ==================== CATEGORIAS ====================

@router.get("/categorias")
def listar_categorias(
    tipo: Optional[str] = Query(None, pattern="^(entrada|saida)$"),
    current_user: User = Depends(get_current_user)
):
    """Lista categorias de transações disponíveis"""
    categorias_entrada = [
        {"id": "consulta", "nome": "Consulta", "tipo": "entrada"},
        {"id": "exame", "nome": "Exame", "tipo": "entrada"},
        {"id": "cirurgia", "nome": "Cirurgia", "tipo": "entrada"},
        {"id": "medicamento", "nome": "Medicamento", "tipo": "entrada"},
        {"id": "banho_tosa", "nome": "Banho e Tosa", "tipo": "entrada"},
        {"id": "produto", "nome": "Produto", "tipo": "entrada"},
        {"id": "outros", "nome": "Outros", "tipo": "entrada"},
    ]
    
    categorias_saida = [
        {"id": "salario", "nome": "Salário", "tipo": "saida"},
        {"id": "aluguel", "nome": "Aluguel", "tipo": "saida"},
        {"id": "fornecedor", "nome": "Fornecedor", "tipo": "saida"},
        {"id": "imposto", "nome": "Imposto", "tipo": "saida"},
        {"id": "manutencao", "nome": "Manutenção", "tipo": "saida"},
        {"id": "marketing", "nome": "Marketing", "tipo": "saida"},
        {"id": "outros", "nome": "Outros", "tipo": "saida"},
    ]
    
    if tipo == "entrada":
        return {"items": categorias_entrada}
    elif tipo == "saida":
        return {"items": categorias_saida}
    else:
        return {"items": categorias_entrada + categorias_saida}


# ==================== CUSTOS DE FROTA ====================

@router.get("/custos-frota", response_model=CustoFrotaLista)
def listar_custos_frota(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    categoria: Optional[str] = None,
    forma_rateio: Optional[str] = Query(None, pattern="^(por_km|por_atendimento|fixo_mensal|hibrido)$"),
    clinica_id: Optional[int] = Query(None, description="Filtrar por clínica vinculada"),
    veiculo_id: Optional[int] = Query(None, description="Filtrar por veículo"),
    veiculo: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista custos de frota com filtros."""
    _ = current_user
    query = db.query(CustoFrota)

    if categoria:
        query = query.filter(CustoFrota.categoria == categoria)
    if forma_rateio:
        query = query.filter(CustoFrota.forma_rateio == forma_rateio)
    if clinica_id:
        query = query.filter(CustoFrota.clinica_id == clinica_id)
    if veiculo_id:
        query = query.filter(CustoFrota.veiculo_id == veiculo_id)
    if veiculo:
        query = query.filter(CustoFrota.veiculo.ilike(f"%{veiculo.strip()}%"))
    if data_inicio:
        query = query.filter(func.date(CustoFrota.data_referencia) >= data_inicio)
    if data_fim:
        query = query.filter(func.date(CustoFrota.data_referencia) <= data_fim)

    total = query.count()
    items = (
        query.order_by(CustoFrota.data_referencia.desc(), CustoFrota.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": items}


@router.post("/custos-frota", response_model=CustoFrotaResponse, status_code=status.HTTP_201_CREATED)
def criar_custo_frota(
    payload: CustoFrotaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um lançamento de custo de frota."""
    item = CustoFrota(
        data_referencia=payload.data_referencia,
        categoria=payload.categoria.strip().lower(),
        valor=payload.valor,
        forma_rateio=payload.forma_rateio,
        km_referencia=payload.km_referencia,
        atendimentos_referencia=payload.atendimentos_referencia,
        clinica_id=payload.clinica_id,
        veiculo_id=payload.veiculo_id,
        veiculo=(payload.veiculo or "").strip() or None,
        descricao=(payload.descricao or "").strip() or None,
        observacoes=(payload.observacoes or "").strip() or None,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/custos-frota/{custo_id}", response_model=CustoFrotaResponse)
def atualizar_custo_frota(
    custo_id: int,
    payload: CustoFrotaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza custo de frota."""
    _ = current_user
    item = db.query(CustoFrota).filter(CustoFrota.id == custo_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Custo de frota nao encontrado")

    dados = payload.model_dump(exclude_unset=True)
    for field, value in dados.items():
        if field == "categoria" and value is not None:
            setattr(item, field, str(value).strip().lower())
            continue
        if field in {"veiculo", "descricao", "observacoes"} and value is not None:
            valor_limpo = str(value).strip()
            setattr(item, field, valor_limpo or None)
            continue
        setattr(item, field, value)

    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/custos-frota/{custo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_custo_frota(
    custo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove custo de frota."""
    _ = current_user
    item = db.query(CustoFrota).filter(CustoFrota.id == custo_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Custo de frota nao encontrado")
    db.delete(item)
    db.commit()
    return None


@router.get("/custos-frota/rateio-resumo")
def resumo_rateio_custos_frota(
    data_inicio: str,
    data_fim: str,
    km_rodado_periodo: float = Query(..., ge=0),
    atendimentos_periodo: int = Query(..., ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumo de custo por km/atendimento com base nos lançamentos da frota."""
    _ = current_user
    config = _obter_ou_criar_config_rateio_frota(db)
    peso_km, peso_atendimento = _validar_pesos_rateio(
        float(config.peso_km or 0),
        float(config.peso_atendimento or 0),
    )

    rows = (
        db.query(CustoFrota.forma_rateio, func.sum(CustoFrota.valor).label("total"))
        .filter(
            func.date(CustoFrota.data_referencia) >= data_inicio,
            func.date(CustoFrota.data_referencia) <= data_fim,
        )
        .group_by(CustoFrota.forma_rateio)
        .all()
    )
    totais = {str(row.forma_rateio): float(row.total or 0) for row in rows}
    total_periodo = float(sum(totais.values()))

    custo_por_km = 0.0
    if km_rodado_periodo > 0:
        custo_por_km = round(
            (totais.get("por_km", 0.0) + totais.get("fixo_mensal", 0.0)) / km_rodado_periodo,
            4,
        )

    custo_por_atendimento = 0.0
    if atendimentos_periodo > 0:
        custo_por_atendimento = round(
            (totais.get("por_atendimento", 0.0) + totais.get("fixo_mensal", 0.0)) / atendimentos_periodo,
            4,
        )

    custo_hibrido_atendimento = 0.0
    custo_hibrido_km = 0.0
    km_medio_atendimento = 0.0
    if atendimentos_periodo > 0:
        km_medio_atendimento = round(km_rodado_periodo / atendimentos_periodo, 6)

    componente_km = (
        round((totais.get("por_km", 0.0) + totais.get("fixo_mensal", 0.0)) / km_rodado_periodo, 6)
        if km_rodado_periodo > 0
        else 0.0
    )
    componente_atendimento = (
        round(totais.get("por_atendimento", 0.0) / atendimentos_periodo, 6)
        if atendimentos_periodo > 0
        else 0.0
    )
    if atendimentos_periodo > 0:
        custo_hibrido_atendimento = round(
            (km_medio_atendimento * componente_km * peso_km) + (componente_atendimento * peso_atendimento),
            6,
        )
    if km_rodado_periodo > 0 and km_medio_atendimento > 0:
        componente_atendimento_em_km = componente_atendimento / km_medio_atendimento
        custo_hibrido_km = round(
            (componente_km * peso_km) + (componente_atendimento_em_km * peso_atendimento),
            6,
        )

    return {
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "total_periodo": round(total_periodo, 2),
        "totais_por_rateio": {
            "por_km": round(totais.get("por_km", 0.0), 2),
            "por_atendimento": round(totais.get("por_atendimento", 0.0), 2),
            "fixo_mensal": round(totais.get("fixo_mensal", 0.0), 2),
            "hibrido": round(totais.get("hibrido", 0.0), 2),
        },
        "indices": {
            "custo_por_km": custo_por_km,
            "custo_por_atendimento": custo_por_atendimento,
            "custo_hibrido_por_km": custo_hibrido_km,
            "custo_hibrido_por_atendimento": custo_hibrido_atendimento,
            "km_medio_por_atendimento": round(km_medio_atendimento, 4),
        },
        "config_rateio": {
            "peso_km": peso_km,
            "peso_atendimento": peso_atendimento,
            "auto_gerar_depreciacao": bool(config.auto_gerar_depreciacao),
        },
    }


# ==================== FROTA V2 ====================

@router.get("/frota/veiculos", response_model=VeiculoFrotaLista)
def listar_veiculos_frota(
    ativo: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = db.query(VeiculoFrota)
    if ativo is not None:
        query = query.filter(VeiculoFrota.ativo == ativo)
    total = query.count()
    items = query.order_by(VeiculoFrota.nome.asc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}


@router.post("/frota/veiculos", response_model=VeiculoFrotaResponse, status_code=status.HTTP_201_CREATED)
def criar_veiculo_frota(
    payload: VeiculoFrotaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = VeiculoFrota(
        nome=payload.nome.strip(),
        placa=(payload.placa or "").strip() or None,
        tipo_combustivel=(payload.tipo_combustivel or "").strip() or None,
        consumo_km_litro=payload.consumo_km_litro,
        valor_aquisicao=payload.valor_aquisicao,
        valor_residual=payload.valor_residual,
        vida_util_meses=payload.vida_util_meses,
        ativo=bool(payload.ativo),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/frota/veiculos/{veiculo_id}", response_model=VeiculoFrotaResponse)
def atualizar_veiculo_frota(
    veiculo_id: int,
    payload: VeiculoFrotaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    item = db.query(VeiculoFrota).filter(VeiculoFrota.id == veiculo_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Veiculo de frota nao encontrado")

    dados = payload.model_dump(exclude_unset=True)
    for field, value in dados.items():
        if field in {"nome", "placa", "tipo_combustivel"} and value is not None:
            texto = str(value).strip()
            if field == "nome" and not texto:
                raise HTTPException(status_code=422, detail="Nome do veiculo nao pode ficar vazio.")
            setattr(item, field, texto or None)
            continue
        setattr(item, field, value)

    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/frota/veiculos/{veiculo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_veiculo_frota(
    veiculo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    item = db.query(VeiculoFrota).filter(VeiculoFrota.id == veiculo_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Veiculo de frota nao encontrado")
    item.ativo = False
    item.updated_at = datetime.now()
    db.commit()
    return None


@router.get("/frota/telemetria", response_model=TelemetriaFrotaMensalLista)
def listar_telemetria_frota(
    competencia: Optional[str] = Query(None, pattern="^\\d{4}-\\d{2}$"),
    veiculo_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    query = db.query(TelemetriaFrotaMensal)
    if competencia:
        query = query.filter(TelemetriaFrotaMensal.competencia == competencia)
    if veiculo_id:
        query = query.filter(TelemetriaFrotaMensal.veiculo_id == veiculo_id)

    total = query.count()
    items = (
        query.order_by(TelemetriaFrotaMensal.competencia.desc(), TelemetriaFrotaMensal.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": items}


@router.post(
    "/frota/telemetria",
    response_model=TelemetriaFrotaMensalResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_telemetria_frota(
    payload: TelemetriaFrotaMensalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    veiculo = db.query(VeiculoFrota).filter(VeiculoFrota.id == payload.veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veiculo nao encontrado")

    existente = (
        db.query(TelemetriaFrotaMensal)
        .filter(
            TelemetriaFrotaMensal.veiculo_id == payload.veiculo_id,
            TelemetriaFrotaMensal.competencia == payload.competencia,
        )
        .first()
    )
    if existente:
        existente.km_inicial = payload.km_inicial
        existente.km_final = payload.km_final
        existente.km_rodado = payload.km_rodado
        existente.litros_consumidos = payload.litros_consumidos
        existente.valor_combustivel = payload.valor_combustivel
        existente.updated_at = datetime.now()
        db.commit()
        db.refresh(existente)
        return existente

    item = TelemetriaFrotaMensal(
        veiculo_id=payload.veiculo_id,
        competencia=payload.competencia,
        km_inicial=payload.km_inicial,
        km_final=payload.km_final,
        km_rodado=payload.km_rodado,
        litros_consumidos=payload.litros_consumidos,
        valor_combustivel=payload.valor_combustivel,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/frota/telemetria/{telemetria_id}", response_model=TelemetriaFrotaMensalResponse)
def atualizar_telemetria_frota(
    telemetria_id: int,
    payload: TelemetriaFrotaMensalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    item = db.query(TelemetriaFrotaMensal).filter(TelemetriaFrotaMensal.id == telemetria_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Telemetria nao encontrada")

    dados = payload.model_dump(exclude_unset=True)
    for field, value in dados.items():
        setattr(item, field, value)
    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/frota/telemetria/{telemetria_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_telemetria_frota(
    telemetria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    item = db.query(TelemetriaFrotaMensal).filter(TelemetriaFrotaMensal.id == telemetria_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Telemetria nao encontrada")
    db.delete(item)
    db.commit()
    return None


@router.get("/frota/rateio-config", response_model=ConfigRateioFrotaResponse)
def obter_config_rateio_frota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _obter_ou_criar_config_rateio_frota(db)


@router.put("/frota/rateio-config", response_model=ConfigRateioFrotaResponse)
def atualizar_config_rateio_frota(
    payload: ConfigRateioFrotaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    peso_km, peso_atendimento = _validar_pesos_rateio(payload.peso_km, payload.peso_atendimento)
    config = _obter_ou_criar_config_rateio_frota(db)
    config.peso_km = peso_km
    config.peso_atendimento = peso_atendimento
    config.auto_gerar_depreciacao = bool(payload.auto_gerar_depreciacao)
    config.updated_at = datetime.now()
    config.criado_por_id = current_user.id
    config.criado_por_nome = current_user.nome
    db.commit()
    db.refresh(config)
    return config


@router.post("/custos-frota/depreciacao/gerar")
def gerar_depreciacao_frota_mensal(
    competencia: str = Query(..., pattern="^\\d{4}-\\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inicio, fim = _parse_competencia_intervalo(competencia)
    veiculos = (
        db.query(VeiculoFrota)
        .filter(VeiculoFrota.ativo == True)
        .order_by(VeiculoFrota.nome.asc())
        .all()
    )

    criados = 0
    ignorados = 0
    detalhes: list[dict] = []

    for veiculo in veiculos:
        valor_aquisicao = float(veiculo.valor_aquisicao or 0)
        valor_residual = float(veiculo.valor_residual or 0)
        vida_util_meses = int(veiculo.vida_util_meses or 0)
        if valor_aquisicao <= 0 or vida_util_meses <= 0 or valor_aquisicao <= valor_residual:
            ignorados += 1
            detalhes.append(
                {
                    "veiculo_id": int(veiculo.id),
                    "veiculo_nome": str(veiculo.nome),
                    "status": "ignorado_parametros",
                }
            )
            continue

        existente = (
            db.query(CustoFrota)
            .filter(
                CustoFrota.categoria == "depreciacao_veiculo",
                CustoFrota.veiculo_id == int(veiculo.id),
                func.date(CustoFrota.data_referencia) >= inicio.isoformat(),
                func.date(CustoFrota.data_referencia) <= fim.isoformat(),
            )
            .first()
        )
        if existente:
            ignorados += 1
            detalhes.append(
                {
                    "veiculo_id": int(veiculo.id),
                    "veiculo_nome": str(veiculo.nome),
                    "status": "ja_existente",
                    "custo_id": int(existente.id),
                }
            )
            continue

        depreciacao_mensal = round((valor_aquisicao - valor_residual) / vida_util_meses, 2)
        if depreciacao_mensal <= 0:
            ignorados += 1
            detalhes.append(
                {
                    "veiculo_id": int(veiculo.id),
                    "veiculo_nome": str(veiculo.nome),
                    "status": "depreciacao_zero",
                }
            )
            continue

        item = CustoFrota(
            data_referencia=datetime(inicio.year, inicio.month, 1),
            categoria="depreciacao_veiculo",
            valor=depreciacao_mensal,
            forma_rateio="fixo_mensal",
            clinica_id=None,
            veiculo_id=int(veiculo.id),
            veiculo=str(veiculo.nome),
            descricao=f"Depreciacao mensal - {veiculo.nome} ({competencia})",
            observacoes="Geracao automatica V2",
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(item)
        criados += 1
        detalhes.append(
            {
                "veiculo_id": int(veiculo.id),
                "veiculo_nome": str(veiculo.nome),
                "status": "criado",
                "valor": depreciacao_mensal,
            }
        )

    db.commit()
    return {
        "competencia": competencia,
        "criados": criados,
        "ignorados": ignorados,
        "detalhes": detalhes,
    }


# ==================== CONTAS A PAGAR - CRUD COMPLETO ====================

@router.get("/contas-pagar", response_model=ContaPagarLista)
def listar_contas_pagar(
    status: Optional[str] = Query(None, pattern="^(Pendente|Pago|Atrasado)$"),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    clinica_id: Optional[int] = Query(None, description="Filtrar por clínica (centro de custo)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista contas a pagar com filtros"""
    query = db.query(ContaPagar)

    if status:
        query = query.filter(ContaPagar.status == status)
    if data_inicio:
        query = query.filter(ContaPagar.data_vencimento >= data_inicio)
    if data_fim:
        query = query.filter(ContaPagar.data_vencimento <= data_fim)
    if clinica_id:
        query = query.filter(ContaPagar.clinica_id == clinica_id)
    
    total = query.count()
    items = query.order_by(ContaPagar.data_vencimento).offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}


@router.get("/contas-pagar/{conta_id}", response_model=ContaPagarResponse)
def obter_conta_pagar(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém uma conta a pagar específica"""
    conta = db.query(ContaPagar).filter(ContaPagar.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada")
    return conta


@router.post("/contas-pagar", response_model=ContaPagarResponse, status_code=status.HTTP_201_CREATED)
def criar_conta_pagar(
    conta_data: ContaPagarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria nova conta a pagar"""
    conta = ContaPagar(
        descricao=conta_data.descricao,
        fornecedor=conta_data.fornecedor,
        categoria=conta_data.categoria,
        valor=conta_data.valor,
        data_vencimento=conta_data.data_vencimento,
        observacoes=conta_data.observacoes,
        clinica_id=conta_data.clinica_id,
        status="Pendente",
        criado_por_id=current_user.id,
        created_at=datetime.now()
    )
    
    db.add(conta)
    db.commit()
    db.refresh(conta)
    return conta


@router.put("/contas-pagar/{conta_id}", response_model=ContaPagarResponse)
def atualizar_conta_pagar(
    conta_id: int,
    conta_data: ContaPagarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma conta a pagar"""
    conta = db.query(ContaPagar).filter(ContaPagar.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada")
    
    for field, value in conta_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(conta, field, value)
    
    db.commit()
    db.refresh(conta)
    return conta


@router.delete("/contas-pagar/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_conta_pagar(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma conta a pagar"""
    conta = db.query(ContaPagar).filter(ContaPagar.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada")
    
    db.delete(conta)
    db.commit()
    return None


@router.patch("/contas-pagar/{conta_id}/pagar", response_model=ContaPagarResponse)
def pagar_conta(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marca conta a pagar como paga e cria transação"""
    conta = db.query(ContaPagar).filter(ContaPagar.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada")
    
    conta.status = "Pago"
    conta.data_pagamento = datetime.now()
    
    # Criar transação automaticamente
    transacao = Transacao(
        tipo="saida",
        categoria=conta.categoria or "outros",
        valor=conta.valor,
        desconto=0,
        valor_final=conta.valor,
        status="Pago",
        descricao=f"Pagamento: {conta.descricao}",
        data_transacao=datetime.now(),
        observacoes=f"Gerado do pagamento da conta #{conta.id}",
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    db.add(transacao)
    
    db.commit()
    db.refresh(conta)
    return conta


# ==================== CONTAS A RECEBER - CRUD COMPLETO ====================

@router.get("/contas-receber", response_model=ContaReceberLista)
def listar_contas_receber(
    status: Optional[str] = Query(None, pattern="^(Pendente|Recebido|Atrasado)$"),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    clinica_id: Optional[int] = Query(None, description="Filtrar por clínica (centro de custo)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista contas a receber com filtros"""
    query = db.query(ContaReceber)

    if status:
        query = query.filter(ContaReceber.status == status)
    if data_inicio:
        query = query.filter(ContaReceber.data_vencimento >= data_inicio)
    if data_fim:
        query = query.filter(ContaReceber.data_vencimento <= data_fim)
    if clinica_id:
        query = query.filter(ContaReceber.clinica_id == clinica_id)
    
    total = query.count()
    items = query.order_by(ContaReceber.data_vencimento).offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}


@router.get("/contas-receber/{conta_id}", response_model=ContaReceberResponse)
def obter_conta_receber(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém uma conta a receber específica"""
    conta = db.query(ContaReceber).filter(ContaReceber.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada")
    return conta


@router.post("/contas-receber", response_model=ContaReceberResponse, status_code=status.HTTP_201_CREATED)
def criar_conta_receber(
    conta_data: ContaReceberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria nova conta a receber"""
    conta = ContaReceber(
        descricao=conta_data.descricao,
        cliente=conta_data.cliente,
        categoria=conta_data.categoria,
        valor=conta_data.valor,
        data_vencimento=conta_data.data_vencimento,
        observacoes=conta_data.observacoes,
        paciente_id=conta_data.paciente_id,
        agendamento_id=conta_data.agendamento_id,
        clinica_id=conta_data.clinica_id,
        status="Pendente",
        criado_por_id=current_user.id,
        created_at=datetime.now()
    )
    
    db.add(conta)
    db.commit()
    db.refresh(conta)
    return conta


@router.put("/contas-receber/{conta_id}", response_model=ContaReceberResponse)
def atualizar_conta_receber(
    conta_id: int,
    conta_data: ContaReceberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma conta a receber"""
    conta = db.query(ContaReceber).filter(ContaReceber.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada")
    
    for field, value in conta_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(conta, field, value)
    
    db.commit()
    db.refresh(conta)
    return conta


@router.delete("/contas-receber/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_conta_receber(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma conta a receber"""
    conta = db.query(ContaReceber).filter(ContaReceber.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada")
    
    db.delete(conta)
    db.commit()
    return None


@router.patch("/contas-receber/{conta_id}/receber", response_model=ContaReceberResponse)
def receber_conta(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marca conta a receber como recebida e cria transação"""
    conta = db.query(ContaReceber).filter(ContaReceber.id == conta_id).first()
    if not conta:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada")
    
    conta.status = "Recebido"
    conta.data_recebimento = datetime.now()
    
    # Criar transação automaticamente
    transacao = Transacao(
        tipo="entrada",
        categoria=conta.categoria or "outros",
        valor=conta.valor,
        desconto=0,
        valor_final=conta.valor,
        status="Recebido",
        descricao=f"Recebimento: {conta.descricao}",
        data_transacao=datetime.now(),
        observacoes=f"Gerado do recebimento da conta #{conta.id}",
        paciente_id=conta.paciente_id,
        agendamento_id=conta.agendamento_id,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    db.add(transacao)
    
    db.commit()
    db.refresh(conta)
    return conta


# ==================== RESUMO E DASHBOARD ====================

@router.get("/resumo", response_model=ResumoFinanceiro)
def resumo_financeiro(
    periodo: str = Query("mes", pattern="^(dia|semana|mes|ano|personalizado)$"),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retorna resumo financeiro do período"""
    hoje = date.today()
    
    if periodo == "dia":
        dt_inicio = hoje
        dt_fim = hoje
    elif periodo == "semana":
        dt_inicio = hoje - timedelta(days=hoje.weekday())
        dt_fim = hoje
    elif periodo == "mes":
        dt_inicio = hoje.replace(day=1)
        dt_fim = hoje
    elif periodo == "ano":
        dt_inicio = hoje.replace(month=1, day=1)
        dt_fim = hoje
    else:  # personalizado
        dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d").date() if data_inicio else hoje
        dt_fim = datetime.strptime(data_fim, "%Y-%m-%d").date() if data_fim else hoje
    
    # Entradas recebidas
    entradas = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "entrada",
        Transacao.status == "Recebido",
        func.date(Transacao.data_transacao) >= dt_inicio,
        func.date(Transacao.data_transacao) <= dt_fim
    ).scalar() or 0
    
    # Saídas pagas
    saidas = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "saida",
        Transacao.status == "Pago",
        func.date(Transacao.data_transacao) >= dt_inicio,
        func.date(Transacao.data_transacao) <= dt_fim
    ).scalar() or 0
    
    # Pendentes
    pendente_entrada = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "entrada",
        Transacao.status.in_(["Pendente"])
    ).scalar() or 0
    
    pendente_saida = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "saida",
        Transacao.status.in_(["Pendente"])
    ).scalar() or 0
    
    return ResumoFinanceiro(
        periodo=periodo,
        data_inicio=str(dt_inicio),
        data_fim=str(dt_fim),
        entradas=float(entradas),
        saidas=float(saidas),
        saldo=float(entradas - saidas),
        pendente_entrada=float(pendente_entrada),
        pendente_saida=float(pendente_saida),
        a_receber=float(pendente_entrada),
        a_pagar=float(pendente_saida)
    )


# ==================== RELATÓRIOS AVANÇADOS ====================

@router.get("/relatorios/categorias", response_model=RelatorioCategoria)
def relatorio_por_categoria(
    tipo: str = Query(..., pattern="^(entrada|saida)$"),
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Relatório de entradas/saídas por categoria"""
    query = db.query(
        Transacao.categoria,
        func.sum(Transacao.valor_final).label("total"),
        func.count(Transacao.id).label("quantidade")
    ).filter(Transacao.tipo == tipo)
    
    if data_inicio:
        query = query.filter(Transacao.data_transacao >= data_inicio)
    if data_fim:
        query = query.filter(Transacao.data_transacao <= data_fim)
    
    resultados = query.group_by(Transacao.categoria).all()
    
    total_geral = sum(r.total for r in resultados) or 1  # evitar divisão por zero
    
    categorias = [
        CategoriaResumo(
            categoria=r.categoria,
            total=float(r.total),
            quantidade=r.quantidade,
            percentual=round((r.total / total_geral) * 100, 2)
        )
        for r in resultados
    ]
    
    return RelatorioCategoria(
        tipo=tipo,
        periodo=f"{data_inicio} a {data_fim}" if data_inicio else "Todo período",
        total=float(total_geral),
        categorias=sorted(categorias, key=lambda x: x.total, reverse=True)
    )


@router.get("/relatorios/fluxo-caixa", response_model=RelatorioFluxoCaixa)
def relatorio_fluxo_caixa(
    data_inicio: str,
    data_fim: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Relatório de fluxo de caixa diário"""
    dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d").date()
    dt_fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
    
    items = []
    saldo_acumulado = 0
    
    delta = dt_fim - dt_inicio
    for i in range(delta.days + 1):
        dia = dt_inicio + timedelta(days=i)
        
        entradas = db.query(func.sum(Transacao.valor_final)).filter(
            Transacao.tipo == "entrada",
            Transacao.status == "Recebido",
            func.date(Transacao.data_transacao) == dia
        ).scalar() or 0
        
        saidas = db.query(func.sum(Transacao.valor_final)).filter(
            Transacao.tipo == "saida",
            Transacao.status == "Pago",
            func.date(Transacao.data_transacao) == dia
        ).scalar() or 0
        
        saldo_dia = float(entradas) - float(saidas)
        saldo_acumulado += saldo_dia
        
        items.append(FluxoCaixaItem(
            data=dia.strftime("%Y-%m-%d"),
            entradas=float(entradas),
            saidas=float(saidas),
            saldo_dia=saldo_dia,
            saldo_acumulado=saldo_acumulado
        ))
    
    total_entradas = sum(item.entradas for item in items)
    total_saidas = sum(item.saidas for item in items)
    
    return RelatorioFluxoCaixa(
        data_inicio=data_inicio,
        data_fim=data_fim,
        saldo_inicial=0,
        total_entradas=total_entradas,
        total_saidas=total_saidas,
        saldo_final=saldo_acumulado,
        items=items
    )


@router.get("/relatorios/comparativo-mensal", response_model=RelatorioComparativo)
def relatorio_comparativo_mensal(
    meses: int = Query(6, ge=2, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Comparativo financeiro dos últimos meses"""
    hoje = date.today()
    items = []
    
    for i in range(meses - 1, -1, -1):
        mes_ref = hoje.replace(day=1) - timedelta(days=1)
        for _ in range(i):
            mes_ref = mes_ref.replace(day=1) - timedelta(days=1)
        mes_ref = mes_ref.replace(day=1)
        
        # Último dia do mês
        if mes_ref.month == 12:
            ultimo_dia = mes_ref.replace(year=mes_ref.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            ultimo_dia = mes_ref.replace(month=mes_ref.month + 1, day=1) - timedelta(days=1)
        
        entradas = db.query(func.sum(Transacao.valor_final)).filter(
            Transacao.tipo == "entrada",
            Transacao.status == "Recebido",
            func.date(Transacao.data_transacao) >= mes_ref,
            func.date(Transacao.data_transacao) <= ultimo_dia
        ).scalar() or 0
        
        saidas = db.query(func.sum(Transacao.valor_final)).filter(
            Transacao.tipo == "saida",
            Transacao.status == "Pago",
            func.date(Transacao.data_transacao) >= mes_ref,
            func.date(Transacao.data_transacao) <= ultimo_dia
        ).scalar() or 0
        
        item = ComparativoMes(
            mes=mes_ref.strftime("%b"),
            ano=mes_ref.year,
            entradas=float(entradas),
            saidas=float(saidas),
            saldo=float(entradas - saidas)
        )
        
        # Calcular variação em relação ao mês anterior
        if items:
            item_anterior = items[-1]
            if item_anterior.entradas > 0:
                item.variacao_entrada = round(((item.entradas - item_anterior.entradas) / item_anterior.entradas) * 100, 2)
            if item_anterior.saidas > 0:
                item.variacao_saida = round(((item.saidas - item_anterior.saidas) / item_anterior.saidas) * 100, 2)
        
        items.append(item)
    
    return RelatorioComparativo(items=items)


@router.get("/relatorios/dre")
def relatorio_dre(
    data_inicio: str,
    data_fim: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Demonstração do Resultado do Exercício (DRE) simplificada"""
    dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
    dt_fim = datetime.strptime(data_fim, "%Y-%m-%d")
    
    # Receita Bruta (todas as entradas)
    receita_bruta = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "entrada",
        Transacao.status == "Recebido",
        Transacao.data_transacao >= dt_inicio,
        Transacao.data_transacao <= dt_fim
    ).scalar() or 0
    
    # Custos (saídas relacionadas a serviços/produtos)
    custos_categorias = ["fornecedor", "medicamento"]
    custos = db.query(
        Transacao.categoria,
        func.sum(Transacao.valor_final).label("total")
    ).filter(
        Transacao.tipo == "saida",
        Transacao.status == "Pago",
        Transacao.categoria.in_(custos_categorias),
        Transacao.data_transacao >= dt_inicio,
        Transacao.data_transacao <= dt_fim
    ).group_by(Transacao.categoria).all()
    
    # Despesas Operacionais
    despesas_op_categorias = ["salario", "aluguel"]
    despesas_op = db.query(
        Transacao.categoria,
        func.sum(Transacao.valor_final).label("total")
    ).filter(
        Transacao.tipo == "saida",
        Transacao.status == "Pago",
        Transacao.categoria.in_(despesas_op_categorias),
        Transacao.data_transacao >= dt_inicio,
        Transacao.data_transacao <= dt_fim
    ).group_by(Transacao.categoria).all()
    
    # Outras despesas
    outras_despesas = db.query(
        Transacao.categoria,
        func.sum(Transacao.valor_final).label("total")
    ).filter(
        Transacao.tipo == "saida",
        Transacao.status == "Pago",
        ~Transacao.categoria.in_(custos_categorias + despesas_op_categorias),
        Transacao.data_transacao >= dt_inicio,
        Transacao.data_transacao <= dt_fim
    ).group_by(Transacao.categoria).all()
    
    total_custos = sum(c.total for c in custos)
    total_despesas_op = sum(d.total for d in despesas_op)
    total_outras = sum(o.total for o in outras_despesas)
    
    receita_liquida = float(receita_bruta)  # Simplificado
    lucro_bruto = receita_liquida - float(total_custos)
    lucro_operacional = lucro_bruto - float(total_despesas_op)
    lucro_liquido = lucro_operacional - float(total_outras)
    
    margem_bruta = round((lucro_bruto / receita_liquida * 100), 2) if receita_liquida > 0 else 0
    margem_operacional = round((lucro_operacional / receita_liquida * 100), 2) if receita_liquida > 0 else 0
    margem_liquida = round((lucro_liquido / receita_liquida * 100), 2) if receita_liquida > 0 else 0
    
    return {
        "periodo": f"{data_inicio} a {data_fim}",
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "receita_bruta": float(receita_bruta),
        "receita_liquida": receita_liquida,
        "custos": [{"categoria": c.categoria, "valor": float(c.total)} for c in custos],
        "total_custos": float(total_custos),
        "lucro_bruto": lucro_bruto,
        "margem_bruta": margem_bruta,
        "despesas_operacionais": [{"categoria": d.categoria, "valor": float(d.total)} for d in despesas_op],
        "total_despesas_operacionais": float(total_despesas_op),
        "lucro_operacional": lucro_operacional,
        "margem_operacional": margem_operacional,
        "outras_despesas": [{"categoria": o.categoria, "valor": float(o.total)} for o in outras_despesas],
        "total_outras_despesas": float(total_outras),
        "lucro_liquido": lucro_liquido,
        "margem_liquida": margem_liquida
    }


@router.get("/relatorios/dados-grafico")
def dados_grafico(
    tipo: str = Query("mensal", pattern="^(mensal|semanal|anual)$"),
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dados formatados para gráficos"""
    hoje = date.today()
    
    labels = []
    entradas = []
    saidas = []
    
    if tipo == "semanal":
        # Últimas semanas
        for i in range(meses - 1, -1, -1):
            fim_semana = hoje - timedelta(days=hoje.weekday()) - timedelta(weeks=i)
            inicio_semana = fim_semana - timedelta(days=6)
            
            labels.append(f"{inicio_semana.day}/{inicio_semana.month}")
            
            e = db.query(func.sum(Transacao.valor_final)).filter(
                Transacao.tipo == "entrada",
                Transacao.status == "Recebido",
                func.date(Transacao.data_transacao) >= inicio_semana,
                func.date(Transacao.data_transacao) <= fim_semana
            ).scalar() or 0
            
            s = db.query(func.sum(Transacao.valor_final)).filter(
                Transacao.tipo == "saida",
                Transacao.status == "Pago",
                func.date(Transacao.data_transacao) >= inicio_semana,
                func.date(Transacao.data_transacao) <= fim_semana
            ).scalar() or 0
            
            entradas.append(float(e))
            saidas.append(float(s))
    
    else:  # mensal
        for i in range(meses - 1, -1, -1):
            mes_ref = hoje.replace(day=1) - timedelta(days=1)
            for _ in range(i):
                mes_ref = mes_ref.replace(day=1) - timedelta(days=1)
            mes_ref = mes_ref.replace(day=1)
            
            if mes_ref.month == 12:
                ultimo_dia = mes_ref.replace(year=mes_ref.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                ultimo_dia = mes_ref.replace(month=mes_ref.month + 1, day=1) - timedelta(days=1)
            
            labels.append(mes_ref.strftime("%b/%y"))
            
            e = db.query(func.sum(Transacao.valor_final)).filter(
                Transacao.tipo == "entrada",
                Transacao.status == "Recebido",
                Transacao.data_transacao >= mes_ref,
                Transacao.data_transacao <= ultimo_dia
            ).scalar() or 0
            
            s = db.query(func.sum(Transacao.valor_final)).filter(
                Transacao.tipo == "saida",
                Transacao.status == "Pago",
                Transacao.data_transacao >= mes_ref,
                Transacao.data_transacao <= ultimo_dia
            ).scalar() or 0
            
            entradas.append(float(e))
            saidas.append(float(s))
    
    return {
        "labels": labels,
        "entradas": entradas,
        "saidas": saidas
    }
