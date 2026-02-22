from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from io import BytesIO
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
    
    query = db.query(Laudo)
    
    if paciente_id:
        query = query.filter(Laudo.paciente_id == paciente_id)
    if tipo:
        query = query.filter(Laudo.tipo == tipo)
    if status:
        query = query.filter(Laudo.status == status)
    
    total = query.count()
    items = query.order_by(Laudo.id.desc()).offset(skip).limit(limit).all()
    
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
            "paciente_nome": paciente.nome if paciente else "Desconhecido",
            "paciente_tutor": tutor_nome or "",
            "clinica": clinica_nome or laudo.medico_solicitante or "",
            "clinic_id": laudo.clinic_id,
            "tipo": laudo.tipo,
            "titulo": laudo.titulo,
            "status": laudo.status,
            "data_exame": laudo.data_exame.isoformat() if laudo.data_exame else None,
            "data_laudo": laudo.data_laudo.isoformat() if laudo.data_laudo else None,
            "created_at": laudo.created_at.isoformat() if laudo.created_at else None,
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
    """Cria um laudo de ecocardiograma com a estrutura específica"""
    import traceback
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    
    try:
        paciente = laudo_data.get("paciente", {})
        medidas = laudo_data.get("medidas", {})
        qualitativa = laudo_data.get("qualitativa", {})
        conteudo = laudo_data.get("conteudo", {})
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})
        paciente_id = paciente.get("id")
        paciente_nome_input = (paciente.get("nome") or "").strip()
        if not paciente_id and not paciente_nome_input:
            raise HTTPException(
                status_code=422,
                detail="Nome do paciente e obrigatorio para salvar o laudo."
            )

        
        print(f"Criando laudo eco para paciente: {paciente.get('nome')}")
        
        # Verificar se o paciente tem ID, senão criar um novo
        if not paciente_id and paciente.get("nome"):
            print(f"Criando novo paciente: {paciente.get('nome')}")
            
            # Criar ou buscar tutor
            tutor_id = None
            tutor_nome = paciente.get('tutor', '').strip()
            if tutor_nome:
                tutor_nome_key = _gerar_nome_key(tutor_nome)

                # Buscar tutor existente pelo nome normalizado (evita colisão de unique key).
                tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
                if not tutor:
                    tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()

                if not tutor:
                    # Criar novo tutor
                    tutor = Tutor(
                        nome=tutor_nome,
                        nome_key=tutor_nome_key,
                        telefone=paciente.get('telefone', ''),
                        ativo=1,
                        created_at=_legacy_now_str(),
                    )
                    db.add(tutor)
                    try:
                        db.commit()
                        db.refresh(tutor)
                    except IntegrityError:
                        # Outro fluxo pode ter criado o mesmo nome_key no intervalo.
                        db.rollback()
                        tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
                        if not tutor:
                            tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()
                        if not tutor:
                            raise
                    print(f"Tutor criado com ID: {tutor.id}")
                tutor_id = tutor.id
            
            paciente_nome = paciente_nome_input or "Paciente sem nome"
            paciente_nome_key = _gerar_nome_key(paciente_nome)
            paciente_especie = (paciente.get("especie") or "Canina").strip() or "Canina"

            # Evita colisão no índice único legado: (tutor_id, nome_key, especie).
            paciente_query = db.query(Paciente).filter(Paciente.nome_key == paciente_nome_key)
            if tutor_id is None:
                paciente_query = paciente_query.filter(Paciente.tutor_id.is_(None))
            else:
                paciente_query = paciente_query.filter(Paciente.tutor_id == tutor_id)
            paciente_query = paciente_query.filter(Paciente.especie.ilike(paciente_especie))

            paciente_existente = paciente_query.order_by(Paciente.id.desc()).first()
            if paciente_existente:
                paciente_id = paciente_existente.id
                print(f"Paciente existente reutilizado ID: {paciente_id}")
            
            # Criar novo paciente
            observacoes = ""
            if paciente.get('idade'):
                observacoes += f"Idade: {paciente.get('idade')}\n"

            if not paciente_id:
                novo_paciente = Paciente(
                    nome=paciente_nome,
                    nome_key=paciente_nome_key,
                    especie=paciente_especie,
                    raca=paciente.get("raca", ""),
                    sexo=paciente.get("sexo", ""),
                    peso_kg=float(paciente.get("peso", 0)) if paciente.get("peso") else None,
                    tutor_id=tutor_id,
                    observacoes=observacoes if observacoes else None,
                    ativo=1,
                    created_at=_legacy_now_str(),
                )
                db.add(novo_paciente)
                try:
                    db.commit()
                    db.refresh(novo_paciente)
                    paciente_id = novo_paciente.id
                    print(f"Paciente criado com ID: {paciente_id}")
                except IntegrityError:
                    # Outro fluxo pode ter criado o mesmo paciente no intervalo.
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
                    paciente_id = paciente_existente.id
                    print(f"Paciente existente pós-colisão reutilizado ID: {paciente_id}")
        
        if not paciente_id:
            raise ValueError("Não foi possível determinar o paciente para o laudo")
        
        # Montar descrição com medidas
        descricao_parts = ["## Medidas Ecocardiográficas\n"]
        for key, value in medidas.items():
            if value:
                descricao_parts.append(f"- {key}: {value}")
        
        descricao_parts.append("\n## Avaliação Qualitativa\n")
        for key, value in qualitativa.items():
            if value:
                descricao_parts.append(f"- {key}: {value}")
        
        descricao = "\n".join(descricao_parts)
        
        # Montar diagnóstico com conclusões
        diagnostico = conteudo.get("conclusao", "")
        
        # Observações adicionais
        observacoes = conteudo.get("observacoes", "")
        
        # Extrair clinic_id (pode vir como objeto ou ID direto)
        clinic_id = None
        if isinstance(clinica, dict):
            clinic_id = clinica.get("id")
        elif isinstance(clinica, (int, str)):
            try:
                clinic_id = int(clinica)
            except:
                clinic_id = None
        
        # Data do exame
        from datetime import datetime
        data_exame_str = paciente.get("data_exame") or paciente.get("data")
        data_exame = None
        if data_exame_str:
            try:
                # Tentar parse ISO format
                data_exame = datetime.fromisoformat(data_exame_str.replace('Z', '+00:00'))
            except:
                try:
                    data_exame = datetime.strptime(data_exame_str, "%Y-%m-%d")
                except:
                    pass
        
        # Criar o laudo
        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=None,
            veterinario_id=current_user.id,
            tipo="ecocardiograma",
            titulo=f"Laudo de Ecocardiograma - {paciente.get('nome', 'Paciente')}",
            descricao=descricao,
            diagnostico=diagnostico,
            observacoes=observacoes,
            anexos=None,
            status=laudo_data.get("status", "Finalizado"),
            clinic_id=clinic_id,
            data_exame=data_exame,
            medico_solicitante=veterinario.get("nome") if isinstance(veterinario, dict) else None,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome
        )
        
        db.add(laudo)
        db.commit()
        db.refresh(laudo)
        
        return {
            "id": laudo.id,
            "mensagem": "Laudo de ecocardiograma salvo com sucesso",
            "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
            "tipo": "ecocardiograma"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO ECO: {str(e)}")
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
    def parse_data_exame(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                try:
                    return datetime.strptime(value, "%Y-%m-%d")
                except ValueError:
                    raise HTTPException(
                        status_code=422,
                        detail="Formato invalido para data_exame. Use YYYY-MM-DD ou ISO datetime."
                    )
        raise HTTPException(status_code=422, detail="Formato invalido para data_exame.")

    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado")

    if "data_exame" in laudo_data:
        laudo_data["data_exame"] = parse_data_exame(laudo_data.get("data_exame"))

    if "clinic_id" in laudo_data:
        clinic_id = laudo_data.get("clinic_id")
        if clinic_id in ("", None):
            laudo_data["clinic_id"] = None
        else:
            try:
                laudo_data["clinic_id"] = int(clinic_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="clinic_id invalido.")

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
    """Gera PDF profissional de um laudo ecocardiográfico"""
    from fastapi.responses import StreamingResponse
    from app.utils.pdf_laudo import gerar_pdf_laudo_eco
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
            raise HTTPException(status_code=404, detail="Laudo não encontrado")
        
        # Buscar paciente
        paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()
        
        # Buscar tutor do paciente
        tutor_nome = ""
        if paciente and paciente.tutor_id:
            tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
            if tutor:
                tutor_nome = tutor.nome
        
        # Buscar clínica
        clinica_nome = ""
        if laudo.clinic_id:
            clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first()
            if clinica:
                clinica_nome = clinica.nome
        elif laudo.medico_solicitante:
            clinica_nome = laudo.medico_solicitante
        
        # Buscar imagens do laudo
        imagens = db.query(ImagemLaudo).filter(
            ImagemLaudo.laudo_id == laudo_id,
            ImagemLaudo.ativo == 1
        ).order_by(ImagemLaudo.ordem).all()
        
        # Preparar lista de imagens (bytes)
        imagens_bytes = []
        for img in imagens:
            if img.conteudo:
                imagens_bytes.append(img.conteudo)
            elif img.caminho_arquivo and os.path.exists(img.caminho_arquivo):
                with open(img.caminho_arquivo, 'rb') as f:
                    imagens_bytes.append(f.read())
        
        # Buscar configurações do sistema
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
        
        # Formatar data do exame
        data_exame = laudo.data_exame or laudo.data_laudo
        
        # Garantir que data_exame é um objeto datetime
        if data_exame and isinstance(data_exame, str):
            try:
                data_exame = datetime.fromisoformat(data_exame.replace('Z', '+00:00'))
            except:
                try:
                    data_exame = datetime.strptime(data_exame, "%Y-%m-%d")
                except:
                    data_exame = None
        
        data_exame_str = data_exame.strftime("%d/%m/%Y") if data_exame else datetime.now().strftime("%d/%m/%Y")
        
        # Extrair dados do paciente
        dados_paciente = {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else "Canina",
            "raca": paciente.raca if paciente else "",
            "sexo": paciente.sexo if paciente else "",
            "idade": "",
            "peso": f"{paciente.peso_kg:.1f}" if paciente and paciente.peso_kg else "",
            "tutor": tutor_nome,
            "data_exame": data_exame_str
        }
        
        # Extrair idade das observações do paciente
        if paciente and paciente.observacoes:
            match = re.search(r'Idade:\s*(.+?)(?:\n|$)', paciente.observacoes)
            if match:
                dados_paciente["idade"] = match.group(1).strip()
        
        # Extrair medidas da descrição (formato markdown)
        medidas = {}
        qualitativa = {}
        
        if laudo.descricao:
            descricao = laudo.descricao
            
            # Extrair medidas (formato: - DIVEd: 1.50 ou - Fracao_encurtamento_AE: 21,5)
            # Aceita números com ponto ou vírgula decimal
            for match in re.finditer(r'-\s*([\w_]+):\s*([\d.,]+)', descricao):
                chave = match.group(1)
                valor = match.group(2).replace(",", ".")
                medidas[chave] = valor
            
            # Extrair qualitativa - procura por seção "Avaliação Qualitativa"
            qualitativa_match = re.search(r'Avaliação Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)', descricao, re.DOTALL)
            if qualitativa_match:
                qualitativa_texto = qualitativa_match.group(1)
                for match in re.finditer(r'-\s*(\w+):?\s*(.+?)(?=\n-|\Z)', qualitativa_texto, re.DOTALL):
                    campo = match.group(1).lower().strip()
                    valor = match.group(2).strip()
                    if campo in ['valvas', 'camaras', 'funcao', 'pericardio', 'vasos', 'ad_vd']:
                        qualitativa[campo] = valor
            
            # Se não achou nada, tenta extrair direto das linhas
            if not qualitativa:
                for match in re.finditer(r'-\s*(valvas|camaras|funcao|pericardio|vasos|ad_vd):\s*(.+?)(?=\n-|\Z)', descricao, re.IGNORECASE | re.DOTALL):
                    campo = match.group(1).lower().strip()
                    valor = match.group(2).strip()
                    qualitativa[campo] = valor
        
        # Buscar referência ecocardiográfica por espécie e peso (mesma lógica da aba Referências)
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

        # Preparar dados para o PDF
        dados = {
            "paciente": dados_paciente,
            "medidas": medidas,
            "qualitativa": qualitativa,
            "conclusao": laudo.diagnostico or "",
            "clinica": clinica_nome,
            "referencia_eco": referencia_eco,
            "imagens": imagens_bytes,
            "veterinario_nome": current_user.nome,
            "veterinario_crmv": config_usuario.crmv if config_usuario else ""
        }
        
        # Definir logomarca e assinatura
        logomarca = None
        assinatura = None
        texto_rodape = None
        
        if config_sistema:
            # Usar logomarca do sistema se configurado
            if config_sistema.mostrar_logomarca and config_sistema.logomarca_dados:
                logomarca = config_sistema.logomarca_dados
            # Texto do rodapé
            texto_rodape = config_sistema.texto_rodape_laudo
        
        # Assinatura: preferência pela do usuário, senão usa a do sistema
        if config_usuario and config_usuario.assinatura_dados:
            assinatura = config_usuario.assinatura_dados
        elif config_sistema and config_sistema.mostrar_assinatura and config_sistema.assinatura_dados:
            assinatura = config_sistema.assinatura_dados
        
        # Gerar PDF com configurações
        pdf_bytes = gerar_pdf_laudo_eco(
            dados,
            logomarca_bytes=logomarca,
            assinatura_bytes=assinatura,
            nome_veterinario=current_user.nome,
            crmv=config_usuario.crmv if config_usuario else "",
            texto_rodape=texto_rodape
        )
        
        # Montar nome do arquivo: data__nome_do_pet__nome_do_tutor__nome_da_clinica.pdf
        try:
            data_nome = data_exame.strftime("%Y-%m-%d") if data_exame else datetime.now().strftime("%Y-%m-%d")
        except:
            data_nome = datetime.now().strftime("%Y-%m-%d")
        
        # Sanitizar nomes para filename (remove caracteres inválidos)
        def sanitizar(texto, padrao):
            if not texto or texto == "N/A":
                return padrao
            # Remover caracteres inválidos para filename
            texto = re.sub(r'[^\w\s-]', '', texto)
            texto = texto.strip().replace(' ', '_')
            return texto[:30] if texto else padrao
        
        pet_nome = sanitizar(dados_paciente.get('nome'), 'Pet')
        tutor_nome_arq = sanitizar(tutor_nome, 'SemTutor')
        clinica_nome_arq = sanitizar(clinica_nome, 'SemClinica')
        
        filename = f"{data_nome}__{pet_nome}__{tutor_nome_arq}__{clinica_nome_arq}.pdf"
        
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
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
