# Plan - laudo-portal-revogar-parceiro

## Fase 1 - backend

- `backend/app/api/v1/endpoints/laudos.py`:
  - `revogar_liberacao_veterinario_no_portal`, em
    `POST /laudos/{laudo_id}/portal/veterinarios/{partner_id}/revogar`:
    localiza o laudo (404), o exame mais recente dele (409 sem exame) e a
    `PortalPartnerReleaseTarget` ativa do parceiro (409 sem liberação),
    preenche `revoked_at`, audita `LAUDO_PORTAL_PARCEIRO_REVOGADO` e devolve o
    estado de liberação recalculado por `_serialize_portal_release_state`.
  - Sem migração: a coluna `revoked_at` já existe e já é lida em todos os
    lugares que checam liberação (`_portal_veterinario_liberado`,
    `_partners_liberados_by_exame_id`, portal do parceiro).

## Fase 2 - testes

- `backend/tests/test_laudo_portal_revogar_parceiro.py` (novo), no estilo de
  `test_laudo_portal_whatsapp_seletor.py`: laudo com clínica, veterinário
  nomeado e veterinário por vínculo, os dois liberados.
  - revoga um: `revoked_at` preenchido, estado do laudo atualizado, clínica e o
    outro veterinário intactos (CA-001 a CA-004);
  - 409 sem liberação ativa e na segunda revogação (CA-005);
  - 404 de laudo e 409 de laudo sem exame (CA-006);
  - auditoria conferida pelo mock (CA-007);
  - `_upsert_portal_partner_release_target` reativa a linha (CA-008);
  - `avisar_laudo_liberado_por_whatsapp` depois da revogação: o parceiro volta
    a `ignorado`/`nao_liberado` (CA-009).

## Fase 3 - tela (segunda fase)

- `frontend/lib/laudo-portal-destinos.ts` (novo): `getClinicaDoLaudo`,
  `getVeterinariosDoLaudo` (todos, liberados ou não, com a origem),
  `temDestinosNoPortal`, `getRotuloOrigemVeterinario` e
  `getConfirmacaoRevogarVeterinario`. Fica separado de
  `laudo-whatsapp-aviso.ts` porque aquele só enxerga quem já está liberado.
- `frontend/app/laudos/components/PortalLiberadoPara.tsx` (novo): o bloco
  "Liberado no portal para", com selo por destino e botão de revogar só em
  veterinário com acesso. `print:hidden` — é controle do app, não parte do
  documento clínico.
- `frontend/app/laudos/[id]/page.tsx`: monta o bloco entre o cabeçalho e o
  documento, confirma pelo texto do helper e atualiza o estado do laudo com o
  que a rota devolve.
- `frontend/app/globals.css`: `.fc-report-view-portal-access`, no bloco das
  demais `.fc-report-view-*`.

## Fase 4 - entrega

- PR com base `stage`, e a conferência visual em stage logo depois: é o que
  fecha CA-012, CA-014 e CA-015.
