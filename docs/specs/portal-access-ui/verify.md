# Verify - portal-access-ui

Data: 2026-06-17
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + QA manual em `http://127.0.0.1:3004/area-pacientes` com sessao ativa do tutor e pet `201` | ok |
| CA-002 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + `backend/tests/test_portal_access_http_flow.py::test_tutor_http_flow_lists_and_downloads_attachment` | ok |
| CA-003 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + `frontend/components/portal/PortalExamResults.tsx` + exame `Ecocardiograma` listado no navegador | ok |
| CA-004 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + `frontend/lib/portal-api.ts` + download validado por token HTTP curto | ok |
| CA-005 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + QA manual em `http://127.0.0.1:3004/clinica-parceira` com unidade `301` autenticada | ok |
| CA-006 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `backend/tests/test_portal_access_http_flow.py::test_clinic_http_flow_filters_scope_and_downloads_attachment` | ok |
| CA-007 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `frontend/components/portal/PortalExamResults.tsx` + consulta do pet `201` na unidade autorizada | ok |
| CA-008 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `frontend/lib/portal-api.ts` + download de anexo validado por HTTP local | ok |
| CA-009 | aceitacao | `frontend/lib/portal-api.ts` com storage separado por perfil | ok |
| CA-010 | aceitacao | `npm run build` | ok |
| NFR-001 | nao funcional | `frontend/lib/portal-api.ts` isolando sessao por ator | ok |
| NFR-002 | nao funcional | `frontend/lib/portal-api.ts` usando `download_token_header` em download | ok |
| NFR-003 | nao funcional | estados de `loading`, `message` e `error` nos workspaces + validacao local de IDs invalidos | ok |
| NFR-004 | nao funcional | rewrites existentes do Next.js para `/api/v1` | ok |
| NFR-005 | nao funcional | `npm run build` | ok |
| NFR-006 | nao funcional | `frontend/components/portal/PortalTutorWorkspace.tsx` fixa canal `email` e remove seletor de WhatsApp da UI preliminar | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend
npm run build

cd ../backend
venv/bin/python -m unittest tests/test_portal_access_http_flow.py -v
```

Resumo dos resultados:
- Frontend:
  - `npm run build`: ok
- Backend:
  - `test_portal_access_http_flow`: 3/3 pass

## 3) Testes manuais

- Executados:
  - render desktop e mobile de `http://127.0.0.1:3004/area-pacientes`;
  - render desktop e mobile de `http://127.0.0.1:3004/clinica-parceira`;
  - validacao local de erro de ID invalido no formulario do tutor;
  - tutor em modo email-only, sem opcao de WhatsApp visivel enquanto a API da Meta nao esta liberada;
  - validacao local de erro de ID invalido no formulario da clinica;
  - tutor com sessao ativa no navegador, pet `201`, exame `Ecocardiograma` e anexo `eco-luna-demo.pdf` visiveis;
  - clinica parceira com solicitacao de codigo, sessao validada para unidade `301`, consulta do pet `201` e exame `Ecocardiograma` visivel no navegador;
  - download do anexo validado via HTTP local porque o browser embutido nao suporta evento de download.
- Pendente:
  - nenhum bloqueador funcional nesta iteracao.

## 4) Regressao e riscos residuais

- Risco residual 1: QA manual depende de ambiente com dados validos e `debug_code` exposto.
- Risco residual 2: a clinica ainda autentica pela unidade/cadastro, nao por usuario nominal persistente.
- Risco residual 3: o browser embutido nao conclui downloads nativos; a verificacao do arquivo segue coberta por HTTP e teste automatizado.
- Risco residual 4: WhatsApp deve ser reabilitado em uma fase posterior, depois de credenciais e webhook aprovados/configurados.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
