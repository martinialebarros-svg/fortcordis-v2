from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterator
from urllib.parse import quote, urlparse

import httpx
from fastapi import HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.core.config import settings


@dataclass(frozen=True)
class AttachmentDownloadSource:
    kind: str
    value: str


def _normalize_remote_url(raw_value: str | None) -> str | None:
    value = str(raw_value or "").strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return value


def resolve_attachment_download_source(attachment) -> AttachmentDownloadSource | None:
    local_path = str(getattr(attachment, "caminho_arquivo", "") or "").strip()
    if local_path and os.path.exists(local_path):
        return AttachmentDownloadSource(kind="local_file", value=local_path)

    remote_url = _normalize_remote_url(getattr(attachment, "url", None))
    if remote_url:
        return AttachmentDownloadSource(kind="remote_url", value=remote_url)

    return None


def attachment_has_download_source(attachment) -> bool:
    return resolve_attachment_download_source(attachment) is not None


def _build_remote_headers() -> dict[str, str]:
    headers: dict[str, str] = {}
    token = str(settings.PORTAL_REMOTE_STORAGE_AUTH_TOKEN or "").strip()
    if not token:
        return headers

    header_name = str(settings.PORTAL_REMOTE_STORAGE_AUTH_HEADER or "").strip() or "Authorization"
    if header_name.lower() == "authorization" and not token.lower().startswith(("bearer ", "basic ")):
        headers[header_name] = f"Bearer {token}"
    else:
        headers[header_name] = token
    return headers


def _build_content_disposition(filename: str | None) -> str:
    resolved = str(filename or "").strip() or "anexo.bin"
    return f"attachment; filename*=UTF-8''{quote(resolved)}"


def _iter_remote_response_bytes(client: httpx.Client, response: httpx.Response) -> Iterator[bytes]:
    try:
        for chunk in response.iter_bytes():
            if chunk:
                yield chunk
    finally:
        response.close()
        client.close()


def _build_remote_download_response(attachment, source: AttachmentDownloadSource, *, missing_detail: str):
    client = httpx.Client(
        follow_redirects=True,
        timeout=max(1, int(settings.PORTAL_REMOTE_STORAGE_TIMEOUT_SECONDS or 20)),
    )
    try:
        request = client.build_request("GET", source.value, headers=_build_remote_headers())
        response = client.send(request, stream=True)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            exc.response.close()
        except Exception:
            pass
        client.close()
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail=missing_detail) from exc
        raise HTTPException(status_code=502, detail="Falha ao acessar storage do anexo.") from exc
    except httpx.HTTPError as exc:
        client.close()
        raise HTTPException(status_code=502, detail="Falha ao acessar storage do anexo.") from exc

    media_type = str(getattr(attachment, "mime_type", "") or "").strip()
    if not media_type:
        media_type = str(response.headers.get("content-type") or "application/octet-stream")

    headers = {"Content-Disposition": _build_content_disposition(getattr(attachment, "nome_original", None))}
    content_length = response.headers.get("content-length")
    if content_length:
        headers["Content-Length"] = content_length

    return StreamingResponse(
        _iter_remote_response_bytes(client, response),
        media_type=media_type,
        headers=headers,
    )


def build_attachment_download_response(attachment, *, missing_detail: str):
    source = resolve_attachment_download_source(attachment)
    if not source:
        raise HTTPException(status_code=404, detail=missing_detail)

    if source.kind == "local_file":
        return FileResponse(
            path=source.value,
            media_type=getattr(attachment, "mime_type", None) or "application/octet-stream",
            filename=getattr(attachment, "nome_original", None) or f"anexo_{getattr(attachment, 'id', 'arquivo')}",
        )

    return _build_remote_download_response(attachment, source, missing_detail=missing_detail)
