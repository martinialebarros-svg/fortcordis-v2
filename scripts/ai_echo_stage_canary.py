#!/usr/bin/env python3
"""One-shot live canary for the stage-only AI echocardiography assistant."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from deploy_authenticated_canary import _token_from_internal_backend


ARTIFICIAL_TRANSCRIPT = (
    "Átrio esquerdo aumentado. Relação átrio esquerdo aorta de um vírgula "
    "setenta e quatro. Sem efusão pericárdica."
)

REMAINING_NORMAL_REGRESSION_TRANSCRIPT = (
    "Valva mitral com folhetos espessados, espessamento leve, com refluxo leve, "
    "sem remodelamento de câmaras cardíacas. Classificação B1 para endocardiose "
    "de mitral. Disfunção diastólica grau 1 padrão senil. O resto "
    "dos parâmetros ecocardiográficos avaliados dentro da normalidade."
)

ADVANCED_MITRAL_STAGE_C_TRANSCRIPT = (
    "Endocardiose mitral estágio C. Folhetos mitrais espessados com "
    "regurgitação mitral importante. Regurgitação tricúspide com repercussão "
    "em câmaras direitas. Sinais de congestão venosa pulmonar."
)


def _request_json(
    *,
    base_url: str,
    path: str,
    token: str,
    method: str = "GET",
    body: bytes | None = None,
    content_type: str | None = None,
    timeout_seconds: int = 120,
) -> tuple[int, dict[str, Any]]:
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(
        base_url.rstrip("/") + path,
        method=method,
        headers=headers,
        data=body,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict):
                raise RuntimeError("Resposta JSON não é objeto.")
            return int(response.status), payload
    except urllib.error.HTTPError as exc:
        exc.read()
        raise RuntimeError(f"Etapa HTTP falhou com status {exc.code}.") from exc


def _json_body(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _multipart_audio(audio_bytes: bytes) -> tuple[bytes, str]:
    boundary = f"----fortcordis-ai-echo-{uuid.uuid4().hex}"
    chunks = [
        f"--{boundary}\r\n".encode(),
        (
            'Content-Disposition: form-data; name="file"; '
            'filename="ai-echo-canary.m4a"\r\n'
        ).encode(),
        b"Content-Type: audio/mp4\r\n\r\n",
        audio_bytes,
        b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _with_backend(backend_dir: str) -> tuple[Any, Any, Any]:
    absolute = os.path.abspath(backend_dir)
    if absolute not in sys.path:
        sys.path.insert(0, absolute)
    previous = os.getcwd()
    os.chdir(absolute)
    try:
        from app.db.database import SessionLocal
        from app.models.laudo import Laudo
        from app.models import ai_echo

        return SessionLocal, Laudo, ai_echo
    finally:
        os.chdir(previous)


def _find_echo_report_id(backend_dir: str) -> int:
    session_local, laudo_model, _ = _with_backend(backend_dir)
    db = session_local()
    try:
        row = (
            db.query(laudo_model)
            .filter(laudo_model.tipo == "ecocardiograma")
            .order_by(laudo_model.id.asc())
            .first()
        )
        if not row:
            raise RuntimeError("Homologação sem ecocardiograma para o canary.")
        return int(row.id)
    finally:
        db.close()


def _cleanup_persistence(backend_dir: str, session_id: str) -> None:
    session_local, _, models = _with_backend(backend_dir)
    db = session_local()
    try:
        assets = (
            db.query(models.AIEchoAudioAsset)
            .filter(models.AIEchoAudioAsset.session_id == session_id)
            .all()
        )
        for asset in assets:
            try:
                os.unlink(asset.storage_path)
            except FileNotFoundError:
                pass
        for model in (
            models.AIEchoApplication,
            models.AIEchoFeedback,
            models.AIEchoClinicalWarning,
            models.AIEchoMeasurement,
            models.AIEchoFieldSuggestion,
            models.AIEchoTranscript,
            models.AIEchoAudioAsset,
        ):
            db.query(model).filter(model.session_id == session_id).delete(
                synchronize_session=False
            )
        db.query(models.AIEchoSession).filter(
            models.AIEchoSession.id == session_id
        ).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _wait_for_review(
    *,
    base_url: str,
    token: str,
    session_id: str,
    needs_transcript: bool = False,
    needs_suggestions: bool = False,
    timeout_seconds: int = 120,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        _, payload = _request_json(
            base_url=base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}",
            token=token,
            timeout_seconds=15,
        )
        if payload.get("status") == "failed":
            error = payload.get("last_error")
            code = error.get("code") if isinstance(error, dict) else "unknown"
            raise RuntimeError(
                f"Processamento de IA falhou ({code})."
            )
        if payload.get("status") == "awaiting_review":
            if needs_transcript and not payload.get("transcript"):
                time.sleep(1)
                continue
            if needs_suggestions and not (
                payload.get("field_suggestions") or payload.get("measurements")
            ):
                raise RuntimeError("Estruturação não retornou sugestões.")
            return payload
        time.sleep(1)
    raise RuntimeError("Processamento de IA excedeu o tempo do canary.")


def run_canary(args: argparse.Namespace) -> None:
    token = _token_from_internal_backend(args.backend_dir)
    session_id = ""
    audio_deleted = False
    try:
        _, config = _request_json(
            base_url=args.base_url,
            path="/api/v1/ai/echo-sessions/config",
            token=token,
            timeout_seconds=15,
        )
        if not (
            config.get("enabled") is True
            and config.get("feature_flag_enabled") is True
            and config.get("provider_configured") is True
            and config.get("requires_explicit_application") is True
        ):
            raise RuntimeError("Configuração do assistente não está pronta em stage.")
        print("[ai-echo-canary] config: ready")

        _, created = _request_json(
            base_url=args.base_url,
            path="/api/v1/ai/echo-sessions",
            token=token,
            method="POST",
            body=_json_body({"laudo_id": _find_echo_report_id(args.backend_dir)}),
            content_type="application/json",
        )
        session_id = str(created.get("id") or "")
        if not session_id:
            raise RuntimeError("Sessão canary não foi criada.")

        audio_bytes = Path(args.audio_file).read_bytes()
        multipart_body, multipart_type = _multipart_audio(audio_bytes)
        _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/audio",
            token=token,
            method="POST",
            body=multipart_body,
            content_type=multipart_type,
        )
        _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/transcribe",
            token=token,
            method="POST",
            body=b"",
            content_type="application/json",
        )
        transcribed = _wait_for_review(
            base_url=args.base_url,
            token=token,
            session_id=session_id,
            needs_transcript=True,
            timeout_seconds=args.timeout_seconds,
        )
        transcript = transcribed.get("transcript")
        if not isinstance(transcript, dict) or not str(
            transcript.get("raw_text") or ""
        ).strip():
            raise RuntimeError("Transcrição real veio vazia.")
        print("[ai-echo-canary] transcription: passed")

        _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/structure",
            token=token,
            method="POST",
            body=_json_body(
                {
                    "edited_transcript": REMAINING_NORMAL_REGRESSION_TRANSCRIPT,
                    "current_measurements": {"AE_Ao": "2,4"},
                }
            ),
            content_type="application/json",
        )
        normality_regression = _wait_for_review(
            base_url=args.base_url,
            token=token,
            session_id=session_id,
            needs_suggestions=True,
            timeout_seconds=args.timeout_seconds,
        )
        regression_suggestions = {
            item.get("field_key"): item.get("suggested_value")
            for item in (normality_regression.get("field_suggestions") or [])
        }
        expected_fields = {
            "valva_mitral", "valva_aortica", "valva_tricuspide", "valva_pulmonar",
            "atrio_esquerdo", "ventriculo_esquerdo", "funcao_sistolica_ve",
            "funcao_diastolica", "atrio_direito", "ventriculo_direito", "septos",
            "aorta", "arteria_pulmonar", "pericardio", "conclusao",
        }
        if set(regression_suggestions) != expected_fields:
            raise RuntimeError("A normalidade dos demais campos não foi expandida.")
        expected_diastolic = "Disfunção diastólica grau I (padrão senil)."
        if regression_suggestions.get("funcao_diastolica") != expected_diastolic:
            raise RuntimeError("A alteração diastólica não foi preservada.")
        conclusion_text = str(regression_suggestions.get("conclusao") or "")
        normalized_conclusion = conclusion_text.lower()
        if not any(
            term in normalized_conclusion
            for term in ("endocardiose mitral", "degeneração mixomatosa")
        ):
            raise RuntimeError("A conclusão não preservou a endocardiose mitral.")
        if "Estágio B1 (ACVIM)" in conclusion_text:
            raise RuntimeError(
                "A conclusão manteve B1 apesar do AE/Ao 2.4 conflitante."
            )
        if "refluxo de grau leve" not in conclusion_text:
            raise RuntimeError("A conclusão não descreveu o refluxo mitral leve.")
        if expected_diastolic.rstrip(".") not in conclusion_text:
            raise RuntimeError("A conclusão não descreveu a disfunção diastólica.")
        if "AE/Ao 2.4" not in conclusion_text:
            raise RuntimeError("A conclusão não interpretou a medida AE/Ao do formulário.")
        if "repercussão hemodinâmica significativa" not in conclusion_text:
            raise RuntimeError("A repercussão hemodinâmica do AE/Ao não foi sugerida.")
        mitral_text = str(regression_suggestions.get("valva_mitral") or "")
        aortic_text = str(regression_suggestions.get("valva_aortica") or "")
        if "folheto septal" not in mitral_text.lower() or "cúspides" not in aortic_text.lower():
            raise RuntimeError("Os campos normais não usaram as frases ricas do preset.")
        if mitral_text == aortic_text:
            raise RuntimeError("O preset normal repetiu o mesmo texto entre estruturas.")
        print("[ai-echo-canary] remaining normality regression: passed")

        _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/structure",
            token=token,
            method="POST",
            body=_json_body(
                {
                    "edited_transcript": ADVANCED_MITRAL_STAGE_C_TRANSCRIPT,
                    "current_measurements": {
                        "AE_Ao": "2,5",
                        "DIVEd_normalizado": "2,0",
                        "Onda_E": "1,35",
                        "E_A": "2,2",
                        "E_E_linha": "14",
                        "IM_Vmax": "5,5",
                        "IT_Vmax": "3,6",
                    },
                }
            ),
            content_type="application/json",
        )
        stage_c_result = _wait_for_review(
            base_url=args.base_url,
            token=token,
            session_id=session_id,
            needs_suggestions=True,
            timeout_seconds=args.timeout_seconds,
        )
        stage_c_suggestions = {
            item.get("field_key"): str(item.get("suggested_value") or "")
            for item in (stage_c_result.get("field_suggestions") or [])
        }
        if "aspecto mixomatoso" not in stage_c_suggestions.get("valva_mitral", ""):
            raise RuntimeError("A valva mitral não recebeu descrição avançada.")
        if "AE/Ao 2.5" not in stage_c_suggestions.get("atrio_esquerdo", ""):
            raise RuntimeError("O remodelamento atrial esquerdo não foi correlacionado.")
        if "DIVEd normalizado 2" not in stage_c_suggestions.get("ventriculo_esquerdo", ""):
            raise RuntimeError("A dilatação ventricular esquerda não foi correlacionada.")
        if "onda E 1.35 m/s" not in stage_c_suggestions.get("funcao_diastolica", ""):
            raise RuntimeError("As pressões de enchimento não foram correlacionadas.")
        stage_c_conclusion = stage_c_suggestions.get("conclusao", "")
        if "Estágio C (ACVIM)" not in stage_c_conclusion:
            raise RuntimeError("A classificação C informada no ditado não foi preservada.")
        if "congestão venosa pulmonar" not in stage_c_conclusion:
            raise RuntimeError("A congestão informada no ditado não foi preservada.")
        warning_types = {
            item.get("warning_type") for item in (stage_c_result.get("warnings") or [])
        }
        for expected_warning in (
            "multimodal_correlation_applied",
            "mitral_velocity_not_regurgitation_grade",
            "tr_velocity_requires_ph_context",
        ):
            if expected_warning not in warning_types:
                raise RuntimeError(
                    f"A salvaguarda multimodal {expected_warning} não foi emitida."
                )
        print("[ai-echo-canary] advanced stage C multimodal correlation: passed")

        _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/structure",
            token=token,
            method="POST",
            body=_json_body({"edited_transcript": ARTIFICIAL_TRANSCRIPT}),
            content_type="application/json",
        )
        structured = _wait_for_review(
            base_url=args.base_url,
            token=token,
            session_id=session_id,
            needs_suggestions=True,
            timeout_seconds=args.timeout_seconds,
        )
        la_ao = next(
            (
                item
                for item in (structured.get("measurements") or [])
                if item.get("target_field_key") == "AE_Ao"
            ),
            None,
        )
        if not la_ao or abs(float(la_ao.get("numeric_value")) - 1.74) > 0.000001:
            raise RuntimeError("Integridade numérica AE/Ao não foi confirmada.")

        suggestions = [
            item
            for item in (structured.get("field_suggestions") or [])
            if item.get("status") == "pending"
        ]
        suggestion = next(
            (
                item
                for item in suggestions
                if item.get("field_key") == "atrio_esquerdo"
            ),
            suggestions[0] if suggestions else None,
        )
        if not suggestion:
            raise RuntimeError("Nenhuma sugestão textual aplicável foi retornada.")
        print("[ai-echo-canary] structure: passed")

        _, applied = _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/apply",
            token=token,
            method="POST",
            body=_json_body(
                {
                    "confirmed": True,
                    "accepted_suggestion_ids": [suggestion["id"]],
                    "accepted_measurement_ids": [la_ao["id"]],
                    "suggestion_overrides": {
                        suggestion["id"]: suggestion["suggested_value"]
                    },
                    "mode": "empty_only",
                    "current_fields": {},
                    "current_measurements": {},
                }
            ),
            content_type="application/json",
        )
        if applied.get("report_persisted") is not False:
            raise RuntimeError("Canary detectou persistência indevida do laudo.")
        if applied.get("report_status") != "Rascunho":
            raise RuntimeError("Canary não preservou o status Rascunho.")

        _, audit = _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/audit",
            token=token,
        )
        if not audit.get("applications"):
            raise RuntimeError("Trilha de aplicação não foi registrada.")
        print("[ai-echo-canary] selective apply and audit: passed")

        _, deleted = _request_json(
            base_url=args.base_url,
            path=f"/api/v1/ai/echo-sessions/{session_id}/audio",
            token=token,
            method="DELETE",
        )
        audio_deleted = deleted.get("audio_deleted") is True
        if not audio_deleted:
            raise RuntimeError("Áudio temporário não foi excluído.")
        print("[ai-echo-canary] audio deletion: passed")
    finally:
        if session_id:
            if not audio_deleted:
                try:
                    _request_json(
                        base_url=args.base_url,
                        path=f"/api/v1/ai/echo-sessions/{session_id}/audio",
                        token=token,
                        method="DELETE",
                    )
                except Exception:
                    pass
            _cleanup_persistence(args.backend_dir, session_id)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument(
        "--backend-dir",
        default="/var/www/fortcordis-stage/backend",
    )
    parser.add_argument(
        "--audio-file",
        default=(
            "/var/www/fortcordis-stage/backend/evals/"
            "ai_echo_canary_pt_br.m4a"
        ),
    )
    parser.add_argument("--timeout-seconds", type=int, default=120)
    args = parser.parse_args()
    try:
        run_canary(args)
    except Exception as exc:
        print(f"[ai-echo-canary] FAILED: {exc}")
        return 1
    print("[ai-echo-canary] PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
