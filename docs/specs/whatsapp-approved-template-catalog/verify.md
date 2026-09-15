# Verify - whatsapp-approved-template-catalog

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: ready-for-release-user-confirmed-meta-approved

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `npm run build` em `whatsapp-stage-backend` | passou |
| CA-002 | `test-approved-templates.ts` confere onze contratos, idioma e quantidades | passou |
| CA-003 | teste inspeciona contratos sem botao, com botoes e com documento | passou |
| CA-004 | teste rejeita `appointmentReminder` com quantidade incorreta | passou |
| CA-005 | `npm run test:reservation-template` | passou |
| CA-006 | `.github/workflows/deploy-stage.yml` executa `test:approved-templates` | inspecao passou |
| CA-007 | `test_whatsapp_template_delivery.py` e validacoes de `templateAutomationController.ts` | passou |
| CA-008 | endpoints e acoes explicitas de Agenda, Portal e Financeiro | passou por inspecao e compilacao |
| CA-009 | teste Python exige mesmo destinatario e numero cadastrado em comum | passou |
| CA-010 | 777 testes Python, suites Node, 65 testes frontend, `tsc`, lint, build e guardrail SDD | passou |
| CA-011 | `test-document-templates.ts` valida upload e cabecalho de documento | passou |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:approved-templates
cd whatsapp-stage-backend && npm run test:document-templates
cd whatsapp-stage-backend && npm run test:reservation-template
cd backend && venv/bin/python -m unittest tests.test_whatsapp_agenda_service tests.test_whatsapp_template_delivery
cd backend && DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=local-whatsapp-quality-gate-secret-key-1234567890 venv/bin/python -m unittest discover -s tests -p "test_*.py"
cd frontend && npx tsc --noEmit && npm run lint
cd frontend && npm run build
python3 -m unittest backend.tests.test_sdd_guardrail
git diff --check
```

## Resultado

- O catalogo do novo snapshot possui onze contratos em `pt_BR`, incluindo os quatro modelos
  financeiros confirmados como aprovados pelo responsavel.
- Payload sem botao contem apenas o componente de corpo.
- Payload com dois botoes preserva indices `0` e `1` e seus payloads opacos.
- Quantidades incorretas falham antes de qualquer chamada ao provedor.
- A transcricao interna de `reserva_de_agendamento` agora inclui acentos e a frase final aprovada.
- Os novos envios dependem de acao explicita e estado de dominio compativel.
- Respostas dos novos botoes sao registradas na caixa de entrada, sem mutacao automatica do dominio.
- A extensao financeira passou nos testes focados e nas suites locais completas.

## Evidencia historica do catalogo anterior em stage

- `Migration CI` (`31926968177`): concluido com sucesso.
- `Deploy to Stage (VPS)` (`31926968382`): `quality-gate`, `sdd-guardrail` e `deploy-stage` concluidos com sucesso.
- O VPS confirmou `HEAD=d8c80ef`, migração do serviço WhatsApp aplicada e smoke autenticado concluído.
- `https://stage.fortcordis.com.br/` respondeu `200` e redirecionou rotas do app para `https://app.stage.fortcordis.com.br/`.
- `/agenda`, `/financeiro`, `/laudos` e `/whatsapp/health` responderam `200`.
- As novas rotas protegidas de Agenda, Laudos, Financeiro e automação WhatsApp responderam `401` sem credencial.
- Os 19 chunks JavaScript referenciados pelas páginas continham as novas rotas e os rótulos de envio pelo FortCordis.

## Aprovacao externa atual

- os quatro modelos financeiros e seus IDs foram confirmados pelo responsavel como aprovados em
  2026-08-16;
- o catalogo nao consulta o status da Meta em tempo real e registra essa confirmacao operacional sem
  apresenta-la como evidencia automatizada;
- esta extensao ainda nao foi publicada em stage nem em producao.
