from __future__ import annotations

import os
import re
import tempfile
import uuid
from typing import Final

from app.core.config import settings

MAX_ATENDIMENTO_ATTACHMENT_SIZE: Final[int] = 25 * 1024 * 1024


def _fallback_storage_dir() -> str:
    return os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "generated",
            "atendimentos_uploads",
        )
    )


def get_atendimento_upload_storage_dir(atendimento_id: int) -> str:
    preferred = str(settings.UPLOAD_DIR or "").strip()
    if os.name == "nt" and preferred.startswith("/"):
        preferred = ""
    candidate = os.path.join(preferred, "atendimentos", str(atendimento_id)) if preferred else ""

    for path in [candidate, os.path.join(_fallback_storage_dir(), str(atendimento_id))]:
        if not path:
            continue
        try:
            os.makedirs(path, exist_ok=True)
            return path
        except OSError:
            continue

    raise RuntimeError("Nao foi possivel criar diretorio para anexos do atendimento.")


def normalize_attachment_filename(filename: str | None, fallback: str = "anexo.bin") -> str:
    raw_name = os.path.basename((filename or "").strip()) or fallback
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", raw_name).strip("._")
    return cleaned or fallback


def validate_attachment_size(content: bytes) -> None:
    if len(content) > MAX_ATENDIMENTO_ATTACHMENT_SIZE:
        raise ValueError("Arquivo excede o limite de 25MB")


def store_atendimento_attachment_file(
    atendimento_id: int,
    filename: str | None,
    content: bytes,
) -> tuple[str, str]:
    validate_attachment_size(content)

    normalized_name = normalize_attachment_filename(filename)
    storage_dir = get_atendimento_upload_storage_dir(atendimento_id)
    unique_prefix = uuid.uuid4().hex[:12]
    target_name = f"{unique_prefix}_{normalized_name}"
    target_path = os.path.join(storage_dir, target_name)

    fd, tmp_path = tempfile.mkstemp(
        suffix=os.path.splitext(normalized_name)[1] or ".bin",
        prefix="anexo_",
        dir=storage_dir,
    )
    try:
        with os.fdopen(fd, "wb") as file_obj:
            file_obj.write(content)
        os.replace(tmp_path, target_path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

    return target_path, normalized_name


def remove_atendimento_attachment_file(path: str | None) -> None:
    if not path:
        return
    try:
        if os.path.exists(path):
            os.unlink(path)
    except OSError:
        return
