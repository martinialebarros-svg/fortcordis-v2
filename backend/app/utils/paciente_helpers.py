from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from typing import Any

IDADE_OBSERVACOES_RE = re.compile(r"(?im)^Idade:\s*(.+?)\s*$")


def normalizar_sexo_paciente(sexo: Any) -> str:
    texto = unicodedata.normalize("NFKD", str(sexo or ""))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.strip().lower()

    if texto.startswith("f"):
        return "Fêmea"
    if texto.startswith("m"):
        return "Macho"
    return str(sexo or "").strip()


def extrair_idade_paciente(
    nascimento: Any, observacoes: Any, *, data_referencia: Any = None,
) -> str:
    referencia = date.today()
    if data_referencia is not None:
        try:
            if isinstance(data_referencia, datetime):
                referencia = data_referencia.date()
            elif isinstance(data_referencia, date):
                referencia = data_referencia
            else:
                referencia = datetime.fromisoformat(str(data_referencia).strip().replace("Z", "+00:00")).date()
        except (TypeError, ValueError, OverflowError):
            return ""
        if referencia > date.today():
            return ""

    if nascimento:
        try:
            if isinstance(nascimento, datetime):
                data_nascimento = nascimento.date()
            elif isinstance(nascimento, date):
                data_nascimento = nascimento
            else:
                data_nascimento = datetime.strptime(str(nascimento), "%Y-%m-%d").date()

            if data_referencia is not None and referencia < data_nascimento:
                return ""
            meses = (referencia.year - data_nascimento.year) * 12 + referencia.month - data_nascimento.month
            # Historical studies require completed months; never turn the day
            # before the first birthday into an adult reference automatically.
            if data_referencia is not None and referencia.day < data_nascimento.day:
                meses -= 1
            if meses < 12:
                return f"{meses}m"

            anos = meses // 12
            meses_restantes = meses % 12
            if meses_restantes > 0:
                return f"{anos}a {meses_restantes}m"
            return f"{anos}a"
        except Exception:
            nascimento_texto = str(nascimento).strip()
            if nascimento_texto:
                return nascimento_texto

    match = IDADE_OBSERVACOES_RE.search(str(observacoes or ""))
    if match:
        return match.group(1).strip()
    return ""


def atualizar_observacoes_com_idade(observacoes: Any, idade: Any) -> str:
    idade_texto = str(idade or "").strip()
    observacoes_texto = str(observacoes or "").replace("\r\n", "\n")
    observacoes_sem_idade = IDADE_OBSERVACOES_RE.sub("", observacoes_texto)
    linhas_restantes = [linha.strip() for linha in observacoes_sem_idade.split("\n") if linha.strip()]

    if idade_texto:
        return "\n".join([f"Idade: {idade_texto}", *linhas_restantes]).strip()
    return "\n".join(linhas_restantes).strip()
