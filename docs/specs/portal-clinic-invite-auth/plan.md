# Plan - portal-clinic-invite-auth

Data: 2026-07-03
Responsavel: Equipe FortCordis
Status: done

## 1) Sequencia de fases

- Fase 1 (fundacao backend): modelar convites, contas, desafios e sessoes persistentes da clinica.
- Fase 2 (operacao/admin): permitir gerar, copiar e revogar convites/sessoes pela area administrativa.
- Fase 3 (portal publico): construir ativacao, login com senha, MFA contextual e reset de senha da clinica.
- Fase 4 (convivencia e rollout): manter compatibilidade com o fluxo legado por codigo e validar rollout progressivo.
- Fase 5 (validacao): executar testes automatizados e QA manual ponta a ponta do onboarding e do acesso aos exames.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar migracoes e modelos para `portal_clinic_invites`, `portal_clinic_accounts`, `portal_clinic_sessions`, `portal_password_reset_tokens` e `portal_auth_challenges`.
- [x] T1.2 Implementar servicos backend de hash de senha, emissao/validacao de convite, MFA por email, refresh seguro e reset de senha.
- [x] T1.3 Adaptar o contexto de sessao do portal para aceitar conta persistente da clinica sem quebrar o token atual do tutor.
- Criterio de conclusao:
  - backend consegue representar convite, conta ativa, sessao curta e sessao estendida da clinica.
- Risco:
  - acoplar demais o novo fluxo ao modelo atual de `portal_access_challenges`.
- Rollback:
  - manter o login legado da clinica ativo e desabilitar os endpoints novos por feature flag.

### Fase 2

- [x] T2.1 Adicionar na area administrativa da clinica controles para gerar convite e copiar link seguro.
- [x] T2.2 Exibir status do convite, da conta da unidade e das sessoes ativas.
- [x] T2.3 Permitir revogar convite pendente, conta ativa e sessoes da unidade.
- Criterio de conclusao:
  - operacao consegue onboardar e desativar clinicas parceiras sem agir direto no banco.
- Risco:
  - fluxo admin nascer opaco e dificultar suporte quando convite expirar ou email estiver incorreto.
- Rollback:
  - ocultar a secao nova e manter geracao manual fora da interface administrativa.

### Fase 3

- [x] T3.1 Criar rota publica de ativacao por convite com estados `pending`, `used`, `expired` e `revoked`.
- [x] T3.2 Implementar formulario de cadastro com email institucional predefinido, responsavel e senha.
- [x] T3.3 Simplificar ativacao para criar conta ativa e sessao inicial sem codigo no primeiro cadastro.
- [x] T3.4 Substituir o login recorrente da clinica por email + senha, mantendo opcao de sessao estendida no computador da unidade.
- [x] T3.5 Implementar fluxo de MFA contextual, esqueci-senha e redefinicao segura.
- Criterio de conclusao:
  - clinica consegue ativar conta pelo convite, entrar automaticamente, usar senha recorrente e recuperar acesso com seguranca.
- Risco:
  - front misturar storage/cookies do app administrativo com a sessao da clinica.
- Rollback:
  - desabilitar rotas novas de ativacao/login e voltar a `/clinica-parceira` ao fluxo legado por codigo.

### Fase 4

- [x] T4.1 Introduzir feature flags para convivio entre `invite-auth` e `legacy-code-login`.
- [x] T4.2 Concluir a liberacao em producao mantendo convivencia com o fluxo legado por codigo.
- [x] T4.3 Garantir que tutor continua usando o fluxo atual sem regressao.
- Criterio de conclusao:
  - o novo fluxo pode ser ligado por clinica/ambiente sem interromper operacao existente.
- Risco:
  - migracao brusca bloquear acesso de unidade ainda nao ativada.
- Rollback:
  - religar `PORTAL_CLINIC_LEGACY_CODE_LOGIN_ENABLED` e desligar o login novo.

### Fase 5

- [x] T5.1 Cobrir backend com testes de convite, ativacao, login, MFA, refresh e reset de senha.
- [x] T5.2 Validar frontend com build/lint e QA manual do fluxo da clinica.
- [x] T5.3 Registrar evidencias em `verify.md` e revisar riscos residuais antes de promover.
- Criterio de conclusao:
  - fluxo ponta a ponta da clinica validado, tutor sem regressao e evidencias registradas.
- Risco:
  - aprovar rollout sem testar expiracao real de convite/sessao ou revogacao.
- Rollback:
  - segurar promocao e manter feature flags desligadas ate corrigir.

## 3) Plano de testes

- Testes unitarios/backend:
  - hash/validacao de senha;
  - expiracao e consumo de convite;
  - ativacao direta por convite com sessao inicial;
  - refresh/logout/revogacao;
  - reset de senha e invalidacao de sessoes.
- Testes de integracao:
  - login da clinica com senha;
  - MFA contextual;
  - listagem/download de exames usando sessao emitida pelo novo fluxo;
  - coexistencia entre tutor atual e clinica nova.
- Testes manuais:
  - gerar convite no admin;
  - ativar conta pelo link;
  - criar senha e cair direto no portal da clinica;
  - usar sessao estendida por dispositivo;
  - testar esqueci-senha;
  - revogar sessao e confirmar bloqueio.

## 4) Dependencias e bloqueios

- Dependencia 1:
  - provider oficial de email do portal precisa permanecer funcional para verificacao de email, MFA e reset de senha.
- Dependencia 2:
  - definicao operacional de qual email conta como institucional da unidade.
- Dependencia 3:
  - decisao de rollout inicial por clinicas piloto antes de desligar o fluxo legado.
- Bloqueio potencial:
  - se o envio oficial de WhatsApp ainda nao estiver liberado, o onboarding inicial depende de copia manual do link seguro pela operacao.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases, riscos e rollback revisados.
- [x] Regra operacional de email institucional confirmada.
- [x] Clinicas piloto definidas para o primeiro rollout.
