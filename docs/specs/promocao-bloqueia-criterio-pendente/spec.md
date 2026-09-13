# Spec - promocao-bloqueia-criterio-pendente

Data: 2026-09-13
Responsavel: Martiniano
Status: done

## 1) Objetivo

Reprovar PR de promocao `stage -> main` que leve feature com criterio de
aceitacao ainda pendente no `verify.md`, com escape hatch explicito por label.

## 2) Requisitos funcionais (RF)

- RF-001: o gate roda apenas em `pull_request` que mira `main`.
- RF-002: o gate considera apenas as features com arquivos em
  `docs/specs/<slug>/` tocados no diff da promocao.
- RF-003: `docs/specs/templates/` e ignorado (placeholders nao sao criterios).
- RF-004: o gate le apenas tabelas markdown que tenham coluna `Status`; o
  `verify.md` costuma trazer tambem tabelas de etapas e de respostas.
- RF-005: marcadores fortes (`pendente`, `pendencia`, `stage_pending`,
  `reprovado`, `falhou`) valem em qualquer posicao da celula de status.
- RF-006: marcadores genericos (`parcial`, `bloqueado`, `sem resposta`,
  `nao testado`, `depois`, ...) valem apenas no inicio da celula.
- RF-007: a label `promocao-com-pendencia` no PR libera a promocao, e o log
  segue listando as pendencias liberadas.
- RF-008: a saida nomeia arquivo, identificador do criterio e status.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: zero falso positivo sobre o corpus atual de `verify.md` do repo.
- NFR-002: o gate nao depende de rede nem de credencial.

## 4) Criterios de aceitacao (CA)

- CA-001: a promocao PR #117 (`9da6868e` -> `adf346ea`), se submetida ao gate,
  reprova apontando `RF-002, RF-003 / CA-002` de
  `receita-emitida-em-fuso-operacional`.
- CA-002: na mesma promocao, `atendimento-continuidade-pos-alta` nao e apontada.
- CA-003: um `ok ... indice unico parcial de idempotency_key` nao e tratado
  como pendencia.
- CA-004: `aprovado em stage; producao pendente` e tratado como pendencia.
- CA-005: o vocabulario de aprovacao do repo (`ok`, `passou`, `aprovado`,
  `local_pass`, `concluido`, `pronto`, `passed`) nao e tratado como pendencia.
- CA-006: com `--allow-pending`, a mesma promocao passa e ainda lista o CA-002.
- CA-007: diff sem `docs/specs/` dispensa o gate.
