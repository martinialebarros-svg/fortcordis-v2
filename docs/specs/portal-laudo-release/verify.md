# Verify - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_cria_exame_publicado_no_portal` | ok |
| CA-002 | aceitacao | `backend/tests/test_laudo_portal_release.py::test_liberar_laudo_sem_clinica_e_bloqueado` | ok |
| CA-003 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_tutor_can_list_only_scoped_pet_exams` | ok |
| CA-004 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_session_filters_exam_list_and_generates_download_token` + `backend/tests/test_portal_clinic_invite_auth.py::test_invite_activation_autologin_refresh_and_exam_scope` + HTTP flow | ok |
| CA-005 | seguranca | `backend/app/api/v1/endpoints/portal.py::_assert_portal_exam_access` | ok |
| CA-006 | frontend | `frontend/app/laudos/page.tsx` com botao de liberacao e status local atualizado | ok |
| CA-007 | frontend | `frontend/app/laudos/[id]/page.tsx` com botao/estado `No portal` | ok |

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
  --max-warnings=0

cd frontend && npm run build

git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

Resultados executados:

- `python3 -m py_compile ...`: ok.
- `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py tests/test_portal_access_foundation.py -v`: 9/9 pass.
- `cd backend && venv/bin/python -m unittest tests/test_portal_clinic_invite_auth.py -v`: 4/4 pass.
- `cd backend && venv/bin/python - <<'PY' ... unittest discover('tests') ... PY`: 259/259 pass, com stub temporario de `app.services.cnpj_consulta` por exclusao local fora do escopo.
- `cd backend && venv/bin/python - <<'PY' ... tests.test_portal_access_http_flow ... PY`: 3/3 pass, com stub temporario de `app.services.cnpj_consulta` por exclusao local fora do escopo.
- `cd frontend && npx eslint app/laudos/page.tsx 'app/laudos/[id]/page.tsx' --max-warnings=0`: ok.
- `cd frontend && npm run build`: ok.
- `git diff --check`: ok.

## 3) Testes manuais sugeridos em stage

- Cenario 1: abrir um laudo finalizado com clinica vinculada e clicar em `Liberar portal`.
- Cenario 2: entrar no portal da clinica e confirmar que o exame passa a aparecer no painel da unidade.
- Cenario 3: tentar liberar laudo sem clinica e confirmar mensagem de bloqueio.
- Cenario 4: criar/concluir exame interno sem liberacao e confirmar que ele nao aparece para tutor nem clinica.

## 4) Riscos residuais

- Risco residual 1: neste ciclo, a publicacao sincroniza o registro de exame; o PDF persistido como anexo do portal ainda depende da etapa de storage definitivo.
- Risco residual 2: o status `Liberado no portal` usa o campo legado `status`; uma etapa futura deve separar status clinico e status de publicacao para permitir republicacao/retirada com mais granularidade.
