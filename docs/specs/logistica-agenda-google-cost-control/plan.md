# Plan - logistica-agenda-google-cost-control

## Incremento — provas locais e publicação pendente com zero novos envios (18/10/2026)

- [x] Integrar `cache_only` aos leitores/materializadores de rota e aos três transportes Google, sem depender das flags legadas ou da presença de chave.
- [x] Reutilizar somente cache Google válido/override manual autorizado; bloquear miss, expiração, heurística, TTL não positivo e primeira saída sem timestamp/TTL confiável.
- [x] Provar via testes sintéticos que cache permitido não gera popup de custo nem rede; falha não inventa disponibilidade nem confirma parcialmente a agenda.
- [x] Provar localmente acesso direto, jobs, concorrência, reconexão e troca de modo com zero envios; preservar regressões de `paid_budget`.
- [ ] Validar stage e promover somente Maps pelo fluxo protegido, isolando a revisão clínica felina e restaurando-a em stage após a publicação.

Os checks acima representam provas locais; suítes integrais aprovadas, etapa instalada pendente. O plano e os checks concluídos abaixo pertencem aos ciclos anteriores; não representam validação do novo modo. Detalhes em `../google-maps-enforced-budget/plan.md` e `verify.md`.

Data: 2026-04-22  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (mapeamento): localizar chamadas repetidas de deslocamento em agenda e refresh heuristico em logistica.
- Fase 2 (implementacao): adicionar cache de lookup por requisicao e gate por settings.
- Fase 3 (validacao): rodar testes focados e suite backend.
- Fase 4 (release): validar guardrail SDD e publicar em `stage`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Mapear `obter_duracao_deslocamento` nos loops de agenda.
- [x] T1.2 Revisar `_deslocamento_esta_atual` na logistica.

### Fase 2

- [x] T2.1 Criar helper cacheado para lookup de duracao na agenda.
- [x] T2.2 Aplicar cache em `sugestoes-horario`, `sugestao-proximidade` e validacao de deslocamento.
- [x] T2.3 Adicionar setting para controlar refresh de heuristica com API key.
- [x] T2.4 Preservar endpoint `/logistica/cobertura-matriz`.

### Fase 3

- [x] T3.1 Adicionar testes de gate em logistica.
- [x] T3.2 Adicionar testes de cache na agenda.
- [x] T3.3 Executar `pytest` focado e `pytest backend/tests`.

### Fase 4

- [x] T4.1 Validar guardrail SDD no diff.
- [x] T4.2 Preparar commit limpo para stage.

## 3) Plano de testes

- `backend/venv/bin/python -m pytest -q backend/tests/test_logistica_cobertura_matriz.py backend/tests/test_logistica_refresh_gate.py backend/tests/test_agenda_deslocamento_cache.py backend/tests/test_agenda_resumo_financeiro.py`
- `backend/venv/bin/python -m pytest -q backend/tests`
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha <base> --head-sha <head>`

## 4) Atualizacao 2026-05-31

- [x] Ajustar default de `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ` para `True` (rollout seguro, sem degradar precisao por padrao).
- [x] Incluir endpoint de leitura dedicado `/api/v1/logistica/google-maps/custos-quotas`.
- [x] Incluir `cost_and_quotas` no resumo `/api/v1/logistica/google-maps/resumo`.
- [x] Corrigir recomendacao de `qpm_soft_limit_recommended` para refletir volume real baixo (piso `1`).
- [x] Separar limite hard de Distance Matrix (`DISTANCE_MATRIX_EPM_HARD_LIMIT=60000`) do limite de Routes.
- [x] Cobrir ajustes com testes automatizados de custo/controle de trafego.
