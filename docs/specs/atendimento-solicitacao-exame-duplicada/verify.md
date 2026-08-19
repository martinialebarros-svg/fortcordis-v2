# Verify - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19
Status: validado localmente, aguardando publicacao

## Matriz de verificacao

| Criterio | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | Teste `reconcileExamRemovalsDuringSave` preserva `_destroy` com o id retornado, inclusive apos o merge da resposta | ok |
| CA-002 | Teste backend de retry do mesmo catalogo conta um unico `Exame` | ok |
| CA-003 | Teste backend de `id` inexistente confirma contagem zero | ok |
| CA-004 | Vitest direcionado, unittest direcionado, typecheck, lint direcionado e build | ok |

## Evidencias executadas

```bash
cd backend && venv/bin/python -m unittest tests.test_atendimento_exame_integridade
# 18 testes, OK

cd frontend && npx vitest run lib/atendimento-form-merge.test.ts
# 6 testes, OK

cd frontend && npx tsc --noEmit
# OK

cd frontend && npx eslint app/atendimento/page.tsx lib/atendimento-form-merge.ts lib/atendimento-form-merge.test.ts --ext .ts,.tsx --max-warnings=0
# OK

cd frontend && npm run build
# Compiled successfully; 43 paginas estaticas geradas
```
