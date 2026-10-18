# Verify - logistica-agenda-google-cost-control

## Estado atual — incremento `cache_only`, 18/10/2026

Produção Maps autorizada com custo adicional zero. Implementação, testes locais focados e suítes integrais aprovados: backend 1.991/69 skips, frontend 980 Vitest/23 Node. Publicação, configuração efetiva e quotas permanecem **pendentes**. A verificação anterior abaixo não prova esse incremento. Exigir: cache Google válido/manual sem rede, miss/expirado/heurística, TTL não positivo e primeira saída sem timestamp/TTL bloqueados, zero transportes em API direta/jobs/concorrência, motivo visível, agenda atômica e preservação de `paid_budget`. Não preencher preços/FX/baseline artificiais.

Console autenticado de 1–18/10 mostrou 6.114 Routes Essentials e 21 Geocoding, ambos R$ 0; isso não comprova saldo livre. Quotas diárias Routes/Compute Route Matrix observadas ilimitadas e sem alteração aplicada. Evidência e checklist atualizado em `../google-maps-enforced-budget/verify.md`; produção e segunda barreira só serão marcadas concluídas após prova efetiva.

O estado `done` e a decisão de release abaixo referem-se exclusivamente ao ciclo de abril/maio.

Data: 2026-04-22  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | helper cacheado em `backend/app/api/v1/endpoints/agenda.py` aplicado nos loops de sugestao/validacao | ok |
| CA-002 | aceitacao | gate default `False` em `backend/app/core/config.py` e logica em `backend/app/services/logistica_service.py` | ok |
| CA-003 | aceitacao | teste `backend/tests/test_logistica_refresh_gate.py` cobre gate desligado/ligado | ok |
| CA-004 | aceitacao | `pytest` focado + suite backend executados com sucesso | ok |
| CA-005 | aceitacao | guardrail SDD executado no diff do commit | ok |
| CA-006 | aceitacao | `backend/app/api/v1/endpoints/logistica.py` expoe `/google-maps/custos-quotas` e resumo inclui `cost_and_quotas` | ok |
| CA-007 | aceitacao | default `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ=True` em `backend/app/core/config.py` | ok |
| CA-008 | aceitacao | `qpm_soft_limit_recommended` calculado com piso `1` e limite hard de Distance Matrix separado | ok |

## 2) Validacoes executadas

Comandos:

```bash
backend/venv/bin/python -m pytest -q backend/tests/test_logistica_cobertura_matriz.py backend/tests/test_logistica_refresh_gate.py backend/tests/test_agenda_deslocamento_cache.py backend/tests/test_agenda_resumo_financeiro.py
backend/venv/bin/python -m pytest -q backend/tests
backend/venv/bin/python -m pytest -q backend/tests/test_logistica_google_cost_controls.py backend/tests/test_logistica_google_cost_report.py backend/tests/test_logistica_refresh_gate.py
backend/venv/bin/python -m pytest -q backend/tests/test_logistica*.py
python3 scripts/ci/check_sdd_guardrail.py --base-sha <base> --head-sha <head>
```

Resumo:
- Testes focados: passaram.
- Suite backend: `109 passed`.
- Suite de logistica: `8 passed`.
- Guardrail SDD: aprovado para o diff desta entrega.

## 3) Riscos residuais

- Risco residual 1: sem cache cross-request, chamadas repetidas entre requisicoes independentes continuam possiveis (escopo atual e por requisicao).
- Risco residual 2: ativar gate de refresh pode elevar chamadas externas; requer decisao operacional.
- Risco residual 3: estimativas de custo dependem de modelo local por SKU e devem ser calibradas periodicamente com faturamento real.

## 4) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
# Ciclo de proteção financeira — 18/10/2026

Evidências e testes do bloqueio obrigatório estão em `../google-maps-enforced-budget/verify.md`. O relatório legado estima custos por janela e não constitui prova de limite, franquia disponível ou cobrança efetiva. Regressão adicionada para cache expirado com retorno Google idêntico, incluindo persistência e leitura por nova sessão.
