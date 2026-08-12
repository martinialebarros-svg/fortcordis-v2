# Verify - agenda-whatsapp-cloud-api

Data: 2026-08-11
Responsavel: Martiniano + Codex
Status: local-validation-passed

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test-reservation-template.ts` inspeciona modelo, idioma, cinco textos e dois quick replies | passou |
| CA-002 | constraints e estado de `agenda_reservation_messages`; envio ambiguo falha fechado | leitura + build passaram |
| CA-003/CA-004 | `test_confirm_is_idempotent_and_updates_active_reservation` | passou |
| CA-005 | `test_late_confirmation_does_not_reactivate_and_creates_alert` | passou |
| CA-006 | `test_change_request_keeps_schedule_and_creates_staff_alert` | passou |
| CA-007 | validacao de destino no core e de remetente no webhook | leitura + tipos passaram |
| CA-008 | rotas importadas, Node compilado, frontend TypeScript/ESLint/build | passou |
| CA-009 | `deploy_prod_vps.sh` e preflight validam formato dos segredos sem registrar seus valores | passou por inspecao + sintaxe |
| CA-010 | `deploy-stage.yml` instala, compila, testa e audita `whatsapp-stage-backend` no quality gate | passou por inspecao; execucao remota pendente |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:reservation-template
cd whatsapp-stage-backend && npm run test:whatsapp-retry
cd whatsapp-stage-backend && npm run test:auth-policy
cd whatsapp-stage-backend && npm run test:log-redaction
cd whatsapp-stage-backend && npm audit --omit=dev
cd backend && backend/venv/bin/python -m unittest tests.test_whatsapp_agenda_service
cd backend && backend/venv/bin/python -m compileall -q app tests/test_whatsapp_agenda_service.py
cd backend && TZ=UTC backend/venv/bin/python -m unittest discover -s tests -p "test_*.py"
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
bash scripts/whatsapp_stage_preflight.sh  # fixtures valida e invalida, sem servicos/HTTP
```

## Resultados atuais

- Node/TypeScript: compilou.
- Payload do template: passou.
- Retry da Graph API: passou.
- Auditoria de dependencias do servico WhatsApp: 0 vulnerabilidades apos atualizar Axios/Express.
- Backend focado: 6 testes de servico/contrato passaram; migracao e ciclo de migracao tambem passaram.
- Suite backend completa com `TZ=UTC`: 718 testes passaram.
- Importacao das duas novas rotas FastAPI: passou.
- Frontend TypeScript e ESLint: passaram sem erros ou avisos.
- Build Next.js 15.5.23: passou, com 40 paginas estaticas geradas.
- Scripts de deploy/preflight: `bash -n` passou.
- Preflight com fixture completa passou; fixture com App Secret placeholder foi recusada sem expor valores.
- Quality gate de stage agora cobre build, template, retry, autorizacao, redacao de logs e auditoria do servico WhatsApp.
- `git diff --check`: passou.

## Pendencias externas para prova real

- access token permanente de usuario do sistema configurado diretamente no servidor;
- App Secret e verify token configurados diretamente no servidor;
- callback HTTPS publicado e inscricao do campo `messages` ativada no WABA;
- smoke real com o numero `+55 85 8828-1436` e verificacao dos dois botoes;
- confirmacao do modo publicado/permissoes do app antes da promocao para producao.
