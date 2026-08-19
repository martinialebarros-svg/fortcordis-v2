# Verify - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19
Status: validado localmente, aguardando publicacao

## Matriz de verificacao

| Criterio | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | Teste `reconcileExamRemovalsDuringSave` preserva `_destroy` com o id retornado, inclusive apos o merge da resposta | ok |
| CA-002 | Guarda sincrona de catalogo no frontend impede segundo clique antes da proxima renderizacao | inspecao de codigo: ok |
| CA-003 | Teste backend de `id` inexistente confirma contagem zero | ok |
| CA-004 | Vitest direcionado, unittest direcionado, typecheck, lint direcionado e build | ok |

## Revisao de compatibilidade

O primeiro envio para stage revelou que o backend deve continuar aceitando repeticoes deliberadas de um mesmo exame de catalogo (cobertura de painel e desempenho). A idempotencia por catalogo foi removida antes da publicacao; a prevencao de clique duplo permanece no frontend e o backend conserva somente a protecao contra replay atrasado de `id` inexistente. A regressao foi coberta junto do teste de batching existente.

## Evidencias executadas

```bash
cd backend && venv/bin/python -m unittest tests.test_atendimento_exame_integridade tests.test_atendimento_sync_batching_nplus1
# 21 testes, OK

cd frontend && npx vitest run lib/atendimento-form-merge.test.ts
# 6 testes, OK

cd frontend && npx tsc --noEmit
# OK

cd frontend && npx eslint app/atendimento/page.tsx lib/atendimento-form-merge.ts lib/atendimento-form-merge.test.ts --ext .ts,.tsx --max-warnings=0
# OK

cd frontend && npm run build
# Compiled successfully; 43 paginas estaticas geradas
```
