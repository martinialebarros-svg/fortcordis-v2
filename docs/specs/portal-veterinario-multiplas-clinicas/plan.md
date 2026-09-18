# Plan - portal-veterinario-multiplas-clinicas

Data: 2026-09-16  
Responsavel: Martiniano  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): tabela `portal_partner_clinic_links` e migracao `86`.
- Fase 2 (backend/API): schemas, CRUD dos vinculos, filtro do seletor.
- Fase 3 (backend/laudos): difusao na liberacao e no aviso por WhatsApp.
- Fase 4 (frontend): tela de parceiros externos e seletor do laudo.

A ordem importa: a Fase 3 depende do modelo da Fase 1 e do resolvedor da Fase 2.
A Fase 4 e a ultima porque consome o contrato ja fechado.

## 2) Tarefas por fase

### Fase 1

- [ ] T1.1 `PortalPartnerClinicLink` em `backend/app/models/portal_partner.py`
- [ ] T1.2 `backend/migrations/versions/20260916_86_portal_partner_clinic_links.py`
- Criterio de conclusao: migracao roda duas vezes seguidas sem erro (CA-017).
- Risco: baixo — tabela nova, vazia, ninguem le antes da Fase 2.
- Rollback: `DROP TABLE portal_partner_clinic_links`; nenhum dado existente
  depende dela.

### Fase 2

- [ ] T2.1 `PortalPartnerClinicLinkPayload` / `...Response` em `schemas/portal.py`
      e o campo `clinicas_vinculadas` no create/update/response
- [ ] T2.2 `_resolve_clinic_links` em `portal_partners.py`: valida tipo, clinica
      ativa e duplicata; devolve o conjunto normalizado
- [ ] T2.3 `_replace_clinic_links`: semantica de substituicao do `PATCH` (RF-005)
- [ ] T2.4 `_serialize_partner` carrega os vinculos em consulta unica (NFR-003)
- [ ] T2.5 `clinica_id` em `/parceiros/veterinarios/opcoes` com a ordenacao da
      RF-015
- Criterio de conclusao: CA-001 a CA-005 e CA-016 verdes.
- Risco: o `PATCH` hoje nao mexe em vinculo nenhum; a substituicao so vale quando
  o campo vem no corpo (`model_fields_set`), senao um `PATCH` de telefone apagaria
  os vinculos.
- Rollback: reverter o commit; a tabela pode ficar, nao e lida por mais ninguem.

### Fase 3

- [ ] T3.1 `_veterinarios_destinatarios_do_laudo(db, laudo)` em `laudos.py`:
      devolve `[(partner, origem)]` com o nomeado primeiro, depois os de difusao,
      deduplicado por `partner_id` (RF-009)
- [ ] T3.2 `_liberar_laudo_para_portal` passa a iterar sobre esse conjunto para
      target + email + auditoria
- [ ] T3.3 `avisar_laudo_liberado_por_whatsapp` passa a iterar para o envio,
      com a chave de idempotencia da RF-012
- [ ] T3.4 resumo agregado em `whatsapp_parceiro_status` (RF-014) e
      `veterinarios_parceiros` na resposta (RF-013)
- Criterio de conclusao: CA-006 a CA-015 verdes **e** CA-019 — a suite de #151
  passando sem edicao.
- Risco: o mais alto da entrega. `_liberar_laudo_para_portal` e o caminho diario
  de producao. Mitigacao: quando o conjunto de difusao e vazio, o codigo percorre
  exatamente o fluxo antigo; a suite antiga e o teste dessa afirmacao.
- Rollback: reverter o commit. Targets ja criados por difusao continuam validos
  (sao targets comuns); se for preciso desfazer, revogar por `revoked_at`.

### Fase 4

- [ ] T4.1 tipos de `clinicas_vinculadas` em `frontend/lib/portal-api.ts`
- [ ] T4.2 selecao multipla com interruptor por clinica em
      `app/clinicas/portal/parceiros/page.tsx` (cadastro, edicao e listagem)
- [ ] T4.3 `clinica_id` na chamada de `/veterinarios/opcoes` nas duas telas que a
      usam (`laudos/[id]/editar`, `laudos/eletrocardiograma/upload`)
- Criterio de conclusao: CA-018; `tsc`, `eslint` e `vitest` limpos.
- Risco: baixo, tela de admin.
- Rollback: reverter o commit.

## 3) Pontos de atencao

- `laudo.veterinario_parceiro_id` continua unico. Quem precisar saber "quem mais
  recebeu" le `portal_partner_release_targets`, nao o laudo.
- A auditoria distingue origem: `LAUDO_PORTAL_PARTNER_NOTIFICATION_*` com
  `origem: "nomeado" | "vinculo_clinica"`.
- Nenhuma mudanca de comportamento chega em producao sem um admin criar vinculo
  e ligar o interruptor — a tabela nasce vazia (NFR-005).

## 4) Verificacao

`verify.md` com a matriz `ID | Tipo | Evidencia | Status` — e o unico formato que
o gate de promocao (`scripts/ci/check_promotion_verify_pending.py`) le.
