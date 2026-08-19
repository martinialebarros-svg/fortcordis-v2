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

## Rollback

- Remover a rota e o componente restaura o comportamento anterior
  (placeholder de texto). Nenhuma migração envolvida.
