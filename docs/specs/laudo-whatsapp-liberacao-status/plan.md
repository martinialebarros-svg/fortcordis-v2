# Plan - laudo-whatsapp-liberacao-status

## Backend

- `backend/app/models/laudo.py`: 3 colunas nullable em `Laudo` —
  `whatsapp_liberacao_status` (String), `whatsapp_liberacao_em`
  (DateTime), `whatsapp_liberacao_erro` (Text).
- `backend/migrations/versions/20260821_75_laudo_whatsapp_liberacao_status.py`:
  migração idempotente (`ALTER TABLE laudos ADD COLUMN ...`), mesmo padrão
  de `20260815_67_exame_visualizado_portal.py`.
- `backend/app/api/v1/endpoints/laudos.py`:
  - `avisar_laudo_liberado_por_whatsapp` (endpoint `POST
    /laudos/{id}/portal/whatsapp`): no `except WhatsAppTemplateDeliveryError`,
    persiste `status="falhou"` + `em`/`erro` e registra auditoria
    `LAUDO_PORTAL_WHATSAPP_FALHOU` antes de levantar o 502 (como já
    acontecia). No caminho de sucesso, persiste `status="enviado"` antes do
    `registrar_auditoria` (`LAUDO_PORTAL_WHATSAPP_ENVIADO`) já existente.
  - `listar_laudos`: inclui os 3 campos no dicionário de cada item
    (reaproveitando o `_iso_or_str` local já usado ali).

## Frontend

- `frontend/app/laudos/page.tsx`:
  - Interface `Laudo`: + `whatsapp_liberacao_status`, `_em`, `_erro`.
  - Imports: `Check`, `AlertCircle` (lucide-react),
    `extractApiErrorMessageSync` (`@/lib/api-error`).
  - Estado `toastWhatsapp` + `toastWhatsappTimeoutRef` e helper
    `mostrarToastWhatsapp(texto, classe)` (mesmo padrão de
    `mostrarToastRealtime` em `agenda/page.tsx`).
  - `avisarLaudoPorWhatsApp`: no sucesso, atualiza o item em `setLaudos`
    com `status: "enviado"` e mostra toast teal; no erro, usa
    `extractApiErrorMessageSync` para extrair a mensagem, atualiza o item
    com `status: "falhou"` + `erro` e mostra toast rose. Fim dos `alert()`.
  - Renderização: badge condicional (`laudo.whatsapp_liberacao_status`) ao
    lado da tag de status na linha do laudo; bloco de toast fixo no topo
    da página (mesmo padrão visual do toast de `agenda/page.tsx`).
- `frontend/app/globals.css`: classes `.fc-wa-envio-badge`,
  `.fc-wa-envio-badge-enviado` (teal), `.fc-wa-envio-badge-falhou` (rose),
  no mesmo bloco das classes `.fc-wa-*` já existentes.

## Testes

- `backend/tests/test_laudo_portal_whatsapp_status.py` (novo): dois casos
  cobrindo sucesso e falha do endpoint, verificando persistência das 3
  colunas e o retorno de `listar_laudos`. Segue o estilo de
  `test_laudo_portal_release.py` (chamada direta das funções do endpoint,
  sqlite em arquivo temporário, mocks via `unittest.mock.patch.object`).
