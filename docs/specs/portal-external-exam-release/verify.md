# Verify - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | frontend | `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-002 | backend | `POST /api/v1/laudos/eletrocardiograma/upload-pdf` | ok |
| CA-003 | frontend/backend | `baixarLaudoPdfOriginal` + `GET /api/v1/laudos/{laudo_id}/pdf-original` | ok |
| CA-004 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_eletrocardiograma_usa_pdf_externo_anexado` | ok |
| CA-005 | frontend | `frontend/app/atendimento/components/AtendimentoExamesSection.tsx` sem botao direto | ok |
| CA-006 | validacao | eslint/build/frontend + backend tests | ok |

## 2) Testes automatizados planejados

```bash
env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile \
  backend/app/api/v1/endpoints/atendimento.py \
  backend/app/api/v1/endpoints/laudos.py \
  backend/tests/test_atendimento_portal_exam_release.py \
  backend/tests/test_laudo_portal_release.py

cd backend && venv/bin/python -m unittest \
  tests/test_atendimento_portal_exam_release.py \
  tests/test_laudo_portal_release.py \
  tests/test_portal_access_foundation.py \
  tests/test_portal_access_http_flow.py -v

cd frontend && npx eslint \
  app/atendimento/page.tsx \
  app/atendimento/components/AtendimentoExamesSection.tsx \
  app/agenda/page.tsx \
  app/agenda/fullcalendar/page.tsx \
  app/laudos/page.tsx \
  app/laudos/[id]/page.tsx \
  app/laudos/eletrocardiograma/upload/page.tsx \
  --max-warnings=0

cd frontend && npm run build

git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

Resultados executados:

- `env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/laudos.py backend/tests/test_laudo_portal_release.py backend/app/api/v1/endpoints/atendimento.py backend/tests/test_atendimento_portal_exam_release.py`: ok.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py tests/test_atendimento_portal_exam_release.py tests/test_portal_access_foundation.py tests/test_portal_access_http_flow.py -v`: 17/17 pass.
- `cd frontend && npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx app/laudos/page.tsx app/laudos/[id]/page.tsx app/laudos/eletrocardiograma/upload/page.tsx app/atendimento/page.tsx app/atendimento/components/AtendimentoExamesSection.tsx --max-warnings=0`: ok.
- `cd frontend && npm run build`: ok.
- `git diff --check`: ok.

## 3) Testes manuais sugeridos em stage

- Cenario 1: abrir agenda, menu `Laudar`, selecionar `Eletrocardiograma`.
- Cenario 2: enviar PDF e confirmar criacao do laudo em `Laudos`.
- Cenario 3: baixar PDF em `Laudos` e confirmar que e o arquivo original enviado.
- Cenario 4: clicar em `Liberar portal` no laudo de eletrocardiograma.
- Cenario 5: entrar no portal da clinica e confirmar que o exame aparece como `Eletrocardiograma`.

## 4) Riscos residuais

- Risco residual 1: a origem do arquivo continua sendo upload manual; integracao automatica com softwares externos fica fora do escopo.
- Risco residual 2: a retirada de um exame ja liberado ainda depende de fluxo futuro de revogacao.
