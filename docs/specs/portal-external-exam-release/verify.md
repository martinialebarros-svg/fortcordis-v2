# Verify - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | frontend | `frontend/app/agenda/page.tsx`, `frontend/app/agenda/fullcalendar/page.tsx` e `frontend/app/laudos/page.tsx` | ok |
| CA-002 | backend | `POST /api/v1/laudos/eletrocardiograma/upload-pdf` | ok |
| CA-003 | frontend/backend | `baixarLaudoPdfOriginal` + `GET /api/v1/laudos/{laudo_id}/pdf-original` | ok |
| CA-004 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_eletrocardiograma_usa_pdf_externo_anexado` | ok |
| CA-005 | frontend | `frontend/app/atendimento/components/AtendimentoExamesSection.tsx` sem botao direto | ok |
| CA-006 | frontend/backend | `frontend/app/laudos/[id]/page.tsx` + `PUT /api/v1/laudos/{laudo_id}/eletrocardiograma/pdf` | ok |
| CA-007 | backend | `backend/tests/test_laudo_portal_release.py::test_substituir_pdf_eletrocardiograma_liberado_atualiza_portal` | ok |
| CA-008 | validacao | eslint/build/frontend + backend tests | ok |
| CA-009 | frontend | `frontend/app/laudos/eletrocardiograma/upload/page.tsx` com seletor manual de clinica no modo sem agendamento | ok |
| CA-010 | frontend | `frontend/app/laudos/eletrocardiograma/upload/page.tsx` com busca de paciente por pet/tutor no modo sem agendamento | ok |
| CA-011 | frontend | `frontend/app/laudos/eletrocardiograma/upload/page.tsx` com cadastro rapido de tutor e pet no mesmo fluxo | ok |
| CA-012 | frontend | `frontend/app/laudos/eletrocardiograma/upload/page.tsx` criando paciente via `/pacientes` antes do upload | ok |
| CA-013 | frontend | `frontend/app/laudos/page.tsx` + `frontend/app/globals.css` com menu visivel fora do cabeçalho | ok |

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
- `env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/laudos.py backend/tests/test_laudo_portal_release.py`: ok.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py -v`: 6/6 pass.
- `cd frontend && npx eslint app/laudos/[id]/page.tsx --max-warnings=0`: ok.
- `cd frontend && npx eslint app/laudos/eletrocardiograma/upload/page.tsx --max-warnings=0`: ok.
- `cd frontend && npm run build`: ok.
- `git diff --check`: ok.

## 3) Testes manuais sugeridos em stage

- Cenario 1: abrir agenda, menu `Laudar`, selecionar `Eletrocardiograma`.
- Cenario 1A: abrir `Laudos`, clicar em `Novo Laudo` e confirmar a opcao `Upload de eletrocardiograma`.
- Cenario 1B: confirmar que o menu `Novo Laudo` abre por completo, sem ficar escondido pelo cabeçalho da Central de laudos.
- Cenario 2: enviar PDF e confirmar criacao do laudo em `Laudos`.
- Cenario 3: baixar PDF em `Laudos` e confirmar que e o arquivo original enviado.
- Cenario 4: clicar em `Liberar portal` no laudo de eletrocardiograma.
- Cenario 5: entrar no portal da clinica e confirmar que o exame aparece como `Eletrocardiograma`.
- Cenario 6: abrir o laudo de eletrocardiograma, selecionar outro PDF e clicar em `Trocar PDF`.
- Cenario 7: repetir a troca depois de o laudo ja estar liberado no portal e confirmar que o download da clinica passou a servir o arquivo novo.
- Cenario 8: abrir `/laudos/eletrocardiograma/upload` sem `agendamento_id`, selecionar clinica, buscar paciente existente e concluir upload.
- Cenario 9: repetir o fluxo sem `agendamento_id`, usar `Cadastrar tutor e pet`, salvar o cadastro no mesmo envio e confirmar que o laudo foi criado com `paciente_id` preenchido.

## 4) Riscos residuais

- Risco residual 1: a origem do arquivo continua sendo upload manual; integracao automatica com softwares externos fica fora do escopo.
- Risco residual 2: a retirada de um exame ja liberado ainda depende de fluxo futuro de revogacao.
