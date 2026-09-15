# Spec - whatsapp-notificacao-push-mensagem-recebida

## Requisitos funcionais

- RF-001: `push_notifications.py` ganha `WHATSAPP_PUSH_ACTIONS_ORDER = ("mensagem_recebida",)`,
  incluído em `PUSH_ACTIONS_ORDER`/`PUSH_ACTIONS_SET`.
- RF-002: `send_whatsapp_message_push_notification(db, *, conversation_id, contact_label=None, body_preview=None)`
  monta um payload com `title` ("Nova mensagem de {contato}" ou
  "Nova mensagem no WhatsApp" sem contato), `body` (preview truncado em
  160 caracteres, ou uma frase padrão se vazio), `url="/whatsapp-stage"`,
  `data.module="whatsapp"`, `data.conversation_id`, e chama
  `send_web_push_payload` com `notification_action="mensagem_recebida"`
  — sem `exclude_user_id` (é broadcast, não há "autor" da ação a
  excluir).
- RF-003: `POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida`
  (protegido por `_require_internal_token`, mesmo mecanismo do endpoint de
  resposta de botão de agenda) recebe `{conversation_id, contact_label,
  body_preview}` e chama a função acima.
- RF-004: no `whatsapp-stage-backend`, toda mensagem inbound persistida
  com sucesso (`inserted === true`, qualquer `message.type`) dispara uma
  chamada não-bloqueante para esse endpoint, com o token
  `WHATSAPP_INTERNAL_API_TOKEN` já usado para o bridge de agenda.
- RF-005: falha na chamada de notificação (rede, timeout, backend fora do
  ar) é capturada e logada como aviso — nunca propaga exceção para o
  fluxo do webhook.
- RF-006: `frontend/app/configuracoes/page.tsx` ganha
  `TIPOS_PUSH_WHATSAPP_OPCOES` (hoje só `mensagem_recebida`), incluída em
  `TIPOS_PUSH_OPCOES`/`TIPOS_PUSH_VALIDOS`, com checkbox próprio na aba
  "Minha conta" e incluída na reconstrução de
  `notificacoes_push_tipos` em `alternarTipoPushAgenda`.

## Requisitos não funcionais

- NFR-001 (não bloqueio): a notificação nunca deve impedir ou atrasar
  significativamente o ack do webhook do WhatsApp à Meta (chamada não
  aguardada no Node).
- NFR-002 (broadcast, sem granularidade por atendente): todos os usuários
  com push habilitado e a preferência `mensagem_recebida` marcada
  recebem, independente de quem está atribuído à conversa.
- NFR-003 (compatibilidade): usuários sem `configuracoes_usuario` (ou com
  `notificacoes_push_tipos IS NULL`) recebem por padrão (comportamento já
  existente de "sem config = habilitado + todos os tipos").

## Contratos de API

### `POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida`

Header: `X-FortCordis-WhatsApp-Token: <WHATSAPP_AGENDA_INTERNAL_TOKEN>`.

Corpo:
```json
{ "conversation_id": "42", "contact_label": "Clinica Teste", "body_preview": "Ola, gostaria de confirmar o horario." }
```

Resposta `200`: `{ "sent": 0, "failed": 0, "deactivated": 0 }` (contagens
de envio do `send_web_push_payload`). `401` sem token válido.

## Critérios de aceitação

- CA-001: `"mensagem_recebida"` está em `PUSH_ACTIONS_SET`.
- CA-002: `send_whatsapp_message_push_notification` monta título com o
  nome do contato quando informado, e título genérico quando não.
- CA-003: corpo do preview nunca excede 160 caracteres.
- CA-004: `send_whatsapp_message_push_notification` não passa
  `exclude_user_id` (broadcast real).
- CA-005: endpoint sem o token correto retorna `401`.
- CA-006: marcar/desmarcar o checkbox "Mensagem recebida" em Configurações
  persiste corretamente (não é descartado pela reconstrução da lista).
