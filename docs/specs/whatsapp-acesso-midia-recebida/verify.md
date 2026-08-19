# Verify - whatsapp-acesso-midia-recebida

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | Teste de componente: mensagem `type: "text"` não renderiza `WhatsAppMediaViewer` (retorna `null` antes de qualquer botão) | passou |
| CA-002 | Teste "carrega e exibe a mídia recebida ao clicar no botão": clique em "Ver imagem" troca o botão por `<img>` com o blob carregado | passou |
| CA-003 | `test-message-media.ts`: imagem com `metadata.message.image = {}` (sem `id`) retorna `404` | passou |
| CA-004 | `test-message-media.ts`: documento com `media_id` inválido retorna `502` (Graph API rejeitou o token/id, capturado e traduzido) | passou |
| CA-005 | `test-message-media.ts`: `messageId` inexistente retorna `404` | passou |

## Bug de teste encontrado (não do código de produção)

O primeiro mock do teste de frontend usava `new Response(new Blob([...]), { status: 200 })`
para simular a resposta binária — o jsdom (ambiente de teste) não lida
bem com `Blob` dentro de `Response` real, fazendo `.blob()` falhar
silenciosamente. Troquei por um objeto simples `{ ok: true, status: 200,
blob: async () => new Blob([...]) }`, que expõe só a interface que o
componente realmente usa. Confirmado que o código de produção (browser
real) não tem esse problema — é uma limitação específica do polyfill de
teste.

## Comandos executados

```bash
cd whatsapp-stage-backend
npx tsc --noEmit
npm run test:message-media   # contra Postgres local

cd ../frontend
npx eslint app/whatsapp-stage/page.tsx app/whatsapp-stage/page.test.tsx --max-warnings=0
npx tsc --noEmit
npx vitest run app/whatsapp-stage/page.test.tsx
npx next build
```

## Verificação manual (Postgres local + curl)

1. Conversa e 3 mensagens sintéticas criadas (`text`, `document` com
   `media_id` falso, `image` sem `id`).
2. `GET .../messages/<id-texto>/media` → `422`.
3. `GET .../messages/<id-documento>/media` → `502`, log confirmou que a
   chamada realmente saiu para `graph.facebook.com` e voltou com erro de
   token (não um bug de request malformado do nosso lado).
4. `GET .../messages/<id-imagem-sem-id>/media` → `404`.
5. `GET .../messages/999999/media` (inexistente) → `404`.
6. Dados sintéticos removidos após o teste manual.

## Resultado final - 2026-08-19

- `tsc --noEmit` (backend Node): passou.
- `npm run test:message-media`: passou (4 cenários).
- ESLint + `tsc --noEmit` (frontend): passaram sem avisos.
- Vitest (`page.test.tsx`): 11 testes passaram (1 novo desta feature, sem
  regressão nos 10 já existentes).
- `next build`: passou; rota `/whatsapp-stage` gerada (11.3 kB).

Risco residual: sem cache, mídia muito antiga pode falhar ao carregar se
a Meta já não a mantiver disponível para download — nesse caso o
atendente vê "Falha ao carregar. Tentar de novo", sem alternativa
(mencionado no intent.md como decisão consciente de escopo).

## Resultado do fallback de áudio - 2026-08-19

- Usuário reportou em produção: imagem carregou normalmente, áudio deu
  "Erro" no player do Safari (WebKit não decodifica Opus/OGG).
- Adicionado handler `onError` no elemento `<audio>` que troca para um
  link "baixar para ouvir em outro app" quando a reprodução falha.
- Novo teste `oferece baixar o áudio quando o navegador não consegue
  tocar`: simula `fireEvent.error` no elemento `<audio>` e confirma que o
  player some e o link de download aparece.
- `npx vitest run app/whatsapp-stage/page.test.tsx`: 12 testes passaram
  (1 novo, sem regressão nos 11 já existentes).
- `npx eslint`, `npx tsc --noEmit`, `npx next build`: todos passaram.

Risco residual adicional: o link de download baixa o arquivo Opus/OGG
original — quem não tiver um player compatível no computador ainda
precisa de outro app para ouvir. Transcodificação server-side (ffmpeg)
ficou fora do escopo; reconsiderar se isso continuar sendo fricção real.
