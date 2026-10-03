# Verify - frontend-real-user-performance

Status: implementado, validado localmente e comprovado em stage; producao pendente.

| Criterio | Evidencia | Estado |
| --- | --- | --- |
| CA-001 | `test_invalid_route_duration_and_content_order_are_rejected` rejeita rota, duracao, ordem e campos inesperados; `frontend-performance.test.ts` cobre a normalizacao fechada | ok_stage |
| CA-002 | `test_migration_is_idempotent_and_creates_bounded_indexes`, persistencia testada e amostras agregadas visiveis em stage | ok_stage |
| CA-003 | painel de stage exibiu p50/p95/p99, maximo e contadores separados por pagina, navegacao e release | ok_stage |
| CA-004 | `FrontendPerformanceMonitor.test.tsx` cobre conclusao, timeout de 30 s antes/depois da troca de rota, cancelamento e classificacao de navegacao interna | ok_stage |
| CA-005 | navegacao autenticada em stage gerou amostras para Dashboard, Atendimento, Laudos e Configuracoes no release `87df427b` | ok_stage |
| CA-006 | painel administrativo visivel apenas na sessao autenticada; GET administrativo sem sessao retornou `401` | ok_stage |

## Validacoes executadas

- Backend focado: 7 testes aprovados para contrato, persistencia, agregacao e
  autorizacao administrativa do PERF-23.
- Backend completo: 1.485 testes aprovados e 7 ignorados, sem falha; o ciclo
  global de migracoes `up/down/up` tambem foi aprovado.
- Frontend: 65 arquivos/469 testes Vitest e 9 testes Node aprovados.
- ESLint sem avisos, TypeScript aprovado e build Next.js de producao aprovado
  para 43 paginas estaticas.
- `git diff --check` aprovado.
- Guardrail SDD local aprovado com 19 arquivos de codigo e a feature qualificada
  `frontend-real-user-performance`.

## Validacao em stage

- PR #289 integrado em `stage` pelo merge commit `204a0d2f`; o snapshot final
  servido foi `87df427b`, que contem o PERF-23 e a alteracao paralela do PR #288.
- Workflow `Deploy to Stage (VPS)` #37089840048 concluido com sucesso: quality
  gate, SDD guardrail e deploy aprovados.
- `https://app.stage.fortcordis.com.br/` e `/configuracoes` responderam `200`
  por HTTP/2; `https://stage.fortcordis.com.br/` respondeu `200` por HTTP/2.
- O alias `www.stage.fortcordis.com.br` nao resolveu no DNS. A falha e
  independente do dominio canonico e foi mantida como lacuna de infraestrutura.
- As 15 referencias JavaScript de `/configuracoes` responderam sem falha. O
  chunk da pagina conteve `Tempo percebido no navegador`; o chunk compartilhado
  conteve a coleta `/observability/frontend-performance` e o chunk da pagina
  conteve a consulta `/admin/observability/frontend-performance`.
- Sem sessao, o POST de coleta e o GET administrativo retornaram `401`.
- Com sessao administrativa existente, o painel exibiu amostras persistidas e
  agregadas no release `87df427b`: `/dashboard` (interna: 444,5 ms), `/laudos`
  (interna: 643,4 ms), `/atendimento` (interna: 3.515,6 ms) e
  `/configuracoes` (interna: 2.361,1 ms). Todos os quatro grupos tinham uma
  amostra e zero erro, timeout ou cancelamento; Atendimento teve uma amostra
  acima de 3.000 ms.
- A primeira entrada direta em `/configuracoes` registrou 27.780,9 ms. Como ha
  apenas uma amostra por grupo e essa entrada ocorreu durante o smoke, os dois
  valores de cauda sao baseline de observacao, nao evidencia de regressao.

## Proxima etapa

- acumular amostra natural em stage antes de decidir promocao;
- investigar primeiro a cauda de `/atendimento` caso ela se repita;
- corrigir o DNS de `www.stage.fortcordis.com.br` em fluxo de infraestrutura
  separado, sem bloquear o dominio canonico.
