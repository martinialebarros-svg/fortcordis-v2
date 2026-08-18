# Plan - whatsapp-lembrete-automatico-consulta

## Fase 1 - schema e configuração

- [x] P1.1 migração `20260818_72_agendamento_whatsapp_reminder.py`
  (`whatsapp_reminder_sent_at/attempts/last_error` + índice de suporte);
- [x] P1.2 colunas equivalentes em `app/models/agendamento.py`;
- [x] P1.3 novas configs em `app/core/config.py` e `.env.example`
  (`WHATSAPP_REMINDER_*`, todas com default seguro).

## Fase 2 - worker

- [x] P2.1 `app/services/whatsapp_reminder_scheduler_service.py`: query de
  elegibilidade, resolução de destinatário, processamento por linha
  reaproveitando `build_agenda_utility_template`/`send_agenda_utility_template`,
  loop com lock local + advisory lock opcional;
- [x] P2.2 wire em `app/main.py` (start/shutdown junto aos demais workers);
- [x] P2.3 exposição do estado do worker em
  `app/core/runtime_checks.py` (`build_runtime_report`), mesmo padrão dos
  demais workers.

## Fase 3 - verificação

- [x] P3.1 teste de migração (idempotência, no-op sem tabela);
- [x] P3.2 testes do serviço: elegibilidade (janela/status/tentativas),
  resolução de destinatário, erro sem WhatsApp cadastrado, loop com limite,
  lock distribuído ocupado;
- [x] P3.3 suíte completa do backend (`unittest discover`) sem regressão;
- [x] P3.4 smoke local: aplicar migração no sqlite de dev, subir o
  servidor e confirmar startup limpo com o worker desligado por padrão.

## Rollback

- Desligar `WHATSAPP_REMINDER_SCHEDULER_ENABLED` (já é o default) para
  parar qualquer envio automático sem precisar reverter código.
- Remover as chamadas em `main.py` e o import do worker restaura o
  comportamento anterior (só botão manual). As colunas novas podem ficar
  sem uso sem efeito colateral, sem exigir migração reversa.
