# Verify - portal-secure-access-foundation

Data: 2026-06-17
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_tutor_challenge_and_code_verification_issue_scoped_token` | ok |
| CA-002 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_invalid_tutor_request_keeps_generic_response_without_creating_challenge` | ok |
| CA-003 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_tutor_challenge_and_code_verification_issue_scoped_token` + asserts de dispatch em `send_portal_access_code` | ok |
| CA-004 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_invalid_code_locks_challenge_when_attempt_limit_is_reached` | ok |
| CA-005 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_tutor_can_list_only_scoped_pet_exams` | ok |
| CA-006 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_session_filters_exam_list_and_generates_download_token` | ok |
| CA-007 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_session_filters_exam_list_and_generates_download_token` + `backend/tests/test_portal_access_http_flow.py::test_tutor_http_flow_downloads_remote_attachment_url` | ok |
| CA-008 | aceitacao | `cd backend && venv/bin/python -m unittest tests/test_portal_delivery_service.py tests/test_portal_access_foundation.py tests/test_portal_access_http_flow.py tests/test_migration_ci_cycle.py -v` | ok |
| CA-001..CA-007 | aceitacao | `backend/tests/test_portal_access_http_flow.py` cobrindo HTTP real para tutor e clinica, incluindo download de anexo local e remoto | ok |
| RF-003b | funcional | `backend/tests/test_portal_access_foundation.py::test_whatsapp_tutor_request_is_disabled_by_default` + `backend/tests/test_portal_delivery_service.py::test_whatsapp_delivery_requires_feature_flag` | ok |
| NFR-001 | nao funcional | `backend/app/core/portal_security.py` com `aud` separado para sessao e download | ok |
| NFR-002 | nao funcional | respostas genericas em `POST /portal/tutores/sessao-link` e `POST /portal/clinicas/sessao-link` | ok |
| NFR-003 | nao funcional | rejeicao de token via query string em `backend/app/core/portal_security.py` | ok |
| NFR-004 | nao funcional | hooks `registrar_auditoria(...)` nos fluxos de desafio, verificacao e download | ok |
| NFR-005 | nao funcional | suite `backend/tests/test_migration_ci_cycle.py` e separacao em `/api/v1/portal` sem mexer no login interno | ok |
| NFR-006 | nao funcional | `backend/app/services/attachment_download_service.py` + `backend/tests/test_portal_access_http_flow.py::test_tutor_http_flow_downloads_remote_attachment_url` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
venv/bin/python -m unittest tests/test_portal_delivery_service.py tests/test_portal_access_foundation.py tests/test_portal_access_http_flow.py tests/test_migration_ci_cycle.py -v
venv/bin/python -m unittest tests/test_atendimento_upload_endpoint.py -v
```

Resumo dos resultados:
- Backend:
  - `test_portal_delivery_service`: 3/3 pass
  - `test_portal_access_foundation`: 7/7 pass
  - `test_portal_access_http_flow`: 3/3 pass
  - `test_migration_ci_cycle`: 1/1 pass
  - suite agregada do portal: 14/14 pass
  - `test_atendimento_upload_endpoint`: 6/6 pass
- Frontend: nao aplicavel.

## 3) Testes manuais

- `GET http://127.0.0.1:8001/health` em `venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001`: `{\"status\":\"healthy\",\"database\":\"connected\",\"readiness\":\"ready\"}` com `pending_count=1`.
- `GET http://127.0.0.1:8001/ready` em `app.main`: `{\"status\":\"healthy\",\"readiness\":\"ready\",\"issues\":[]}`.
- `GET http://127.0.0.1:8000/health` em `app.local_portal_http_app:app`: `{\"status\":\"healthy\",\"mode\":\"portal-local\"}`.
- Smoke HTTP local da clinica parceira:
  - desafio aceito para a unidade `301`;
  - codigo temporario validado em `/api/v1/portal/auth/verificar-codigo`;
  - `GET /api/v1/portal/pets/201/exames` retornando `Ecocardiograma`;
  - `POST /api/v1/portal/exames/501/download-url` seguido de `GET` do anexo `eco-luna-demo.pdf` com `200 OK` e `31` bytes.
- O backend local dedicado foi usado como suporte para o QA do navegador nas telas de tutor e clinica.

## 4) Regressao e riscos residuais

- Risco residual 1: o portal preliminar opera por email; WhatsApp fica bloqueado por `PORTAL_WHATSAPP_ENABLED=false` ate liberacao/configuracao da API da Meta.
- Risco residual 2: fluxo de clinica parceira ainda usa desafio por cadastro de clinica, nao usuario nominal persistido com MFA definitivo.
- Risco residual 3: o endpoint `download-url` retorna token curto em header dedicado; a integracao com storage remoto depende de `url` absoluta e, se necessario, token estatico de upstream configurado no ambiente.
- Risco residual 4: o fluxo administrativo de upload continua gravando em `UPLOAD_DIR`/filesystem local; upload direto para object storage vendor-specific continua fora do escopo desta iteracao.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
