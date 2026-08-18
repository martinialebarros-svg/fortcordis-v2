# Plan - whatsapp-fila-nao-lida-urgencia

## Fase 1 - backend

- [x] P1.1 migração: `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  last_seen_at TIMESTAMPTZ` em `init.sql`;
- [x] P1.2 `markConversationSeen` + rota `PATCH /conversations/:id/seen`;
- [x] P1.3 `listConversations`: coluna calculada `unread` + novo `ORDER BY`;
- [x] P1.4 `listConversationMessages`: expor `last_inbound_at` no corpo da
  resposta.

## Fase 2 - frontend

- [x] P2.1 interface `Conversation` ganha `unread`/`last_seen_at`,
  `MessagesResponse` ganha `last_inbound_at`;
- [x] P2.2 `lastSeenInboundRef` (por conversa) + chamada a `PATCH .../seen`
  na carga não-silenciosa e no poll silencioso só quando há mensagem nova;
- [x] P2.3 atualização otimista local (`unread: false`) sem esperar reload
  da lista;
- [x] P2.4 indicador visual (ponto) na lista de conversas + destaque sutil
  na linha não lida.

## Fase 3 - verificação

- [x] P3.1 testes de componente (indicador visível, marca como vista ao
  abrir, sem chamada duplicada em poll sem mudança);
- [x] P3.2 verificação manual via `curl` do backend (unread calculado,
  ordenação, endpoint de seen, 404);
- [x] P3.3 `tsc --noEmit`, ESLint direcionado, `next build`, `vitest run`.

## Rollback

- Reverter o `ORDER BY`/coluna calculada em `listConversations` e remover a
  rota `seen` restaura o comportamento anterior. A coluna `last_seen_at`
  pode ficar sem uso (nula para sempre) sem efeito colateral — não precisa
  de migração reversa.
