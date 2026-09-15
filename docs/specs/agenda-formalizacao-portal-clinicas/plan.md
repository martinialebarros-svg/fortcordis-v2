# Plan - agenda-formalizacao-portal-clinicas

## Fase 1 - modelo de dados do convite

- [x] P1.1 `AgendaFormalizacaoInvite` (`backend/app/models/agenda_formalizacao.py`):
  `agendamento_id`, `token_hash`, `status`, `expires_at`, `used_at`,
  `revoked_at`.
- [x] P1.2 migração `20260820_74_agenda_formalizacao_invites.py`
  (Postgres + SQLite, 4 índices), idempotente.
- [x] P1.3 teste de migração (`test_agenda_formalizacao_migration.py`):
  roda `upgrade()` duas vezes, confirma colunas/índices.

## Fase 2 - serviço de convite + endpoints públicos

- [x] P2.1 `backend/app/services/agenda_formalizacao_service.py`:
  `criar_ou_reutilizar_convite`, `obter_convite_valido`,
  `obter_contexto_publico`, `processar_submissao`,
  `build_formalizacao_url`. Reaproveita `hash_secret`/
  `generate_opaque_token` de `portal_clinic_auth_service.py` e
  `_resolve_destination` de `whatsapp_reminder_scheduler_service.py`.
- [x] P2.2 `GET`/`POST /api/v1/agenda/formalizacao/{token}` em
  `whatsapp_agenda.py` (públicos, sem `get_current_user`).
- [x] P2.3 `POST /api/v1/integracoes/whatsapp/agenda/{agendamento_id}/link-formalizacao`
  (protegido pelo token interno) para o Node gerar o link sob demanda.
- [x] P2.4 `PUBLIC_APP_BASE_URL` e
  `AGENDA_FORMALIZACAO_INVITE_DEFAULT_HOURS` em `config.py`/`.env.example`.
- [x] P2.5 13 testes novos em `test_agenda_formalizacao_service.py`
  cobrindo prazo do convite, revogação do convite anterior, expiração,
  contexto público, criação/reaproveitamento de tutor, falha
  best-effort da notificação, campos obrigatórios, convite já usado.

## Fase 3 - handler dos botões do WhatsApp (Node)

- [x] P3.1 `approved_template_button_events` (migração
  `whatsapp-stage-backend/migrations/init.sql`) — idempotência por
  `provider_message_id`, FK para `approved_template_messages`.
- [x] P3.2 `src/services/approvedTemplateButtonService.ts`:
  `handleApprovedTemplateButtonReply` casa o payload via
  `jsonb_array_elements(button_bindings)`, valida remetente, despacha
  `enviar_dados` (chama P2.3, envia o link como texto livre) e
  `falar_equipe` (chama o endpoint de resposta existente).
- [x] P3.3 fio em `webhookController.ts`, ao lado de
  `handleAgendaButtonReply` (fluxo de `reservation`, intocado).
- [x] P3.4 `Action`/`process_button_response`
  (`whatsapp_agenda_service.py`) ganham `"falar_equipe"` — alerta
  interno, independente do status do agendamento.
- [x] P3.5 teste de integração
  (`scripts/test-approved-template-button-events.ts`, requer Postgres
  local) cobrindo: link gerado e enviado, idempotência em reentrega do
  webhook, `falar_equipe` roteado corretamente, remetente divergente
  rejeitado sem side effect.

## Fase 4 - modelo "agendamento formalizado" no catálogo

- [x] P4.1 `AgendaUtilityTemplateKey`/`ApprovedUtilityTemplateKey`
  ganham `"appointmentFormalized"`; `build_agenda_utility_template`
  monta os 7 parâmetros (destinatário, serviço, paciente, tutor, data,
  hora, unidade).
- [x] P4.2 catálogo Node (`approvedTemplates.ts`,
  `templateAutomationController.ts`, `templateCatalogController.ts`)
  com `metaId: "PENDING_META_APPROVAL"` — placeholder documentado até a
  Meta aprovar o modelo submetido (`docs/specs/agenda-reserva-formalizacao-dados-pendentes/intent.md`).
- [x] P4.3 teste novo (`test_build_agenda_utility_template_formalized_monta_sete_parametros`)
  e teste do catálogo Node (`test-approved-templates.ts`) atualizados.

## Fase 5 - página pública

- [x] P5.1 `frontend/app/agenda/formalizar/[token]/page.tsx` +
  `components/agenda/AgendaFormalizacaoWorkspace.tsx` — sem
  `DashboardLayout`, sem autenticação, mesmo esqueleto visual de
  `clinica-parceira/ativar/[token]`.
- [x] P5.2 `lib/agenda-formalizacao-api.ts` (fetch dedicado, reaproveita
  `portalErrorMessageFromBody`).
- [x] P5.3 teste de componente
  (`AgendaFormalizacaoWorkspace.test.tsx`): fluxo feliz completo e erro
  de link inválido.

## Fase 6 - verificação de ponta a ponta

- [x] P6.1 suíte completa do backend (838 testes), Node (`tsc`,
  suíte existente + a nova), frontend (`tsc`, `eslint`, `vitest`,
  `next build`).
- [x] P6.2 clique real no navegador: servidor local (SQLite) + frontend
  dev, convite gerado via `criar_ou_reutilizar_convite`, formulário
  preenchido e enviado, confirmado no banco (status `Agendado`,
  paciente/tutor vinculados, convite `used`) e nos logs do servidor
  (200 no GET e no POST, sem exceptions).

## Rollback

- Fases 1-2: reverter a migração remove só a tabela nova
  (`agenda_formalizacao_invites`), sem tocar em dado existente de
  `agendamentos`.
- Fase 3: reverter a migração remove `approved_template_button_events`;
  remover a chamada em `webhookController.ts` volta ao comportamento
  atual (clique em "Enviar dados"/"Falar com a equipe" não faz nada,
  como já era antes desta entrega).
- Fase 4: o envio usa `APPROVED_UTILITY_TEMPLATES[key].name` (não
  `metaId`, que é só exibido no catálogo) — a Graph API já rejeita
  sozinha o envio enquanto `agendamento_formalizado` não estiver
  aprovado; `metaId: "PENDING_META_APPROVAL"` é só um lembrete visual
  no catálogo para atualizar o ID assim que a Meta aprovar.
- Fase 5: página nova e isolada, sem efeito em nenhuma rota existente.
