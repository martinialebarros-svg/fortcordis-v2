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

## Fase 4 - bug de ordenação (reserva automática "sumindo" da lista)

Usuário reportou: enviou uma reserva automática pelo botão "Enviar pelo
FortCordis" para a clínica "Lá no Pet" (envio confirmado com sucesso,
sem erro visível), mas a mensagem não aparecia na Central de Atendimento.

- [x] P4.1 causa raiz: `ORDER BY unread DESC, c.last_inbound_at ASC
  NULLS LAST, ...` aplicava o `NULLS LAST` **globalmente**, não só dentro
  do grupo de não-lidas — qualquer conversa sem `last_inbound_at` (nunca
  recebeu mensagem, ex.: reserva automática para clínica nova) caía
  sempre depois de QUALQUER conversa com `last_inbound_at` preenchido,
  mesmo antiga, em vez de competir por `last_activity_at` recente;
- [x] P4.2 fix: `CASE WHEN <condicao de unread> THEN c.last_inbound_at
  END ASC NULLS LAST` — só aplica esse critério de desempate dentro do
  grupo de não-lidas; fora dele, cai direto para `last_activity_at DESC`
  (nota: referenciar o alias `unread` calculado no SELECT dentro do CASE
  falhou com "column unread does not exist" no Postgres — ORDER BY
  resolve alias em referência direta, não dentro de expressões mais
  complexas — foi preciso repetir a condição booleana completa);
- [x] P4.3 novo teste `scripts/test-conversation-ordering.ts`: 4
  conversas (não lida recente, não lida antiga, lida antiga, só-enviada-
  agora-sem-inbound) confirmam a ordem correta, incluindo o caso do bug
  (conversa sem inbound recente deve vir antes de uma lida antiga).

## Rollback

- Reverter o `ORDER BY`/coluna calculada em `listConversations` e remover a
  rota `seen` restaura o comportamento anterior. A coluna `last_seen_at`
  pode ficar sem uso (nula para sempre) sem efeito colateral — não precisa
  de migração reversa.
