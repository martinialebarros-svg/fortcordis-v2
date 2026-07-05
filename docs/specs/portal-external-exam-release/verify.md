# Verify - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_atendimento_portal_exam_release.py::test_liberar_ecg_importado_normaliza_tipo_e_publica_exame` | ok |
| CA-002 | aceitacao | `backend/tests/test_atendimento_portal_exam_release.py::test_liberar_ecg_importado_normaliza_tipo_e_publica_exame` | ok |
| CA-003 | aceitacao | `backend/tests/test_atendimento_portal_exam_release.py::test_liberar_exame_sem_pdf_e_bloqueado` | ok |
| CA-004 | frontend | `frontend/app/atendimento/components/AtendimentoExamesSection.tsx` com acao e estado visual | ok |
| CA-005 | validacao | eslint/build frontend | ok |

## 2) Testes automatizados planejados

```bash
env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile \
  backend/app/api/v1/endpoints/atendimento.py \
  backend/tests/test_atendimento_portal_exam_release.py

cd backend && venv/bin/python -m unittest \
  tests/test_atendimento_portal_exam_release.py \
  tests/test_portal_access_foundation.py \
  tests/test_portal_access_http_flow.py -v

cd frontend && npx eslint \
  app/atendimento/page.tsx \
  app/atendimento/components/AtendimentoExamesSection.tsx \
  --max-warnings=0

cd frontend && npm run build

git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

Resultados executados:

- `env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/atendimento.py backend/tests/test_atendimento_portal_exam_release.py`: ok.
- `cd backend && venv/bin/python -m unittest tests/test_atendimento_portal_exam_release.py -v`: 2/2 pass.
- `cd backend && venv/bin/python -m unittest tests/test_atendimento_portal_exam_release.py tests/test_portal_access_foundation.py tests/test_portal_access_http_flow.py -v`: 13/13 pass.
- `cd frontend && npx eslint app/atendimento/page.tsx app/atendimento/components/AtendimentoExamesSection.tsx --max-warnings=0`: ok.
- `cd frontend && npm run build`: ok.
- `git diff --check`: ok.

## 3) Testes manuais sugeridos em stage

- Cenario 1: abrir atendimento com exame `ECG`, anexar PDF e clicar em `Liberar no portal`.
- Cenario 2: confirmar que o card muda para `Liberado no portal`.
- Cenario 3: entrar no portal da clinica e confirmar que o exame aparece como `Eletrocardiograma`.
- Cenario 4: tentar liberar exame sem PDF e confirmar bloqueio.

## 4) Riscos residuais

- Risco residual 1: a origem do arquivo continua sendo upload manual; integracao automatica com softwares externos fica fora do escopo.
- Risco residual 2: a retirada de um exame ja liberado ainda depende de fluxo futuro de revogacao.
