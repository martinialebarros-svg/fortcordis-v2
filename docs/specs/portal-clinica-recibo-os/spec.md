# Spec - portal-clinica-recibo-os

Data: 2026-08-08
Status: draft (implementado; aguardando QA)

## 1) Escopo funcional

Botao "Recibo" em cada item da lista "Pagas" do bloco financeiro do portal, que baixa o PDF do
recibo daquela OS especifica.

## 2) Requisitos funcionais (RF)

- RF-001: `GET /api/v1/portal/clinicas/ordens-servico/{ordem_servico_id}/recibo` retorna o PDF do
  recibo quando a OS pertence a clinica da sessao e esta com `status == "Pago"`.
- RF-002: Qualquer outro caso (OS de outra clinica, status diferente de "Pago", ID inexistente)
  retorna 404 com mensagem generica.
- RF-003: O recibo gerado pelo portal usa o mesmo layout/dados de negocio do recibo interno
  (`_montar_recibos_os`, `_gerar_pdf_recibos_ordens`), com o nome da empresa como emitente (sem
  assinatura/CRMV de usuario, ja que a sessao do portal nao e um usuario interno).
- RF-004: No frontend, o botao "Recibo" aparece em cada linha da lista de "Pagas"; mostra um
  spinner enquanto baixa e reaproveita a mesma area de erro do bloco financeiro em caso de falha.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): checagem de clinica + status feita ANTES de montar qualquer
  dado do recibo (nao apenas no nome do arquivo) — dupla verificacao: existencia+escopo (query
  direta) e depois `_montar_recibos_os` (que so retorna OS "Pago").
- NFR-002 (nao regressao): a extracao de `_montar_recibos_os` e
  `_carregar_dados_emissor_recibo_empresa` preserva exatamente o comportamento anterior da rota
  interna `GET /api/v1/ordens-servico/relatorios/recibos/pdf` (mesmas consultas, mesma ordem,
  mesmos campos) — validado pela suite completa de testes de backend.

## 4) Contratos tecnicos

### API

- `GET /api/v1/portal/clinicas/ordens-servico/{ordem_servico_id}/recibo`
  - Auth: `PortalSessionContext` (`actor_type == "clinica"`, `clinica_id` presente e ativo).
  - Resposta: `application/pdf` (StreamingResponse, `Content-Disposition: attachment`).
  - Erros: 403 (sessao sem clinica ativa), 404 (nao encontrada / outra clinica / nao paga).

### Backend (refatoracao interna, sem mudanca de contrato)

- Novas funcoes reutilizaveis em `backend/app/api/v1/endpoints/ordens_servico.py`:
  `_montar_recibos_os(db, ids)` e `_carregar_dados_emissor_recibo_empresa(db)`.
- `gerar_recibos_os_pdf` (rota interna existente) passa a usar essas funcoes, sem mudanca de
  comportamento observavel.

### Frontend

- `frontend/lib/portal-api.ts`: `downloadPortalClinicOSRecibo(ordemServicoId, token, filename)`
  (fetch + download via blob, mesmo padrao de `downloadPortalAttachment`).
- `frontend/components/portal/PortalClinicaWorkspace.tsx`: botao "Recibo" por linha na lista de
  pagas.

## 5) Compatibilidade e rollout

- Backward compatible; endpoint novo e aditivo; refatoracao interna sem mudanca de contrato.
- Sem migracao. Pendente de QA manual do usuario em stage antes de promover.

## 6) Criterios de aceitacao (CA)

- CA-001: Clinica A baixa o recibo de uma OS paga dela mesma com sucesso (PDF valido).
- CA-002: Clinica A tenta baixar recibo de uma OS da Clinica B — 404.
- CA-003: Clinica A tenta baixar recibo de uma OS "Pendente" dela mesma — 404.
- CA-004: A tela interna de Financeiro continua gerando recibos (unitario e agrupado) exatamente
  como antes da refatoracao.

## 7) Fora de escopo

- Recibo agrupado pelo portal.
- Envio do recibo por WhatsApp/e-mail a partir do portal.
