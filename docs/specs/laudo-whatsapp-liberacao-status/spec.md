# Spec - laudo-whatsapp-liberacao-status

## Critérios de aceitação

| ID | Critério |
|---|---|
| CA-001 | Ao clicar no ícone de WhatsApp e o envio ser aceito pela API, aparece um toast de sucesso ("Aviso enviado pelo WhatsApp oficial da Fort Cordis.") e a badge "WhatsApp enviado" (ícone `Check`, `fc-wa-envio-badge-enviado`) surge na linha do laudo, sem precisar recarregar a página. |
| CA-002 | Ao clicar no ícone de WhatsApp e a API rejeitar o envio (`WhatsAppTemplateDeliveryError`), aparece um toast de erro com a mensagem retornada pelo backend e a badge "WhatsApp falhou" (ícone `AlertCircle`, `fc-wa-envio-badge-falhou`) surge na linha, com `title` mostrando o erro. |
| CA-003 | Recarregando "Central de laudos", a badge do último resultado (enviado ou falhou) continua aparecendo — o estado vem persistido em `GET /laudos` (`whatsapp_liberacao_status`/`_em`/`_erro`), não só em memória do cliente. |
| CA-004 | Laudos que nunca tiveram um aviso de WhatsApp disparado (`whatsapp_liberacao_status` nulo) não mostram nenhuma badge. |
| CA-005 | A migração (`20260821_75_laudo_whatsapp_liberacao_status.py`) roda de forma idempotente: aplicá-la duas vezes seguidas na mesma base não levanta erro nem duplica colunas. |
| CA-006 | Tanto o envio bem-sucedido quanto a falha geram um evento de auditoria (`LAUDO_PORTAL_WHATSAPP_ENVIADO` / `LAUDO_PORTAL_WHATSAPP_FALHOU`) — a falha passou a ser auditada, o que não acontecia antes. |
| CA-007 | O código de status HTTP e o corpo de erro retornados pelo endpoint `POST /laudos/{id}/portal/whatsapp` em caso de falha continuam os mesmos de antes (502 com o `detail` do provedor) — a persistência do status não muda o contrato já consumido pelo frontend. |
