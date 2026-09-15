# Intent - whatsapp-acesso-midia-recebida

## Problema

Quando um tutor manda uma foto de exame, um áudio ou um documento pelo
WhatsApp, o webhook só registrava um placeholder de texto (`[image]`,
`[audio]`, `[document]`) — o conteúdo em si nunca ficava acessível na
Central de Atendimento. O binário nunca é persistido pelo serviço WhatsApp
(por desenho, ver `whatsapp-financeiro-cobranca-recibo-pdf`), só o
`media_id` da Meta, guardado dentro de `messages.metadata` (JSON bruto do
webhook).

## Objetivo

Permitir que o atendente veja/ouça/baixe a mídia recebida diretamente na
conversa, sob demanda, sem persistir o binário no nosso banco.

## Escopo inicial

- endpoint `GET /conversations/:id/messages/:messageId/media` no
  `whatsapp-stage-backend`, que busca o `media_id` no metadata da mensagem,
  chama a Graph API (2 chamadas: metadata → URL temporária, depois a URL
  temporária → binário) e devolve o arquivo direto na resposta;
- suporte a `image`, `audio`, `video`, `document` e `sticker` — os únicos
  tipos que a Meta associa a um `media_id` baixável;
- frontend: botão "Ver imagem"/"Ouvir áudio"/"Ver vídeo"/"Baixar
  documento" por mensagem recebida com mídia, que busca o binário
  autenticado (`fetch` + token, igual ao padrão já usado para
  logomarca/assinatura em Configurações) e renderiza inline
  (`<img>`/`<audio>`/`<video>`) ou oferece um link de salvar (documento).

## Fora de escopo

- persistir o binário no banco ou em disco — sempre busca ao vivo na Meta,
  sob demanda (ver "Riscos e decisões" sobre o efeito colateral disso);
- pré-carregar mídia automaticamente ao abrir a conversa — só busca quando
  o atendente clica, para não gastar banda/chamadas à Graph API com
  conteúdo que ninguém vai olhar;
- mídia enviada por nós (`from_me = true`) — hoje o único caso de saída é o
  recibo PDF, que já tem seu próprio fluxo de entrega e não depende deste
  endpoint.

## Riscos e decisões

- **Sem cache**: a Meta mantém o `media_id` de uma mensagem recebida
  disponível para download por um período limitado (não documentado como
  um número fixo, mas na prática correlacionado à retenção normal da
  conversa, não indefinido). Se um atendente tentar ver uma mídia muito
  antiga, a Graph API pode responder com erro e o endpoint devolve `502`
  ("pode ter expirado"). Cache/download antecipado ficou fora do escopo
  desta entrega por simplicidade — se isso se tornar um problema real
  (atendentes reportando falha em mídia antiga), vale reconsiderar guardar
  uma cópia local.
- **Duas chamadas por visualização**: a Graph API não permite baixar o
  binário direto pelo `media_id` — sempre exige primeiro pedir a URL
  temporária (que expira em minutos) e só então buscar o conteúdo nela,
  ambas autenticadas com o mesmo token. Isso significa 2 chamadas de rede
  à Meta por clique, sem cache — aceitável para o volume esperado deste
  uso.
- **Proxy, não link direto**: o navegador não permite anexar um header
  `Authorization` customizado em `<img src>`/`<audio src>`, então o
  frontend busca o binário via `fetch` autenticado e cria um blob URL
  (`URL.createObjectURL`) — mesmo padrão já usado para logomarca/assinatura
  em Configurações, só que aqui o "servidor de origem" da imagem é a
  própria Meta, atravessada pelo nosso backend.
- Erro de configuração (token/`PHONE_NUMBER_ID` ausente) retorna `500`
  claro em vez de deixar a exceção estourar sem resposta.

## Adendo - Safari não toca o áudio do WhatsApp (Opus/OGG) [diagnóstico revisado, ver adendo seguinte]

Primeiro reporte em produção: a imagem carrega normalmente, mas o áudio
mostra "Erro" no player nativo do Safari. Diagnóstico inicial: WebKit não
decodifica Opus dentro de contêiner OGG (suporta Opus só dentro de
MP4/CAF, nunca Ogg).

Decisão original: sem transcodificação no servidor (exigiria ffmpeg como
dependência nova de infraestrutura, fora do escopo desta entrega). Em vez
disso, o player escuta o evento `onError` do elemento `<audio>` e troca
para um link de download ("baixar para ouvir em outro app") quando a
reprodução falha.

**Este diagnóstico estava incompleto** — ver adendo seguinte.

## Adendo 2 - falha é universal (Chrome também falha), causa raiz é o contêiner OGG/Opus do WhatsApp

Segundo reporte, agora em Chrome: o mesmo áudio falha da mesma forma
("Erro", cai no fallback de download). Isso invalida a hipótese
"Safari-specific" — Chrome tem suporte a Opus/Ogg nativamente, então não é
um problema de compatibilidade de um navegador só.

Usuário baixou o arquivo e confirmou que ele abre normalmente em outro
aplicativo (player nativo do OS) — descarta corrupção de dados ou bug no
proxy. A causa raiz é uma particularidade do contêiner OGG/Opus gerado
pela própria integração do WhatsApp (Meta), que os decoders `<audio>` dos
navegadores rejeitam mesmo suportando Opus/Ogg em tese — um problema
conhecido de integrações com a Cloud API do WhatsApp, não específico de
um navegador.

Decisão revisada: transcodificar o áudio no servidor, de OGG/Opus para
MP3, antes de servir ao navegador. Usa `ffmpeg-static` (binário ffmpeg
pré-compilado, sem dependência de infraestrutura do host) via
`child_process.spawn`, pipe stdin/stdout, sem tocar em disco. Em
`downloadWhatsAppMedia` (`whatsappService.ts`): se o `mime_type` retornado
pela Graph API contém `ogg`, tenta transcodificar; em caso de falha
(timeout, ffmpeg indisponível, arquivo corrompido), cai para o binário
original sem quebrar a resposta — o fallback `onError` do frontend
continua como rede de segurança para esse caso residual.
