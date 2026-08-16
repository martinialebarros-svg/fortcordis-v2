# Verify - whatsapp-customer-service-window

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: local-passed

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | teste do calculo e teste da interface | passou |
| CA-002 | limite exato de 24 horas nos testes Node e frontend | passou |
| CA-003 | teste sem mensagem recebida | passou |
| CA-004 | controlador rejeita antes do insert ou da chamada Graph; compilacao estrita | passou |
| CA-005 | webhook usa timestamp do provedor e migracao faz backfill apenas quando nulo | passou por inspecao e compilacao |
| CA-006 | suites, lint, build e guardrail SDD | passou |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:reservation-template
cd whatsapp-stage-backend && npm run test:approved-templates
cd whatsapp-stage-backend && npm run test:customer-service-window
cd whatsapp-stage-backend && npm run test:phone-number
cd whatsapp-stage-backend && npm run test:whatsapp-retry
cd whatsapp-stage-backend && npm run test:auth-policy
cd whatsapp-stage-backend && npm run test:log-redaction
cd whatsapp-stage-backend && npm audit --omit=dev
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
cd backend && DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=<segredo-local-de-teste> venv/bin/python -m unittest discover -s tests -p "test_*.py"
python3 -m unittest backend.tests.test_sdd_guardrail
git diff --check
```

## Resultado

- Calculo Node passou para janela aberta, limite exato de 24 horas, ausencia e data invalida.
- Frontend passou com 52 testes Vitest e 9 testes Node, incluindo indicador aberto e compositor bloqueado no prazo vencido.
- Backend principal passou com 745 testes.
- Backend WhatsApp compilou e todas as suites do quality gate passaram; auditoria encontrou 0 vulnerabilidades de producao.
- TypeScript, lint e build otimizado do frontend passaram; 43 paginas foram geradas.
- O guardrail SDD reconheceu `whatsapp-customer-service-window` como feature qualificada.
- Publicacao em stage e producao nao executada neste ciclo.
