#!/usr/bin/env python3
"""Recover missing frases in production from backup tarballs."""

from __future__ import annotations

import glob
import json
import os
import sys
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_APP_DIR = "/var/www/fortcordis-v2"


def key_of(frase: dict[str, Any]) -> tuple[str, ...]:
    chave = str(frase.get("chave") or "").strip().lower()
    if chave:
        return ("chave", chave)

    pat = str(frase.get("patologia") or "").strip().lower()
    grau = str(frase.get("grau") or "").strip().lower()
    concl = str(frase.get("conclusao") or "").strip().lower()
    return ("pgc", pat, grau, concl)


def read_frases_from_tar(tar_path: str) -> dict[str, Any] | None:
    try:
        with tarfile.open(tar_path, "r:gz") as tar:
            member = None
            for candidate in ("backend/data/frases.json", "./backend/data/frases.json"):
                try:
                    member = tar.getmember(candidate)
                    break
                except KeyError:
                    continue

            if member is None:
                for candidate in tar.getmembers():
                    if candidate.name.endswith("backend/data/frases.json"):
                        member = candidate
                        break

            if member is None:
                return None

            extracted = tar.extractfile(member)
            if extracted is None:
                return None

            data = json.loads(extracted.read().decode("utf-8"))
            frases = data.get("frases", []) if isinstance(data, dict) else []
            if not isinstance(frases, list):
                frases = []

            active = [f for f in frases if isinstance(f, dict) and f.get("ativo", 1) == 1]
            return {
                "path": tar_path,
                "name": os.path.basename(tar_path),
                "data": data if isinstance(data, dict) else {"frases": []},
                "total": len(frases),
                "active": len(active),
            }
    except Exception:
        return None


def main() -> int:
    app_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_APP_DIR)
    runtime_path = app_dir / "backend" / "data" / "frases.json"
    runtime_path.parent.mkdir(parents=True, exist_ok=True)

    backup_files = sorted(
        glob.glob(str(app_dir / "backup_*.tar.gz")),
        key=os.path.getmtime,
        reverse=True,
    )

    if not backup_files:
        print("Nenhum backup_*.tar.gz encontrado em /var/www/fortcordis-v2")
        return 1

    candidates: list[dict[str, Any]] = []
    for path in backup_files:
        info = read_frases_from_tar(path)
        if info:
            candidates.append(info)

    if not candidates:
        print("Backups encontrados, mas nenhum com frases.json valido")
        return 1

    print("=== BACKUPS CANDIDATOS (top 10) ===")
    for item in candidates[:10]:
        mtime = datetime.fromtimestamp(os.path.getmtime(item["path"])).isoformat()
        print(
            f"- {item['name']} | active={item['active']} total={item['total']} | "
            f"mtime={mtime}"
        )

    selected = sorted(
        candidates,
        key=lambda c: (c["active"], c["total"], os.path.getmtime(c["path"])),
        reverse=True,
    )[0]

    print("=== BACKUP SELECIONADO ===")
    print(f"{selected['name']} | active={selected['active']} total={selected['total']}")

    current_data: dict[str, Any] = {"frases": [], "version": "1.0"}
    if runtime_path.exists():
        try:
            loaded = json.loads(runtime_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                current_data = loaded
        except Exception:
            pass

    current_frases = current_data.get("frases", [])
    if not isinstance(current_frases, list):
        current_frases = []

    backup_data = selected["data"] if isinstance(selected.get("data"), dict) else {"frases": []}
    backup_frases = backup_data.get("frases", [])
    if not isinstance(backup_frases, list):
        backup_frases = []

    print("=== CONTAGEM ATUAL VS BACKUP ===")
    print(
        f"Atual: active={sum(1 for f in current_frases if isinstance(f, dict) and f.get('ativo', 1) == 1)} "
        f"total={len(current_frases)}"
    )
    print(
        f"Backup: active={sum(1 for f in backup_frases if isinstance(f, dict) and f.get('ativo', 1) == 1)} "
        f"total={len(backup_frases)}"
    )

    merged: list[dict[str, Any]] = []
    index: dict[tuple[str, ...], dict[str, Any]] = {}

    for frase in current_frases:
        if not isinstance(frase, dict):
            continue
        frase_key = key_of(frase)
        index[frase_key] = frase
        merged.append(frase)

    added = 0
    for frase in backup_frases:
        if not isinstance(frase, dict):
            continue
        frase_key = key_of(frase)
        if frase_key in index:
            continue
        merged.append(frase)
        index[frase_key] = frase
        added += 1

    for i, frase in enumerate(merged, start=1):
        frase["id"] = i

    result = dict(current_data)
    result["frases"] = merged
    result["last_updated"] = datetime.now().isoformat()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_current = runtime_path.parent / f"frases.before_recovery.{stamp}.json"
    if runtime_path.exists():
        backup_current.write_text(runtime_path.read_text(encoding="utf-8"), encoding="utf-8")

    runtime_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== RECUPERACAO APLICADA ===")
    print(f"Backup do arquivo atual: {backup_current}")
    print(f"Frases adicionadas do backup: {added}")
    active_total = sum(1 for f in merged if isinstance(f, dict) and f.get("ativo", 1) == 1)
    print(f"Total final: {len(merged)} | active={active_total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
