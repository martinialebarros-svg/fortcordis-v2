# Verify - whatsapp-envio-anexo-documento

## Matriz de rastreabilidade

| ID | Tipo | Evidência | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | `page.test.tsx`: "anexa um PDF e envia como mensagem no WhatsApp" | ok |
| CA-002 | aceitação | mesmo teste acima cobre anexo + legenda no mesmo envio | ok |
| CA-003 | aceitação | `page.test.tsx`: "rejeita anexo com tipo de arquivo não suportado antes de enviar" | ok |
| CA-004 | aceitação | inspeção do JSX (`disabled={... (!sendMessageBody.trim() && !attachmentFile)}`) + cobertura indireta nos testes acima | ok |
| CA-005 | aceitação | `test-message-attachment.ts`: `sendConversationMessage` com mimetype não permitido retorna 422 sem chamar `query` | ok |
| CA-006 | aceitação | `WhatsAppMediaViewer` renderizado sem a condição `!message.from_me` | ok (revisão de código, sem teste de componente dedicado) |
| CA-007 | aceitação | condição do botão "Reenviar" passou a incluir `message.type === "text"` | ok (revisão de código, sem teste de componente dedicado) |
| CA-008 | aceitação | `page.test.tsx`: "limpa o anexo selecionado ao trocar de conversa" | ok |
| CA-009 | aceitação | `page.test.tsx`: "remove o anexo anterior ao tentar substituí-lo por um arquivo inválido" | ok |
| CA-010 | aceitação | `page.test.tsx`: "não mostra o botão de mídia para um anexo enviado que falhou" | ok |
| NFR-002 | não funcional | allowlist explícita `ALLOWED_ATTACHMENT_MIME_TYPES`; teste de 422 confirma rejeição de mimetype fora da lista | ok |
| CB-004 | caso de borda | `test-message-attachment.ts`: `decodeMultipartFilename` recupera nome UTF-8 mangled como latin1 | ok |

## Testes automatizados executados

Comandos:

```bash
# backend
cd whatsapp-stage-backend
npm ci
npx tsc --noEmit
npm run build
npm run test:message-attachment
npm run test:whatsapp-retry       # regressao
npm run test:approved-templates   # regressao
npm run test:auth-policy          # regressao

# frontend
cd ../frontend
npm ci
npx tsc --noEmit -p .
npx eslint app/whatsapp-stage/page.tsx
npx vitest run app/whatsapp-stage/page.test.tsx
```

Resumo dos resultados:
- Backend: `tsc --noEmit` e `npm run build` sem erros; `test:message-
  attachment` (novo) passou — upload/envio de documento com
  `axios.post` mockado, regressão de `uploadWhatsAppPdfWithRetry`
  pós-refactor (ainda valida `%PDF`), e rejeição de mimetype/corpo vazio
  sem tocar banco; `test:whatsapp-retry`, `test:approved-templates` e
  `test:auth-policy` passaram sem regressão.
- Frontend: `tsc --noEmit` e `eslint --max-warnings=0` sem avisos;
  `vitest run app/whatsapp-stage/page.test.tsx` — 18 testes passaram
  (13 já existentes + 5 novos desta feature, ver adendos de revisão
  abaixo).

## Testes manuais

- Cenário 1: não executado — esta sessão não tem acesso a
  `WHATSAPP_ACCESS_TOKEN`/`PHONE_NUMBER_ID` reais nem a um Postgres
  local, então a validação ponta a ponta contra a Graph API real fica
  para o ambiente de stage (mesma limitação já registrada em
  `whatsapp-acesso-midia-recebida/verify.md`).
- Cenário 2: revisão manual do diff (sem execução automatizada) para
  CA-006/CA-007, que dependem de estado (`from_me`, mensagem `failed`)
  não coberto por um teste de componente dedicado nesta entrega.

## Regressão e riscos residuais

- Risco residual 1: um anexo que falhar ao enviar exige que o atendente
  re-selecione o arquivo (sem reenvio automático) — decisão consciente
  de escopo, documentada em `intent.md`.
- Risco residual 2: CA-006/CA-007 (visualizador de mídia e botão
  "Reenviar" para mensagens de documento) foram verificados por revisão
  de código, não por teste automatizado dedicado — considerar um teste
  de componente específico se essa área tiver mudanças futuras.

## Itens fora de escopo entregues

- Nenhum.

## Adendo - revisão automatizada (Codex) na PR #63 - 2026-08-20

Dois apontamentos P1 do revisor automático (`chatgpt-codex-connector[bot]`):

1. **Anexo não é limpo ao trocar de conversa.** Confirmado: `attachmentFile`/
   `fileInputRef` eram estado de página, sem nenhum efeito reagindo a
   `selectedConversationId`. Selecionar um arquivo na conversa A e trocar
   para a conversa B sem enviar mantinha o arquivo escolhido — ao clicar
   "Enviar" em B, o anexo de A seguiria para o contato errado (risco
   real de vazamento de documento para o destinatário errado, não só um
   texto de rascunho). Corrigido com um novo `useEffect` dedicado,
   dependente de `selectedConversationId`, que limpa `attachmentFile` e
   o valor do `<input type="file">` a cada troca de conversa — mesmo
   padrão dos demais efeitos já existentes na página. Novo teste "limpa
   o anexo selecionado ao trocar de conversa" (CA-008) cobre o cenário.
   Nota: o rascunho de texto (`sendMessageBody`) já tinha esse mesmo
   comportamento antes desta feature (não é uma regressão introduzida
   aqui) e ficou fora desta correção — o risco de um anexo ir para o
   contato errado é qualitativamente maior (documento potencialmente
   sensível) do que um texto de rascunho remanescente.

2. **Limite de corpo da requisição no Nginx para anexos até 8 MB.**
   Apontamento: `scripts/provision_institutional_nginx.sh` define
   `client_max_body_size 30m` só em `location /api/`, e um upload de
   anexo poderia cair em outro `location` sem esse limite (default do
   Nginx é 1 MB). Verificado: esse script provisiona o site
   institucional (`fortcordis.com`/`www.fortcordis.com`, `SITE_NAME=
   fortcordis-www`), que nem tem rota `/whatsapp/`. A Central de
   Atendimento (`/whatsapp-stage`) roda em `app.fortcordis.com.br`
   (`PUBLIC_URL` em `scripts/deploy_prod_vps.sh`), cujo `/whatsapp/:path*`
   é reescrito pelo próprio Next.js (`frontend/next.config.js`) para o
   `whatsapp-stage-backend` — não passa pelo `location /api/` do Nginx
   institucional. A configuração de Nginx desse domínio real não está
   neste repositório (`deploy_prod_vps.sh` só recarrega o Nginx via
   `reload_nginx_if_possible`, não gera o site) — não há arquivo aqui
   para confirmar ou corrigir o `client_max_body_size` efetivo desse
   domínio. Risco residual genuíno: se o Nginx de `app.fortcordis.com.br`
   não tiver um `client_max_body_size` de pelo menos 8 MB para `location
   /` (ou para o path usado pelo proxy do Next.js), anexos acima de ~1 MB
   podem ser rejeitados antes de chegar ao Multer. Não corrigido nesta
   PR — sinalizado no comentário de revisão para confirmação manual no
   servidor (fora do controle de versão deste repositório).

## Adendo 2 - revisão automatizada (Codex), segunda rodada na PR #63 - 2026-08-20

Três apontamentos P2 do revisor automático, todos confirmados e corrigidos:

1. **Nome de arquivo corrompido (encoding).** Confirmado: Multer/Busboy
   decodificam o parâmetro `filename` do multipart como latin1 por
   padrão, mesmo com o navegador enviando UTF-8 — um PDF chamado
   "laudo-coração.pdf" chegava como "laudo-coraÃ§Ã£o.pdf" em
   `file.originalname`, e esse nome corrompido era salvo e enviado ao
   contato. Corrigida com `decodeMultipartFilename` (round-trip
   `Buffer.from(raw, "latin1").toString("utf8")`), aplicada antes de
   `sanitizeAttachmentFilename`. Teste novo em
   `test-message-attachment.ts` cobre o caso acentuado e confirma que
   nomes ASCII simples continuam inalterados (CB-004).
2. **Anexo antigo não era limpo ao tentar substituí-lo por um inválido.**
   Confirmado: `handleAttachmentChange` só resetava o valor do
   `<input type="file">` nos dois ramos de rejeição (tipo/tamanho
   inválido), deixando `attachmentFile` (o anexo válido escolhido
   antes) intacto — um agente que tentasse trocar o anexo por um
   arquivo inválido continuaria com o anexo anterior pronto para
   envio, sem perceber. Corrigido chamando `clearAttachment()` (que já
   limpava os dois) nos dois ramos. Novo teste "remove o anexo anterior
   ao tentar substituí-lo por um arquivo inválido" (CA-009).
3. **Botão de mídia quebrado em anexo com falha de envio.** Confirmado:
   `WhatsAppMediaViewer` não checava `message.status`, então uma
   mensagem de documento com `status: "failed"` (upload ou envio à
   Graph API não completou, `metadata.message.document.id` nunca foi
   gravado) ainda mostrava "Baixar documento" — clicar sempre resultaria
   em `404` de `getMessageMedia` (sem `media_id` para buscar). Corrigido
   com um segundo early-return no componente
   (`if (message.status === "failed") return null;`). Novo teste "não
   mostra o botão de mídia para um anexo enviado que falhou" (CA-010).

Comandos re-executados após as correções: `npx tsc --noEmit` (backend e
frontend), `npm run test:message-attachment`, `npx eslint
app/whatsapp-stage/page.tsx app/whatsapp-stage/page.test.tsx
--max-warnings=0`, `npx vitest run app/whatsapp-stage/page.test.tsx` (18
testes, sem regressão). Todos passaram.

## Decisão de release

- [ ] Aprovado para stage.
- [ ] Aprovado para produção.
- [ ] Não aprovado (descrever motivo).
