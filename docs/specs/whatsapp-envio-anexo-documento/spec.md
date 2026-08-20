# Spec - whatsapp-envio-anexo-documento

## Escopo funcional

Botão de anexo (clipe) no composer de mensagem do WhatsApp: seleciona um
arquivo local (PDF/Word/Excel/PowerPoint/CSV/texto, até 8 MB), mostra um
chip com o nome do arquivo antes de enviar, e ao clicar em "Enviar" manda
o arquivo como mensagem de documento no WhatsApp, com legenda opcional a
partir do texto digitado no composer.

## Requisitos funcionais (RF)

- RF-001: `POST /conversations/:id/messages` aceita `multipart/form-data`
  com um arquivo no campo `attachment` (0 ou 1 arquivo) e um campo de
  texto opcional `body` (legenda), além do `application/json` já
  existente para texto puro.
- RF-002: se não vier arquivo e `body` estiver vazio, responde `400`
  ("body is required") — mesma validação que já existia para texto.
- RF-003: se vier arquivo com `mimetype` fora da lista permitida
  (`application/pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`,
  `text/csv`, `text/plain`), responde `422` antes de qualquer consulta
  ao banco ou chamada à Graph API.
- RF-004: arquivo maior que 8 MB é rejeitado pelo Multer com `413`
  (mesmo limite já usado pelo upload de PDF do fluxo de recibo).
- RF-005: com a janela de atendimento de 24h fechada, tanto anexo quanto
  texto livre respondem `409`/`CUSTOMER_SERVICE_WINDOW_CLOSED` — mesma
  regra já existente, agora também aplicada ao caminho de anexo.
- RF-006: envio de anexo faz 2 chamadas à Graph API (upload de mídia,
  depois envio da mensagem tipo `document` referenciando o `media_id`),
  reaproveitando o retry/backoff já usado pelo envio de texto e pelo
  upload de PDF do fluxo de recibo.
- RF-007: a mensagem gravada localmente usa `type: "document"`,
  `body: <nome do arquivo>` e `metadata.message.document = {id,
  filename, caption?}` — mesmo formato usado para documento recebido,
  para que `GET .../messages/:messageId/media`
  (`whatsapp-acesso-midia-recebida`) funcione também para o que o
  atendente enviou.
- RF-008: falha em qualquer uma das 2 chamadas à Graph API marca a
  mensagem como `failed` e responde `502`, sem deixar a exceção sem
  resposta — mesmo padrão do envio de texto.
- RF-009: no frontend, o botão de anexo abre o seletor de arquivo; ao
  escolher um arquivo fora da lista permitida ou maior que 8 MB, mostra
  erro sem chegar a chamar a API.
- RF-010: o botão "Enviar" fica habilitado se houver texto OU anexo (não
  exige mais só texto).
- RF-011: mensagens de documento (recebidas ou enviadas por nós) mostram
  o visualizador de mídia (`WhatsAppMediaViewer`) — antes só aparecia
  para mensagens recebidas (`from_me: false`); passou a valer para as
  duas direções.
- RF-012: o botão "Reenviar" (mensagem `from_me` com `status: failed`)
  deixou de aparecer para `type !== "text"`, já que o reenvio só
  reconstrói a requisição a partir do texto salvo, não do arquivo
  original (ver `whatsapp-reenvio-mensagem-falha/spec.md`, RF-002).

## Requisitos não funcionais (NFR)

- NFR-001 (performance): nenhuma mudança no polling existente; o envio é
  uma requisição síncrona igual à de texto, só que multipart.
- NFR-002 (segurança/permissões): a rota continua atrás do mesmo
  `requireApiAuth` já usado por `/conversations`; a lista de mimetypes
  permitidos é uma allowlist explícita (nunca aceita executáveis/
  binários arbitrários).
- NFR-003 (observabilidade): falha de envio de anexo loga com uma
  mensagem própria (`"Graph API attachment send failed"`), distinta da
  de texto, para facilitar diagnóstico.

## Contratos técnicos

### API

- Endpoint: `POST /conversations/:id/messages`
- Método: POST (agora aceita tanto `application/json` quanto
  `multipart/form-data`)
- Payload: JSON `{body, type}` (comportamento existente, inalterado) OU
  form-data `{attachment: File, body?: string}`
- Resposta: `201 {id, wa_message_id, status: "sent"}` nos dois casos;
  erros `400`/`422`/`409`/`413`/`500`/`502` conforme os RF acima.

### Banco/migrações

- Tabelas/colunas afetadas: nenhuma (reaproveita `messages.body/type/
  metadata`, já existentes).
- Índices/constraints: nenhum.
- Migração necessária: não.

### Frontend

- Telas afetadas: `frontend/app/whatsapp-stage/page.tsx` (composer da
  conversa selecionada).
- Estados de UI: nenhum arquivo selecionado (padrão) → arquivo
  selecionado (chip com nome + botão remover) → enviando → enviado
  (chip removido, campo de texto limpo).
- Regras de exibição/erro: erro de tipo/tamanho aparece no banner de
  erro já existente da página (`errorMessage`), sem componente novo.

## Compatibilidade e rollout

- Backward compatibility: total — o envio de texto por JSON continua
  funcionando exatamente como antes; a mudança é estritamente aditiva na
  rota (novo campo opcional `req.file`).
- Feature flag: nenhuma; o botão de anexo aparece para todo atendente
  que já tem acesso ao composer.
- Estratégia de rollback: remover o botão/estado do frontend e a branch
  `if (file)` do controller restaura o comportamento anterior; nenhuma
  migração envolvida.

## Critérios de aceitação (CA)

- CA-001: anexar um PDF válido e enviar sem legenda cria uma mensagem
  `type: "document"` com o nome do arquivo, remove o chip e mostra
  "Anexo enviado.".
- CA-002: anexar um arquivo + digitar texto envia os dois juntos (o
  texto vira legenda do documento).
- CA-003: escolher um arquivo de tipo não permitido (ex.: `.exe`) mostra
  erro e não chama a API.
- CA-004: sem texto e sem anexo, o botão "Enviar" continua desabilitado.
- CA-005: `sendConversationMessage` rejeita anexo de mimetype não
  permitido com `422` antes de qualquer consulta ao banco.
- CA-006: mensagem de documento enviada por nós mostra o botão de
  visualizar/baixar na própria conversa (antes só valia para recebidas).
- CA-007: mensagem de documento com falha de envio não mostra mais o
  botão "Reenviar".

## Casos de borda

- CB-001: janela de 24h fechada + tentativa de anexar → mesmo `409` já
  usado para texto livre.
- CB-002: arquivo de 0 bytes é rejeitado antes de qualquer chamada de
  rede (`uploadWhatsAppDocumentWithRetry` valida conteúdo vazio).
- CB-003: nome de arquivo muito longo é truncado para 200 caracteres
  antes de salvar/enviar (`sanitizeAttachmentFilename`).

## Fora de escopo

- Anexo de imagem/áudio/vídeo como mídia inline (não "documento").
- Reenvio automático de anexo após falha (exigiria persistir o binário).
