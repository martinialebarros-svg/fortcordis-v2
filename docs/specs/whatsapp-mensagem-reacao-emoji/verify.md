# Verify - whatsapp-mensagem-reacao-emoji

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `scripts/test-webhook-message-body.ts`: `{type:"reaction", reaction:{emoji:"👍"}}` → `"Reagiu com 👍"` | passou |
| CA-002 | Mesmo script: `{type:"reaction", reaction:{emoji:""}}` e `{type:"reaction"}` (sem campo `reaction`) → `"Removeu a reação"` | passou |
| CA-003 | Mesmo script: `text`, `image` (com/sem legenda), `audio` continuam iguais; tipo desconhecido continua vazio | passou |

## Comandos executados

```bash
cd whatsapp-stage-backend
npx tsc --noEmit
npm run test:webhook-message-body
```

## Resultado final - 2026-08-18

- `tsc --noEmit`: limpo.
- `npm run test:webhook-message-body`: passou (8 asserções).

Achado a partir de um print real de produção enviado pelo usuário
("Meu Pet Xodó" reagindo a uma mensagem de laudo disponível), mostrando
`[reaction]` na tela. Corrigido e testado antes do deploy.
