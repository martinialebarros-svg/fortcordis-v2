# Spec - stage-prod-environment-isolation

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Escopo

Documentar e validar o isolamento operacional entre `stage` e `prod`, cobrindo:
- matriz oficial de ambientes com organizacao, `project ref`, plano e raiz da VPS;
- reforco de refs e regras de deploy em runbooks existentes;
- script local/VPS para checar os refs a partir de `DATABASE_URL`;
- ajuste de dependencia para suportar timezone `America/Fortaleza` em ambientes que precisem de `tzdata`.

## 2) Requisitos funcionais (RF)

- RF-001: registrar em documentacao a matriz oficial de `stage` e `prod`.
- RF-002: explicitar em `docs/DEPLOY-STAGE.md` que o `stage` usa a org `Fortcordis Stage` e o ref `dtguubpzjrkvqjryazjq`.
- RF-003: explicitar em `docs/RUNBOOK-STAGE-PROD.md` os refs de `stage` e `prod`, com checklist rapido de verificacao.
- RF-004: criar `docs/ENVIRONMENT-SAFETY-CHECKLIST.md` como fonte de verdade de consulta operacional.
- RF-005: criar `scripts/check_environment_matrix.py` para validar os refs esperados de `prod` e `stage` a partir dos `.env` da VPS.
- RF-006: o script deve retornar codigo de erro quando `.env` estiver ausente, `DATABASE_URL` estiver faltando ou o `project ref` nao corresponder ao esperado.
- RF-007: registrar `tzdata>=2024.1` em `backend/requirements.txt` para compatibilidade com uso de timezone por `ZoneInfo`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: o script deve usar apenas biblioteca padrao do Python.
- NFR-002: as mensagens de saida devem ser legiveis e apontar claramente ambiente, host e ref esperado.
- NFR-003: o pacote documental deve ser suficiente para orientar deploy seguro sem depender de memoria operacional.
- NFR-004: a feature deve permanecer compatível com o guardrail SDD do repositório.

## 4) Criterios de aceitacao (CA)

- CA-001: a matriz oficial documenta `prod` com ref `wycxoueogfxdhyouhfhw` e `stage` com ref `dtguubpzjrkvqjryazjq`.
- CA-002: `docs/DEPLOY-STAGE.md` e `docs/RUNBOOK-STAGE-PROD.md` refletem os refs e organizacoes corretos.
- CA-003: `scripts/check_environment_matrix.py` compila localmente sem erro.
- CA-004: o script falha com codigo diferente de zero em caso de mismatch de `project ref`.
- CA-005: `backend/requirements.txt` inclui `tzdata>=2024.1`.
- CA-006: o diff desta rodada atende ao guardrail SDD do repositório.
