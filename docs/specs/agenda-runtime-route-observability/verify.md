# Verificação — PERF-21: observabilidade por subrota da Agenda

## Matriz de rastreabilidade

| ID | Evidência | Estado |
| --- | --- | --- |
| CA-001 | `test_http_latency_monitor_tracks_exact_agenda_reads_separately` cobre cinco leituras, detalhe e mutação | ok_local |
| CA-002 | `test_http_latency_monitor_tracks_query_count_and_application_time` cobre duas consultas e aplicação | ok_local |
| CA-003 | `test_migration_creates_idempotent_table_and_indexes` aplica `20260923_89` duas vezes e preserva índices | ok_local |
| CA-004 | `test_request_context_and_persisted_summary_keep_only_aggregate_fields` cobre agregação e privacidade | ok_local |
| CA-005 | ESLint, TypeScript e build de 43 páginas | ok_local |
| CA-006 | testes focados, suítes completas, `diff --check` e guardrail SDD | ok_local |
| CA-007 | janela autenticada de stage por rota/release `c758af1` | ok_stage |

## Linha de base da auditoria

- Stage, release anterior: 246 amostras agregadas, p95 `240,69 ms`, p99
  `547,46 ms`, uma leitura acima de `1.200 ms` e zero 5xx.
- Produção, release `997ef931`: 174 amostras agregadas, p50 `107,77 ms`, p95
  `467,87 ms`, p99 `3.750,4 ms`, máximo `6.184,18 ms`, cinco leituras acima de
  `1.200 ms` e zero 5xx.
- A matriz autenticada da lista principal teve p95 entre `471 ms` e `511 ms`
  para dia, semana, mês e nove meses, sem timeout.
- O prefixo agregado não permitia saber qual subrota originou a cauda.

## Validações locais

- Backend focado no snapshot reconciliado: 25 testes de observabilidade,
  persistência, runtime checks e pool, todos aprovados.
- Backend completo: `Ran 1413 tests ... OK (skipped=7)`.
- Pool de conexão: 4 testes aprovados.
- Frontend completo: 53 arquivos/409 testes Vitest e 9 testes Node aprovados.
  Uma primeira execução teve uma oscilação isolada em
  `NovoAgendamentoPedido.test.tsx`; o teste passou isoladamente e a repetição
  integral passou sem falhas.
- ESLint do painel, `tsc --noEmit`, build Next.js de 43 páginas e `compileall`
  do backend aprovados.
- `git diff --check` aprovado.
- Guardrail SDD executado sobre os 15 arquivos reais alterados: aprovado para
  `agenda-runtime-route-observability`,
  `financeiro-runtime-latency-observability` e
  `runtime-latency-persistence-performance`.
- Nenhuma migração, escrita operacional ou publicação foi executada em stage ou
  produção nesta fase.

## Validação de stage

- [x] Migração aplicada e release `c758af1` identificada no painel.
- [x] Cinco grupos da Agenda aparecem separadamente.
- [x] Rota principal com 127 amostras; `relacionados` e `resumo-financeiro` com
  104 amostras cada. `configuracao` e `stream` são rotas de baixa frequência e
  permaneceram abaixo de 100.
- [x] Zero 5xx; comparação de total, banco, aplicação, consultas e pool feita no
  painel. Não houve aviso de truncamento.
- [x] Nenhuma escrita clínica, financeira ou operacional durante o smoke.

### Resultado da release `c758af1`

- `/api/v1/agenda`: p95 `298,95 ms`, banco p95 `234,21 ms`, app p95
  `70,86 ms`, consultas p95 `10` e pool p95 `0,14 ms`.
- `/api/v1/agenda/relacionados`: p95 `83,58 ms`, consultas p95 `7`.
- `/api/v1/agenda/resumo-financeiro`: p95 `89,70 ms`, consultas p95 `7`.
- A evidência direciona a próxima otimização para a inspeção de schema ainda
  presente no caminho crítico da rota principal; o trabalho está especificado
  em `agenda-schema-preflight-performance`.
