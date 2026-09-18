# Plan - laudo-aviso-whatsapp-seletor-destino

## Fase 1 - banco

- `backend/app/models/laudo.py`: coluna `whatsapp_envios` (JSON, nullable).
- `backend/migrations/versions/20260917_86_laudo_whatsapp_envios.py`: idempotente,
  no padrão de `20260916_85_laudo_whatsapp_parceiro_status.py`. `JSONB` no
  Postgres, `TEXT` no SQLite (o tipo `JSON` do SQLAlchemy serializa em texto lá).
- Rollback: coluna nullable, sem default; código antigo ignora.

## Fase 2 - backend

- `backend/app/api/v1/endpoints/laudos.py`:
  - `DESTINO_AVISO_CLINICA` e `_chave_destino_veterinario(partner_id)`: as chaves
    que o frontend manda de volta.
  - `PortalReportWhatsAppRequest`: + `destinos: list[str] | None`.
  - `avisar_laudo_liberado_por_whatsapp`: depois de montar os destinos elegíveis
    (como hoje) e antes de enviar, aplica a seleção — chave desconhecida ou não
    elegível levanta 422; quem ficou de fora vira `skip_reason="nao_selecionado"`.
  - `_registrar_envio_destino`: grava `{status, em, erro}` em `whatsapp_envios`
    sob a chave do destino, reatribuindo o dicionário (JSON do SQLAlchemy não
    rastreia mutação in-place).
  - `listar_laudos` e o GET de um laudo: devolvem `whatsapp_envios`.

## Fase 3 - frontend

- `frontend/lib/laudo-whatsapp-aviso.ts`:
  - `getDestinosSelecionaveis(laudo)`: clínica (quando liberada) + cada
    veterinário liberado, cada um com `id`, `nome`, `tipo` e `ultimoEnvio` lido de
    `whatsapp_envios`, com as colunas de resumo como fallback para laudo antigo.
  - `getSelecaoInicialAviso(destinos)`: ids cujo último envio não foi `enviado`.
  - `resumirRespostaAvisoWhatsApp`: passa a olhar `veterinarios_parceiros` para
    dizer quantos/quais foram avisados.
- `frontend/app/laudos/components/AvisoWhatsAppDialog.tsx` (novo): janela com a
  lista de destinos, no padrão `fc-appointment-submodal` já usado em
  `agenda/ClienteInfoModal.tsx`. Enviar desabilitado sem seleção.
- `frontend/app/laudos/page.tsx` e `frontend/app/laudos/[id]/page.tsx`: o botão
  abre a janela; o envio manda `destinos` e trata o resultado como hoje.

## Fase 4 - testes

- `backend/tests/test_laudo_portal_whatsapp_seletor.py` (novo): CA-001 a CA-008 e
  CA-015, no estilo dos testes de `test_laudo_portal_whatsapp_parceiro.py`.
- `frontend/lib/laudo-whatsapp-aviso.test.ts`: casos novos para
  `getDestinosSelecionaveis` e `getSelecaoInicialAviso` (CA-010, CA-011, CA-014).
- Regressão: `pytest tests/ -k "laudo or whatsapp"`, `vitest run`, `tsc`,
  `eslint`, `next build`.
