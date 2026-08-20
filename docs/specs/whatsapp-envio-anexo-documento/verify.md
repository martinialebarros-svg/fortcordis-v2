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
| NFR-002 | não funcional | allowlist explícita `ALLOWED_ATTACHMENT_MIME_TYPES`; teste de 422 confirma rejeição de mimetype fora da lista | ok |

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
  `vitest run app/whatsapp-stage/page.test.tsx` — 15 testes passaram
  (13 já existentes + 2 novos desta feature).

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

## Decisão de release

- [ ] Aprovado para stage.
- [ ] Aprovado para produção.
- [ ] Não aprovado (descrever motivo).
