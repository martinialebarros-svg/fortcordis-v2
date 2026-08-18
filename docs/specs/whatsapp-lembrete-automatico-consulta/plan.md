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

## Fase 2b - preview somente leitura

- [x] P2b.1 `list_eligible_agendamentos_preview` no serviço, reaproveitando
  o mesmo filtro de elegibilidade do worker (`_eligibility_filters`);
- [x] P2b.2 `GET /agenda/whatsapp/lembrete-preview` em
  `whatsapp_agenda.py`, mesma autenticação dos demais endpoints;
- [x] P2b.3 destino mascarado (últimos 4 dígitos) na resposta.

## Fase 3 - verificação

- [x] P3.1 teste de migração (idempotência, no-op sem tabela);
- [x] P3.2 testes do serviço: elegibilidade (janela/status/tentativas),
  resolução de destinatário, erro sem WhatsApp cadastrado, loop com limite,
  lock distribuído ocupado;
- [x] P3.3 suíte completa do backend (`unittest discover`) sem regressão;
- [x] P3.4 smoke local: aplicar migração no sqlite de dev, subir o
  servidor e confirmar startup limpo com o worker desligado por padrão.

## Fase 4 - toggle em Configurações (substitui env var)

- [x] P4.1 migração `20260818_73_whatsapp_lembrete_toggle_config.py`
  (coluna `configuracoes.whatsapp_lembrete_automatico_habilitado`);
- [x] P4.2 endpoints `GET`/`PUT /configuracoes`: expor o campo, admin-guard
  pontual (mesmo padrão de `fortinho_habilitado`);
- [x] P4.3 `is_reminder_scheduler_enabled_in_db()` + refactor de
  `_scheduler_worker_main` para reler o banco a cada ciclo (thread sempre
  inicia, como os demais workers);
- [x] P4.4 `get_whatsapp_reminder_scheduler_worker_runtime_state` e o
  endpoint de preview passam a refletir a coluna, não a env var;
- [x] P4.5 remover `WHATSAPP_REMINDER_SCHEDULER_ENABLED` de `config.py`,
  `.env.example` e do passo correspondente em `deploy-stage.yml`;
- [x] P4.6 card "Lembrete automático de consulta (WhatsApp)" em
  Configurações → Empresa, ao lado do card Fortinho.

## Rollback

- Desmarcar o toggle em Configurações (default `false`) para parar
  qualquer envio automático sem precisar de deploy.
- Remover as chamadas em `main.py` e o import do worker restaura o
  comportamento anterior (só botão manual). As colunas novas podem ficar
  sem uso sem efeito colateral, sem exigir migração reversa.
