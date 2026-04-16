# Plan - stage-prod-environment-isolation

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (mapeamento): consolidar a matriz oficial de ambientes e refs.
- Fase 2 (documentacao): atualizar runbooks e checklists de deploy/operacao.
- Fase 3 (validacao): adicionar script para checar `.env` da VPS.
- Fase 4 (compatibilidade): registrar dependencia necessaria para timezone em ambientes locais.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar os refs oficiais de `prod` e `stage`.
- [x] T1.2 Confirmar os caminhos esperados na VPS para cada ambiente.
- Criterio de conclusao: matriz oficial registrada em documentacao dedicada.
- Risco: baixo.
- Rollback: remover apenas o material documental novo.

### Fase 2

- [x] T2.1 Atualizar `docs/DEPLOY-STAGE.md` com a organizacao e `project ref` corretos do stage.
- [x] T2.2 Atualizar `docs/RUNBOOK-STAGE-PROD.md` com a matriz `stage/prod` e checklist operacional.
- [x] T2.3 Adicionar checklist de seguranca para consulta rapida antes de acoes sensiveis.
- Criterio de conclusao: runbooks coerentes entre si e com a matriz oficial.
- Risco: divergencia futura se os ambientes mudarem sem atualizar docs.
- Rollback: reverter o commit documental.

### Fase 3

- [x] T3.1 Criar `scripts/check_environment_matrix.py`.
- [x] T3.2 Validar extracao de `project ref` a partir de `DATABASE_URL`.
- [x] T3.3 Fazer o script falhar quando `.env` nao existir ou quando o ref estiver incorreto.
- Criterio de conclusao: script compila e produz status deterministico.
- Risco: paths absolutos da VPS mudarem sem revisao do script.
- Rollback: remover o script e voltar ao checklist manual.

### Fase 4

- [x] T4.1 Registrar `tzdata>=2024.1` em `backend/requirements.txt`.
- [x] T4.2 Vincular a dependencia ao uso de `ZoneInfo("America/Fortaleza")` no backend.
- [x] T4.3 Validar rapidamente a consistencia do pacote com o guardrail SDD.
- Criterio de conclusao: dependencia documentada e validacao SDD destravada.
- Risco: futuros ambientes dependerem de outra estrategia de timezone.
- Rollback: reverter o ajuste de dependencia se a stack mudar.

## 3) Plano de testes

- Testes unitarios: nao aplicavel neste ciclo.
- Testes de integracao: `python -m py_compile scripts/check_environment_matrix.py`.
- Testes operacionais: executar `python3 scripts/check_environment_matrix.py` na VPS antes de deploy sensivel.
- Testes de processo: validar localmente o `scripts/ci/check_sdd_guardrail.py` no diff desta feature.

## 4) Dependencias e bloqueios

- Dependencia 1: acesso aos paths padrao da VPS nos runbooks.
- Dependencia 2: `DATABASE_URL` presente nos `.env` dos ambientes.
- Dependencia 3: refs oficiais de `stage` e `prod` permanecerem vigentes.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Runbooks alvo identificados.
- [x] Valores oficiais de `project ref` confirmados.
