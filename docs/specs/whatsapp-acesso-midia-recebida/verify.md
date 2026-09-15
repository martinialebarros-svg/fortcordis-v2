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

## Resultado da transcodificação de áudio (correção de diagnóstico) - 2026-08-19

Usuário reportou falha também em Chrome (não só Safari) e confirmou que o
arquivo baixado abre normalmente em outro app — descartando corrupção e
invalidando o diagnóstico "Safari-specific". Causa raiz: contêiner
OGG/Opus do WhatsApp rejeitado pelos decoders `<audio>` dos navegadores
de forma geral.

- Confirmado que não havia ffmpeg no sistema nem uso prévio no repositório
  (`grep` vazio); instalado `ffmpeg-static@5.3.0` via npm.
- Validado manualmente via bash antes de escrever código: gerado um
  OGG/Opus sintético (`ffmpeg -f lavfi -i "anullsrc=..." -c:a libopus`) e
  transcodificado para MP3 tanto por arquivo quanto pelo padrão exato de
  pipe stdin/stdout (`cat ... | ffmpeg -i pipe:0 ... pipe:1`), confirmado
  MP3 válido via `file`.
- `transcodeOggOpusToMp3` implementada em `whatsappService.ts`
  (`child_process.spawn`, timeout de 20s com `SIGKILL`, sem tocar disco).
  `downloadWhatsAppMedia` passou a chamar essa função quando o
  `mime_type` retornado pela Graph API contém `ogg`, com fallback para o
  binário original em caso de falha (nunca quebra a resposta).
- `npx tsc --noEmit`: passou.
- Novo `scripts/test-audio-transcode.ts` (`npm run test:audio-transcode`):
  gera um OGG/Opus sintético via `ffmpeg-static`, chama a função real
  (não o CLI), valida assinatura MP3 (ID3/frame sync) na saída, e confirma
  que entrada inválida rejeita com erro (`ffmpeg exited with code ...`)
  em vez de travar o processo. Passou.
- `npm run test:message-media` (regressão): passou, sem mudança de
  comportamento nos cenários existentes (404/422/502).

Risco residual: sem cache de transcodificação — cada visualização de
áudio roda o ffmpeg de novo (aceitável para o volume esperado, arquivos de
voz são curtos). Se a transcodificação falhar por qualquer motivo, o
binário original ainda é servido e o fallback `onError` do frontend
continua ativo como rede de segurança.

## Investigação pós-deploy em produção - 2026-08-19

Usuário testou em produção após o deploy: o arquivo baixado ainda veio
como `.ogg` (não `.mp3`), indicando que a transcodificação está caindo no
fallback silenciosamente em produção. Como a transcodificação sempre
serve o original em caso de falha (por desenho, para nunca quebrar a
resposta), isso não gerou erro visível — só o resultado indesejado de não
converter.

Hipótese mais provável: o binário `ffmpeg-static` baixado durante `npm
ci` na VPS de produção não está presente/executável (`index.js` do pacote
resolve o caminho esperado do binário só com base em
`platform`/`arch` reconhecidos — **sem checar se o arquivo realmente
existe em disco**), então `ffmpegPath` aponta para um arquivo inexistente
e o `spawn` falha.

Duas mudanças para diagnosticar e blindar sem precisar de outro round-trip
de produção:
- `transcodeOggOpusToMp3` (`whatsappService.ts`) agora chama
  `existsSync(ffmpegPath)` explicitamente antes de tentar `spawn`, com
  mensagem de erro específica ("binary download likely failed during npm
  install") em vez de deixar o `spawn` falhar com um erro genérico de
  ENOENT.
- O log de fallback (`logger.warn`) passou a incluir `mimeType`,
  `rawBufferBytes` e o `ffmpegPath` resolvido, para descartar outras
  hipóteses (ex.: `mime_type` não contendo "ogg") na próxima ocorrência.
- `scripts/deploy_prod_vps.sh`: nova função `ensure_ffmpeg_static_binary`
  (mesmo padrão não-fatal já usado para Tesseract OCR em
  `ensure_eco_study_ocr_dependencies`) chamada logo após o `npm ci` do
  `whatsapp-stage-backend`, que resolve o binário via
  `require('ffmpeg-static')`, confirma que existe e é executável, e loga
  a versão. Não fatal — objetivo é aparecer no log do deploy (lido via
  `gh run view --log`, sem precisar de SSH na VPS) e confirmar/descartar
  a hipótese antes de decidir o próximo passo.

Ainda não confirmado definitivamente até reler o log do próximo deploy.

## Diagnóstico do ffmpeg confirmado negativo - hipótese descartada - 2026-08-19

Deploy do diagnóstico feito em stage e produção. Em ambos os ambientes
(mesma VPS, apps distintos) o log do deploy confirmou:
`ffmpeg-static binary ready: .../node_modules/ffmpeg-static/ffmpeg
(ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/)` — o
binário existe, é executável e funciona nos dois ambientes. Hipótese de
"binário ausente" **descartada**.

Nota técnica sobre o processo de deploy: como `scripts/deploy_prod_vps.sh`
faz `git reset --hard` em si mesmo durante a própria execução, o processo
bash já em execução continua rodando a versão do script que existia
*antes* do reset (o shell não relê o arquivo do meio da execução) — então
qualquer mudança no próprio script de deploy só tem efeito prático a
partir do deploy *seguinte*. Para confirmar o diagnóstico sem esperar
outro commit, usei `gh run rerun --job <id>` no mesmo job: como o código
já estava atualizado em disco pelo deploy anterior, o rerun executa a
versão nova do script imediatamente.

Usuário testou de novo em produção (reload completo + novo clique) e o
erro persistiu — descartando também a hipótese de estado do componente
React preso de uma tentativa anterior (o link de fallback, uma vez
mostrado, não tem como acionar novo carregamento — outro ponto a
melhorar, mas não a causa raiz aqui).

**Descoberta decisiva**: o usuário anexou o arquivo baixado
(`audio (1).ogg`, 46508 bytes). Inspeção teve dois resultados
aparentemente contraditórios:
- `file` (assinatura/magic bytes): identifica corretamente como MP3
  válido (`ID3 version 2.4.0 ... MPEG ADTS, layer III, v1, 128 kbps,
  48 kHz, Monaural`) — confirma que a transcodificação no servidor está
  **funcionando** (bitrate/sample rate batem exatamente com os parâmetros
  do `ffmpeg` usado no código).
- Verificação byte-a-byte de todos os 121 frames MPEG do arquivo (script
  Python ad-hoc): 100% estruturalmente válido, sem truncamento, sem
  frame corrompido, tamanho final bate exato com o fim do arquivo.
- `afinfo` (Core Audio, macOS) recusa abrir o arquivo — tanto com a
  extensão original quanto renomeado para `.mp3`. Isso inicialmente
  pareceu um sinal de arquivo quebrado, mas foi descartado como pista
  falsa: reproduzi o mesmo comando `ffmpeg` (pipe stdin/stdout,
  `-f mp3 -codec:a libmp3lame -b:a 128k`) localmente com um tom de teste
  sintético, e o resultado **abre normalmente no `afinfo`** — ou seja,
  `afinfo`/Core Audio é mais estrito que os decoders de navegador em
  geral, não é um teste confiável para prever o comportamento real do
  `<audio>` do Chrome/Safari.
- Teste decisivo: servi o arquivo real (baixado da produção) e o arquivo
  sintético via um servidor HTTP local simples, e abri ambos em um
  Chromium real (Browser pane) com um `<audio>` de teste. **Os dois
  tocam perfeitamente** (`canplaythrough`, sem `error`). Isso prova que
  o arquivo produzido pela transcodificação de produção é 100% válido e
  reproduzível em um motor de navegador real — o problema não está no
  áudio em si, nem na transcodificação.

Conclusão: a falha está especificamente no caminho
fetch → blob → `URL.createObjectURL` → `<audio src>` dentro do app (ou
no proxy do Next.js entre o app e o `whatsapp-stage-backend`), não na
geração do arquivo. Provavelmente o `Content-Type`/tipo do Blob que chega
ao elemento `<audio>` não é `audio/mpeg` como esperado, mesmo com os
bytes corretos — mas isso não pôde ser confirmado sem acesso autenticado
à produção.

Mudança para obter essa confirmação sem exigir que o usuário abra a aba
Network do DevTools (mais fricção): `WhatsAppMediaViewer` passou a
logar no console do navegador, em toda mensagem de áudio: o
`Content-Type` da resposta do fetch, o `type`/tamanho do Blob resultante
(em `carregarMidia`), e — se o `<audio>` disparar `onError` — o código
numérico do `MediaError` (`event.currentTarget.error.code`: 1=abortado,
2=erro de rede, 3=erro de decodificação, 4=formato/src não suportado) e o
`currentSrc`. Também corrigido, de passagem: o link de fallback baixava
sempre com nome fixo `audio.ogg`, mesmo já servindo mp3 — trocado para
`audio.mp3` (cosmético, não relacionado à causa raiz, mas induzia ao erro
de diagnóstico "ainda está vindo ogg" quando na verdade eram bytes mp3
com nome de arquivo errado).

`npx tsc --noEmit`, `npx eslint --max-warnings=0`, `npx vitest run
app/whatsapp-stage/page.test.tsx` (12 testes, sem regressão) e `npx next
build`: todos passaram.

## Causa raiz confirmada: CSP bloqueando blob: em `<audio>` - 2026-08-19

Usuário seguiu o passo a passo (reload completo + F12 + Console + clicar
em "Ouvir áudio") e enviou print do console. A própria mensagem do
navegador revelou a causa raiz de forma definitiva:

```
Loading media from 'blob:https://app.fortcordis.com.br/...' violates the
following Content Security Policy directive: "default-src 'self'". Note
that 'media-src' was not explicitly set, so 'default-src' is used as a
fallback. The action has been blocked.
```

`frontend/next.config.js` define a Content-Security-Policy da aplicação
com `img-src 'self' data: blob: https:` (por isso imagem/sticker via blob
já funcionava) e `frame-src 'self' blob:`, mas **nunca teve uma diretiva
`media-src`** — então `<audio>`/`<video>` caem no fallback `default-src
'self'`, que não inclui `blob:`. O navegador bloqueia o carregamento do
blob ANTES de qualquer tentativa de decodificação — por isso a
transcodificação (que está correta, confirmado nas seções anteriores)
nunca teve chance de ser exercida de fato: o arquivo mp3 correto é
buscado e vira um Blob válido, mas o elemento `<audio>` é impedido pela
política de segurança de sequer carregar esse blob.

Fix: adicionada a diretiva `"media-src 'self' blob: https:"` em
`appContentSecurityPolicy` (`frontend/next.config.js`), no mesmo padrão
já usado para `img-src`. Confirmado localmente que o header
`Content-Security-Policy` servido pelo Next.js (`curl -I
http://localhost:3002/`) agora inclui `media-src 'self' blob: https:`.

Nota: como o vídeo (`<video src={blobUrl}>`) usa a mesma diretiva
`media-src`, esse mesmo bug provavelmente também afetava vídeo recebido
via WhatsApp — não havia sido reportado ainda, mas o fix cobre os dois
tipos de mídia igualmente.

`npx tsc --noEmit`, `npx eslint --max-warnings=0`, `npx next build`:
todos passaram (vitest não exercita o header de CSP, que é validado via
`curl` contra o servidor dev real).
