# Verify - financeiro-multi-forma-pagamento-credito

Data: 2026-05-25  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `PATCH /ordens-servico/{id}/receber` aceita `pagamentos[]` e UI com linhas multiplas nas telas de agenda e financeiro | ok |
| CA-002 | aceitacao | campos `taxa_percentual`, `taxa_fixa`, `valor_taxa` em `transacoes` + resumo de taxa por linha nos modais | ok |
| CA-003 | aceitacao | criacao de `creditos_financeiros` no excedente de recebimento com destino selecionado | ok |
| CA-004 | aceitacao | `desfazer-recebimento` cancela todas transacoes do marker e creditos ativos vinculados | ok |
| CA-005 | aceitacao | fluxo multipagamento presente em `agenda/page.tsx` e `agenda/fullcalendar/page.tsx` | ok |
| CA-006 | aceitacao | `resumo` e `relatorios/controle` expõem `taxas_pagamento` e `creditos_gerados` | ok |
| CA-007 | aceitacao | endpoints de cadastro usam `_require_admin` para mutacoes | ok |
| CA-008 | aceitacao | `PATCH /ordens-servico/{id}/receber` aceita `desconto` e recalcula cobertura no backend; modais da agenda exibem campo de desconto | ok |
| CA-009 | aceitacao | tela financeiro permite editar `taxa_percentual` e `taxa_fixa` por forma de pagamento via `PUT /financeiro/formas-pagamento/{id}` | ok |
| CA-010 | aceitacao | modal individual do Financeiro usa viewport limitada, formulario com rolagem propria e rodape fixo para manter `Confirmar Recebimento` acessivel com 2+ pagamentos | ok |
| NFR-001 | nao funcional | cancelamento em lote no desfazer recebimento | ok |
| NFR-002 | nao funcional | guardrail admin em `financeiro.py` para cadastro | ok |
| NFR-003 | nao funcional | retorno de recebimento com totais bruto/taxa/liquido/excedente | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# Backend (sintaxe + ciclo de migracao)
cd backend
python3 -m py_compile app/api/v1/endpoints/ordens_servico.py \
  app/api/v1/endpoints/financeiro.py \
  app/api/v1/endpoints/relatorios.py \
  app/models/financeiro.py \
  app/schemas/financeiro.py \
  migrations/versions/20260525_41_financeiro_multiplos_pagamentos_credito.py

cd backend
source venv/bin/activate
pytest -q tests/test_migration_ci_cycle.py

# Frontend
cd frontend && npm run lint
cd frontend && npm run build
```

Resumo:
- `py_compile`: ok.
- `pytest tests/test_migration_ci_cycle.py`: ok (1 passed) no ambiente com `venv` ativado.
- `npm run lint`: ok.
- `npm run build`: ok.
- `npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx app/financeiro/page.tsx`: ok (validacao focada nos arquivos alterados em 2026-05-29).
- `python -m compileall app/api/v1/endpoints/ordens_servico.py`: ok.

Observacao:
- Tentativa de `pytest` sem `venv` ativado falhou por dependencia ausente (`pydantic_settings`), resolvida ao executar com ambiente virtual do backend.

## 3) Smoke manual recomendado (stage/local)

- Cenario A: receber OS com 2 formas de pagamento (ex.: pix + cartao credito com taxa).
- Cenario B: receber OS com valor bruto maior que valor da OS e gerar credito para cliente.
- Cenario C: repetir Cenario B com destino clinica.
- Cenario D: desfazer recebimento e validar cancelamento de transacoes + credito.
- Cenario E: validar relatorio controle (CSV/PDF) com campos de taxa e credito no periodo.
- Cenario F: validar comportamento identico no modal da Agenda Lista e FullCalendar.
- Cenario G: no modal de recebimento da agenda, aplicar desconto e confirmar que o total a cobrir passa a ser o valor liquido da OS.
- Cenario H: no Financeiro > cadastro de meios, editar taxa percentual/fixa e validar reflexo na "taxa estimada" em novo recebimento.
- Cenario I: no Financeiro, abrir o recebimento individual de uma OS, adicionar 2+ formas de pagamento e confirmar que o formulario rola sem ocultar `Cancelar` e `Confirmar Recebimento`.

## 4) Riscos residuais

- Risco 1: cadastro rapido no front financeiro usa prompts para entrada de dados; pode exigir refinamento UX posterior.
- Risco 2: consumo de credito em OS futura ainda nao implementado (fora de escopo atual).

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
