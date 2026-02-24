from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
from datetime import datetime
from io import BytesIO
import json
import os
import re
import unicodedata

from app.db.database import get_db
from app.models.laudo import Laudo, Exame
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()


def _gerar_nome_key(nome: Optional[str]) -> str:
    """Gera chave normalizada para compatibilidade com schema legado."""
    if not nome:
        return ""
    texto = unicodedata.normalize("NFKD", nome)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower().strip()
    texto = re.sub(r"[^a-z0-9\s]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto


def _legacy_now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _to_float_or_none(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int_or_none(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _parse_data_exame(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            try:
                return datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                return None
    return None


def _extrair_clinic_id(clinica: Any) -> Optional[int]:
    if isinstance(clinica, dict):
        clinic_id = clinica.get("id")
        try:
            return int(clinic_id) if clinic_id not in (None, "") else None
        except (TypeError, ValueError):
            return None
    if isinstance(clinica, (int, str)):
        try:
            return int(clinica)
        except (TypeError, ValueError):
            return None
    return None


def _normalizar_pressao_arterial(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    pas_1 = _to_int_or_none(raw.get("pas_1"))
    pas_2 = _to_int_or_none(raw.get("pas_2"))
    pas_3 = _to_int_or_none(raw.get("pas_3"))

    medidas_validas = [v for v in (pas_1, pas_2, pas_3) if isinstance(v, int) and v > 0]
    pas_media = _to_int_or_none(raw.get("pas_media"))
    if pas_media is not None and pas_media <= 0:
        pas_media = None
    if pas_media is None and medidas_validas:
        pas_media = int(round(sum(medidas_validas) / len(medidas_validas)))

    manguito = (raw.get("manguito") or "").strip()
    membro = (raw.get("membro") or "").strip()
    decubito = (raw.get("decubito") or "").strip()
    obs_extra = (raw.get("obs_extra") or "").strip()
    metodo = (raw.get("metodo") or "Doppler").strip() or "Doppler"

    # Evita anexar pressão em laudos eco quando apenas campos padrão foram enviados.
    # Para considerar pressão válida, é obrigatório ter ao menos uma PAS/média > 0.
    if not (medidas_validas or pas_media):
        return None

    return {
        "pas_1": pas_1,
        "pas_2": pas_2,
        "pas_3": pas_3,
        "pas_media": pas_media,
        "metodo": metodo,
        "manguito": manguito,
        "membro": membro,
        "decubito": decubito,
        "obs_extra": obs_extra,
    }


def _serializar_anexos(anexos_raw: Any, pressao_arterial: Optional[Dict[str, Any]]) -> Optional[str]:
    anexos_data: Dict[str, Any] = {}
    if isinstance(anexos_raw, dict):
        anexos_data = dict(anexos_raw)
    elif isinstance(anexos_raw, str) and anexos_raw.strip():
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                anexos_data = parsed
        except json.JSONDecodeError:
            anexos_data = {}

    if pressao_arterial:
        anexos_data["pressao_arterial"] = pressao_arterial
    else:
        anexos_data.pop("pressao_arterial", None)

    if not anexos_data:
        return None
    return json.dumps(anexos_data, ensure_ascii=False)


def _extrair_pressao_arterial_de_anexos(anexos_raw: Any) -> Optional[Dict[str, Any]]:
    if not anexos_raw:
        return None
    if isinstance(anexos_raw, dict):
        return _normalizar_pressao_arterial(anexos_raw.get("pressao_arterial"))
    if isinstance(anexos_raw, str):
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                return _normalizar_pressao_arterial(parsed.get("pressao_arterial"))
        except json.JSONDecodeError:
            return None
    return None


def _classificar_pressao_media(pas_media: Optional[int]) -> str:
    if pas_media is None or pas_media <= 0:
        return "Sem classificação (média indisponível)"
    if pas_media <= 140:
        return "Normal (110 a 140 mmHg)"
    if pas_media <= 159:
        return "Levemente elevada (141 a 159 mmHg)"
    if pas_media <= 179:
        return "Moderadamente elevada (160 a 179 mmHg)"
    return "Severamente elevada (>=180 mmHg)"


def _resolver_ou_criar_paciente(paciente: Dict[str, Any], db: Session) -> int:
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor

    paciente_id = paciente.get("id")
    if paciente_id not in (None, ""):
        try:
            return int(paciente_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="ID do paciente inválido.")

    paciente_nome_input = (paciente.get("nome") or "").strip()
    if not paciente_nome_input:
        raise HTTPException(status_code=422, detail="Nome do paciente e obrigatorio para salvar o laudo.")

    tutor_id = None
    tutor_nome = (paciente.get("tutor") or "").strip()
    if tutor_nome:
        tutor_nome_key = _gerar_nome_key(tutor_nome)
        tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
        if not tutor:
            tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()

        if not tutor:
            tutor = Tutor(
                nome=tutor_nome,
                nome_key=tutor_nome_key,
                telefone=paciente.get("telefone", ""),
                ativo=1,
                created_at=_legacy_now_str(),
            )
            db.add(tutor)
            try:
                db.commit()
                db.refresh(tutor)
            except IntegrityError:
                db.rollback()
                tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
                if not tutor:
                    tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()
                if not tutor:
                    raise
        tutor_id = tutor.id

    paciente_nome = paciente_nome_input or "Paciente sem nome"
    paciente_nome_key = _gerar_nome_key(paciente_nome)
    paciente_especie = (paciente.get("especie") or "Canina").strip() or "Canina"

    paciente_query = db.query(Paciente).filter(Paciente.nome_key == paciente_nome_key)
    if tutor_id is None:
        paciente_query = paciente_query.filter(Paciente.tutor_id.is_(None))
    else:
        paciente_query = paciente_query.filter(Paciente.tutor_id == tutor_id)
    paciente_query = paciente_query.filter(Paciente.especie.ilike(paciente_especie))

    paciente_existente = paciente_query.order_by(Paciente.id.desc()).first()
    if paciente_existente:
        return paciente_existente.id

    observacoes = ""
    if paciente.get("idade"):
        observacoes += f"Idade: {paciente.get('idade')}\n"

    novo_paciente = Paciente(
        nome=paciente_nome,
        nome_key=paciente_nome_key,
        especie=paciente_especie,
        raca=paciente.get("raca", ""),
        sexo=paciente.get("sexo", ""),
        peso_kg=_to_float_or_none(paciente.get("peso")),
        tutor_id=tutor_id,
        observacoes=observacoes if observacoes else None,
        ativo=1,
        created_at=_legacy_now_str(),
    )
    db.add(novo_paciente)
    try:
        db.commit()
        db.refresh(novo_paciente)
        return novo_paciente.id
    except IntegrityError:
        db.rollback()
        paciente_query = db.query(Paciente).filter(Paciente.nome_key == paciente_nome_key)
        if tutor_id is None:
            paciente_query = paciente_query.filter(Paciente.tutor_id.is_(None))
        else:
            paciente_query = paciente_query.filter(Paciente.tutor_id == tutor_id)
        paciente_query = paciente_query.filter(Paciente.especie.ilike(paciente_especie))
        paciente_existente = paciente_query.order_by(Paciente.id.desc()).first()
        if not paciente_existente:
            raise
        return paciente_existente.id


@router.get("/laudos")
def listar_laudos(
    paciente_id: Optional[int] = None,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista laudos com filtros e dados do paciente/tutor"""
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    from app.models.clinica import Clinica

    def _iso_or_str(value: Any) -> Optional[str]:
        if value is None:
            return None
        if hasattr(value, "isoformat"):
            try:
                return value.isoformat()
            except Exception:
                return str(value)
        return str(value)
    
    query = db.query(Laudo)
    
    if paciente_id:
        query = query.filter(Laudo.paciente_id == paciente_id)
    if tipo:
        query = query.filter(Laudo.tipo == tipo)
    if status:
        query = query.filter(Laudo.status == status)
    
    total = query.count()
    # Ordena por recência real para evitar "sumiço" em bases com sequência de ID legada/desalinhada.
    items = query.order_by(
        Laudo.created_at.desc(),
        Laudo.data_laudo.desc(),
        Laudo.id.desc(),
    ).offset(skip).limit(limit).all()
    
    # Enriquecer com dados do paciente e tutor
    resultado = []
    for laudo in items:
        paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()
        
        tutor_nome = None
        if paciente and paciente.tutor_id:
            tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
            if tutor:
                tutor_nome = tutor.nome
        
        clinica_nome = None
        if laudo.clinic_id:
            clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first()
            if clinica:
                clinica_nome = clinica.nome
        
        resultado.append({
            "id": laudo.id,
            "paciente_id": laudo.paciente_id,
            "agendamento_id": laudo.agendamento_id,
            "paciente_nome": paciente.nome if paciente else "Desconhecido",
            "paciente_tutor": tutor_nome or "",
            "clinica": clinica_nome or laudo.medico_solicitante or "",
            "clinic_id": laudo.clinic_id,
            "tipo": laudo.tipo,
            "titulo": laudo.titulo,
            "status": laudo.status,
            "data_exame": _iso_or_str(laudo.data_exame),
            "data_laudo": _iso_or_str(laudo.data_laudo),
            "created_at": _iso_or_str(laudo.created_at),
        })
    
    return {"total": total, "items": resultado}


@router.post("/laudos", status_code=status.HTTP_201_CREATED)
def criar_laudo(
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo laudo"""
    import traceback
    try:
        # Verificar se é um laudo de ecocardiograma (com estrutura complexa)
        if "paciente" in laudo_data and isinstance(laudo_data["paciente"], dict):
            tipo_laudo = (laudo_data.get("tipo_laudo") or laudo_data.get("tipo") or "").strip().lower()
            if tipo_laudo == "pressao_arterial":
                return criar_laudo_pressao_arterial(laudo_data, db, current_user)
            return criar_laudo_ecocardiograma(laudo_data, db, current_user)
        
        # Laudo padrão
        laudo = Laudo(
            paciente_id=laudo_data.get("paciente_id"),
            agendamento_id=laudo_data.get("agendamento_id"),
            veterinario_id=current_user.id,
            tipo=laudo_data.get("tipo", "exame"),
            titulo=laudo_data.get("titulo"),
            descricao=laudo_data.get("descricao"),
            diagnostico=laudo_data.get("diagnostico"),
            observacoes=laudo_data.get("observacoes"),
            anexos=laudo_data.get("anexos"),
            status=laudo_data.get("status", "Rascunho"),
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome
        )
        
        db.add(laudo)
        db.commit()
        db.refresh(laudo)
        
        return laudo
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


def criar_laudo_ecocardiograma(laudo_data: dict, db: Session, current_user: User):
    """Cria um laudo de ecocardiograma com a estrutura especifica."""
    import traceback

    try:
        paciente = laudo_data.get("paciente", {}) or {}
        medidas = laudo_data.get("medidas", {}) or {}
        qualitativa = laudo_data.get("qualitativa", {}) or {}
        conteudo = laudo_data.get("conteudo", {}) or {}
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})

        paciente_id = _resolver_ou_criar_paciente(paciente, db)
        pressao_arterial = _normalizar_pressao_arterial(laudo_data.get("pressao_arterial"))

        descricao_parts = ["## Medidas Ecocardiograficas\n"]
        for key, value in medidas.items():
            if value:
                descricao_parts.append(f"- {key}: {value}")

        descricao_parts.append("\n## Avaliacao Qualitativa\n")
        for key, value in qualitativa.items():
            if value:
                descricao_parts.append(f"- {key}: {value}")
        descricao = "\n".join(descricao_parts)

        diagnostico = conteudo.get("conclusao", "")
        observacoes = conteudo.get("observacoes", "")
        clinic_id = _extrair_clinic_id(clinica)
        data_exame = _parse_data_exame(paciente.get("data_exame") or paciente.get("data"))
        anexos_json = _serializar_anexos(laudo_data.get("anexos"), pressao_arterial)

        agendamento_id = laudo_data.get("agendamento_id")
        if agendamento_id in ("", 0):
            agendamento_id = None
        if agendamento_id is not None:
            try:
                agendamento_id = int(agendamento_id)
            except Exception:
                agendamento_id = None

        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=agendamento_id,
            veterinario_id=current_user.id,
            tipo="ecocardiograma",
            titulo=f"Laudo de Ecocardiograma - {paciente.get('nome', 'Paciente')}",
            descricao=descricao,
            diagnostico=diagnostico,
            observacoes=observacoes,
            anexos=anexos_json,
            status=laudo_data.get("status", "Finalizado"),
            clinic_id=clinic_id,
            data_exame=data_exame,
            medico_solicitante=veterinario.get("nome") if isinstance(veterinario, dict) else None,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )

        db.add(laudo)
        db.commit()
        db.refresh(laudo)

        return {
            "id": laudo.id,
            "agendamento_id": laudo.agendamento_id,
            "mensagem": "Laudo de ecocardiograma salvo com sucesso",
            "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
            "tipo": "ecocardiograma",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO ECO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar laudo: {str(e)}")


def criar_laudo_pressao_arterial(laudo_data: dict, db: Session, current_user: User):
    """Cria laudo de pressao arterial."""
    import traceback

    try:
        paciente = laudo_data.get("paciente", {}) or {}
        conteudo = laudo_data.get("conteudo", {}) or {}
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})

        paciente_id = _resolver_ou_criar_paciente(paciente, db)
        pressao_arterial = _normalizar_pressao_arterial(laudo_data.get("pressao_arterial"))
        if not pressao_arterial:
            raise HTTPException(
                status_code=422,
                detail="Informe pelo menos uma afericao de pressao para salvar o laudo de pressao arterial.",
            )

        pas_1 = pressao_arterial.get("pas_1") or 0
        pas_2 = pressao_arterial.get("pas_2") or 0
        pas_3 = pressao_arterial.get("pas_3") or 0
        pas_media = pressao_arterial.get("pas_media")
        classificacao = _classificar_pressao_media(pas_media)

        descricao_linhas = [
            "## Afericao de Pressao Arterial",
            f"- 1a afericao (PAS): {pas_1} mmHg",
            f"- 2a afericao (PAS): {pas_2} mmHg",
            f"- 3a afericao (PAS): {pas_3} mmHg",
            f"- PAS media: {pas_media or 0} mmHg",
            f"- Metodo: {pressao_arterial.get('metodo') or 'Doppler'}",
            f"- Manguito: {pressao_arterial.get('manguito') or '-'}",
            f"- Membro: {pressao_arterial.get('membro') or '-'}",
            f"- Decubito: {pressao_arterial.get('decubito') or '-'}",
        ]
        if pressao_arterial.get("obs_extra"):
            descricao_linhas.append(f"- Observacoes adicionais: {pressao_arterial.get('obs_extra')}")
        descricao = "\n".join(descricao_linhas)

        observacoes_extra = (conteudo.get("observacoes") or "").strip()
        obs_pressao = (pressao_arterial.get("obs_extra") or "").strip()
        observacoes = observacoes_extra
        if obs_pressao and obs_pressao not in observacoes:
            observacoes = f"{observacoes}\n{obs_pressao}".strip()

        clinic_id = _extrair_clinic_id(clinica)
        data_exame = _parse_data_exame(paciente.get("data_exame") or paciente.get("data"))
        anexos_json = _serializar_anexos(laudo_data.get("anexos"), pressao_arterial)

        agendamento_id = laudo_data.get("agendamento_id")
        if agendamento_id in ("", 0):
            agendamento_id = None
        if agendamento_id is not None:
            try:
                agendamento_id = int(agendamento_id)
            except Exception:
                agendamento_id = None

        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=agendamento_id,
            veterinario_id=current_user.id,
            tipo="pressao_arterial",
            titulo=f"Laudo de Pressao Arterial - {paciente.get('nome', 'Paciente')}",
            descricao=descricao,
            diagnostico=classificacao,
            observacoes=observacoes,
            anexos=anexos_json,
            status=laudo_data.get("status", "Finalizado"),
            clinic_id=clinic_id,
            data_exame=data_exame,
            medico_solicitante=veterinario.get("nome") if isinstance(veterinario, dict) else None,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )

        db.add(laudo)
        db.commit()
        db.refresh(laudo)

        return {
            "id": laudo.id,
            "agendamento_id": laudo.agendamento_id,
            "mensagem": "Laudo de pressao arterial salvo com sucesso",
            "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
            "tipo": "pressao_arterial",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO PRESSAO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar laudo: {str(e)}")


@router.get("/laudos/{laudo_id}")
def obter_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um laudo específico com dados completos do paciente e clínica"""
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    from app.models.clinica import Clinica
    
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    # Buscar dados do paciente
    paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()
    
    # Buscar dados do tutor se existir
    tutor_nome = None
    tutor_telefone = None
    if paciente and paciente.tutor_id:
        tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
        if tutor:
            tutor_nome = tutor.nome
            tutor_telefone = tutor.telefone
    
    # Calcular idade do paciente se tiver data de nascimento
    idade = ""
    if paciente and paciente.nascimento:
        try:
            nasc = datetime.strptime(str(paciente.nascimento), "%Y-%m-%d")
            hoje = datetime.now()
            meses = (hoje.year - nasc.year) * 12 + hoje.month - nasc.month
            if meses < 12:
                idade = f"{meses}m"
            else:
                anos = meses // 12
                meses_rest = meses % 12
                if meses_rest > 0:
                    idade = f"{anos}a {meses_rest}m"
                else:
                    idade = f"{anos}a"
        except:
            idade = str(paciente.nascimento)
    
    # Extrair idade das observações se não calculou
    if not idade and paciente and paciente.observacoes:
        match = re.search(r'Idade:\s*(.+?)(?:\n|$)', paciente.observacoes)
        if match:
            idade = match.group(1).strip()
    
    # Buscar nome da clínica
    clinica_nome = None
    if laudo.clinic_id:
        clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first()
        if clinica:
            clinica_nome = clinica.nome
    
    # Buscar imagens do laudo
    from app.models.imagem_laudo import ImagemLaudo
    imagens = db.query(ImagemLaudo).filter(
        ImagemLaudo.laudo_id == laudo_id,
        ImagemLaudo.ativo == 1
    ).order_by(ImagemLaudo.ordem).all()
    
    imagens_list = []
    for img in imagens:
        imagens_list.append({
            "id": img.id,
            "nome": img.nome_arquivo,
            "ordem": img.ordem,
            "descricao": img.descricao,
            "url": f"/imagens/{img.id}",
            "tamanho": img.tamanho_bytes
        })

    pressao_arterial = _extrair_pressao_arterial_de_anexos(laudo.anexos)
    
    return {
        "id": laudo.id,
        "paciente_id": laudo.paciente_id,
        "paciente": {
            "id": paciente.id if paciente else None,
            "nome": paciente.nome if paciente else "Desconhecido",
            "tutor": tutor_nome or "",
            "telefone": tutor_telefone or "",
            "especie": paciente.especie if paciente else "",
            "raca": paciente.raca if paciente else "",
            "sexo": paciente.sexo if paciente else "",
            "peso_kg": paciente.peso_kg if paciente else None,
            "idade": idade,
        },
        "clinica": clinica_nome or laudo.medico_solicitante or "",
        "clinic_id": laudo.clinic_id,
        "medico_solicitante": laudo.medico_solicitante,
        "data_exame": laudo.data_exame.isoformat() if laudo.data_exame else None,
        "tipo": laudo.tipo,
        "titulo": laudo.titulo,
        "descricao": laudo.descricao,
        "diagnostico": laudo.diagnostico,
        "observacoes": laudo.observacoes,
        "status": laudo.status,
        "created_at": laudo.created_at.isoformat() if laudo.created_at else None,
        "updated_at": laudo.updated_at.isoformat() if laudo.updated_at else None,
        "data_laudo": laudo.data_laudo.isoformat() if laudo.data_laudo else None,
        "pressao_arterial": pressao_arterial,
        "imagens": imagens_list,
    }


@router.put("/laudos/{laudo_id}")
def atualizar_laudo(
    laudo_id: int,
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um laudo"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado")

    if "data_exame" in laudo_data:
        parsed = _parse_data_exame(laudo_data.get("data_exame"))
        if laudo_data.get("data_exame") not in (None, "", parsed):
            # Se o cliente enviou string invalida, bloqueia para evitar data corrompida.
            if isinstance(laudo_data.get("data_exame"), str) and parsed is None:
                raise HTTPException(
                    status_code=422,
                    detail="Formato invalido para data_exame. Use YYYY-MM-DD ou ISO datetime.",
                )
        laudo_data["data_exame"] = parsed

    if "clinic_id" in laudo_data:
        clinic_id = laudo_data.get("clinic_id")
        if clinic_id in ("", None):
            laudo_data["clinic_id"] = None
        else:
            try:
                laudo_data["clinic_id"] = int(clinic_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="clinic_id invalido.")

    if "tipo_laudo" in laudo_data and "tipo" not in laudo_data:
        laudo_data["tipo"] = laudo_data.pop("tipo_laudo")

    if "pressao_arterial" in laudo_data:
        pressao_arterial = _normalizar_pressao_arterial(laudo_data.pop("pressao_arterial"))
        laudo.anexos = _serializar_anexos(laudo.anexos, pressao_arterial)

    for field, value in laudo_data.items():
        if hasattr(laudo, field):
            setattr(laudo, field, value)

    laudo.updated_at = datetime.now()
    db.commit()
    db.refresh(laudo)
    return laudo


@router.delete("/laudos/{laudo_id}")
def deletar_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um laudo e suas imagens associadas"""
    from app.models.imagem_laudo import ImagemLaudo
    
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    # Remover imagens associadas ao laudo
    imagens = db.query(ImagemLaudo).filter(ImagemLaudo.laudo_id == laudo_id).all()
    for img in imagens:
        db.delete(img)
    
    # Remover o laudo
    db.delete(laudo)
    db.commit()
    
    return {"message": "Laudo e imagens removidos com sucesso"}


# Endpoint para gerar PDF
@router.get("/laudos/{laudo_id}/pdf")
def gerar_pdf_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gera PDF de laudo ecocardiografico ou de pressao arterial."""
    from fastapi.responses import StreamingResponse
    from app.utils.pdf_laudo import gerar_pdf_laudo_eco, gerar_pdf_laudo_pressao
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    from app.models.clinica import Clinica
    from app.models.imagem_laudo import ImagemLaudo
    from app.models.configuracao import Configuracao, ConfiguracaoUsuario
    from app.models.referencia_eco import ReferenciaEco
    from sqlalchemy import func
    import traceback

    try:
        laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
        if not laudo:
            raise HTTPException(status_code=404, detail="Laudo nao encontrado")

        paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()

        tutor_nome = ""
        if paciente and paciente.tutor_id:
            tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
            if tutor:
                tutor_nome = tutor.nome

        clinica_nome = ""
        if laudo.clinic_id:
            clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first()
            if clinica:
                clinica_nome = clinica.nome
        elif laudo.medico_solicitante:
            clinica_nome = laudo.medico_solicitante

        imagens = db.query(ImagemLaudo).filter(
            ImagemLaudo.laudo_id == laudo_id,
            ImagemLaudo.ativo == 1
        ).order_by(ImagemLaudo.ordem).all()

        imagens_bytes = []
        for img in imagens:
            if img.conteudo:
                imagens_bytes.append(img.conteudo)
            elif img.caminho_arquivo and os.path.exists(img.caminho_arquivo):
                with open(img.caminho_arquivo, "rb") as f:
                    imagens_bytes.append(f.read())

        config_sistema = None
        config_usuario = None
        try:
            config_sistema = db.query(Configuracao).first()
        except Exception as e:
            db.rollback()
            print(f"[WARN] Configuracao indisponivel para PDF: {e}")

        try:
            config_usuario = db.query(ConfiguracaoUsuario).filter(
                ConfiguracaoUsuario.user_id == current_user.id
            ).first()
        except Exception as e:
            db.rollback()
            print(f"[WARN] ConfiguracaoUsuario indisponivel para PDF: {e}")

        data_exame = laudo.data_exame or laudo.data_laudo
        if data_exame and isinstance(data_exame, str):
            data_exame = _parse_data_exame(data_exame)
        data_exame_str = data_exame.strftime("%d/%m/%Y") if data_exame else datetime.now().strftime("%d/%m/%Y")

        idade = ""
        if paciente and paciente.nascimento:
            try:
                nasc = datetime.strptime(str(paciente.nascimento), "%Y-%m-%d")
                hoje = datetime.now()
                meses = (hoje.year - nasc.year) * 12 + hoje.month - nasc.month
                idade = f"{meses}m" if meses < 12 else f"{meses // 12}a"
            except Exception:
                idade = ""
        if not idade and paciente and paciente.observacoes:
            match = re.search(r"Idade:\s*(.+?)(?:\\n|$)", paciente.observacoes)
            if match:
                idade = match.group(1).strip()

        dados_paciente = {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else "Canina",
            "raca": paciente.raca if paciente else "",
            "sexo": paciente.sexo if paciente else "",
            "idade": idade,
            "peso": f"{paciente.peso_kg:.1f}" if paciente and paciente.peso_kg else "",
            "tutor": tutor_nome,
            "solicitante": laudo.medico_solicitante or "",
            "data_exame": data_exame_str,
        }

        logomarca = None
        assinatura = None
        texto_rodape = None
        if config_sistema:
            if config_sistema.mostrar_logomarca and config_sistema.logomarca_dados:
                logomarca = config_sistema.logomarca_dados
            texto_rodape = config_sistema.texto_rodape_laudo

        if config_usuario and config_usuario.assinatura_dados:
            assinatura = config_usuario.assinatura_dados
        elif config_sistema and config_sistema.mostrar_assinatura and config_sistema.assinatura_dados:
            assinatura = config_sistema.assinatura_dados

        def sanitizar(texto, padrao):
            if not texto or texto == "N/A":
                return padrao
            texto = re.sub(r"[^\w\s-]", "", texto)
            texto = texto.strip().replace(" ", "_")
            return texto[:30] if texto else padrao

        try:
            data_nome = data_exame.strftime("%Y-%m-%d") if data_exame else datetime.now().strftime("%Y-%m-%d")
        except Exception:
            data_nome = datetime.now().strftime("%Y-%m-%d")

        pet_nome = sanitizar(dados_paciente.get("nome"), "Pet")
        tutor_nome_arq = sanitizar(tutor_nome, "SemTutor")
        clinica_nome_arq = sanitizar(clinica_nome, "SemClinica")
        filename_base = f"{data_nome}__{pet_nome}__{tutor_nome_arq}__{clinica_nome_arq}"

        if (laudo.tipo or "").lower() == "pressao_arterial":
            pressao_arterial = _extrair_pressao_arterial_de_anexos(laudo.anexos) or {}
            classificacao = laudo.diagnostico or _classificar_pressao_media(pressao_arterial.get("pas_media"))

            dados_pressao = {
                "paciente": dados_paciente,
                "clinica": clinica_nome,
                "pressao_arterial": pressao_arterial,
                "conclusao": classificacao,
                "observacoes": laudo.observacoes or "",
                "veterinario_nome": current_user.nome,
                "veterinario_crmv": config_usuario.crmv if config_usuario else "",
            }

            pdf_bytes = gerar_pdf_laudo_pressao(
                dados_pressao,
                logomarca_bytes=logomarca,
                assinatura_bytes=assinatura,
                nome_veterinario=current_user.nome,
                crmv=config_usuario.crmv if config_usuario else "",
                texto_rodape=texto_rodape,
            )
            filename = f"{filename_base}__PA.pdf"
        else:
            medidas = {}
            qualitativa = {}
            pressao_arterial = _extrair_pressao_arterial_de_anexos(laudo.anexos)
            if laudo.descricao:
                descricao = laudo.descricao
                for match in re.finditer(r"-\s*([\w_]+):\s*([\d.,]+)", descricao):
                    chave = match.group(1)
                    valor = match.group(2).replace(",", ".")
                    medidas[chave] = valor

                qualitativa_match = re.search(r"Avalia(?:ç|c)ão Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)", descricao, re.DOTALL)
                if not qualitativa_match:
                    qualitativa_match = re.search(r"Avaliacao Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)", descricao, re.DOTALL)
                if qualitativa_match:
                    qualitativa_texto = qualitativa_match.group(1)
                    for match in re.finditer(r"-\s*(\w+):?\s*(.+?)(?=\n-|\Z)", qualitativa_texto, re.DOTALL):
                        campo = match.group(1).lower().strip()
                        valor = match.group(2).strip()
                        if campo in ["valvas", "camaras", "funcao", "pericardio", "vasos", "ad_vd"]:
                            qualitativa[campo] = valor

            referencia_eco = None
            if paciente and paciente.especie and paciente.peso_kg is not None:
                try:
                    ref = db.query(ReferenciaEco).filter(
                        ReferenciaEco.especie.ilike(paciente.especie)
                    ).order_by(
                        func.abs(ReferenciaEco.peso_kg - float(paciente.peso_kg))
                    ).first()
                    if ref:
                        referencia_eco = {
                            col.name: getattr(ref, col.name)
                            for col in ref.__table__.columns
                        }
                except Exception as e:
                    db.rollback()
                    print(f"[WARN] ReferenciaEco indisponivel para PDF: {e}")

            dados_eco = {
                "paciente": dados_paciente,
                "medidas": medidas,
                "qualitativa": qualitativa,
                "conclusao": laudo.diagnostico or "",
                "clinica": clinica_nome,
                "referencia_eco": referencia_eco,
                "pressao_arterial": pressao_arterial,
                "imagens": imagens_bytes,
                "veterinario_nome": current_user.nome,
                "veterinario_crmv": config_usuario.crmv if config_usuario else "",
            }

            pdf_bytes = gerar_pdf_laudo_eco(
                dados_eco,
                logomarca_bytes=logomarca,
                assinatura_bytes=assinatura,
                nome_veterinario=current_user.nome,
                crmv=config_usuario.crmv if config_usuario else "",
                texto_rodape=texto_rodape,
            )
            filename = f"{filename_base}.pdf"

        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO GERAR PDF: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")


# Exames
@router.get("/exames")
def listar_exames(
    paciente_id: Optional[int] = None,
    tipo_exame: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista exames com filtros"""
    try:
        query = db.query(Exame)

        if paciente_id:
            query = query.filter(Exame.paciente_id == paciente_id)
        if tipo_exame:
            query = query.filter(Exame.tipo_exame == tipo_exame)
        if status:
            query = query.filter(Exame.status == status)

        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return {"total": total, "items": items}
    except Exception as e:
        # Stage legado pode ter drift de schema em `exames`; não bloqueia a tela de laudos.
        print(f"[WARN] Falha ao listar exames: {e}")
        return {"total": 0, "items": []}


@router.post("/exames", status_code=status.HTTP_201_CREATED)
def criar_exame(
    exame_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo exame"""
    exame = Exame(
        laudo_id=exame_data.get("laudo_id"),
        paciente_id=exame_data["paciente_id"],
        tipo_exame=exame_data["tipo_exame"],
        resultado=exame_data.get("resultado"),
        valor_referencia=exame_data.get("valor_referencia"),
        unidade=exame_data.get("unidade"),
        status=exame_data.get("status", "Solicitado"),
        valor=exame_data.get("valor", 0),
        observacoes=exame_data.get("observacoes"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(exame)
    db.commit()
    db.refresh(exame)
    
    return exame


@router.get("/exames/{exame_id}")
def obter_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um exame específico"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    return exame


@router.put("/exames/{exame_id}")
def atualizar_exame(
    exame_id: int,
    exame_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    
    for field, value in exame_data.items():
        if hasattr(exame, field):
            setattr(exame, field, value)
    
    db.commit()
    db.refresh(exame)
    return exame


@router.delete("/exames/{exame_id}")
def deletar_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    
    db.delete(exame)
    db.commit()
    
    return {"message": "Exame removido com sucesso"}


