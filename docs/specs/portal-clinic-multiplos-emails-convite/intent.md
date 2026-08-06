# Intent - portal-clinic-multiplos-emails-convite

Data: 2026-08-06
Responsavel: Equipe FortCordis
Status: approved

## 1) Problema atual

O convite/conta do portal da clinica parceira (feature `portal-clinic-invite-auth`) foi desenhado para aceitar apenas um email institucional ativo por clinica. Quando uma unidade tem mais de um gestor que precisa de acesso proprio (por exemplo, socia e gerente operacional), a operacao so consegue reenviar o mesmo acesso: tentar gerar um segundo convite com outro email retorna erro, e a ativacao de uma segunda conta e bloqueada pelo backend ("A clinica ja possui conta ativa").

## 2) Objetivo

Permitir que uma clinica parceira tenha mais de um gestor com convite e login proprios (email + senha individuais), cada um recebendo seu proprio convite de acesso, mantendo a unicidade de email como identidade de login e um limite operacional de gestores simultaneos por unidade.

## 3) Nao objetivos

- Perfis com permissoes diferentes por gestor (todos os gestores de uma clinica continuam com o mesmo escopo de leitura/download por `clinica_id`).
- Trocar o fluxo do tutor.
- Alterar o fluxo de parceiros veterinarios (`portal_partner_*` / `PortalPartnerProfile`).
- Autoatendimento: a propria clinica convidar outro gestor pelo portal (o convite continua sendo emitido pela operacao Fort Cordis).

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - reaproveitar as tabelas `portal_clinic_invites`/`portal_clinic_accounts` existentes, que ja suportam multiplas linhas por `clinica_id` no schema (`clinica_id` nunca teve `unique=True`); a restricao de "uma conta por clinica" estava apenas no codigo da aplicacao.
  - preservar `portal_clinic_accounts.email_normalized` unico globalmente (identidade de login).
  - preservar compatibilidade com convites/contas legados sem email predefinido.
- Restricoes operacionais:
  - limitar o numero de gestores simultaneos por clinica para evitar cadastros indevidos.
- Restricoes de prazo: entrega unica, sem rollout progressivo por feature flag — o fluxo de convite ja esta em producao e a mudanca remove uma restricao artificial, sem novo contrato de API obrigatorio.

## 5) Impacto esperado

- Usuarios impactados: operacao Fort Cordis (emite convites) e clinicas parceiras com mais de um gestor.
- Modulos impactados: `portal_clinic_auth_service`, `portal_clinic_notification_service`, endpoints admin de convite/acesso da clinica (`portal_clinic_auth.py`), telas `clinicas/[id]` (card de acesso) e `clinicas/portal` (painel).
- Risco de regressao: baixo a moderado. Login, sessao (por refresh token), MFA e reset de senha ja eram resolvidos por email/`account_id` (nao por clinica) e continuam funcionalmente inalterados; a revisao encontrou e corrigiu dois pontos que revogavam sessoes por `clinica_id` (revogar conta e redefinir senha), que precisavam passar a ser escopados por `account_id` para nao afetar outros gestores da mesma unidade.

## 6) Riscos iniciais

- Risco 1: reaproveitar email de outro gestor/clinica indevidamente — mitigado mantendo a unicidade global de `email_normalized`.
- Risco 2: crescimento descontrolado de convites/contas por clinica — mitigado com limite `MAX_ACTIVE_CLINIC_MANAGERS` (5).
- Risco 3: notificacao de laudo liberado deixar de avisar algum gestor — mitigado enviando a notificacao para todos os emails ativos, com fallback para o comportamento anterior quando nao houver conta ativa.
- Risco 4 (encontrado durante a implementacao): revogar a conta de um gestor ou ele redefinir a propria senha encerrava as sessoes de TODOS os gestores da clinica (`revoke_sessions_for_clinica` operava por `clinica_id`). Corrigido com `revoke_sessions_for_account`, escopado por `account_id`; a acao explicita de "encerrar todas as sessoes da unidade" continua clinica-wide de proposito.

## 7) Perguntas abertas

- Nenhuma bloqueante. A pergunta aberta 1 do spec `portal-clinic-invite-auth` — "a conta da unidade sera unica por clinica no primeiro rollout ou ja deve aceitar mais de um email responsavel?" — e respondida por esta feature: passa a aceitar mais de um email responsavel.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
