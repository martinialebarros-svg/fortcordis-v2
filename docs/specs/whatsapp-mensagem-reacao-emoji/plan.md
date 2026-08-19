# Plan - whatsapp-mensagem-reacao-emoji

## Fase 1 - implementação

- [x] P1.1 campo `reaction` em `WebhookMessage`;
- [x] P1.2 `case "reaction"` em `extractMessageBody`, exportando a
  função para permitir teste direto;
- [x] P1.3 `scripts/test-webhook-message-body.ts` + entrada
  `test:webhook-message-body` no `package.json`.

## Rollback

- Reverter o `case "reaction"` (volta a cair no `default`, corpo vazio,
  frontend mostra `[reaction]` de novo). Sem migração envolvida.
