# Plan - whatsapp-notificacao-push-mensagem-recebida

## Fase 1 - backend principal (Python)

- [x] P1.1 `WHATSAPP_PUSH_ACTIONS_ORDER` no catálogo de
  `push_notifications.py`;
- [x] P1.2 `_build_whatsapp_message_title`/`_build_whatsapp_message_body`
  + `send_whatsapp_message_push_notification`;
- [x] P1.3 endpoint `POST /integracoes/whatsapp/notificacoes/mensagem-recebida`
  em `whatsapp_agenda.py`, protegido por `_require_internal_token`.

## Fase 2 - serviço WhatsApp (Node)

- [x] P2.1 `whatsappPushNotificationService.ts`: `notifyPushForInboundMessage`,
  mesmo padrão de bridge de `agendaButtonService.ts`, com try/catch
  próprio (nunca lança);
- [x] P2.2 chamada não-aguardada (`void ...`) em `handleInboundMessages`
  (`webhookController.ts`), para toda mensagem inbound persistida.

## Fase 3 - preferências do usuário (frontend)

- [x] P3.1 `TIPOS_PUSH_WHATSAPP_OPCOES` + checkbox na aba "Minha conta";
- [x] P3.2 corrigir `alternarTipoPushAgenda` para incluir a lista de
  WhatsApp na reconstrução de `notificacoes_push_tipos` (bug encontrado
  durante a implementação, antes de qualquer deploy);
- [x] P3.3 incluir `mensagem_recebida` no preset "Recepção".

## Fase 4 - verificação

- [x] P4.1 `backend/tests/test_whatsapp_push_notification.py` (catálogo,
  builders de título/corpo, payload montado corretamente, sem
  `exclude_user_id`);
- [x] P4.2 suíte completa do backend (`unittest discover`), sem
  regressão;
- [x] P4.3 `tsc --noEmit` nos dois serviços TypeScript, ESLint e
  `next build` no frontend;
- [x] P4.4 smoke manual local: endpoint real com token válido/inválido,
  confirmando `401` e `200` com contagens zeradas (sem subscriptions
  locais).

## Rollback

- Remover a chamada em `handleInboundMessages` interrompe o disparo sem
  afetar o resto do webhook.
- Remover o endpoint Python e o tipo do catálogo restaura o estado
  anterior — nenhuma migração envolvida (não há coluna nova, só um valor
  de catálogo em texto).
