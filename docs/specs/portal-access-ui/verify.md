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
| NFR-007 | nao funcional | Varredura das strings visiveis de `PortalTutorWorkspace`, `PortalExamResults`, `PortalClinicaWorkspace`, `PortalClinicActivationWorkspace` e `PortalClinicResetPasswordWorkspace` sem termos sem diacriticos necessarios | ok |
| CA-011 | aceitacao | QA local de `/area-pacientes` e `/clinica-parceira` confirmou labels e mensagens acentuadas em desktop e mobile | ok |
| CA-012 | aceitacao | `GET /api/v1/portal/admin/clinicas/acessos/painel` + `frontend/app/clinicas/portal/page.tsx` renderizando metricas, filtros e lista panoramica | ok |
| CA-013 | aceitacao | `frontend/app/clinicas/portal/page.tsx` + `frontend/lib/portal-clinic-admin.ts` com convite, link e mensagem reutilizando o endpoint administrativo | ok |
| CA-014 | aceitacao | `frontend/app/clinicas/portal/page.tsx` acionando revogacao de convite, sessoes e conta com confirmacao local | ok |
| CA-015 | aceitacao | `backend/app/api/v1/endpoints/portal.py` + `backend/app/api/v1/endpoints/portal_clinic_auth.py` + `test_admin_can_load_portal_access_overview_with_download_analytics` | ok |
| CA-016 | aceitacao | `frontend/app/clinicas/portal/page.tsx` exportando CSV da visao filtrada localmente | ok |
| CA-017 | aceitacao | calculos de adesao/inatividade em `frontend/app/clinicas/portal/page.tsx` combinando ultimo login e ultimo download | ok |
| NFR-008 | nao funcional | auditoria de download enriquecida com `actor_type`, `clinica_id` e `account_id` em `backend/app/api/v1/endpoints/portal.py` | ok |
| NFR-009 | nao funcional | confirmacoes explicitas antes de revogacoes no cockpit administrativo | ok |
| NFR-010 | nao funcional | painel calcula metricas somente a partir dos dados de acesso ja autorizados no backend | ok |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/bin/python -m unittest backend/tests/test_portal_clinic_invite_auth.py

cd frontend
npx eslint app/clinicas/portal/page.tsx app/clinicas/page.tsx app/clinicas/components/ClinicaPortalAccessCard.tsx app/layout-dashboard.tsx lib/portal-api.ts lib/portal-clinic-admin.ts
npx tsc --noEmit --pretty false
git diff --check
```

Resumo dos resultados:
- Backend:
  - `test_portal_clinic_invite_auth`: 5/5 pass
- Frontend:
  - `npx eslint ...`: ok
  - `npx tsc --noEmit --pretty false`: ok
- Qualidade de diff:
  - `git diff --check`: ok

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

### Refinamento de 2026-07-12

- Formulario do tutor renderizado sem envio de IDs, email ou codigo.
- Resultados e estados autenticados revisados por codigo, sem criar sessao nem iniciar download.
- Login, ativacao, redefinicao de senha e estados autenticados da clinica revisados sem enviar formularios.
- Estado `Esqueci minha senha` aberto e fechado localmente; copy acentuada confirmada sem envio de email.
- `/clinica-parceira` validada em 1280x720 e 390x844, sem overflow horizontal ou erros no console.
- Lint e typecheck concluidos sem erros.
- Build do frontend concluido com 33 paginas compiladas.

### Refinamento administrativo de 2026-07-21

- `/clinicas/portal` validada localmente com resposta HTTP `200`.
- Filtros por status, fila rapida e opcao `Mostrar apenas quem ja baixou laudo` revisados por codigo.
- Exportacao CSV revisada por codigo para refletir somente a lista filtrada.
- Revogacao de convite, revogacao de conta e encerramento de sessoes revisados por codigo com confirmacao antes da chamada de API.
- Reuso do convite administrativo individual pela tela panoramica confirmado em `frontend/lib/portal-clinic-admin.ts` e `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx`.
- Feed de downloads validado com auditoria de `actor_type=clinica` coberta por teste automatizado.

## 4) Regressao e riscos residuais

- Risco residual 1: QA manual depende de ambiente com dados validos e `debug_code` exposto.
- Risco residual 2: a clinica ainda autentica pela unidade/cadastro, nao por usuario nominal persistente.
- Risco residual 3: o browser embutido nao conclui downloads nativos; a verificacao do arquivo segue coberta por HTTP e teste automatizado.
- Risco residual 4: WhatsApp deve ser reabilitado em uma fase posterior, depois de credenciais e webhook aprovados/configurados.
- Risco residual 5: o CSV representa o recorte filtrado localmente; para analytics historico/executivo amplo ainda sera melhor uma camada dedicada de relatorios.
- Risco residual 6: o indicador de inatividade de 30 dias depende da auditoria de download enriquecida e do ultimo login existente; eventos antigos sem esse contexto nao entram na leitura administrativa.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
