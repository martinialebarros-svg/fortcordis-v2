# Verify - atendimento-catalogo-exames-customizados

Data: 2026-08-26
Status: validado localmente, aguardando publicacao

## Matriz de verificacao

| Criterio | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | Teste backend de criacao e serializacao customizada | ok |
| CA-002 | Teste backend de edicao + teste frontend de `upsertCatalogoExame` | ok |
| CA-003 | Teste backend de desativacao e limpeza de vinculos com paineis | ok |
| CA-004 | Testes backend protegem item padrao | ok |
| CA-005 | Teste backend rejeita duplicidade case-insensitive | ok |
| CA-006 | Testes, lint, TypeScript, build, `git diff --check` e SDD | ok |

## Evidencias executadas

```bash
cd backend && venv/bin/python -m unittest \
  tests.test_atendimento_custom_exam_catalog \
  tests.test_atendimento_custom_exam_panels
# 4 testes, OK

cd backend && venv/bin/python -m unittest \
  tests.test_atendimento_custom_exam_catalog \
  tests.test_atendimento_custom_exam_panels \
  tests.test_exam_catalog_service \
  tests.test_atendimento_sync_batching_nplus1 \
  tests.test_atendimento_exame_laudo_id_propriedade \
  tests.test_atendimento_exame_integridade
# 33 testes, OK

cd backend && venv/bin/python -m unittest discover -s tests -p 'test_*.py'
# 1140 testes, OK (2 skipped)

cd frontend && npx vitest run \
  lib/catalogo-exames.test.ts \
  lib/atendimento-form-merge.test.ts
# 17 testes, OK

cd frontend && npm test
# 126 testes Vitest + 9 testes Node, OK

cd frontend && npx eslint \
  app/atendimento/page.tsx \
  app/atendimento/components/AtendimentoExamesSection.tsx \
  app/atendimento/components/PainelExamesModal.tsx \
  lib/catalogo-exames.ts lib/catalogo-exames.test.ts \
  lib/atendimento-form-merge.ts lib/atendimento-form-merge.test.ts \
  --ext .ts,.tsx --max-warnings=0
# OK

cd frontend && npx tsc --noEmit
# OK

cd frontend && npm run build
# Compiled successfully; 43 paginas estaticas geradas

# Com `sdd_commit_sha` apontando para o commit sintetico da arvore de trabalho:
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha "$sdd_commit_sha"
# PASSED; as duas features SDD foram reconhecidas
```
