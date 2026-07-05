# Spec - portal-clinic-invite-auth

Data: 2026-07-03
Responsavel: Equipe FortCordis
Status: approved

## 1) Escopo funcional

Substituir o fluxo recorrente de codigo temporario da clinica parceira por um modelo de convite e conta persistente da unidade. A entrega inclui convite individual enviado por WhatsApp, email institucional definido pela operacao, ativacao com responsavel e senha sem codigo no primeiro cadastro, login recorrente com email e senha, MFA contextual para eventos de risco, sessao estendida opcional no computador da unidade e manutencao do escopo de acesso por clinica/unidade aos exames do portal.

O fluxo atual de tutor com codigo temporario permanece inalterado nesta iteracao.

## 2) Requisitos funcionais (RF)

- RF-001: a operacao/admin deve conseguir gerar um convite individual para uma clinica/unidade parceira a partir de cadastro interno existente.
- RF-002: o convite deve produzir um link seguro de ativacao que possa ser enviado por WhatsApp sem autenticar o destinatario automaticamente.
- RF-003: o link de convite deve abrir uma tela publica de ativacao com contexto da clinica/unidade e estado do convite (`pending`, `expired`, `used`, `revoked`).
- RF-004: a geracao do convite deve permitir definir o `email institucional` que sera usado pela unidade.
- RF-005: a ativacao da conta da unidade deve exigir `responsavel_nome`, `senha` e `confirmacao de senha`; se um convite legado nao tiver email predefinido, a tela pode pedir `email institucional`.
- RF-006: apos submissao valida da ativacao, o sistema deve consumir o convite, criar a conta como ativa e emitir sessao inicial da clinica sem pedir codigo no primeiro cadastro.
- RF-007: clinica ativada deve conseguir entrar no portal com `email + senha`.
- RF-008: o login da clinica deve oferecer a opcao `manter acesso neste computador da unidade ate o fim do expediente`.
- RF-009: quando a opcao de sessao estendida estiver marcada, o sistema deve manter a unidade autenticada por ate 8 horas no mesmo navegador/dispositivo, com renovacao automatica da sessao curta.
- RF-010: o sistema deve exigir MFA adicional por codigo no email institucional em eventos de risco ou sensiveis, sem exigir codigo extra em todo login de rotina no mesmo dispositivo confiavel.
- RF-011: a clinica autenticada deve continuar consultando apenas exames autorizados para a propria unidade, reaproveitando o escopo atual por `clinica_id`.
- RF-012: a clinica autenticada deve continuar baixando anexos liberados pelos endpoints atuais do portal, sem envio de PDF sensivel por email ou WhatsApp.
- RF-013: a clinica deve conseguir iniciar fluxo de `esqueci minha senha` com resposta generica anti-enumeracao e redefinicao segura por email.
- RF-014: a operacao/admin deve conseguir revogar convite pendente, conta da clinica e sessoes ativas da unidade.
- RF-015: enquanto o novo fluxo nao estiver ativo em producao, a experiencia publica atual de clinica com codigo temporario deve poder permanecer disponivel por feature flag para migracao gradual.
- RF-016: caso o provider oficial de WhatsApp ainda nao esteja habilitado, a operacao deve conseguir copiar manualmente o link seguro do convite junto de uma mensagem contextual para envio controlado a clinica.
- RF-017: a tela publica de ativacao deve orientar a clinica a conferir o email institucional, cadastrar responsavel/senha e entrar direto no portal, sem instruir confirmacao de codigo no primeiro cadastro.
- RF-018: apos login com sucesso, a clinica deve entrar em um ambiente operacional explicito de `clinica parceira`, separado da pagina institucional, com identificacao da unidade autenticada.
- RF-019: o ambiente da clinica deve exibir visao panoramica dos exames liberados da propria unidade, com filtros por busca geral, pet, tutor, especie, tipo de exame e periodo, alem de ordenacao por data, tipo, pet, tutor ou especie.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): o link enviado por WhatsApp deve ser apenas de ativacao; nunca deve autenticar a clinica sozinho nem conceder acesso direto ao portal.
- NFR-002 (seguranca/senhas): a senha da conta da clinica deve ser armazenada apenas como hash forte (`Argon2id` preferencialmente, com fallback equivalente aprovado).
- NFR-003 (seguranca/sessao): sessoes estendidas da clinica devem usar refresh token em cookie `HttpOnly`, `Secure` e `SameSite=Lax`, separado do token curto de acesso do portal.
- NFR-004 (seguranca/anti-enumeracao): login, ativacao, reenviar codigo, esqueci-senha e redefinicao devem responder com mensagens genericas quando o contexto nao puder ser revelado.
- NFR-005 (LGPD): notificacoes por WhatsApp e email nao devem carregar anexos sensiveis; devem apenas orientar acesso ao portal autenticado.
- NFR-006 (LGPD/minimizacao): o cadastro da conta da clinica deve coletar apenas os dados necessarios para autenticacao, comunicacao e auditoria da unidade.
- NFR-007 (auditoria): criacao de convite, abertura do link, ativacao, login, MFA, refresh, reset de senha, revogacao e download devem gerar evento de auditoria best-effort.
- NFR-008 (compatibilidade): endpoints atuais de listagem/download de exames do portal devem continuar compatíveis e sem impacto no fluxo administrativo interno.
- NFR-009 (operacao): o modelo deve permitir rollout progressivo por clinica/unidade sem exigir migracao atomica de todos os parceiros.
- NFR-010 (UX): o portal da clinica deve informar claramente expiracao do convite, email institucional do acesso, sessao ativa ate horario estimado e expiracao da sessao estendida.
- NFR-011 (UX/adesao): a rotina diaria da clinica deve priorizar busca e download em uma tela unica, reduzindo dependencia de IDs internos do pet para localizar exames.
- NFR-012 (auditoria/tempo): timestamps do portal retornados sem timezone explicito devem ser tratados pelo frontend como UTC e exibidos em `America/Fortaleza`, evitando mostrar horarios de auditoria tres horas adiantados.

## 4) Contratos tecnicos

### API

#### Admin / operacao

- `POST /api/v1/portal/admin/clinicas/{clinica_id}/convites`
  - auth:
    - token administrativo atual
  - payload:
    - `delivery_channel` (`whatsapp`)
    - `delivery_target` (telefone/contato da unidade)
    - `account_email` (email institucional da unidade)
    - `expires_in_hours` (default 72)
    - `allow_manual_copy` (bool)
  - resposta:
    - `invite_id`
    - `status`
    - `expires_at`
    - `activation_url`
    - `delivery_channel`
    - `delivery_target_masked`
    - `account_email_masked`

- `POST /api/v1/portal/admin/clinica-accounts/{account_id}/revogar`
  - auth:
    - token administrativo atual
  - payload:
    - `reason`
    - `revoke_sessions` (bool)
  - resposta:
    - `status`
    - `revoked_at`

- `POST /api/v1/portal/admin/clinica-sessions/revogar`
  - auth:
    - token administrativo atual
  - payload:
    - `clinica_id`
    - `session_id` opcional
    - `reason`
  - resposta:
    - `revoked_count`

#### Publico / portal clinica

- `GET /api/v1/portal/clinicas/convites/{invite_token}`
  - auth:
    - nao
  - resposta:
    - `status`
    - `clinica_id`
    - `clinica_nome`
    - `unidade_nome`
    - `expires_at`
    - `can_activate`
    - `email_hint` opcional quando ja houver email predefinido ou conta criada

- `POST /api/v1/portal/clinicas/ativacao`
  - auth:
    - nao
  - payload:
    - `invite_token`
    - `email` opcional quando o convite nao tiver email predefinido
    - `responsavel_nome`
    - `password`
    - `password_confirmation`
  - resposta:
    - `activation_id`
    - `access_token`
    - `token_type`
    - `expires_at`
    - `actor_type`
    - `actor_id`
    - `clinica_id`
    - `account_id`
    - `auth_method`
    - `trusted_session_expires_at`
    - `scope`
    - `message`

- `POST /api/v1/portal/auth/email/verificar`
  - compatibilidade:
    - mantido apenas para desafios de email legados ou futuros eventos sensiveis, nao faz parte da ativacao inicial simplificada
  - auth:
    - nao
  - payload:
    - `challenge_id`
    - `codigo`
  - resposta:
    - `account_id`
    - `status`
    - `verified_at`

- `POST /api/v1/portal/auth/login`
  - auth:
    - nao
  - payload:
    - `email`
    - `password`
    - `remember_device_until_shift_end`
  - resposta:
    - caso sucesso sem step-up:
      - `access_token`
      - `token_type`
      - `expires_at`
      - `actor_type`
      - `actor_id`
      - `clinica_id`
      - `scope`
      - `trusted_session_expires_at` opcional
    - caso MFA adicional exigido:
      - `mfa_required`
      - `challenge_id`
      - `message`

- `POST /api/v1/portal/auth/mfa/verificar`
  - auth:
    - nao
  - payload:
    - `challenge_id`
    - `codigo`
    - `remember_device_until_shift_end`
  - resposta:
    - mesmo contrato de login com sessao emitida

- `POST /api/v1/portal/auth/refresh`
  - auth:
    - refresh token via cookie seguro
  - payload:
    - vazio
  - resposta:
    - `access_token`
    - `token_type`
    - `expires_at`
    - `actor_type`
    - `actor_id`
    - `clinica_id`
    - `scope`

- `POST /api/v1/portal/auth/logout`
  - auth:
    - access token do portal e/ou refresh token da clinica
  - payload:
    - vazio
  - resposta:
    - `success`

- `POST /api/v1/portal/auth/esqueci-senha`
  - auth:
    - nao
  - payload:
    - `email`
  - resposta:
    - `accepted`
    - `message`

- `POST /api/v1/portal/auth/redefinir-senha`
  - auth:
    - nao
  - payload:
    - `reset_token`
    - `password`
    - `password_confirmation`
  - resposta:
    - `success`
    - `message`

- `GET /api/v1/portal/clinicas/exames`
  - auth:
    - `Authorization: Bearer <portal token>` de clinica
  - query params:
    - `q` busca geral por pet, tutor, tipo ou categoria
    - `pet`
    - `tutor`
    - `especie`
    - `tipo_exame`
    - `status_exame`
    - `data_inicio`
    - `data_fim`
    - `sort_by` (`data`, `tipo_exame`, `especie`, `pet`, `tutor`, `status`)
    - `sort_dir` (`asc`, `desc`)
    - `limit`, `offset`
  - resposta:
    - `total`
    - `clinica_id`
    - `clinica_nome`
    - `items[]` com `paciente_nome`, `tutor_nome`, `especie`, metadados do exame e anexos disponiveis
  - regra:
    - deve retornar apenas exames associados ao `clinica_id` da sessao por atendimento ou laudo, sem vazar exames de outras unidades.

#### Endpoints reaproveitados

- `GET /api/v1/portal/pets/{paciente_id}/exames`
  - mantido
  - continua exigindo `Authorization: Bearer <portal token>`

- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - mantido
  - continua exigindo `Authorization: Bearer <portal token>`

### Banco/migracoes

- Novas tabelas:
  - `portal_clinic_invites`
  - `portal_clinic_accounts`
  - `portal_clinic_sessions`
  - `portal_password_reset_tokens`
  - `portal_auth_challenges`

- Compatibilidade de schema:
  - `laudos.clinic_id` deve existir para manter o escopo de exames por unidade quando o exame estiver associado a um laudo, com migracao idempotente para ambientes legados.

- Campos principais sugeridos:
  - `portal_clinic_invites`
    - `id`
    - `clinica_id`
    - `token_hash`
    - `status` (`pending`, `used`, `expired`, `revoked`)
    - `delivery_channel`
    - `delivery_target_masked`
    - `expires_at`
    - `used_at`
    - `revoked_at`
    - `created_by_user_id`
    - `contexto_json` incluindo `account_email` quando definido no convite
  - `portal_clinic_accounts`
    - `id`
    - `clinica_id`
    - `email_normalized`
    - `responsavel_nome`
    - `password_hash`
    - `email_verified_at`
    - `status` (`pending_verification`, `active`, `locked`, `revoked`; nova ativacao entra como `active`)
    - `last_login_at`
    - `activated_at`
    - `revoked_at`
  - `portal_clinic_sessions`
    - `id`
    - `account_id`
    - `clinica_id`
    - `refresh_token_hash`
    - `device_label`
    - `user_agent_hash`
    - `trusted_until`
    - `last_seen_at`
    - `revoked_at`
    - `status` (`active`, `expired`, `revoked`, `logged_out`)
  - `portal_password_reset_tokens`
    - `id`
    - `account_id`
    - `token_hash`
    - `expires_at`
    - `used_at`
    - `revoked_at`
  - `portal_auth_challenges`
    - `id`
    - `account_id`
    - `clinica_id`
    - `challenge_type` (`email_verification`, `login_mfa`, `password_reset_verification`)
    - `code_hash`
    - `failed_attempts`
    - `max_attempts`
    - `expires_at`
    - `consumed_at`
    - `contexto_json`

- Indices/constraints:
  - `portal_clinic_accounts.email_normalized` unico
  - regra de conta ativa por `clinica_id` definida explicitamente na implementacao:
    - preferencia inicial: uma conta principal por unidade/clinica
  - indices por `expires_at` e `status` nas tabelas de convite/challenge/session

- Migracao necessaria: sim

### Frontend

- Telas administrativas afetadas:
  - `frontend/app/clinicas/[id]/page.tsx` ou tela equivalente de gestao da clinica
  - adicionar secao para:
    - gerar convite
    - informar email institucional da unidade
    - copiar link seguro e mensagem pronta explicando o convite
    - ver status do convite
    - revogar conta/sessoes

- Telas publicas afetadas:
  - `frontend/app/clinica-parceira/page.tsx`
  - nova rota de ativacao, por exemplo:
    - `frontend/app/clinica-parceira/ativar/[token]/page.tsx`
  - nova rota de esqueci-senha, por exemplo:
    - `frontend/app/clinica-parceira/esqueci-senha/page.tsx`

- Estados de UI esperados:
  - convite valido
  - convite expirado
  - convite ja utilizado
  - convite revogado
  - email institucional predefinido
  - conta ativada
  - login com email e senha
  - MFA adicional requerido
  - sessao ativa ate horario estimado
  - conta revogada/bloqueada

- Regras de exibicao/erro:
  - o link do convite nunca deve logar automaticamente
  - o portal deve ocultar detalhes sensiveis quando o convite nao for valido
  - mensagens de login e esqueci-senha devem ser genericas
  - o uso valido do convite com senha deve criar sessao inicial e redirecionar para o portal da clinica
  - o checkbox `manter acesso neste computador da unidade ate o fim do expediente` aparece apenas para clinica
  - o tutor continua na UI atual com codigo temporario e sem senha persistente

## 5) Compatibilidade e rollout

- Backward compatibility:
  - fluxo atual de tutor com codigo temporario permanece inalterado
  - endpoints de exames e download do portal permanecem os mesmos
  - fluxo atual de clinica por codigo temporario pode coexistir temporariamente enquanto a migracao por convite e concluida

- Feature flag:
  - `PORTAL_CLINIC_INVITE_AUTH_ENABLED`
  - `PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED`
  - `PORTAL_CLINIC_LEGACY_CODE_LOGIN_ENABLED`

- Estrategia de rollout:
  - fase 1: disponibilizar geracao de convite e ativacao para clinicas piloto, mantendo login legado por codigo
  - fase 2: ativar login por email+senha para clinicas piloto e validar operacao diaria
  - fase 3: habilitar sessao estendida de 8 horas e MFA contextual
  - fase 4: migrar novas clinicas apenas para convite e descontinuar gradualmente o login legado por codigo

- Estrategia de rollback:
  - desabilitar `PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED`
  - manter `PORTAL_CLINIC_LEGACY_CODE_LOGIN_ENABLED=true`
  - revogar sessoes emitidas pelo novo fluxo se necessario
  - preservar contas/convites para reprocessamento posterior sem apagar auditoria

## 6) Criterios de aceitacao (CA)

- CA-001: a operacao consegue gerar convite seguro de clinica com expiracao e copiar/enviar uma mensagem contextual com o link.
- CA-002: o link do convite nao autentica a clinica sozinho e exige criacao de senha para consumir o convite.
- CA-003: a conta da clinica e ativada no uso valido do convite e recebe sessao inicial sem codigo no primeiro cadastro.
- CA-004: a clinica consegue entrar com email e senha apos a ativacao, sem codigo em login de rotina.
- CA-005: em dispositivo confiavel com sessao estendida habilitada, a clinica consegue operar por ate 8 horas sem pedir codigo a cada acesso.
- CA-006: em evento de risco ou sensivel, o sistema exige MFA adicional por codigo no email institucional.
- CA-007: a clinica autenticada continua vendo apenas exames da propria unidade.
- CA-008: o fluxo de tutor por codigo temporario continua funcional e sem regressao.
- CA-009: esqueceu-a-senha responde de forma generica e permite redefinicao segura por email institucional.
- CA-010: a operacao consegue revogar conta e sessoes ativas da clinica.

## 7) Casos de borda

- CB-001: convite expirado deve oferecer orientacao para solicitar novo convite, sem reaproveitar o token antigo.
- CB-002: convite usado nao deve permitir segunda ativacao.
- CB-003: tentativa de ativar com email diferente da politica da unidade pode ser bloqueada por regra operacional configuravel.
- CB-004: se o email institucional definido no convite estiver errado, a operacao deve revogar/gerar novo convite com o email correto.
- CB-005: redefinicao de senha deve invalidar sessoes anteriores e exigir novo login.
- CB-006: troca de email institucional deve exigir verificacao do novo email antes de efetivar a mudanca.
- CB-007: se o provider oficial de WhatsApp nao estiver habilitado, a operacao deve conseguir copiar a mensagem com o link do convite manualmente sem quebrar o fluxo.
- CB-008: dispositivos compartilhados da clinica nao devem herdar sessao apos logout manual ou expiracao do periodo confiavel.

## 8) Fora de escopo

- Substituir o fluxo de tutor por login com senha nesta iteracao.
- SSO corporativo externo para clinicas parceiras.
- Multiplos usuarios nominais por clinica/unidade com perfis distintos.
- Envio de laudos/PDF sensiveis por email ou WhatsApp.
- Automacao obrigatoria do envio via WhatsApp antes da liberacao operacional do provider oficial.
