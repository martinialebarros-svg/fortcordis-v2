# Verify - whatsapp-approved-template-catalog

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: local-passed-stage-pending

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `npm run build` em `whatsapp-stage-backend` | passou |
| CA-002 | `test-approved-templates.ts` confere total, idioma e contratos | passou |
| CA-003 | teste inspeciona `laudo_disponivel_portal` e `lembrete_pagamento_pendente` | passou |
| CA-004 | teste rejeita `appointmentReminder` com quantidade incorreta | passou |
| CA-005 | `npm run test:reservation-template` | passou |
| CA-006 | `.github/workflows/deploy-stage.yml` executa `test:approved-templates` | inspecao passou |
| CA-007 | `test_whatsapp_template_delivery.py` e validacoes de `templateAutomationController.ts` | passou |
| CA-008 | endpoints e acoes explicitas de Agenda, Portal e Financeiro | passou por inspecao e compilacao |
| CA-009 | cobranca oficial somente quando existe uma unica OS pendente | passou por inspecao e compilacao |
| CA-010 | 740 testes Python, suites Node, `tsc`, lint, build frontend e guardrail SDD | passou |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:approved-templates
cd whatsapp-stage-backend && npm run test:reservation-template
cd backend && venv/bin/python -m unittest tests.test_whatsapp_agenda_service tests.test_whatsapp_template_delivery
cd backend && DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=local-whatsapp-quality-gate-secret-key-1234567890 venv/bin/python -m unittest discover -s tests -p "test_*.py"
cd frontend && npx tsc --noEmit && npm run lint
cd frontend && npm run build
python3 -m unittest backend.tests.test_sdd_guardrail
git diff --check
```

## Resultado

- O catalogo possui oito modelos de utilidade em `pt_BR`.
- Payload sem botao contem apenas o componente de corpo.
- Payload com dois botoes preserva indices `0` e `1` e seus payloads opacos.
- Quantidades incorretas falham antes de qualquer chamada ao provedor.
- A transcricao interna de `reserva_de_agendamento` agora inclui acentos e a frase final aprovada.
- Os novos envios dependem de acao explicita e estado de dominio compativel.
- Respostas dos novos botoes sao registradas na caixa de entrada, sem mutacao automatica do dominio.
- A suite completa do backend passou com 740 testes.
- O build otimizado do frontend gerou 43 paginas sem erro.
- Nenhum ambiente foi publicado.
