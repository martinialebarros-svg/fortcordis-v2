# Verify - portal-clinic-invite-auth

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/app/clinicas/[id]/page.tsx` + `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx` + `frontend/lib/portal-clinic-admin.ts` + `backend/app/services/portal_clinic_auth_service.py::send_whatsapp_invite` com mensagem contextual de WhatsApp | ok |
| CA-002 | aceitacao | `backend/app/api/v1/endpoints/portal_clinic_auth.py::criar_convite_clinica` + `::revogar_convite_clinica` | ok |
| CA-003 | aceitacao | `frontend/app/clinica-parceira/ativar/[token]/page.tsx` + `frontend/components/portal/PortalClinicActivationWorkspace.tsx` + `test_invite_activation_autologin_refresh_and_exam_scope` | ok |
| CA-004 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `backend/app/api/v1/endpoints/portal_clinic_auth.py::login_clinica_com_senha` | ok |
| CA-005 | aceitacao | refresh cookie + `frontend/lib/portal-api.ts` (`refreshClinicPortalSession`) + `trusted_session_expires_at` | ok |
| CA-006 | aceitacao | `backend/app/api/v1/endpoints/portal_clinic_auth.py::verificar_mfa_clinica` + `frontend/components/portal/PortalClinicaWorkspace.tsx` | ok |
| CA-007 | aceitacao | `backend/tests/test_portal_clinic_invite_auth.py::test_invite_activation_autologin_refresh_and_exam_scope` | ok |
| CA-008 | aceitacao | `backend/tests/test_portal_access_http_flow.py` com smoke do tutor/clinica legado | ok |
| CA-009 | aceitacao | `frontend/app/clinica-parceira/redefinir-senha/page.tsx` + `frontend/components/portal/PortalClinicResetPasswordWorkspace.tsx` + `test_password_reset_revokes_session_and_forces_mfa_on_next_login` | ok |
| CA-010 | aceitacao | `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx` + `test_admin_can_inspect_and_revoke_pending_invite` | ok |
| CA-011 | aceitacao | `GET /api/v1/portal/clinicas/exames` + `frontend/components/portal/PortalClinicaWorkspace.tsx` com filtros e ordenacao | ok |
| CA-012 | seguranca | `test_invite_activation_autologin_refresh_and_exam_scope` valida que exame de outra unidade nao aparece no painel da clinica | ok |
| CA-013 | auditoria | `frontend/lib/portal-datetime.ts` trata timestamp ISO sem timezone como UTC e exibe em `America/Fortaleza` | ok |
| CA-014 | schema | `backend/migrations/versions/20260704_44_laudos_clinic_id_alignment.py` garante `laudos.clinic_id` para escopo por laudo no portal da clinica | ok |
| CA-015 | schema | `test_clinic_exam_date_sort_does_not_use_legacy_created_at` evita `COALESCE` entre timestamp e `exames.created_at` textual em banco legado | ok |
| CA-016 | aceitacao | `frontend/app/clinica-parceira/page.tsx`, `frontend/app/clinica-parceira/ativar/[token]/page.tsx` e `frontend/app/clinica-parceira/redefinir-senha/page.tsx` publicam preview com copy dedicada para a clinica | ok |
| NFR-013 | nao funcional | `frontend/lib/portal-metadata.ts` centraliza metadata de compartilhamento da clinica com Open Graph/Twitter e imagem oficial | ok |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/bin/python -m py_compile \
  backend/app/api/v1/endpoints/portal.py \
  backend/app/api/v1/endpoints/portal_clinic_auth.py \
  backend/app/services/portal_clinic_auth_service.py \
  backend/app/schemas/portal.py \
  backend/tests/test_portal_clinic_invite_auth.py

backend/venv/bin/python -m unittest \
  backend.tests.test_portal_clinic_invite_auth \
  backend.tests.test_portal_access_foundation \
  backend.tests.test_portal_delivery_service

backend/venv/bin/python -m unittest \
  backend.tests.test_laudos_clinic_id_migration

backend/venv/bin/python - <<'PY'
import os, sys, types, unittest
sys.modules.setdefault('app.services.cnpj_consulta', types.ModuleType('app.services.cnpj_consulta'))
os.chdir('backend')
result = unittest.TextTestRunner(verbosity=1).run(
    unittest.defaultTestLoader.loadTestsFromName('tests.test_portal_access_http_flow')
)
raise SystemExit(0 if result.wasSuccessful() else 1)
PY

cd frontend && npx eslint \
  app/layout.tsx \
  app/clinica-parceira/page.tsx \
  'app/clinica-parceira/ativar/[token]/page.tsx' \
  app/clinica-parceira/redefinir-senha/page.tsx \
  'app/clinicas/[id]/page.tsx' \
  app/clinicas/components/ClinicaPortalAccessCard.tsx \
  components/portal/PortalClinicaWorkspace.tsx \
  components/portal/PortalClinicActivationWorkspace.tsx \
  components/portal/PortalClinicResetPasswordWorkspace.tsx \
  lib/portal-clinic-admin.ts \
  lib/portal-metadata.ts \
  lib/portal-api.ts \
  --max-warnings=0

cd frontend && npx eslint \
  components/portal/PortalClinicaWorkspace.tsx \
  components/portal/PortalClinicActivationWorkspace.tsx \
  components/portal/PortalExamResults.tsx \
  components/portal/PortalTutorWorkspace.tsx \
  app/clinicas/components/ClinicaPortalAccessCard.tsx \
  lib/portal-datetime.ts \
  lib/portal-api.ts \
  app/clinica-parceira/page.tsx \
  --max-warnings=0

cd frontend && npx eslint \
  app/clinicas/components/ClinicaPortalAccessCard.tsx \
  --max-warnings=0

cd frontend && npm run build

cd backend && venv/bin/python -m py_compile \
  app/core/config.py \
  app/api/v1/endpoints/portal.py \
  app/api/v1/endpoints/portal_clinic_auth.py \
  app/services/portal_clinic_auth_service.py

cd backend && venv/bin/python -m unittest \
  tests.test_portal_clinic_invite_auth \
  tests.test_portal_access_foundation \
  tests.test_portal_delivery_service
```

Resumo dos resultados:
- Backend:
  - `py_compile`: ok.
  - `test_portal_clinic_invite_auth`: inclui `GET /api/v1/portal/clinicas/exames` com filtros, bloqueio de exame de outra unidade e regressao da ordenacao por data sem `exames.created_at`.
  - `test_portal_clinic_invite_auth` + `test_portal_access_foundation` + `test_portal_delivery_service`: 13/13 pass.
  - `test_laudos_clinic_id_migration`: valida `laudos.clinic_id` e idempotencia da migracao de schema.
  - `test_portal_access_http_flow`: 3/3 pass.
- Frontend:
  - ESLint dos arquivos afetados: ok.
  - `frontend/lib/portal-clinic-admin.ts` alinha a mensagem copiada pela operacao com a proposta de valor do portal para a clinica parceira.
  - `frontend/lib/portal-metadata.ts` padroniza `title`, `description`, `og:*` e `twitter:*` para o portal.
  - ESLint especifico do dashboard da clinica: ok.
  - Helper `portal-datetime` centraliza exibicao de timestamps do portal em `America/Fortaleza`.
  - ESLint do card administrativo de convite apos mensagem contextual: ok.
  - `npm run build`: ok.
- Stage smoke:
  - `https://stage.fortcordis.com.br/clinica-parceira`: 200 OK.
  - `https://stage.fortcordis.com.br/clinica-parceira/ativar/teste`: 200 OK.
  - Copy da pagina de ativacao revisada para remover a etapa antiga de codigo no primeiro acesso.
- Refinamento de preview comercial em 2026-07-22:
  - `curl -Ls http://127.0.0.1:3101/clinica-parceira | rg 'og:title|og:description|twitter:title|twitter:description|og:image'`: confirmou preview comercial dedicado para a landing da clinica.
  - `curl -Ls http://127.0.0.1:3101/clinica-parceira/ativar/teste | rg 'og:title|og:description|twitter:title|twitter:description|og:image'`: confirmou preview comercial dedicado para o link de ativacao da unidade.
  - `curl -Ls 'http://127.0.0.1:3101/clinica-parceira/redefinir-senha?token=teste' | rg 'og:title|og:description|twitter:title|twitter:description|og:image'`: confirmou preview comercial dedicado para recuperacao de acesso da clinica.
  - `/clinica-parceira` passou a anunciar o valor para a unidade com copy comercial dedicada.
  - `/clinica-parceira/ativar/[token]` passou a anunciar criacao segura da senha e consulta de exames/laudos pelo portal.
  - A mensagem de convite copiada no admin e o texto do provider de WhatsApp passaram a reforcar ativacao do portal, consulta de laudos e uso restrito a equipe autorizada.
- Rollout prod:
  - o teste manual em producao expôs `404 Fluxo de convite da clinica indisponivel.` ao gerar convite no admin, indicando ausencia de `PORTAL_CLINIC_INVITE_AUTH_ENABLED` e `PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED` no `.env` prod apesar da UI ja estar publicada.
  - `backend/app/core/config.py` passou a usar default `true` para ambos os flags, preservando override explicito por ambiente e evitando regressao silenciosa em novos deploys.
  - `venv/bin/python -m unittest tests.test_portal_clinic_invite_auth tests.test_portal_access_foundation tests.test_portal_delivery_service`: 15/15 pass apos o ajuste dos defaults.

## 3) Testes manuais sugeridos

- Cenario 1: admin abre cadastro da clinica, gera convite, copia a mensagem contextual com link e envia pelo WhatsApp institucional.
- Cenario 2: clinica abre `/clinica-parceira/ativar/[token]`, confere o email institucional, cadastra responsavel/senha e cai direto no portal.
- Cenario 3: clinica entra depois em `/clinica-parceira` com email/senha e usa `manter acesso neste computador` sem codigo em rotina normal.
- Cenario 4: clinica fecha/reabre o navegador no mesmo computador e valida restauracao da sessao via refresh seguro.
- Cenario 5: apos login, clinica visualiza o ambiente `clinica parceira` em tela cheia, com nome da unidade, metricas, filtros e lista de exames liberados.
- Cenario 6: clinica filtra por pet, tutor, especie, tipo de exame e periodo; ordena por data/tipo/pet/tutor/especie.
- Cenario 7: clinica baixa um anexo a partir do painel e confirma que o download continua usando URL temporaria.
- Cenario 8: admin revoga sessoes ativas e confirma perda de acesso no dispositivo da unidade.
- Cenario 9: tutor continua acessando o portal atual por codigo temporario sem regressao.
- Cenario 10: no resumo administrativo da clinica, `Ultimo login`, `Valida ate`, `Ultima atividade` e `Expira em` aparecem no horario de Fortaleza, nao em UTC bruto.

## 4) Regressao e riscos residuais

- Risco residual 1: o smoke HTTP legado precisou de stub temporario para `app.services.cnpj_consulta`, porque existe uma exclusao fora do escopo atual no worktree que impede importar `app.main` sem esse modulo.
- Risco residual 2: ainda nao houve QA manual completa em producao com clinica piloto ativando conta, saindo e entrando novamente por email/senha.
- Risco residual 3: o link bruto de ativacao fica disponivel apenas na resposta de criacao do convite; depois disso a operacao depende do link copiado ou de gerar um novo convite.

## 5) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado.
