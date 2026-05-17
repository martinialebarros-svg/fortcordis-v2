# Verificacao

## Validacoes executadas
- revisao de consistencia com:
  - `scripts/whatsapp_stage_preflight.sh`
  - `whatsapp-stage-backend/src/app.ts`
  - `whatsapp-stage-backend/src/services/webhookEventsCleanupService.ts`
- conferido encadeamento de docs:
  - `README.md`
  - `docs/RUNBOOK-STAGE-PROD.md`
  - `docs/WHATSAPP-STAGE-PREFLIGHT.md`

## Criterios
1. Existe runbook unico com cenarios A/B/C/D e acoes de resposta.
2. Os comandos e caminhos documentados batem com os artefatos atuais do repo.
3. O novo runbook esta linkado a partir dos docs operacionais principais.
