#!/usr/bin/env python3
"""Lint de formato: `verify.md` tocado no PR precisa de matriz com coluna `Status`.

Por que isto existe
-------------------
O gate de promocao (`check_promotion_verify_pending.py`) so le tabela markdown
que tenha uma coluna `Status`. Isso e deliberado, nao descuido: o `verify.md`
costuma trazer tambem tabelas de etapas, de respostas e de medicao, que nao sao
criterios de aceitacao -- ler todas geraria falso positivo. A regra esta fixada
como RF-004 de `docs/specs/promocao-bloqueia-criterio-pendente`.

O efeito colateral e silencioso: uma matriz escrita com outro cabecalho -- o
mais comum sendo `| Criterio | Evidencia | Resultado |`, herdado de specs
anteriores ao gate -- fica invisivel para o gate. Um criterio marcado
`pendente` ali atravessa a promocao `stage -> main` e o PR verde ainda informa
"nenhum criterio pendente", que e a pior forma de errar: o gate diz que olhou.

Corrigir o parser seria pior (voltaria o falso positivo que RF-004 evita). O
que fecha o buraco e manter os documentos no formato canonico do template,
`| ID | Tipo | Evidencia | Status |` -- e este lint impede que ele divirja de
novo.

Escopo
------
So os `verify.md` adicionados ou modificados no diff. Duas razoes:

- nao reprovar PR alheio por causa de spec legada: 37 dos 251 `verify.md` ainda
  registram verificacao so em prosa, sem matriz nenhuma;
- o passivo diminui sozinho -- quem encosta num `verify.md` antigo o deixa no
  formato canonico, sem precisar de lista de excecao que envelhece no repo.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import subprocess
import sys
from dataclasses import dataclass, field
from typing import List, Sequence

SPEC_ROOT = "docs/specs/"
SPEC_TEMPLATES_PREFIX = "docs/specs/templates/"
VERIFY_FILE = "verify.md"

_DIR = os.path.dirname(os.path.abspath(__file__))
_GATE_PATH = os.path.join(_DIR, "check_promotion_verify_pending.py")


def _carregar_gate():
    """Importa o gate de promocao para reusar o MESMO parser de tabela.

    Reimplementar a leitura aqui seria o jeito mais facil de este lint aprovar
    um arquivo que o gate nao consegue ler.
    """
    spec = importlib.util.spec_from_file_location("check_promotion_verify_pending", _GATE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Nao foi possivel carregar o gate de promocao: {_GATE_PATH}")
    modulo = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = modulo
    spec.loader.exec_module(modulo)
    return modulo


GATE = _carregar_gate()


def cabecalhos_de_tabela(conteudo: str) -> List[List[str]]:
    """Cabecalhos normalizados de cada tabela markdown, na ordem do arquivo."""
    cabecalhos: List[List[str]] = []
    dentro_de_tabela = False

    for linha in conteudo.splitlines():
        if not linha.lstrip().startswith("|"):
            dentro_de_tabela = False
            continue

        celulas = GATE._celulas(linha)
        if GATE._e_separador(celulas):
            continue

        if not dentro_de_tabela:
            cabecalhos.append([GATE._normalizar(c) for c in celulas])
            dentro_de_tabela = True

    return cabecalhos


def tem_matriz_legivel(conteudo: str) -> bool:
    """True quando alguma tabela tem coluna `Status` -- o que o gate exige."""
    return any("status" in cabecalho for cabecalho in cabecalhos_de_tabela(conteudo))


@dataclass
class ResultadoLint:
    passou: bool
    mensagens: List[str] = field(default_factory=list)
    verificados: List[str] = field(default_factory=list)
    invalidos: List[str] = field(default_factory=list)


def verify_tocados(arquivos: Sequence[str]) -> List[str]:
    tocados = set()
    for caminho in arquivos:
        normalizado = caminho.replace("\\", "/").lstrip("./")
        if not normalizado.startswith(SPEC_ROOT):
            continue
        if normalizado.startswith(SPEC_TEMPLATES_PREFIX):
            continue
        if os.path.basename(normalizado) != VERIFY_FILE:
            continue
        tocados.add(normalizado)
    return sorted(tocados)


def avaliar(arquivos: Sequence[str], repo_root: str) -> ResultadoLint:
    verificados = verify_tocados(arquivos)
    if not verificados:
        return ResultadoLint(
            passou=True,
            mensagens=["Nenhum verify.md no diff: lint dispensado."],
        )

    invalidos: List[str] = []
    for caminho in verificados:
        absoluto = os.path.join(repo_root, caminho)
        if not os.path.isfile(absoluto):
            # Renomeado ou removido depois do diff: nao e assunto deste lint.
            continue
        with open(absoluto, encoding="utf-8") as stream:
            if not tem_matriz_legivel(stream.read()):
                invalidos.append(caminho)

    if not invalidos:
        return ResultadoLint(
            passou=True,
            mensagens=[f"{len(verificados)} verify.md no diff, todos com matriz legivel pelo gate."],
            verificados=verificados,
        )

    return ResultadoLint(
        passou=False,
        mensagens=[
            f"{len(invalidos)} verify.md sem tabela com coluna `Status`.",
            "O gate de promocao so le tabela com coluna `Status`: sem ela, criterio",
            "marcado `pendente` atravessa a promocao e o PR ainda diz que nada ficou aberto.",
            "Use o cabecalho do template (docs/specs/templates/verify.md):",
            "    | ID | Tipo | Evidencia | Status |",
            "    | --- | --- | --- | --- |",
            "    | CA-001 | aceitacao | <teste/print/log/link> | ok |",
        ],
        verificados=verificados,
        invalidos=invalidos,
    )


def _git_diff_changed_files(base_sha: str, head_sha: str) -> List[str]:
    saida = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMR", f"{base_sha}...{head_sha}"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return [linha.strip() for linha in saida.splitlines() if linha.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lint: verify.md tocado no PR precisa de matriz com coluna Status."
    )
    parser.add_argument("--base-sha", required=True, help="SHA base para diff.")
    parser.add_argument("--head-sha", required=True, help="SHA head para diff.")
    parser.add_argument("--repo-root", default=".", help="Raiz do repositorio (default: atual).")
    args = parser.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    os.chdir(repo_root)

    try:
        arquivos = _git_diff_changed_files(args.base_sha, args.head_sha)
    except Exception as exc:
        print(f"[verify-matrix] FAILED: {exc}")
        return 1

    resultado = avaliar(arquivos, repo_root)

    print(f"[verify-matrix] base={args.base_sha} head={args.head_sha}")
    if resultado.verificados:
        print(f"[verify-matrix] verify.md no diff: {', '.join(resultado.verificados)}")

    if resultado.invalidos:
        print("[verify-matrix] sem coluna `Status`:")
        for caminho in resultado.invalidos:
            print(f"  {caminho}")

    for mensagem in resultado.mensagens:
        print(f"[verify-matrix] {mensagem}")

    if resultado.passou:
        print("[verify-matrix] PASSED")
        return 0

    print("[verify-matrix] FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
