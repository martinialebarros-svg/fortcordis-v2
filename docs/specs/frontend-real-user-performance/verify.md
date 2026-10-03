# Verify - frontend-real-user-performance

Status: implementado e validado localmente; publicacao em stage pendente.

| Criterio | Evidencia | Estado |
| --- | --- | --- |
| CA-001 | `test_invalid_route_duration_and_content_order_are_rejected` rejeita rota, duracao, ordem e campos inesperados; `frontend-performance.test.ts` cobre a normalizacao fechada | ok_local |
| CA-002 | `test_migration_is_idempotent_and_creates_bounded_indexes` e `test_sample_persists_only_safe_fields_and_summary_percentiles` | ok_local |
| CA-003 | resumo testado com tres desfechos, p50/p95, maximo e contadores | ok_local |
| CA-004 | `FrontendPerformanceMonitor.test.tsx` cobre conclusao, timeout de 30 s antes/depois da troca de rota, cancelamento e classificacao de navegacao interna | ok_local |
| CA-005 | Dashboard, Atendimento, Laudos e Configuracoes usam `useRoutePerformanceReady`; suite frontend completa aprovada | ok_local |
| CA-006 | painel administrativo compilado no build de producao e consulta restrita a admin testada | ok_local |

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

## Pendente de release

- executar os controles remotos da esteira do PR;
- publicar primeiro em stage;
- confirmar migracao, `202` autenticado na coleta, `401` sem sessao, primeira
  amostra agregada e painel visivel antes de qualquer promocao.
