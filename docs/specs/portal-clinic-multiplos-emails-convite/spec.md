# Spec - portal-clinic-multiplos-emails-convite

Data: 2026-08-06
Responsavel: Equipe FortCordis
Status: approved

## 1) Escopo funcional

Permitir que a operacao emita convites de portal para mais de um email institucional por clinica parceira, cada um resultando em uma conta (`portal_clinic_accounts`) e login independentes. Reenviar convite/acesso para um email que ja tem conta ativa/bloqueada nesta clinica continua funcionando como reenvio (sem criar convite duplicado); convidar um email novo passa a criar um convite adicional em vez de ser bloqueado. Um limite de gestores simultaneos por clinica evita crescimento descontrolado. A notificacao de laudo liberado passa a alcancar todos os gestores com conta ativa, e revogar a conta/sessoes de um gestor (ou ele redefinir a propria senha) deixa de afetar os demais gestores da mesma clinica.

## 2) Requisitos funcionais (RF)

- RF-001: a operacao deve conseguir criar um convite para um email institucional que ainda nao tem conta na clinica, mesmo que a clinica ja tenha outro(s) gestor(es) com conta ativa/pendente/bloqueada.
- RF-002: ao informar um email que ja tem conta ativa ou bloqueada NESTA clinica, o sistema deve continuar tratando a chamada como reenvio de acesso (`access_mode=login`), sem criar novo convite, como no comportamento anterior.
- RF-003: ao informar um email que ja tem conta ativa, pendente ou bloqueada em OUTRA clinica, o sistema deve rejeitar a criacao do convite com HTTP 409.
- RF-004: o sistema deve limitar a `MAX_ACTIVE_CLINIC_MANAGERS` (5) o numero de gestores simultaneos (contas nao revogadas + convites pendentes) por clinica; ao atingir o limite, novas tentativas de convite para um email novo devem retornar HTTP 409 com mensagem explicativa.
- RF-005: revogar um convite pendente ou a conta de um gestor nao deve afetar convites, contas OU sessoes de outros gestores da mesma clinica.
- RF-006: redefinir a senha de um gestor (fluxo "esqueci minha senha") nao deve encerrar sessoes de outros gestores da mesma clinica.
- RF-007: o resumo administrativo de uma clinica (`GET /admin/clinicas/{clinica_id}/acesso`) deve listar todos os convites e todas as contas da clinica (nao apenas o mais recente).
- RF-008: o painel administrativo (`GET /admin/clinicas/acessos/painel`) deve informar quantos gestores com conta nao revogada cada clinica tem.
- RF-009: cada gestor deve conseguir entrar no portal com o proprio email e senha, de forma independente dos demais gestores da clinica.
- RF-010: a notificacao de "novo laudo liberado" deve ser enviada para todos os emails de gestores com conta nao revogada da clinica; sem nenhuma conta ativa, o comportamento de fallback (ultimo convite com email predefinido, ou email de contato da clinica) permanece o mesmo de antes.
- RF-011: as telas administrativas de convite (`clinicas/[id]` e `clinicas/portal`) devem permitir convidar um novo gestor sem exigir a revogacao do gestor atual.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): `portal_clinic_accounts.email_normalized` continua unico globalmente; nenhum gestor pode assumir o email de acesso de outro.
- NFR-002 (compatibilidade): nenhum contrato de API existente e removido; os campos novos (`invites`, `accounts`, `active_accounts_count`, `account_id` na sessao) sao aditivos.
- NFR-003 (auditoria): criacao/revogacao de convite e de conta continuam gerando evento de auditoria best-effort, agora por gestor.
- NFR-004 (banco): nenhuma migracao de schema e necessaria — `clinica_id` ja nao era unico em `portal_clinic_invites`/`portal_clinic_accounts`.
- NFR-005 (isolamento de sessao): revogar conta ou redefinir senha de um gestor deve encerrar apenas as sessoes desse `account_id`, nunca as sessoes de outros gestores da mesma clinica; a acao administrativa de "encerrar todas as sessoes da unidade" continua sendo a unica via clinica-wide, de forma explicita.

## 4) Contratos tecnicos

### API

- `POST /api/v1/portal/admin/clinicas/{clinica_id}/convites`
  - Sem mudanca de payload. Mudanca de comportamento: so trata como reenvio (`access_mode=login`) quando o email informado ja tem conta ativa/bloqueada NESTA clinica; caso contrario cria convite novo, sujeito ao limite `MAX_ACTIVE_CLINIC_MANAGERS`. Email ja ativo em outra clinica retorna 409.
- `GET /api/v1/portal/admin/clinicas/{clinica_id}/acesso`
  - Resposta ganha `invites: PortalAdminClinicInviteSnapshot[]` e `accounts: PortalAdminClinicAccountSnapshot[]` (historico completo, mais recente primeiro). Campos `invite`/`account` (mais recente) permanecem para compatibilidade.
- `GET /api/v1/portal/admin/clinicas/acessos/painel`
  - Cada item ganha `active_accounts_count: int` (contas com status `pending_verification`/`active`/`locked`).
- `POST /api/v1/portal/admin/clinica-accounts/{account_id}/revogar`
  - Sem mudanca de payload/resposta. Mudanca de comportamento: quando `revoke_sessions=true`, revoga apenas as sessoes deste `account_id` (antes revogava todas as sessoes da clinica).
- `POST /api/v1/portal/auth/redefinir-senha`
  - Sem mudanca de payload/resposta. Mudanca de comportamento: revoga apenas as sessoes da conta que redefiniu a senha (antes revogava todas as sessoes da clinica).
- `PortalAdminClinicSessionSnapshot` ganha `account_id: int | null` para permitir agrupar sessoes por gestor no frontend.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma nova coluna. `portal_clinic_invites.clinica_id` e `portal_clinic_accounts.clinica_id` ja eram colunas indexadas nao-unicas.
- Indices/constraints: sem mudanca.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas:
  - `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx`: passa a listar todos os gestores (contas) e convites pendentes/historicos da clinica, com revogacao individual por gestor/convite; o formulario de convite deixa de alternar para um "modo reenvio" exclusivo e fica sempre disponivel para convidar um novo email.
  - `frontend/app/clinicas/portal/page.tsx`: mostra a contagem de gestores ativos por clinica (`active_accounts_count`) no painel de detalhe e um atalho para limpar o campo de email ao convidar um novo gestor.
  - `frontend/lib/portal-api.ts`: tipos `PortalAdminClinicAccessSummaryResponse`, `PortalAdminClinicAccessOverviewItem` e `PortalAdminClinicSessionSnapshot` atualizados de forma aditiva.
- Estados de UI: sem estados novos; os existentes (pending/expired/used/revoked para convite, pending_verification/active/locked/revoked para conta) agora podem coexistir para gestores diferentes da mesma clinica.
- Regras de exibicao/erro: erro 409 do backend (limite de gestores ou email de outra clinica) deve aparecer como mensagem de erro no formulario de convite.

## 5) Compatibilidade e rollout

- Backward compatibility: total. Nenhum endpoint/campo foi removido; login, sessao, MFA e reset de senha ja eram resolvidos por email/`account_id` e continuam com o mesmo contrato.
- Feature flag: nenhuma nova; continua sob `PORTAL_CLINIC_INVITE_AUTH_ENABLED`/`PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED` existentes.
- Estrategia de rollback: reverter o deploy. Como nao ha migracao de schema, o rollback e apenas de codigo; contas/convites criados para gestores adicionais continuam validos no banco e sao ignorados pelas telas antigas (que so olhavam a conta mais recente).

## 6) Criterios de aceitacao (CA)

- CA-001: convidar um segundo email institucional para uma clinica que ja tem um gestor ativo cria um segundo convite/conta, sem revogar ou afetar o primeiro gestor.
- CA-002: os dois gestores conseguem entrar no portal de forma independente, cada um com seu email e senha.
- CA-003: convidar um email que ja tem conta ativa em outra clinica retorna 409 e nao cria convite.
- CA-004: convidar um email novo apos a clinica atingir `MAX_ACTIVE_CLINIC_MANAGERS` gestores retorna 409.
- CA-005: revogar a conta de um gestor (com `revoke_sessions=true`) encerra apenas as sessoes desse gestor; a sessao de outro gestor da mesma clinica permanece ativa.
- CA-006: um gestor concluir "esqueci minha senha" nao encerra a sessao de outro gestor da mesma clinica.
- CA-007: `GET /admin/clinicas/{clinica_id}/acesso` retorna `accounts`/`invites` com todos os gestores da clinica.
- CA-008: `GET /admin/clinicas/acessos/painel` retorna `active_accounts_count` correto por clinica.
- CA-009: liberar um laudo para uma clinica com dois gestores ativos envia a notificacao de "novo laudo liberado" para os dois emails.

## 7) Casos de borda

- CB-001: reenviar convite/acesso para o mesmo email de um gestor com conta pendente cria um novo convite pendente para aquele email, sem tocar nos convites de outros gestores.
- CB-002: revogar a unica conta ativa de uma clinica com apenas um gestor mantem o comportamento anterior (a clinica volta a precisar de convite).
- CB-003: clinica sem nenhum gestor com conta ativa continua recebendo a notificacao de laudo liberado pelo fallback (ultimo convite com email predefinido ou email de contato da clinica).
- CB-004: convite legado sem email predefinido continua sem um "hint" de email deterministico quando ha mais de um gestor possivel para a clinica — nao regressivo em relacao ao unico caso pratico anterior, pois a UI atual sempre envia email no convite.
- CB-005: a acao administrativa "encerrar sessoes ativas" no card da clinica continua explicitamente clinica-wide (encerra sessoes de todos os gestores de uma vez), distinta da revogacao de conta individual.

## 8) Fora de escopo

- Perfis/permissoes diferentes por gestor dentro da mesma clinica.
- Autoatendimento: a propria clinica convidar um novo gestor pelo portal.
- Tornar `MAX_ACTIVE_CLINIC_MANAGERS` configuravel por ambiente/clinica.
