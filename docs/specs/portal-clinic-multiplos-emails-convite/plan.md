# Plan - portal-clinic-multiplos-emails-convite

Data: 2026-08-06
Responsavel: Equipe FortCordis
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): confirmar que nenhuma migracao e necessaria.
- Fase 2 (backend/API): remover a restricao de "uma conta por clinica", adicionar limite de gestores, listar convites/contas completos, notificar todos os gestores ativos, corrigir escopo de revogacao de sessao.
- Fase 3 (frontend): atualizar card de acesso da clinica e painel administrativo para refletir multiplos gestores.
- Fase 4 (integracao/observabilidade): testes automatizados cobrindo os cenarios novos, regressao da suite de portal e verificacao manual em navegador real.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar por leitura do modelo (`portal_clinic_auth.py`) e das migracoes existentes que `portal_clinic_invites.clinica_id` e `portal_clinic_accounts.clinica_id` nao tem constraint de unicidade.
- Criterio de conclusao: nenhuma migracao criada.
- Risco: baixo.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 `portal_clinic_auth_service.py`: `revoke_pending_invites_for_clinica_email`, `count_active_clinic_manager_slots`, `get_active_accounts_by_clinica`, `revoke_sessions_for_account`; remover bloqueio de conta unica em `create_or_replace_pending_account`.
- [x] T2.2 `portal_clinic_auth.py`: `criar_convite_clinica` passa a resolver por email especifico (nao pela "unica conta ativa da clinica"); `consultar_acesso_clinica_admin` retorna listas completas; `consultar_painel_acessos_clinicas` calcula `active_accounts_count`; `consultar_convite_clinica` resolve o hint de email pelo convite especifico; `revogar_conta_clinica` e `redefinir_senha_clinica` passam a revogar sessoes por `account_id`.
- [x] T2.3 `portal_clinic_notification_service.py`: `resolve_clinic_release_notification_emails` e `notify_clinic_report_released` passam a considerar todos os gestores ativos.
- [x] T2.4 `schemas/portal.py`: novos campos aditivos (`invites`, `accounts`, `active_accounts_count`, `account_id`).
- Criterio de conclusao: testes automatizados novos e existentes passam.
- Risco: medio (mudanca em endpoint critico de convite e em revogacao de sessao). Mitigado por testes de regressao dos fluxos existentes e testes novos de isolamento entre gestores.
- Rollback: reverter o deploy do backend; sem migracao para desfazer.

### Fase 3

- [x] T3.1 `ClinicaPortalAccessCard.tsx`: listar gestores/convites, revogacao individual, formulario de convite sempre disponivel.
- [x] T3.2 `clinicas/portal/page.tsx`: expor `active_accounts_count` e atalho para convidar novo gestor.
- [x] T3.3 `lib/portal-api.ts`: tipos atualizados.
- Criterio de conclusao: `tsc --noEmit`, `eslint` e `next build` sem erros.
- Risco: baixo (aditivo).
- Rollback: reverter o deploy do frontend.

### Fase 4

- [x] T4.1 Testes automatizados backend: `test_portal_clinic_invite_auth.py` (multiplos gestores, limite, email de outra clinica, isolamento de sessao em revogacao e em redefinicao de senha) e `test_laudo_portal_release.py` (notificacao para todos os gestores).
- [x] T4.2 Regressao backend: suite completa de testes de portal (`test_portal_access_foundation.py`, `test_portal_partner_auth.py`, `test_portal_partner_profiles_migration.py`).
- [x] T4.3 Verificacao manual em navegador real (Playwright + Chromium local): login administrativo, convite de dois gestores para a mesma clinica, ativacao publica de cada convite, login independente, revogacao de um gestor confirmando isolamento de conta e de sessao no painel `clinicas/[id]` e no painel `clinicas/portal`.
- Criterio de conclusao: todos os testes citados passam; o cenario de isolamento de sessao foi observado visualmente no navegador antes e depois da correcao de `revoke_sessions_for_account`.
- Risco: baixo.
- Rollback: nao aplicavel (apenas testes).

## 3) Plano de testes

- Testes unitarios/integracao: `backend/tests/test_portal_clinic_invite_auth.py`, `backend/tests/test_laudo_portal_release.py`.
- Testes manuais: fluxo completo convite -> ativacao -> login -> revogacao, exercitado via navegador Chromium automatizado contra backend (FastAPI/uvicorn + SQLite) e frontend (Next.js dev server) locais.

## 4) Dependencias e bloqueios

- Nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite + uvicorn + Next dev server).
