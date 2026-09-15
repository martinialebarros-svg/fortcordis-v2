# Plan - whatsapp-acesso-midia-recebida

## Fase 1 - backend

- [x] P1.1 `downloadWhatsAppMedia` em `whatsappService.ts` — 2 chamadas
  Graph API (metadata → url temporária → binário), reaproveitando
  `normalizeAxiosError`/`WhatsAppGraphApiError` já existentes;
- [x] P1.2 `getMessageMedia` em `conversationsController.ts` — resolve
  `media_id` a partir de `messages.metadata`, valida tipo/existência,
  chama o serviço, seta `Content-Type`/`Content-Disposition`;
- [x] P1.3 rota `GET /conversations/:id/messages/:messageId/media` em
  `app.ts`, dentro do prefixo já protegido por `requireApiAuth`.

## Fase 2 - frontend

- [x] P2.1 componente `WhatsAppMediaViewer` (estado idle/loading/error,
  `fetch` autenticado + `URL.createObjectURL`, revoga no unmount);
- [x] P2.2 botão de ação por tipo (`Ver imagem`/`Ouvir áudio`/`Ver
  vídeo`/`Baixar documento`/`Ver sticker`), só para `!message.from_me`;
- [x] P2.3 estilos `fc-wa-media-button`/`fc-wa-media-preview`/`fc-wa-media-download-link`.

## Fase 3 - verificação

- [x] P3.1 `scripts/test-message-media.ts`: mensagem inexistente (404),
  tipo texto (422), mídia sem `media_id` (404), falha controlada da
  Graph API (502) — todos chamando o controller direto, sem servidor;
- [x] P3.2 teste de componente (`page.test.tsx`): botão aparece só para
  mídia recebida, clique carrega e renderiza `<img>`;
- [x] P3.3 verificação manual via `curl` local com dados sintéticos
  (mesmos 4 casos do script, antes de escrevê-lo).

## Fase 4 - transcodificação de áudio (correção de diagnóstico)

Motivação: fallback `onError` (Fase anterior) tratava o sintoma; usuário
confirmou falha em Chrome também (não só Safari) e que o arquivo baixado
abre normalmente em outro app — causa raiz é o contêiner OGG/Opus do
WhatsApp sendo rejeitado pelos decoders `<audio>` dos navegadores, não
corrupção nem um bug de um navegador específico.

- [x] P4.1 dependência `ffmpeg-static` adicionada (`npm install`),
  confirmado binário com suporte a `libmp3lame`/`libopus`;
- [x] P4.2 `transcodeOggOpusToMp3(buffer): Promise<Buffer>` em
  `whatsappService.ts` — `spawn` com pipe stdin/stdout, timeout de 20s
  com `SIGKILL`, rejeita em erro/timeout/código de saída não-zero;
- [x] P4.3 `downloadWhatsAppMedia` chama a transcodificação quando
  `mime_type` contém `ogg`; sucesso → `audio/mpeg`; falha → loga aviso e
  serve o binário original inalterado (nunca quebra a resposta);
- [x] P4.4 `scripts/test-audio-transcode.ts` — gera um OGG/Opus sintético
  via `ffmpeg-static` (`anullsrc` + `libopus`), chama a função real
  (não só o binário via CLI), valida assinatura MP3 (ID3/frame sync) na
  saída e confirma que entrada inválida rejeita com erro em vez de
  travar;
- [x] P4.5 `npx tsc --noEmit`, `npm run test:audio-transcode`, `npm run
  test:message-media` (regressão) — todos passaram.

## Rollback

- Fase 1-3: remover a rota e o componente restaura o comportamento
  anterior (placeholder de texto). Nenhuma migração envolvida.
- Fase 4: remover a chamada a `transcodeOggOpusToMp3` em
  `downloadWhatsAppMedia` restaura o comportamento anterior (serve
  OGG/Opus original + fallback `onError` no frontend). Sem migração;
  `ffmpeg-static` pode ser desinstalado sem afetar mais nada.
