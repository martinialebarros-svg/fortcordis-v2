# Plan - whatsapp-portal-clinic-invite-template

## Fase 1 - botão de convite via WhatsApp (revertida em parte na Fase 2)

- [x] P1.1 `ClinicaPortalAccessCard.tsx`: botão "Abrir no WhatsApp" (`wa.me`) no card de acesso da
  clínica, usando `buildClinicWhatsappLink` já existente.
- Usuário rejeitou: abre app externo, queria envio pelo canal interno. Botão `wa.me` removido na
  Fase 3.

## Fase 2 - escolher e mapear o canal interno (sem dependência externa)

- [x] P2.1 mapeamento completo dos dois mecanismos de envio de WhatsApp já existentes (canal
  genérico do Portal vs. WhatsApp Business do Atendimento) e dos contratos envolvidos
  (`approvedTemplates.ts`, `templateAutomationController.ts`, `whatsapp_template_delivery_service.py`,
  `portal_clinic_auth_service.py`, `portal_clinic_auth.py`).
- [x] P2.2 decisão com o usuário: reaproveitar o WhatsApp Business do Atendimento.

## Fase 3 - implementar o envio pelo canal interno (bloqueia envio real por aprovação da Meta)

- [x] P3.1 `whatsapp-stage-backend/src/templates/approvedTemplates.ts`: 3 modelos novos
  (`portalClinicInviteActivation` 3 variáveis, `portalClinicInviteLoginAccess` 3 variáveis,
  `portalClinicInviteTemporaryPassword` 4 variáveis), `metaId: "PENDING_META_APPROVAL"`.
- [x] P3.2 `templateAutomationController.ts`: `SubjectType` ganha `"clinica"`; `SUBJECT_BY_TEMPLATE`
  mapeia os 3 modelos novos.
- [x] P3.3 `templateCatalogController.ts`: `TEMPLATE_CATALOG_METADATA` vira `Partial<Record<...>>` e
  `listApprovedTemplateCatalog` filtra pelas chaves com metadado - os 3 modelos novos ficam de fora
  do catálogo da caixa de entrada (`test-inbox-ui-contracts.ts` continua esperando 12 sem mudança).
- [x] P3.4 `test-approved-templates.ts`: catálogo passa de 12 para 15 entradas, com os 3 novos
  contratos.
- [x] P3.5 `whatsapp_template_delivery_service.py`: `ApprovedUtilityTemplateKey` e
  `ApprovedTemplateSubject` (`"clinica"`) estendidos.
- [x] P3.6 `portal_clinic_auth_service.py`: `send_whatsapp_invite`/`send_whatsapp_login_access`/
  `send_whatsapp_temporary_password` reescritas para chamar `send_approved_utility_template` (em vez
  de `send_portal_whatsapp_message`), normalizando o destino via `normalize_whatsapp_number`
  (importado de `whatsapp_agenda_service`).
- [x] P3.7 `portal_clinic_auth.py`: gate `settings.PORTAL_WHATSAPP_ENABLED` →
  `settings.WHATSAPP_AGENDA_ENABLED`; chave de idempotência dedicada por modo de acesso
  (`portal-clinic-invite-*`, `portal-clinic-login-*`, `portal-clinic-temp-password-*`).
- [x] P3.8 `ClinicaPortalAccessCard.tsx` e `clinicas/portal/page.tsx`: botão "Abrir no WhatsApp"
  removido; `handleGenerateInvite` aceita overrides (`InviteRequestParams`) para sobreviver à
  limpeza de campos do formulário após o primeiro envio; novo botão "Reenviar pelo WhatsApp" chama
  `handleResendWhatsapp` → reinvoca o mesmo endpoint com os dados capturados no envio anterior.
- [x] P3.9 conteúdo dos 3 modelos (nome, categoria, corpo, variáveis de exemplo) entregue ao usuário
  para submissão manual no WhatsApp Manager (usuário optou por não compartilhar token de acesso
  nesta sessão).

## Fase 4 - verificação

- [x] P4.1 backend: 2 testes novos em `test_portal_clinic_invite_auth.py` (envio com sucesso via
  template aprovado; fallback para `manual_copy` quando o envio falha); suíte completa (`pytest`)
  sem regressão.
- [x] P4.2 `whatsapp-stage-backend`: `tsc --noEmit`, `test:approved-templates`, verificação isolada
  de que `listApprovedTemplateCatalog` continua expondo exatamente 12 modelos.
- [x] P4.3 frontend: `tsc --noEmit`, `eslint --max-warnings=0` (arquivos tocados), `vitest run`.
- [ ] P4.4 pendente do usuário: submeter os 3 modelos no WhatsApp Manager e trazer os 3 IDs
  aprovados para atualizar `metaId` em `approvedTemplates.ts`.

## Rollback

- Fase 3: reverter para `send_portal_whatsapp_message`/`PORTAL_WHATSAPP_ENABLED` restaura o
  comportamento anterior (webhook genérico nunca configurado, sempre cai em `manual_copy`) - sem
  migração de dados envolvida.
