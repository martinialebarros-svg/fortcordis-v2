# Spec - whatsapp-mensagem-reacao-emoji

## Requisitos funcionais

- RF-001: `WebhookMessage` (`whatsapp-stage-backend/src/types/whatsapp.ts`)
  ganha o campo `reaction?: { message_id?: string; emoji?: string }`.
- RF-002: `extractMessageBody` (exportado) trata `type === "reaction"`:
  retorna `"Reagiu com {emoji}"` quando `reaction.emoji` está presente e
  não vazio; retorna `"Removeu a reação"` quando `emoji` está ausente ou
  vazio.
- RF-003: o corpo extraído é persistido em `messages.body` normalmente
  (nenhuma mudança de schema) e reaproveitado como está pelo preview da
  notificação push de mensagem recebida.

## Requisitos não funcionais

- NFR-001 (compatibilidade): tipos de mensagem já tratados (`text`,
  `button`, `interactive`, `image`, `audio`, `video`, `document`) e o
  `default` (corpo vazio) continuam com o mesmo comportamento.

## Critérios de aceitação

- CA-001: reação com emoji não vazio produz `"Reagiu com {emoji}"`.
- CA-002: reação sem emoji (removida) produz `"Removeu a reação"`.
- CA-003: tipos de mensagem já existentes não regridem.
