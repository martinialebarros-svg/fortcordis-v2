# Verify - portal-clinic-invite-auth

Data: 2026-07-03
Responsavel: Equipe FortCordis
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/app/clinicas/[id]/page.tsx` + `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx` com mensagem contextual de WhatsApp | ok |
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
  app/clinica-parceira/page.tsx \
  'app/clinica-parceira/ativar/[token]/page.tsx' \
  app/clinica-parceira/redefinir-senha/page.tsx \
  'app/clinicas/[id]/page.tsx' \
  app/clinicas/components/ClinicaPortalAccessCard.tsx \
  components/portal/PortalClinicaWorkspace.tsx \
  components/portal/PortalClinicActivationWorkspace.tsx \
  components/portal/PortalClinicResetPasswordWorkspace.tsx \
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
```

Resumo dos resultados:
- Backend:
  - `py_compile`: ok.
  - `test_portal_clinic_invite_auth`: 3/3 pass, incluindo `GET /api/v1/portal/clinicas/exames` com filtros e bloqueio de exame de outra unidade.
  - `test_portal_clinic_invite_auth` + `test_portal_access_foundation` + `test_portal_delivery_service`: 13/13 pass.
  - `test_portal_access_http_flow`: 3/3 pass.
- Frontend:
  - ESLint dos arquivos afetados: ok.
  - ESLint especifico do dashboard da clinica: ok.
  - Helper `portal-datetime` centraliza exibicao de timestamps do portal em `America/Fortaleza`.
  - ESLint do card administrativo de convite apos mensagem contextual: ok.
  - `npm run build`: ok.
- Stage smoke:
  - `https://stage.fortcordis.com.br/clinica-parceira`: 200 OK.
  - `https://stage.fortcordis.com.br/clinica-parceira/ativar/teste`: 200 OK.
  - Copy da pagina de ativacao revisada para remover a etapa antiga de codigo no primeiro acesso.

## 3) Testes manuais sugeridos (stage)

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
- Risco residual 2: ainda nao houve QA manual em stage com provider real de email + clinica piloto.
- Risco residual 3: o link bruto de ativacao fica disponivel apenas na resposta de criacao do convite; depois disso a operacao depende do link copiado ou de gerar um novo convite.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
