# Spec - laudo-portal-revogar-parceiro

## Contrato

`POST /laudos/{laudo_id}/portal/veterinarios/{partner_id}/revogar`

Sem corpo. Resposta 200:

```json
{
  "message": "Acesso do veterinario parceiro revogado no portal.",
  "laudo_id": 49,
  "partner_id": 144,
  "exame_id": 673,
  "revogado_em": "2026-09-18T12:00:00",
  "portal_clinica_liberado": true,
  "portal_veterinario_liberado": false,
  "portal_veterinarios_destinos": [],
  "portal_destinos_pendentes": ["veterinario_parceiro"],
  "portal_pode_liberar": true
}
```

Erros: 404 (laudo inexistente), 409 (laudo sem exame, ou parceiro sem liberação
ativa para este laudo).

## Criterios de aceitacao

| ID | Criterio |
|---|---|
| CA-001 | Parceiro com liberação ativa: a chamada marca `revoked_at` na `PortalPartnerReleaseTarget` daquele parceiro e exame, e responde 200. |
| CA-002 | Depois de revogar, o parceiro deixa de aparecer como liberado no estado do laudo: `portal_veterinarios_destinos` traz `liberado: false` para ele (ou lista vazia, se ele só entrava pelo vínculo nomeado) e `veterinario_parceiro` volta a `portal_destinos_pendentes`. |
| CA-003 | A liberação da clínica não é afetada: `status` do laudo e `portal_clinica_liberado` seguem como estavam. |
| CA-004 | Revogar não afeta outro veterinário liberado no mesmo laudo — quem não foi nomeado na rota continua com acesso. |
| CA-005 | Parceiro sem liberação ativa (nunca liberado, ou já revogado) responde 409, sem alterar nada. |
| CA-006 | Laudo inexistente responde 404; laudo sem exame responde 409. |
| CA-007 | A revogação gera evento de auditoria `LAUDO_PORTAL_PARCEIRO_REVOGADO` com `laudo_id`, `exame_id` e `partner_id` nos detalhes. |
| CA-008 | Liberar o laudo de novo depois de revogar devolve o acesso ao parceiro: o `_upsert_portal_partner_release_target` reativa a mesma linha, zerando `revoked_at`. |
| CA-009 | O aviso por WhatsApp respeita a revogação: parceiro revogado volta a ser `ignorado`/`nao_liberado` no `POST /laudos/{id}/portal/whatsapp`, em vez de receber mensagem. |

## Criterios da tela (segunda fase)

| ID | Criterio |
|---|---|
| CA-010 | A tela de visualização do laudo mostra um bloco "Liberado no portal para" com a clínica e cada veterinário do laudo, cada um marcado como "Com acesso" ou "Sem acesso". |
| CA-011 | Cada veterinário aparece com a origem — "Encaminhou o caso" para o nomeado no laudo, "Por vínculo com a clínica" para quem entra por difusão. |
| CA-012 | O botão "Revogar" aparece só em veterinário com acesso; clínica não tem botão de revogar neste bloco. |
| CA-013 | A confirmação antes de revogar nomeia o veterinário e diz que liberar o laudo de novo devolve o acesso. |
| CA-014 | Depois de revogar, o bloco atualiza sem recarregar: o veterinário passa a "Sem acesso" e perde o botão, a partir do estado que a própria resposta devolve. |
| CA-015 | Laudo sem clínica e sem veterinário não mostra o bloco; o bloco não sai na impressão do laudo. |
