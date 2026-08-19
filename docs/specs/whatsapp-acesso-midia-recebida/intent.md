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
