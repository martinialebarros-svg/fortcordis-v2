# Plan - whatsapp-reenvio-mensagem-falha

## Fase 1 - frontend

- [x] P1.1 `handleResendMessage` em `whatsapp-stage/page.tsx`,
  reaproveitando o mesmo `POST /conversations/:id/messages` do composer
  (mesmo tratamento de erro 409/janela de atendimento);
- [x] P1.2 botão "Reenviar" no rodapé da bolha, visível só para
  `from_me && status === "failed"`, com estado de loading por mensagem
  (`resendingMessageId`);
- [x] P1.3 estilo `.fc-wa-resend-button` em `globals.css`.

## Fase 2 - verificação

- [x] P2.1 novo teste `reenvia uma mensagem com falha` em
  `page.test.tsx`: confirma que o botão só aparece para mensagem
  `failed`, que o POST sai com body/type corretos, e que a UI reflete o
  sucesso;
- [x] P2.2 `npx tsc --noEmit`, `npx eslint --max-warnings=0`, `npx
  vitest run`, `npx next build` — todos sem erros.

## Rollback

- Remover o botão e `handleResendMessage` restaura o comportamento
  anterior (reescrever a mensagem manualmente no composer). Nenhuma
  migração ou mudança de backend envolvida — reaproveita endpoint já
  existente.
