# Verify - agenda-whatsapp-cloud-api

Data: 2026-08-14
Responsavel: Martiniano + Codex
Status: copy-update-local-pending-meta-review

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test-reservation-template.ts` inspeciona modelo, idioma, cinco textos, dois quick replies e o texto completo armazenado na conversa | passou |
| CA-002 | constraints e estado de `agenda_reservation_messages`; envio ambiguo falha fechado | leitura + build passaram |
| CA-003/CA-004 | `test_confirm_is_idempotent_and_updates_active_reservation` | passou |
| CA-005 | `test_late_confirmation_does_not_reactivate_and_creates_alert` | passou |
| CA-006 | `test_change_request_keeps_schedule_and_creates_staff_alert` | passou |
| CA-007 | validacao de destino no core e de remetente no webhook | leitura + tipos passaram |
| CA-008 | rotas importadas, Node compilado, frontend TypeScript/ESLint/build | passou |
| CA-009 | `deploy_prod_vps.sh` e preflight validam formato dos segredos sem registrar seus valores | passou por inspecao + sintaxe |
| CA-010 | `deploy-stage.yml` instala, compila, testa e audita `whatsapp-stage-backend` no quality gate | passou no run `31652774238` |
| CA-011 | workflow valida e transmite por stdin os tres GitHub Secrets de stage, atualiza o `.env` remoto e aplica `0600` sem imprimir valores | passou no run `31652774238` |
| CA-012 | fallback do cliente Graph e default do deploy usam `v26.0` | passou no deploy e no callback real de stage |
| CA-013 | `test-phone-number.ts` cobre equivalencia com/sem nono digito e rejeita DDD/sufixo diferentes | passou localmente |
| CA-014 | controllers inbound/outbound usam `canonicalWhatsAppIdentity` como chave de conversa | build + inspecao passaram localmente |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:reservation-template
cd whatsapp-stage-backend && npm run test:phone-number
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
- Identidade telefonica: equivalencia brasileira restrita passou; DDD, sufixo e numeros internacionais distintos continuaram rejeitados.
- Retry da Graph API: passou.
- Auditoria de dependencias do servico WhatsApp: 0 vulnerabilidades apos atualizar Axios/Express.
- Backend focado: 6 testes de servico/contrato passaram; migracao e ciclo de migracao tambem passaram.
- Suite backend completa com `TZ=UTC`: 718 testes passaram novamente em 14/08/2026.
- Importacao das duas novas rotas FastAPI: passou.
- Frontend TypeScript e ESLint: passaram sem erros ou avisos.
- Build Next.js 15.5.14: passou, com 43 paginas estaticas geradas.
- Scripts de deploy/preflight: `bash -n` passou.
- Preflight com fixture completa passou; fixture com App Secret placeholder foi recusada sem expor valores.
- Quality gate de stage agora cobre build, template, retry, autorizacao, redacao de logs e auditoria do servico WhatsApp.
- `git diff --check`: passou.
- GitHub Secrets de stage cadastrados sem exposicao: `WHATSAPP_ACCESS_TOKEN_STAGE`, `WHATSAPP_APP_SECRET_STAGE` e `WHATSAPP_VERIFY_TOKEN_STAGE`.
- App FortZap usa configuracao de webhook Graph API `v26.0`; defaults do servico e do deploy foram alinhados.
- Deploy de stage `31652774238` e Migration CI `31652774196` terminaram com sucesso no commit `95d94a69`.
- O smoke executado no VPS validou verificacao GET, rejeicao de assinatura invalida, idempotencia de payload duplicado, concorrencia de mensagens, retry da Graph API e canario autenticado.
- Callback HTTPS `https://app.stage.fortcordis.com.br/whatsapp/webhook` aceitou a verificacao com o token real e devolveu o challenge esperado; token incorreto retornou `403`.
- O campo `messages` esta inscrito no app e a assinatura de webhooks da WABA `1369494994627980` foi ativada.
- Health check do servico retornou `200`; `/whatsapp/agents` anonimo retornou `401`.
- O app Meta `975334532125008` foi publicado e esta disponivel ao publico.
- O template `reserva_de_agendamento` em `pt_BR`, com cinco variaveis e os quick replies `Confirmar` e `Solicitar alteracao`, foi criado na WABA correta com ID `1850190569695780` e aparece como ativo no WhatsApp Manager.
- O primeiro teste real enviou para `5585988018899`, mas a Meta devolveu o clique de botao como `558588018899`; a comparacao literal rejeitou o evento e manteve a reserva como `Reservado`.
- A correcao publicada usa a representacao sem o nono digito apenas como chave interna e para auditoria do callback; o numero original continua sendo enviado para a Graph API.
- O teste real repetido apos a correcao entregou a mensagem e atualizou automaticamente a reserva para `Confirmado` quando o destinatario clicou no celular.
- A copia solicitada agora termina com `Apos esse prazo, o horario podera ser disponibilizado para outros clientes automaticamente.`; o teste unitario exige a versao acentuada exata armazenada na conversa.

## Pendencias da atualizacao de copia

- o corpo do modelo `reserva_de_agendamento` foi editado na WABA correta sem alterar as cinco variaveis nem os dois quick replies;
- a Meta confirmou o envio para analise e o modelo aparece como `Em analise`; aguardar o novo conteudo ficar ativo;
- publicar o corpo persistido em stage e repetir uma reserva controlada antes de qualquer promocao para producao;
- testar `Solicitar alteracao` em outra reserva controlada e comprovar o alerta interno.
