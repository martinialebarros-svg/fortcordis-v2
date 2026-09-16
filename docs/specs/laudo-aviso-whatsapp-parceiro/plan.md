# Plan - laudo-aviso-whatsapp-parceiro

## Fase 1 - banco

- `backend/app/models/laudo.py`: 3 colunas nullable em `Laudo` —
  `whatsapp_parceiro_status` (String), `whatsapp_parceiro_em` (DateTime),
  `whatsapp_parceiro_erro` (Text), espelhando as `whatsapp_liberacao_*`.
- `backend/migrations/versions/20260916_85_laudo_whatsapp_parceiro_status.py`:
  `ALTER TABLE laudos ADD COLUMN ...` com checagem via `inspector.get_columns`,
  mesmo padrão de `20260821_75_laudo_whatsapp_liberacao_status.py`.
- Rollback: colunas nullable e sem default; código antigo ignora, então basta
  reverter o deploy — não precisa de downgrade.

## Fase 2 - backend

- `backend/app/api/v1/endpoints/laudos.py`:
  - `_registered_partner_whatsapp_numbers(partner)`: `whatsapp` e depois
    `telefone` do perfil, normalizados por `normalize_whatsapp_number`,
    ignorando o que não normaliza (mesma forma do helper da clínica).
  - `_partner_whatsapp_idempotency_key(base)`: `f"{base[:124]}-vet"`.
  - `avisar_laudo_liberado_por_whatsapp`: resolve os dois destinos, tenta os
    dois envios, persiste um status por destino, audita cada um
    (`LAUDO_PORTAL_WHATSAPP_ENVIADO/FALHOU` para a clínica, sufixo
    `_PARCEIRO_` para o parceiro) e devolve o resumo por destino. 502 apenas
    quando o envio da clínica falha; 409 quando nenhum destino é elegível.
  - `listar_laudos`: inclui `whatsapp_parceiro_status/_em/_erro` no item.

## Fase 3 - frontend

- `frontend/lib/laudo-whatsapp-aviso.ts` (novo, lógica pura e testável):
  `getDestinosAvisoWhatsApp`, `podeAvisarWhatsApp`,
  `getConfirmacaoAvisoWhatsApp`, `getTituloBotaoAvisoWhatsApp` e
  `resumirRespostaAvisoWhatsApp` (texto + tom `sucesso`/`alerta` a partir do
  corpo da resposta).
- `frontend/app/laudos/page.tsx`: usa os helpers no gate do botão e na
  confirmação; atualiza as duas badges a partir da resposta (em vez do chute
  otimista só da clínica); toast âmbar no sucesso parcial; badge nova do
  parceiro ao lado da existente.
- `frontend/app/laudos/[id]/page.tsx`: mesmo gate e mesma confirmação via
  helpers; o `alert()` de sucesso passa a nomear os destinos avisados.

## Fase 4 - testes

- `backend/tests/test_laudo_portal_whatsapp_parceiro.py` (novo): cobre
  CA-001..CA-010, no estilo de `test_laudo_portal_whatsapp_status.py` (chamada
  direta da função do endpoint, sqlite temporário, `patch.object` em
  `send_approved_utility_template` e `registrar_auditoria`).
- `frontend/lib/laudo-whatsapp-aviso.test.ts` (novo): cobre CA-013..CA-015.
- Regressão: `pytest tests/ -k "laudo"` e `vitest run`.
