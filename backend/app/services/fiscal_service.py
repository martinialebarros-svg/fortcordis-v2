"""Serviço de negócio para o módulo fiscal."""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.fiscal import NotaFiscal
from app.models.ordem_servico import OrdemServico
from app.models.tutor import Tutor
from app.models.clinica import Clinica
from app.schemas.fiscal import NotaFiscalCreate, NotaFiscalUpdate

logger = logging.getLogger(__name__)


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _calcular_valores(valor_servico: float, valor_desconto: float, aliquota_iss: float) -> tuple[float, float]:
    """Calcula valor final e valor ISS."""
    valor_final = max(0, valor_servico - valor_desconto)
    valor_iss = round(valor_final * (aliquota_iss / 100), 2)
    return valor_final, valor_iss


def _gerar_numero(db: Session) -> str:
    """Gera próximo número sequencial de NF no formato NFO-YYYY-NNNNN."""
    ano = datetime.now().year
    result = db.execute(
        text(
            "SELECT numero FROM notas_fiscais "
            "WHERE numero LIKE :prefix ORDER BY id DESC LIMIT 1"
        ),
        {"prefix": f"NFO-{ano}-%"},
    ).fetchone()

    if result and result[0]:
        try:
            ultimo = int(result[0].split("-")[-1])
            proximo = ultimo + 1
        except (ValueError, IndexError):
            proximo = 1
    else:
        proximo = 1

    return f"NFO-{ano}-{proximo:05d}"


def criar_nota_fiscal(db: Session, data: NotaFiscalCreate) -> NotaFiscal:
    """Cria uma nova nota fiscal a partir dos dados fornecidos."""
    valor_final, valor_iss = _calcular_valores(
        data.valor_servico, data.valor_desconto, data.aliquota_iss
    )
    numero = _gerar_numero(db)

    nota = NotaFiscal(
        numero=numero,
        serie="1",
        os_id=data.os_id,
        tipo_cliente=data.tipo_cliente,
        cliente_nome=data.cliente_nome,
        cliente_documento=data.cliente_documento,
        cliente_endereco=data.cliente_endereco or "",
        cliente_bairro=data.cliente_bairro or "",
        cliente_cidade=data.cliente_cidade or "",
        cliente_estado=data.cliente_estado or "",
        cliente_cep=data.cliente_cep or "",
        cliente_telefone=data.cliente_telefone or "",
        cliente_email=data.cliente_email or "",
        valor_servico=data.valor_servico,
        valor_desconto=data.valor_desconto,
        valor_final=valor_final,
        aliquota_iss=data.aliquota_iss,
        valor_iss=valor_iss,
        atividade_cnae=data.atividade_cnae or "",
        descricao_servico=data.descricao_servico or "",
        observacoes=data.observacoes or "",
        natureza_operacao=data.natureza_operacao,
        status="rascunho",
        created_at=_now_str(),
    )
    db.add(nota)
    db.commit()
    db.refresh(nota)
    logger.info(f"[Fiscal] Nota fiscal criada: {nota.numero}")
    return nota


def atualizar_nota_fiscal(
    db: Session, nota_id: int, data: NotaFiscalUpdate
) -> Optional[NotaFiscal]:
    """Atualiza uma nota fiscal existente."""
    nota = db.query(NotaFiscal).filter(NotaFiscal.id == nota_id).first()
    if not nota:
        return None

    update = data.model_dump(exclude_unset=True)

    # Se valores mudaram, recalcula
    if "valor_servico" in update or "valor_desconto" in update or "aliquota_iss" in update:
        vs = update.get("valor_servico", float(nota.valor_servico or 0))
        vd = update.get("valor_desconto", float(nota.valor_desconto or 0))
        ai = update.get("aliquota_iss", nota.aliquota_iss or 5.0)
        vf, vi = _calcular_valores(vs, vd, ai)
        update["valor_final"] = vf
        update["valor_iss"] = vi

    for key, value in update.items():
        setattr(nota, key, value)

    nota.updated_at = _now_str()
    db.commit()
    db.refresh(nota)
    logger.info(f"[Fiscal] Nota fiscal atualizada: {nota.numero}")
    return nota


def excluir_nota_fiscal(db: Session, nota_id: int) -> bool:
    """Exclui uma nota fiscal (soft-delete via status)."""
    nota = db.query(NotaFiscal).filter(NotaFiscal.id == nota_id).first()
    if not nota:
        return False
    nota.status = "cancelado"
    nota.updated_at = _now_str()
    db.commit()
    logger.info(f"[Fiscal] Nota fiscal cancelada: {nota.numero}")
    return True


def buscar_nota_fiscal(db: Session, nota_id: int) -> Optional[NotaFiscal]:
    """Busca uma nota fiscal pelo ID."""
    return db.query(NotaFiscal).filter(NotaFiscal.id == nota_id).first()


def listar_notas_fiscais(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    tipo_cliente: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> tuple[list[NotaFiscal], int]:
    """Lista notas fiscais com filtros."""
    query = db.query(NotaFiscal)

    if status:
        query = query.filter(NotaFiscal.status == status)
    if tipo_cliente:
        query = query.filter(NotaFiscal.tipo_cliente == tipo_cliente)
    if data_inicio:
        query = query.filter(NotaFiscal.created_at >= data_inicio)
    if data_fim:
        query = query.filter(NotaFiscal.created_at <= data_fim)

    total = query.count()
    items = query.order_by(NotaFiscal.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def marcar_exportada(
    db: Session, nota_id: int, formato: str
) -> Optional[NotaFiscal]:
    """Marca nota fiscal como exportada e registra o formato."""
    nota = db.query(NotaFiscal).filter(NotaFiscal.id == nota_id).first()
    if not nota:
        return None
    nota.status = "exportado"
    nota.formato_exportado = formato
    nota.updated_at = _now_str()
    db.commit()
    db.refresh(nota)
    return nota


def buscar_os_para_fiscal(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    """
    Busca OS que podem ser vinculadas a uma nota fiscal.
    Para PF: busca pelo nome do tutor.
    Para PJ: busca pelo nome da clínica.
    """
    query = db.query(
        OrdemServico.id,
        OrdemServico.numero_os,
        OrdemServico.data_atendimento,
        OrdemServico.valor_final,
        OrdemServico.status,
        Tutor.nome.label("tutor_nome"),
        Tutor.cpf.label("tutor_cpf"),
        Clinica.nome.label("clinica_nome"),
        Clinica.cnpj.label("clinica_cnpj"),
        Clinica.endereco.label("clinica_endereco"),
        Clinica.numero.label("clinica_numero"),
        Clinica.bairro.label("clinica_bairro"),
        Clinica.cidade.label("clinica_cidade"),
        Clinica.estado.label("clinica_estado"),
        Clinica.cep.label("clinica_cep"),
        Clinica.telefone.label("clinica_telefone"),
        Clinica.email.label("clinica_email"),
    ).outerjoin(Tutor, Tutor.id == OrdemServico.paciente_id).outerjoin(
        Clinica, Clinica.id == OrdemServico.clinica_id
    )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Tutor.nome.ilike(search_term))
            | (Clinica.nome.ilike(search_term))
            | (OrdemServico.numero_os.ilike(search_term))
        )

    total = query.count()
    rows = query.offset(skip).limit(limit).all()

    items = []
    for r in rows:
        # Se tem cpf no tutor → PF, senão → PJ
        if r.tutor_cpf:
            tipo = "PF"
            cliente_nome = r.tutor_nome
            cliente_doc = r.tutor_cpf
        else:
            tipo = "PJ"
            cliente_nome = r.clinica_nome or ""
            cliente_doc = r.clinica_cnpj or ""

        items.append({
            "os_id": r.id,
            "numero_os": r.numero_os,
            "data_atendimento": str(r.data_atendimento) if r.data_atendimento else None,
            "valor_final": float(r.valor_final or 0),
            "status_os": r.status,
            "tipo_cliente": tipo,
            "cliente_nome": cliente_nome,
            "cliente_documento": cliente_doc,
            "clinica_nome": r.clinica_nome,
            "clinica_endereco": r.clinica_endereco,
            "clinica_numero": r.clinica_numero,
            "clinica_bairro": r.clinica_bairro,
            "clinica_cidade": r.clinica_cidade,
            "clinica_estado": r.clinica_estado,
            "clinica_cep": r.clinica_cep,
            "clinica_telefone": r.clinica_telefone,
            "clinica_email": r.clinica_email,
        })

    return items, total
