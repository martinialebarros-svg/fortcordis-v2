from __future__ import annotations

import hashlib
import json
import os
import re
import traceback
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.laudo import Laudo
from app.models.user import User


@dataclass(frozen=True)
class GeneratedLaudoPdf:
    content: bytes
    filename: str
    cache_key: str


def _safe_iso(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _sanitizar_nome_arquivo(texto: Any, padrao: str) -> str:
    valor = str(texto or "").strip()
    if not valor or valor == "N/A":
        return padrao
    valor = re.sub(r"[^\w\s-]", "", valor)
    valor = valor.strip().replace(" ", "_")
    return valor[:30] if valor else padrao


def _carregar_stamp_cache(db: Session, laudo: Laudo, user_id: int) -> dict[str, Any]:
    from app.models.configuracao import Configuracao, ConfiguracaoUsuario
    from app.models.imagem_laudo import ImagemLaudo

    imagens_count = 0
    imagens_max_created = None
    try:
        imagens_count, imagens_max_created = db.query(
            func.count(ImagemLaudo.id),
            func.max(ImagemLaudo.created_at),
        ).filter(
            ImagemLaudo.laudo_id == laudo.id,
            ImagemLaudo.ativo == 1,
        ).first() or (0, None)
    except Exception:
        db.rollback()

    config_sistema = None
    try:
        config_sistema = db.query(
            Configuracao.id,
            Configuracao.updated_at,
            Configuracao.created_at,
        ).first()
    except Exception:
        db.rollback()

    config_usuario = None
    try:
        config_usuario = db.query(
            ConfiguracaoUsuario.id,
            ConfiguracaoUsuario.updated_at,
            ConfiguracaoUsuario.created_at,
        ).filter(
            ConfiguracaoUsuario.user_id == user_id
        ).first()
    except Exception:
        db.rollback()

    return {
        "laudo_id": laudo.id,
        "laudo_tipo": laudo.tipo,
        "laudo_status": laudo.status,
        "laudo_updated_at": _safe_iso(laudo.updated_at or laudo.created_at or laudo.data_laudo),
        "requested_by_id": user_id,
        "imagens_count": int(imagens_count or 0),
        "imagens_max_created_at": _safe_iso(imagens_max_created),
        "config_sistema_id": getattr(config_sistema, "id", None),
        "config_sistema_updated_at": _safe_iso(getattr(config_sistema, "updated_at", None) or getattr(config_sistema, "created_at", None)),
        "config_usuario_id": getattr(config_usuario, "id", None),
        "config_usuario_updated_at": _safe_iso(getattr(config_usuario, "updated_at", None) or getattr(config_usuario, "created_at", None)),
    }


def compute_laudo_pdf_cache_key(db: Session, laudo_id: int, user_id: int) -> str:
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise ValueError("Laudo nao encontrado")

    payload = _carregar_stamp_cache(db, laudo, user_id)
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def render_laudo_pdf(db: Session, laudo_id: int, current_user: User) -> GeneratedLaudoPdf:
    from app.api.v1.endpoints import laudos as laudos_endpoint
    from app.models.clinica import Clinica
    from app.models.configuracao import Configuracao, ConfiguracaoUsuario
    from app.models.imagem_laudo import ImagemLaudo
    from app.models.paciente import Paciente
    from app.models.referencia_eco import ReferenciaEco
    from app.models.tutor import Tutor
    from app.utils.pdf_laudo import (
        gerar_pdf_laudo_eco,
        gerar_pdf_laudo_pressao,
        gerar_pdf_laudo_ultrassom_abdominal,
    )

    try:
        laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
        if not laudo:
            raise ValueError("Laudo nao encontrado")

        cache_key = compute_laudo_pdf_cache_key(db, laudo_id, current_user.id)
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
            ImagemLaudo.ativo == 1,
        ).order_by(ImagemLaudo.ordem).all()

        imagens_bytes: list[bytes] = []
        for img in imagens:
            if img.conteudo:
                imagens_bytes.append(img.conteudo)
            elif img.caminho_arquivo and os.path.exists(img.caminho_arquivo):
                with open(img.caminho_arquivo, "rb") as file_obj:
                    imagens_bytes.append(file_obj.read())

        config_sistema = None
        config_usuario = None
        try:
            config_sistema = db.query(Configuracao).first()
        except Exception as exc:
            db.rollback()
            print(f"[WARN] Configuracao indisponivel para PDF: {exc}")

        try:
            config_usuario = db.query(ConfiguracaoUsuario).filter(
                ConfiguracaoUsuario.user_id == current_user.id
            ).first()
        except Exception as exc:
            db.rollback()
            print(f"[WARN] ConfiguracaoUsuario indisponivel para PDF: {exc}")

        data_exame = laudo.data_exame or laudo.data_laudo
        if data_exame and isinstance(data_exame, str):
            data_exame = laudos_endpoint._parse_data_exame(data_exame)
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
        ecocardiograma_cabecalho = (
            laudos_endpoint._extrair_ecocardiograma_cabecalho_de_anexos(laudo.anexos) or {}
        )
        dados_paciente["ritmo"] = str(ecocardiograma_cabecalho.get("ritmo") or "").strip()
        dados_paciente["estado"] = str(ecocardiograma_cabecalho.get("estado") or "").strip()
        dados_paciente["fc"] = str(ecocardiograma_cabecalho.get("fc") or "").strip()

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

        try:
            data_nome = data_exame.strftime("%Y-%m-%d") if data_exame else datetime.now().strftime("%Y-%m-%d")
        except Exception:
            data_nome = datetime.now().strftime("%Y-%m-%d")

        pet_nome = _sanitizar_nome_arquivo(dados_paciente.get("nome"), "Pet")
        tutor_nome_arq = _sanitizar_nome_arquivo(tutor_nome, "SemTutor")
        clinica_nome_arq = _sanitizar_nome_arquivo(clinica_nome, "SemClinica")
        filename_base = f"{data_nome}__{pet_nome}__{tutor_nome_arq}__{clinica_nome_arq}"

        tipo_laudo = (laudo.tipo or "").lower()

        if tipo_laudo == "pressao_arterial":
            pressao_arterial = laudos_endpoint._extrair_pressao_arterial_de_anexos(laudo.anexos) or {}
            classificacao = laudo.diagnostico or laudos_endpoint._classificar_pressao_media(
                pressao_arterial.get("pas_media")
            )

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
        elif tipo_laudo == "ultrassonografia_abdominal":
            ultrassonografia_abdominal = laudos_endpoint._extrair_ultrassonografia_abdominal_de_anexos(laudo.anexos)
            if not ultrassonografia_abdominal:
                ultrassonografia_abdominal = laudos_endpoint._extrair_ultrassonografia_abdominal_do_descricao(
                    laudo.descricao
                )
            if not ultrassonografia_abdominal:
                ultrassonografia_abdominal = {
                    "versao": 1,
                    "sexo_paciente": laudos_endpoint._normalizar_sexo_paciente(paciente.sexo if paciente else ""),
                    "qualitativa": {},
                    "observacoes_gerais": laudo.observacoes or "",
                }

            dados_ultrassom = {
                "paciente": dados_paciente,
                "clinica": clinica_nome,
                "ultrassonografia_abdominal": ultrassonografia_abdominal,
                "observacoes": laudo.observacoes or "",
                "imagens": imagens_bytes,
                "veterinario_nome": current_user.nome,
                "veterinario_crmv": config_usuario.crmv if config_usuario else "",
            }

            pdf_bytes = gerar_pdf_laudo_ultrassom_abdominal(
                dados_ultrassom,
                logomarca_bytes=logomarca,
                assinatura_bytes=assinatura,
                nome_veterinario=current_user.nome,
                crmv=config_usuario.crmv if config_usuario else "",
                texto_rodape=texto_rodape,
            )
            filename = f"{filename_base}__US_abdominal.pdf"
        else:
            medidas: dict[str, Any] = {}
            qualitativa: dict[str, Any] = {}
            pressao_arterial = laudos_endpoint._extrair_pressao_arterial_de_anexos(laudo.anexos)
            if laudo.descricao:
                descricao = laudo.descricao
                for match in re.finditer(r"-\s*([\w_]+):\s*([\d.,]+)", descricao):
                    chave = match.group(1)
                    valor = match.group(2).replace(",", ".")
                    medidas[chave] = valor

                qualitativa_match = re.search(
                    r"Avalia(?:Ã§|c)Ã£o Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)",
                    descricao,
                    re.DOTALL,
                )
                if not qualitativa_match:
                    qualitativa_match = re.search(
                        r"Avaliacao Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)",
                        descricao,
                        re.DOTALL,
                    )
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
                except Exception as exc:
                    db.rollback()
                    print(f"[WARN] ReferenciaEco indisponivel para PDF: {exc}")

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

        return GeneratedLaudoPdf(
            content=pdf_bytes,
            filename=filename,
            cache_key=cache_key,
        )
    except Exception as exc:
        print(f"ERRO AO GERAR PDF: {exc}")
        print(traceback.format_exc())
        raise
