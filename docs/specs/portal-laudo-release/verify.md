# Verify - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_cria_exame_publicado_no_portal` | ok |
| CA-002 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_sem_clinica_e_bloqueado` | ok |
| CA-003 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_cria_exame_publicado_no_portal` verifica `AnexoAtendimento` PDF | ok |
| CA-004 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_reusa_anexo_pdf_existente` | ok |
| CA-005 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_tutor_can_list_only_scoped_pet_exams` | ok |
| CA-006 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_session_filters_exam_list_and_generates_download_token` + `backend/tests/test_portal_clinic_invite_auth.py::test_invite_activation_autologin_refresh_and_exam_scope` + HTTP flow | ok |
| CA-007 | seguranca | `backend/app/api/v1/endpoints/portal.py::_assert_portal_exam_access` | ok |
| CA-008 | frontend | `frontend/app/laudos/page.tsx` com botao de liberacao e status local atualizado | ok |
| CA-009 | frontend | `frontend/app/laudos/[id]/page.tsx` com botao/estado `No portal` | ok |
| CA-010 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_date_filter_uses_exam_execution_date_not_release_date` | ok |
| CA-011 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_date_filter_uses_exam_execution_date_not_release_date` | ok |
| CA-012 | frontend | `frontend/components/portal/PortalClinicaWorkspace.tsx::handleStartDateChange` + eslint focado | ok |
| CA-013 | frontend | `frontend/components/portal/PortalClinicaWorkspace.tsx` e `frontend/components/portal/PortalExamResults.tsx` rotulam datas explicitamente + eslint focado | ok |
| CA-014 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_envia_email_para_conta_ativa_da_clinica` | ok |
| CA-015 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_atualizar_laudo_liberado_atualiza_pdf_publicado_no_portal` | ok |

## 2) Testes automatizados planejados

```bash
python3 -m py_compile \
  backend/app/core/portal_release.py \
  backend/app/api/v1/endpoints/laudos.py \
  backend/app/api/v1/endpoints/portal.py \
  backend/tests/test_laudo_portal_release.py \
  backend/tests/test_portal_access_foundation.py \
  backend/tests/test_portal_access_http_flow.py

cd backend && venv/bin/python -m unittest \
  tests/test_laudo_portal_release.py \
  tests/test_portal_clinic_invite_auth.py \
  tests/test_portal_access_foundation.py \
  tests/test_portal_access_http_flow.py -v

cd frontend && npx eslint \
  app/laudos/page.tsx \
  'app/laudos/[id]/page.tsx' \
  components/portal/PortalClinicaWorkspace.tsx \
  components/portal/PortalExamResults.tsx \
  lib/portal-api.ts \
  --max-warnings=0

cd frontend && npm run build

git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

Resultados executados:

- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py tests/test_portal_access_foundation.py -v`: 16/16 pass.
- `cd frontend && npx eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts app/laudos/page.tsx 'app/laudos/[id]/page.tsx' --max-warnings=0`: ok.
- `env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/laudos.py backend/tests/test_laudo_portal_release.py`: ok.
- `env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/portal.py backend/app/schemas/portal.py backend/tests/test_portal_access_foundation.py backend/tests/test_portal_clinic_invite_auth.py`: ok.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py -v`: 3/3 pass.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py tests/test_portal_access_foundation.py -v`: 10/10 pass.
- `cd backend && venv/bin/python -m unittest tests/test_portal_access_foundation.py tests/test_portal_clinic_invite_auth.py -v`: 12/12 pass.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py tests/test_portal_access_foundation.py tests/test_portal_clinic_invite_auth.py tests/test_portal_access_http_flow.py -v`: 18/18 pass.
- `cd backend && venv/bin/python -m unittest tests/test_portal_clinic_invite_auth.py -v`: 4/4 pass.
- `cd backend && venv/bin/python - <<'PY' ... unittest discover('tests') ... PY`: 260/260 pass, com stub temporario de `app.services.cnpj_consulta` por exclusao local fora do escopo.
- `cd backend && venv/bin/python - <<'PY' ... tests.test_portal_access_http_flow ... PY`: 3/3 pass, com stub temporario de `app.services.cnpj_consulta` por exclusao local fora do escopo.
- `env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/laudos.py backend/tests/test_laudo_portal_release.py`: ok.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py -v`: 8/8 pass.
- `cd frontend && npx eslint app/laudos/page.tsx 'app/laudos/[id]/page.tsx' --max-warnings=0`: ok.
- `cd frontend && npx eslint components/portal/PortalClinicaWorkspace.tsx components/portal/PortalExamResults.tsx lib/portal-api.ts --max-warnings=0`: ok.
- `cd frontend && npx eslint components/portal/PortalClinicaWorkspace.tsx components/portal/PortalExamResults.tsx --max-warnings=0`: ok.
- `cd frontend && npm run build`: ok.
- `git diff --check`: ok.

## 3) Testes manuais sugeridos em stage

- Cenario 1: abrir um laudo finalizado com clinica vinculada e clicar em `Liberar portal`.
- Cenario 2: entrar no portal da clinica e confirmar que o exame passa a aparecer no painel da unidade.
- Cenario 3: tentar liberar laudo sem clinica e confirmar mensagem de bloqueio.
- Cenario 4: criar/concluir exame interno sem liberacao e confirmar que ele nao aparece para tutor nem clinica.

## 4) Riscos residuais

- Risco residual 1: o anexo PDF fica no filesystem configurado por `UPLOAD_DIR`; upload para object storage externo permanece fora do escopo desta iteracao.
- Risco residual 2: quando o laudo nao tem atendimento clinico vinculado, o anexo usa `atendimento_id=0` como escopo tecnico legado e o portal autoriza por `exame_id`/`laudo_id`.
- Risco residual 3: o status `Liberado no portal` usa o campo legado `status`; uma etapa futura deve separar status clinico e status de publicacao para permitir republicacao/retirada com mais granularidade.
