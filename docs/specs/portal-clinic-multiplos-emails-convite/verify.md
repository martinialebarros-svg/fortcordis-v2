# Verify - portal-clinic-multiplos-emails-convite

Data: 2026-08-06
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_clinica_pode_ter_mais_de_um_gestor_com_convite_e_login_proprios` (backend/tests/test_portal_clinic_invite_auth.py) + verificacao manual em navegador (dois convites criados sem 409) | ok |
| CA-002 | aceitacao | mesmo teste (`login_a`/`login_b`) + login independente confirmado no navegador para os dois gestores | ok |
| CA-003 | aceitacao | `test_convite_recusa_email_ja_ativo_em_outra_clinica` | ok |
| CA-004 | aceitacao | `test_convite_respeita_limite_de_gestores_por_clinica` | ok |
| CA-005 | aceitacao | `test_revogar_conta_de_um_gestor_nao_encerra_sessao_de_outro_gestor` + verificacao manual (screenshot `fix-02-after-revoke-carla.png`) | ok |
| CA-006 | aceitacao | `test_redefinir_senha_de_um_gestor_nao_encerra_sessao_de_outro_gestor` | ok |
| CA-007 | aceitacao | mesmo teste da CA-001 (`summary_payload["accounts"]`/`["invites"]` com 2 itens) | ok |
| CA-008 | aceitacao | mesmo teste da CA-001 (`overview_item["active_accounts_count"] == 2`) + screenshot do painel `clinicas/portal` | ok |
| CA-009 | aceitacao | `test_liberar_laudo_notifica_todos_os_gestores_ativos_da_clinica` (backend/tests/test_laudo_portal_release.py) | ok |
| NFR-002 | nao funcional | leitura do diff: nenhum campo/endpoint removido, apenas adicoes | ok |
| NFR-004 | nao funcional | leitura dos modelos: `clinica_id` sem `unique=True` em `PortalClinicInvite`/`PortalClinicAccount` | ok |
| NFR-005 | nao funcional | CA-005 + CA-006 acima; encontrado e corrigido durante a verificacao manual (ver secao 3) | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend (dentro de backend/, com venv contendo requirements.txt + pytest)
DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=<secret> \
  pytest tests/test_portal_clinic_invite_auth.py \
         tests/test_laudo_portal_release.py \
         tests/test_portal_access_foundation.py \
         tests/test_portal_partner_auth.py \
         tests/test_portal_partner_profiles_migration.py

# frontend (dentro de frontend/)
npx tsc --noEmit -p tsconfig.json
npx eslint app/clinicas/components/ClinicaPortalAccessCard.tsx app/clinicas/portal/page.tsx lib/portal-api.ts
npm run build
```

Resumo dos resultados:
- Backend: 40 testes relevantes, todos passando (13 novos cobrindo os cenarios desta feature; nenhuma regressao nos demais fluxos de portal).
- Frontend: sem erros de tipo, sem erros de lint, build de producao concluido com sucesso (`next build` gerou todas as 40+ rotas, incluindo `clinicas/[id]` e `clinicas/portal`).

## 3) Testes manuais

- Cenario 1 (fluxo completo de dois gestores): com backend (uvicorn + SQLite) e frontend (`next dev`) rodando localmente e um usuario admin semeado (`seed_data.py`), abri `clinicas/1` em um Chromium automatizado (Playwright), logado como admin. Convidei dois gestores distintos (`ana.diretora@central.com` e `bruno.socio@central.com`) pelo card "Acesso da clinica ao portal": o segundo convite NAO foi bloqueado (comportamento antigo retornaria 409). Abri o link publico de ativacao de cada convite em abas novas, completei o cadastro de responsavel/senha para os dois, e o card administrativo passou a listar "Gestores com acesso (2 de 2)" com os dois emails mascarados, cada um com login e sessao propios ("Sessoes ativas: Total em aberto: 2").
- Cenario 2 (isolamento ao revogar um gestor — encontrou e validou a correcao do NFR-005): ainda no navegador, revoguei o acesso de um dos dois gestores. Na primeira tentativa (antes da correcao), a sessao do OUTRO gestor tambem foi encerrada (bug real, nao especulativo). Apos corrigir `revoke_sessions_for_clinica` para `revoke_sessions_for_account` em `revogar_conta_clinica`, repeti o cenario do zero (banco recriado) na clinica "Clinica Norte": revogar o gestor "Carla"/"Diego" passou a encerrar apenas a sessao dele, com o outro gestor permanecendo "Ativo" e com sessao valida — confirmado nos screenshots `fix-01-two-managers-active.png` e `fix-02-after-revoke-carla.png`.
- Cenario 3 (painel `clinicas/portal`): apos os cadastros do cenario 1, o painel `clinicas/portal` exibiu a clinica com a nova metrica "N gestor(es) com acesso" no card de sessoes e, apos a revogacao, a linha do tempo da clinica passou a listar "Conta revogada" para o gestor especifico sem impactar o outro (screenshot `08-portal-overview.png`).

## 4) Regressao e riscos residuais

- Risco residual 1: convite legado sem email predefinido perde o "hint" de email deterministico quando ha mais de um gestor possivel para a clinica (ver CB-004 do spec) — impacto baixo, pois a UI atual sempre envia email no convite.
- Risco residual 2: a verificacao manual usou um ambiente local efemero (SQLite + servidores locais), sem SMTP/WhatsApp reais configurados (`PORTAL_WHATSAPP_ENABLED=false`); o envio real por WhatsApp/SMTP em stage/producao nao foi exercitado nesta rodada, apenas a logica de geracao/copia manual do link.

## 5) Itens fora de escopo entregues

- Correcao de `revoke_sessions_for_account` (RF-005/RF-006, NFR-005): nao estava explicitamente listada no `intent.md` inicial, mas e um pre-requisito direto para a garantia de isolamento entre gestores que a propria feature promete; documentada retroativamente no `intent.md` (Risco 4) e no `spec.md` (RF-005/RF-006, NFR-005).

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
