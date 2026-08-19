# Spec - whatsapp-acesso-midia-recebida

## Requisitos funcionais

- RF-001: `GET /conversations/:id/messages/:messageId/media` (autenticado,
  mesmo `requireApiAuth` de `/conversations`) retorna `404` se a mensagem
  não existir ou não pertencer à conversa informada.
- RF-002: retorna `422` se `messages.type` não estiver em
  `{image, audio, video, document, sticker}`.
- RF-003: retorna `404` se o `media_id` não estiver presente no
  `metadata.message.<type>.id` da mensagem (ex.: payload incompleto).
- RF-004: retorna `500` se `WHATSAPP_ACCESS_TOKEN` não estiver configurado
  no ambiente.
- RF-005: em caso de sucesso, resolve o `media_id` via
  `GET https://graph.facebook.com/{version}/{media_id}` (Bearer token),
  depois busca o binário na `url` temporária retornada (mesmo Bearer
  token), e responde com `Content-Type` igual ao `mime_type` recebido.
- RF-006: para `document`, inclui `Content-Disposition: inline;
  filename="..."` com o nome de arquivo original.
- RF-007: qualquer falha na comunicação com a Graph API (token inválido,
  mídia expirada, erro de rede) resulta em `502` com mensagem clara,
  nunca deixa a exceção sem resposta.
- RF-007a: se o `mime_type` do binário retornado contém `ogg` (áudio de
  voz do WhatsApp, Opus dentro de contêiner OGG), o serviço tenta
  transcodificar para MP3 (`ffmpeg-static`, via `spawn`, stdin/stdout,
  sem tocar disco) antes de responder; em caso de falha na
  transcodificação (timeout, ffmpeg indisponível, entrada corrompida),
  serve o binário original sem quebrar a resposta.
- RF-008: no frontend, cada mensagem recebida (`from_me: false`) cujo
  `type` seja baixável mostra um botão de ação; ao clicar, busca o
  binário autenticado e troca o botão pelo preview inline
  (imagem/áudio/vídeo) ou por um link de salvar (documento).
- RF-009: mensagens enviadas por nós (`from_me: true`) nunca mostram esse
  botão, independente do tipo.

- RF-007b: o deploy da VPS (`scripts/deploy_prod_vps.sh`) confirma, de
  forma não-fatal, que o binário do `ffmpeg-static` foi instalado e é
  executável logo após o `npm ci` do `whatsapp-stage-backend`, registrando
  o resultado no log do deploy (mesmo padrão já usado para verificar o
  Tesseract OCR).
- RF-007c: toda mensagem de áudio, ao buscar a mídia, registra no console
  do navegador o `Content-Type` da resposta e o `type`/tamanho do Blob
  resultante; se o elemento `<audio>` disparar `onError`, também registra
  o código do `MediaError` e o `currentSrc` — diagnóstico para falhas de
  reprodução sem depender de acesso à aba Network do DevTools.
- RF-007d: o link de fallback de áudio baixa o arquivo como `audio.mp3`
  (refletindo o formato realmente servido), não mais `audio.ogg`.

## Requisitos não funcionais

- NFR-001 (privacidade): o binário nunca é persistido no banco do serviço
  WhatsApp nem em disco — sempre buscado ao vivo na Meta por solicitação
  explícita do atendente.
- NFR-002 (desempenho): nenhuma mídia é buscada automaticamente ao
  carregar a conversa — só sob clique explícito.
- NFR-003 (memória do navegador): o blob URL criado no frontend é revogado
  (`URL.revokeObjectURL`) quando o componente da mensagem é desmontado.

## Contratos de API

### `GET /conversations/:id/messages/:messageId/media`

Resposta `200`: corpo binário, `Content-Type` = mime type original,
`Content-Disposition: inline` (com filename para documentos).

Erros: `404` (mensagem/mídia não encontrada), `422` (tipo sem mídia
baixável), `500` (config ausente), `502` (falha na Graph API).

## Critérios de aceitação

- CA-001: mensagem de texto não mostra nenhum botão de mídia.
- CA-002: mensagem de imagem recebida mostra "Ver imagem"; ao clicar,
  vira uma tag `<img>` com o conteúdo buscado.
- CA-003: mensagem sem `media_id` no metadata retorna `404` ao tentar
  buscar.
- CA-004: falha na Graph API (token inválido, mídia inexistente) retorna
  `502` de forma controlada, sem quebrar a requisição.
- CA-005: mensagem inexistente ou de outra conversa retorna `404`.
- CA-006: quando o elemento `<audio>` dispara `onError` (navegador não
  suporta o codec/contêiner), o player é substituído por um link de
  download do arquivo já carregado, em vez de deixar um player quebrado.
- CA-007: áudio de voz do WhatsApp (`mime_type` contendo `ogg`) é
  transcodificado para MP3 antes de chegar ao navegador, tocando inline
  sem cair no fallback de download em uso normal.
- CA-008: entrada inválida/corrompida na transcodificação rejeita com
  erro tratado (não trava o processo, não derruba a requisição) e a
  resposta cai para o binário original.
