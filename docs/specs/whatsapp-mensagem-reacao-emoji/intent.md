# Intent - whatsapp-mensagem-reacao-emoji

## Problema

Quando um contato reage com um emoji a uma mensagem no WhatsApp (recurso
nativo de "reagir", sem digitar texto), a Central de Atendimento mostrava
só o rótulo genérico `[reaction]` — descoberto a partir de um print real
de produção enviado pelo usuário. O tipo `"reaction"` não tinha nenhum
tratamento em `extractMessageBody` (`whatsapp-stage-backend/src/controllers/webhookController.ts`);
caía no `default` (corpo vazio), e o frontend preenchia com
`[${message.type}]` como placeholder — o mesmo mecanismo genérico já
usado para imagem/áudio/vídeo sem esses tipos terem tratamento
dedicado.

## Objetivo

Mostrar qual emoji foi usado na reação, em vez do rótulo genérico.

## Escopo inicial

- extrair `message.reaction.emoji` e gravar `"Reagiu com {emoji}"` como
  corpo da mensagem;
- tratar o caso de remoção de reação (Meta envia o evento de reação de
  novo, com `emoji` vazio) como `"Removeu a reação"`.

## Fora de escopo

- mostrar a qual mensagem a reação se refere (`message.reaction.message_id`
  existe no payload, mas exigiria buscar e exibir um trecho da mensagem
  original — deixado para uma iteração futura se fizer falta);
- backfill de mensagens `"reaction"` já persistidas antes desta mudança —
  elas continuam com corpo vazio e mostrando `[reaction]` no frontend, já
  que a extração acontece só no momento da inserção.

## Riscos e decisões

- `extractMessageBody` foi exportado (antes era função local do módulo)
  para permitir um teste de contrato dedicado
  (`scripts/test-webhook-message-body.ts`), seguindo o mesmo padrão já
  usado para `isConversationStatus` em `conversationsController.ts`.
- Corpo de reação também alimenta o preview da notificação push (feature
  `whatsapp-notificacao-push-mensagem-recebida`, que reusa
  `extractMessageBody`) — antes mostraria a mensagem genérica de fallback
  ("Abra a Central de Atendimento..."), agora mostra "Reagiu com 👍" no
  próprio push.
