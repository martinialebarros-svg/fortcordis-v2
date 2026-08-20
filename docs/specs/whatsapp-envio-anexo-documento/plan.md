# Plan - whatsapp-envio-anexo-documento

## Sequência de fases

- Fase 1 (backend - serviço Graph API)
- Fase 2 (backend - rota e controller)
- Fase 3 (frontend - composer)
- Fase 4 (verificação)

## Tarefas por fase

### Fase 1 - `whatsappService.ts`

- [x] T1.1 extrair `uploadMediaWithRetry` (helper interno) do corpo de
  `uploadWhatsAppPdfWithRetry`, parametrizando `mimeType` (antes fixo em
  `application/pdf`).
- [x] T1.2 `uploadWhatsAppPdfWithRetry` passa a validar o PDF e delegar
  ao helper — comportamento externo inalterado.
- [x] T1.3 nova `uploadWhatsAppDocumentWithRetry` (valida só conteúdo
  não vazio, aceita qualquer `mimeType`) para o anexo genérico.
- [x] T1.4 nova `sendWhatsAppDocumentMessageWithRetry` (payload
  `type: "document"`, `document: {id, filename, caption?}`), usando o
  `sendPayloadWithRetry` já existente.
- Critério de conclusão: `npx tsc --noEmit` limpo; funções exportadas e
  testáveis isoladamente com `axios.post` mockado.
- Risco: quebrar a validação de PDF do fluxo de recibo financeiro.
- Rollback: reverter para a implementação anterior de
  `uploadWhatsAppPdfWithRetry` (sem o helper compartilhado).

### Fase 2 - `conversationsController.ts` + `app.ts`

- [x] T2.1 `ALLOWED_ATTACHMENT_MIME_TYPES` (allowlist de documentos).
- [x] T2.2 helpers `insertPendingMessage`/`markMessageSent`/
  `markMessageFailed` (extraídos do corpo de `sendConversationMessage`
  para reaproveitar entre o caminho de texto e o de anexo).
- [x] T2.3 `sendAttachmentMessage` — insere `pending`, upload, envio,
  marca `sent`/`failed`, no mesmo formato de `metadata` usado por
  mensagem de documento recebida.
- [x] T2.4 `sendConversationMessage` passa a aceitar `req.file`, valida
  mimetype antes de qualquer acesso a banco/Graph API, delega para
  `sendAttachmentMessage` quando há arquivo.
- [x] T2.5 `app.ts`: renomeia `uploadPdf` → `uploadAttachment` (mesmo
  Multer, agora usado pelas duas rotas) e registra
  `uploadAttachment.single("attachment")` em
  `POST /conversations/:id/messages`; mensagem de erro do Multer
  generalizada ("Invalid file upload." em vez de "Invalid PDF upload.").
- Critério de conclusão: `npm run build` (tsc) limpo; rota antiga de
  `automation/document-templates` continua funcionando com o Multer
  renomeado.
- Risco: quebrar a rota de recibo financeiro ao renomear o Multer
  compartilhado.
- Rollback: reverter `app.ts`/`conversationsController.ts` para a rota
  JSON-only original.

### Fase 3 - `frontend/app/whatsapp-stage/page.tsx`

- [x] T3.1 estado `attachmentFile` + `fileInputRef`; input de arquivo
  oculto (`sr-only`) com `accept` restrito aos mimetypes permitidos.
- [x] T3.2 botão de clipe (`Paperclip`, lucide-react) que abre o
  seletor; validação client-side de tipo/tamanho antes de aceitar o
  arquivo.
- [x] T3.3 chip com nome do arquivo + botão remover
  (`.fc-wa-attachment-chip`, novo em `globals.css`).
- [x] T3.4 `requestWithAttachment` (novo helper, `FormData` + `fetch`,
  sem forçar `Content-Type` — diferente de `requestJson`, que sempre
  usa JSON); `handleSendMessage` passa a escolher entre os dois
  caminhos.
- [x] T3.5 botão "Enviar" habilitado com texto OU anexo; botão
  "Reenviar" só para `type: "text"`; `WhatsAppMediaViewer` passa a
  renderizar também para `from_me: true`.
- Critério de conclusão: `npx eslint`, `npx tsc --noEmit`, `npx vitest
  run` limpos.
- Risco: colisão de `aria-label` entre o botão de anexo e o input de
  arquivo (`getByLabelText` ambíguo nos testes).
- Rollback: remover o botão/estado do composer; o formulário volta a
  postar só JSON.

### Fase 4 - verificação

- [x] T4.1 `whatsapp-stage-backend/scripts/test-message-attachment.ts`
  (novo): upload/envio de documento com `axios.post` mockado (sem
  banco/rede real), regressão de `uploadWhatsAppPdfWithRetry` pós-
  refactor, e validação de `422`/`400` do controller sem precisar de
  banco (mimetype inválido e corpo vazio são rejeitados antes de
  qualquer `query`).
- [x] T4.2 `npm run test:message-attachment` registrado em
  `package.json` e nos dois workflows de deploy (`deploy.yml`,
  `deploy-stage.yml`), ao lado de `test:whatsapp-retry`.
- [x] T4.3 dois testes novos em `page.test.tsx`: anexar+enviar PDF com
  legenda (inspeciona o `FormData` da requisição capturada) e rejeição
  de tipo não suportado antes de qualquer chamada de rede.
- [x] T4.4 regressão: suíte completa de `page.test.tsx` (15 testes),
  `test:whatsapp-retry`, `test:approved-templates`, `test:auth-policy`.

## Plano de testes

- Testes unitários: `test-message-attachment.ts` (serviço + validação
  de controller, sem banco/rede).
- Testes de integração: `page.test.tsx` (fetch mockado, componente
  completo).
- Testes manuais: nenhum além dos automatizados — sem ambiente com
  credenciais reais da Graph API disponível nesta sessão (mesma
  limitação já registrada em `whatsapp-acesso-midia-recebida`).

## Dependências e bloqueios

- Nenhuma dependência nova (reaproveita `multer`, já usado pelo fluxo de
  recibo financeiro).

## Checklist para iniciar execução

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, sem Postgres/Graph API reais —
  testes isolados com mocks).
