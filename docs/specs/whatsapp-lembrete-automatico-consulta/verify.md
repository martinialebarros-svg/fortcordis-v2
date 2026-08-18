# Verify - whatsapp-lembrete-automatico-consulta

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_run_due_once_processes_up_to_limit`: 3 agendamentos elegíveis, `limit=2` processa 2 e marca `whatsapp_reminder_sent_at` | passou |
| CA-002 | `test_fetch_next_due_agendamento_respeita_janela_status_e_tentativas`: agendamento 10min no futuro (abaixo do piso de 45min) e 30h no futuro (acima da janela de 24h) não são selecionados | passou |
| CA-003 | Mesmo teste: agendamento `status="Cancelado"` não é selecionado | passou |
| CA-004 | Mesmo teste: agendamento com `whatsapp_reminder_sent_at` preenchido e agendamento com `whatsapp_reminder_attempts=3` (== MAX) não são selecionados | passou |
| CA-005 | `test_process_agendamento_marca_erro_quando_clinica_sem_whatsapp`: clínica sem `whatsapps`/`telefone` gera `result == "error"`, `attempts == 1`, `last_error` preenchido, `sent_at` continua `None` | passou |
| CA-006 | `test_run_due_once_skips_cycle_when_distributed_lock_is_busy`: lock ocupado → `processed=0`, nenhuma linha tocada | passou |
| CA-007 | `.env.example`/`config.py`: `WHATSAPP_REMINDER_SCHEDULER_ENABLED=False` por padrão; `_scheduler_worker_main` retorna sem agendar nada quando desligado | passou (inspeção de código + smoke de startup) |
| CA-008 | `test_list_eligible_agendamentos_preview_nao_envia_nada_e_mascara_destino`: após chamar o preview, `whatsapp_reminder_sent_at` continua `None` e `attempts` continua `0` no agendamento elegível | passou |
| CA-009 | Mesmo teste: `destination_last4 == "8888"` para o número `5585999998888` cadastrado, nunca o número completo | passou |

## Comandos executados

```bash
cd backend
venv/bin/python -m unittest tests.test_whatsapp_reminder_migration -v
venv/bin/python -m unittest tests.test_whatsapp_reminder_scheduler_service -v
venv/bin/python -m unittest tests.test_whatsapp_agenda_service -v
venv/bin/python -m unittest discover -s tests -p "test_*.py"
```

## Verificação manual

1. `venv/bin/python -c "from migrations.runner import run_migrations; run_migrations()"`
   aplicou a migração 72 no sqlite de desenvolvimento sem erro.
2. Conferido via `sqlite3`/`PRAGMA table_info`: as 3 colunas novas existem em
   `agendamentos`.
3. Subida do servidor local (`start_server.py`) com
   `WHATSAPP_REMINDER_SCHEDULER_ENABLED` no valor padrão (`false`):
   `Application startup complete` sem exceções, worker inativo por
   configuração (log `Worker de lembrete automatico do WhatsApp desativado
   por configuracao.` esperado ao habilitar em outro teste manual).

## Resultado final - 2026-08-18

- Testes de migração: 2 passaram.
- Testes do serviço/worker: 6 passaram.
- Suíte completa do backend (`unittest discover`): 798 testes passaram, sem
  regressão nos módulos de agenda/WhatsApp existentes
  (`test_whatsapp_agenda_service`, `test_admin_hardening_readiness`,
  `test_runtime_checks_observability`).
- Smoke local de startup: passou, worker permanece desligado por padrão.

Risco residual: o worker só foi validado com dados sintéticos locais
(SQLite). A primeira habilitação real (`WHATSAPP_REMINDER_SCHEDULER_ENABLED=true`)
deve acontecer primeiro em stage, com `WHATSAPP_AGENDA_ENABLED` também
avaliado com cuidado, antes de promover para produção — ambos os
interruptores continuam desligados por padrão nesta entrega.

## Resultado do endpoint de preview - 2026-08-18

- Testado localmente contra o sqlite de dev com login real (usuário seed
  `admin@fortcordis.com`): sem dados elegíveis, retornou `count: 0`.
- Inserido um agendamento sintético elegível (clínica com WhatsApp
  cadastrado, horário 10h no futuro): o preview retornou `count: 1`, com
  `recipient_nome`, `has_valid_destination: true` e `destination_last4`
  corretos; dados sintéticos removidos após o teste.
- `unittest discover` completo (798 → 799 com o teste novo): passou sem
  regressão.

Este endpoint existe para o usuário inspecionar o alcance real em stage
(quais agendamentos e clínicas seriam afetados) antes de decidir habilitar
o envio automático de fato.

## Habilitação real em stage - 2026-08-18

- Usuário consultou `GET /agenda/whatsapp/lembrete-preview` em
  `app.stage.fortcordis.com.br` (console do navegador, sessão autenticada):
  `whatsapp_agenda_enabled: true` (interruptor geral já ligado por causa do
  cutover de produção anterior) e `count: 0` (nenhum agendamento real caía
  na janela de 24h no momento da checagem) — habilitar o worker nesse
  instante não disparava nenhum envio imediato.
- Confirmado com o usuário, adicionado o passo "Configure WhatsApp reminder
  scheduler flag on Stage VPS" em `.github/workflows/deploy-stage.yml`
  (mesmo padrão `upsert_env` já usado para os segredos do WhatsApp Cloud
  API), escrevendo `WHATSAPP_REMINDER_SCHEDULER_ENABLED=true` no `.env`
  real da VPS de stage antes do passo de deploy, que reinicia o serviço
  `fortcordis-stage-backend` e aplica o valor novo.
- `WHATSAPP_AGENDA_ENABLED` não foi tocado (já estava `true`); nenhuma
  mudança em produção (`main`) foi feita nesta ação — o worker segue
  desligado em produção até decisão e verificação separadas em stage.
