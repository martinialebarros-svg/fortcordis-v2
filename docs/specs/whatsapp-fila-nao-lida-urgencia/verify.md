# Verify - whatsapp-fila-nao-lida-urgencia

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `curl PATCH /conversations/1/seen` seguido de `GET /conversations`: conversa 1 passou a `unread: false`, conversa 13 (sem seen) manteve `unread: true` | passou |
| CA-002 | Teste `mostra indicador de não lida e marca como vista ao abrir a conversa` em `page.test.tsx`: clicar em "Contato Pendente" dispara `PATCH /whatsapp/conversations/60/seen` e o indicador some | passou |
| CA-003 | Coberto indiretamente: mock reutiliza o mesmo `last_inbound_at` em `GET .../messages`; a lógica de `hasNewInbound` (comparação de string) foi validada por inspeção do fluxo — poll silencioso com o mesmo valor não re-dispara `seen` (mesma branch usada pelos testes antigos, que só chamam `seen` uma vez na carga inicial) | passou |
| CA-004 | `curl GET /conversations?limit=3`: conversa não lida (id 13) veio antes da conversa recém-marcada como vista (id 1) | passou |

## Comandos executados

```bash
cd whatsapp-stage-backend
npx tsc --noEmit
npm run migrate   # aplica last_seen_at localmente

cd ../frontend
npx eslint app/whatsapp-stage/page.tsx app/whatsapp-stage/page.test.tsx --max-warnings=0
npx vitest run app/whatsapp-stage/page.test.tsx
npx next build
```

## Verificação manual (API, Postgres local `fortcordis_stage`)

1. `GET /conversations?limit=3` antes de qualquer `seen`: ambas as conversas
   de teste (`1` e `13`) vieram com `unread: true` (nunca vistas).
2. `PATCH /conversations/1/seen` → `200` com `last_seen_at` preenchido.
3. `GET /conversations?limit=3` de novo: conversa `13` (`unread: true`)
   veio antes da conversa `1` (`unread: false`), confirmando a nova
   ordenação.
4. `PATCH /conversations/999999/seen` (inexistente) → `404`.
5. `GET /conversations/1/messages?limit=1` retornou `last_inbound_at` no
   nível raiz do payload.

## Resultado final - 2026-08-18

- `tsc --noEmit` (whatsapp-stage-backend): passou.
- ESLint direcionado (frontend): passou sem avisos.
- Vitest direcionado (`page.test.tsx`): 10 testes passaram (1 novo desta
  feature, mais os 9 já existentes — nenhuma regressão).
- `next build`: passou; rota `/whatsapp-stage` gerada (10.8 kB).
- Verificação manual de API (Postgres local): passou em todos os pontos
  acima.

Risco residual: modelo de "não lida" é compartilhado/global, não por
atendente — reabrir uma conversa já vista por outra pessoa não a marca como
não lida de novo, mesmo que o atendente atual ainda não a tenha visto
pessoalmente.

## Bug de ordenação corrigido - 2026-08-19

Usuário reportou que uma reserva automática enviada com sucesso para a
clínica "Lá no Pet" não aparecia na Central de Atendimento. Investigação
confirmou envio bem-sucedido (sem erro no modal) — o problema era só de
ordenação: `last_inbound_at ASC NULLS LAST` aplicava globalmente,
empurrando qualquer conversa sem mensagem recebida (`last_inbound_at
NULL`) para o fim da lista, atrás de QUALQUER conversa com
`last_inbound_at` preenchido por mais antigo que fosse — mesmo que a
conversa sem inbound tivesse acabado de ser criada/atualizada.

Fix: `CASE WHEN <mesma condição do unread> THEN c.last_inbound_at END
ASC NULLS LAST` restringe esse critério de desempate ao grupo de
não-lidas; fora dele, a ordenação cai direto para `last_activity_at
DESC`.

- Novo teste `scripts/test-conversation-ordering.ts`
  (`npm run test:conversation-ordering`): 4 conversas sintéticas (não
  lida recente, não lida antiga, lida antiga, só-enviada-agora sem
  inbound) confirmam a ordem exata esperada, cobrindo especificamente o
  cenário do bug relatado. Passou.
- `npm run test:inbox-ui`, `test:webhook-message-body`,
  `test:webhook-cleanup-config`, `test:smoke-cleanup` (todos tocam
  `conversations`/Postgres): sem regressão.
- `npx tsc --noEmit`: passou.

Nota técnica: a primeira tentativa do fix referenciava o alias `unread`
(computado no `SELECT`) dentro do `CASE` do `ORDER BY` — falhou com
"column unread does not exist" no Postgres. `ORDER BY` só resolve alias
do `SELECT` em referência direta (`ORDER BY unread`), não dentro de uma
expressão mais complexa; foi preciso repetir a condição booleana
completa dentro do `CASE`.
