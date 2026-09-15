# Verify - whatsapp-stage-delivery-status-refresh

## Evidencia operacional anterior a correcao

- Mensagem real enviada pelo FortCordis recebeu `wamid` da Meta e chegou ao aparelho.
- O backend persistiu a transicao para `delivered`; uma recarga completa da tela mostrou o novo estado.
- A tela aberta antes do callback permaneceu em `sent`, confirmando defasagem apenas no frontend.

## Validacao automatizada

- `./node_modules/.bin/vitest run app/whatsapp-stage/page.test.tsx`: 1 arquivo e 1 teste aprovados; a atualizacao periodica troca `sent` por `delivered` sem exibir carregamento intermediario.
- `npm test`: 5 arquivos Vitest/25 testes e 9 testes Node aprovados.
- `npm run lint`: concluido sem erros ou avisos.
- `npm run build`: build de producao concluido; rota `/whatsapp-stage` gerada com sucesso.

## Validacao em stage pendente do deploy

- `/whatsapp-stage` carrega autenticado.
- A conversa real reflete `delivered/read` em ate cinco segundos sem recarga completa.
- A rota protegida `/whatsapp/conversations` continua retornando `401` sem credenciais.
