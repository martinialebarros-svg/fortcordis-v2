# Plan - portal-clinica-link-laudo-whatsapp

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## Fase 1 - banco e modelo

Objetivo: persistir o link emitido sem guardar credencial utilizavel.

- `backend/app/models/portal_clinic_exam_link.py` com `PortalClinicExamLink`.
- Registrar em `backend/app/models/__init__.py` e na lista `MODELS` de
  `backend/setup_database.py`.
- Migracao `backend/migrations/versions/20260918_87_portal_clinic_exam_links.py`,
  idempotente e com os dois dialetos (postgresql/sqlite), no padrao de
  `20260916_86_portal_partner_clinic_links.py`.

Criterios: tabela criada em banco limpo e em banco ja existente sem erro; indices
presentes.

Rollback: remover a tabela; nada mais depende dela nesta fase.

## Fase 2 - servico de emissao e resolucao

Objetivo: concentrar a regra do link num servico, fora dos endpoints.

- `backend/app/services/portal_clinic_exam_link_service.py`:
  - `issue_exam_link(...)` - reaproveita link ativo (RF-012) ou emite novo;
  - `resolve_active_link(db, raw_token)` - valida formato, hash, status;
  - `revoke_links_for_exam(db, exame_id, motivo)`;
  - `build_exam_link_url(request, raw_token)`;
  - `register_link_open(db, link)`.
- Flags novas em `backend/app/core/config.py`.

Criterios: testes unitarios do servico cobrindo emissao, reaproveitamento,
resolucao, revogacao e contadores.

Rollback: servico nao referenciado por ninguem ainda.

## Fase 3 - endpoint publico de resolucao

Objetivo: entregar o conteudo do exame sem emitir sessao de portal.

- `POST /portal/laudo-link/{token}` em `backend/app/api/v1/endpoints/portal.py`.
- Reusa `_load_exam_with_context`, `_is_exam_released_to_portal`,
  `attachment_has_download_source` e `create_portal_download_token` com um
  `PortalSessionContext` sintetico (so para montar o token de download preso ao par
  exame/anexo) - **sem** emitir `create_portal_session_token`.
- Schemas em `backend/app/schemas/portal.py`.
- Auditoria `PORTAL_EXAM_LINK_OPENED`.

Criterios: CA-004 a CA-007 e CA-010 cobertos por teste.

Rollback: remover a rota; nada no frontend aponta para ela ainda.

## Fase 4 - modelo novo no servico Node

Objetivo: ter a chave `portalReportLink` disponivel para envio.

- `whatsapp-stage-backend/src/templates/approvedTemplates.ts`: chave nova,
  `metaId: "PENDING_META_APPROVAL"`, corpo com 4 variaveis e a URL em `{{4}}`,
  seguindo o precedente aprovado de `portalClinicInviteActivation`.
- `whatsapp-stage-backend/src/controllers/templateAutomationController.ts`:
  `portalReportLink: "exame"` em `SUBJECT_BY_TEMPLATE`.
- **Nao** adicionar em `TEMPLATE_CATALOG_METADATA` (RF-011 / CA-012).
- Espelhar a chave em `ApprovedUtilityTemplateKey` no
  `backend/app/services/whatsapp_template_delivery_service.py`.

Criterios: `npm run build` e as suites de template do Node passam; catalogo da caixa
de entrada continua com 12 modelos.

Rollback: remover a chave.

## Fase 5 - integracao no aviso de laudo

Objetivo: o aviso que ja existe passa a levar o link.

- `backend/app/api/v1/endpoints/laudos.py`, em
  `avisar_laudo_liberado_por_whatsapp`: emitir link sob flag, montar os 4
  parametros, tentar `portalReportLink` e degradar para `portalReportAvailable`
  (RF-004).
- `POST /laudos/{laudo_id}/portal/link/revogar`.
- Ligar a revogacao em `revogar_liberacao_exame_no_portal`
  (`backend/app/api/v1/endpoints/atendimento.py`).
- Schemas de resposta com `template_key` e `link_incluido`.

Criterios: CA-001 a CA-003, CA-008, CA-009.

Rollback: desligar `PORTAL_CLINIC_EXAM_LINK_ENABLED`.

## Fase 6 - pagina publica

Objetivo: um toque no WhatsApp e o laudo na tela.

- `frontend/app/laudo/[token]/page.tsx` (server shell, metadata `noindex`).
- `frontend/components/portal/PortalExamLinkWorkspace.tsx` (client).
- Funcao `resolvePortalExamLink` em `frontend/lib/portal-api.ts`, reaproveitando
  `portalFetchJson` e `downloadPortalAttachment`.
- Teste de componente em `frontend/components/portal/PortalExamLinkWorkspace.test.tsx`.

Criterios: CA-011; layout legivel em 375px de largura.

Rollback: remover a rota; o link passa a cair em 404 do Next.

## Fase 7 - verificacao

- Rodar `pytest` (backend), `npm run test` + `npm run lint` (frontend) e as suites
  do `whatsapp-stage-backend`.
- Preencher `verify.md` com a matriz de rastreabilidade.
- Verificacao manual em stage (`app.stage.fortcordis.com.br`) antes de promover.

## Ordem e dependencias

1 -> 2 -> 3 sao encadeadas. 4 e independente e pode sair em paralelo. 5 depende de
2, 3 e 4. 6 depende de 3. 7 fecha.

## Riscos do plano

- A Fase 4 depende de aprovacao externa (Meta) que nao controlamos. Por isso a
  degradacao da Fase 5 e requisito, nao refinamento: sem ela, um modelo pendente
  derruba o aviso de laudo que funciona hoje.
- A Fase 3 e o ponto sensivel de seguranca. Toda a decisao de **nao** emitir sessao
  de portal vive ali; qualquer refactor futuro que "unifique" esse endpoint com o
  fluxo de sessao reabre o acesso amplo que a spec descarta.
