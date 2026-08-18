# Spec - whatsapp-lembrete-automatico-consulta

## Requisitos funcionais

- RF-001: `agendamentos` ganha `whatsapp_reminder_sent_at` (timestamp,
  nulo), `whatsapp_reminder_attempts` (inteiro, default 0, não nulo) e
  `whatsapp_reminder_last_error` (texto, nulo).
- RF-002: um worker em background, quando habilitado
  (`WHATSAPP_REMINDER_SCHEDULER_ENABLED=true`), varre periodicamente
  agendamentos elegíveis e tenta enviar o lembrete de cada um.
- RF-003: um agendamento é elegível quando: `status` está em `{Agendado,
  Reservado, Confirmado}`; `whatsapp_reminder_sent_at IS NULL`;
  `whatsapp_reminder_attempts < WHATSAPP_REMINDER_MAX_ATTEMPTS`; e `inicio`
  está entre `agora + WHATSAPP_REMINDER_MIN_LEAD_MINUTES` e
  `agora + WHATSAPP_REMINDER_WINDOW_HOURS`.
- RF-004: o destinatário é resolvido pelo tipo configurado em
  `WHATSAPP_REMINDER_RECIPIENT_TYPE` (`clinica` por padrão): para
  `clinica`, o primeiro número não vazio em `clinica.whatsapps`, com
  fallback para `clinica.telefone`; para `tutor`, `tutor.whatsapp` com
  fallback para `tutor.telefone`.
- RF-005: se não houver destinatário válido, a linha é marcada como erro
  (`whatsapp_reminder_attempts += 1`, `whatsapp_reminder_last_error`
  preenchido) e **não** tenta o outro tipo de destinatário como fallback.
- RF-006: envio bem-sucedido usa `build_agenda_utility_template` +
  `send_agenda_utility_template` (mesmas funções do botão manual da
  Agenda), com `template_key="appointmentReminder"` e chave de
  idempotência `appointment-reminder-{agendamento_id}`, e marca
  `whatsapp_reminder_sent_at = now()`.
- RF-007: envio com falha (validação ou entrega) incrementa
  `whatsapp_reminder_attempts` e grava `whatsapp_reminder_last_error`, sem
  marcar como enviado; ao atingir `WHATSAPP_REMINDER_MAX_ATTEMPTS`, a linha
  para de ser reprocessada.
- RF-008: o worker respeita um lock de execução local (evita ciclos
  concorrentes no mesmo processo) e, opcionalmente, um advisory lock do
  Postgres com chave própria (`WHATSAPP_REMINDER_SCHEDULER_DISTRIBUTED_LOCK_KEY`,
  diferente da usada pelo worker de push) para coordenar múltiplas
  instâncias do backend.
- RF-009: o worker é iniciado/parado junto com os demais workers de
  background em `app/main.py` (evento de startup/shutdown do FastAPI).

## Requisitos não funcionais

- NFR-001 (segurança de envio): `WHATSAPP_REMINDER_SCHEDULER_ENABLED` e
  `WHATSAPP_AGENDA_ENABLED` são independentes; ambos precisam estar
  `true` para qualquer envio real acontecer. Default de ambos: desligado
  (o segundo já era `false` por padrão; o primeiro nasce `false`).
- NFR-002 (observabilidade): o estado do worker (`enabled`,
  `thread_alive`, `poll_seconds`) é exposto em
  `build_runtime_report()["observability"]["whatsapp_reminder_scheduler_worker"]`,
  no mesmo formato dos demais workers.
- NFR-003 (migração): coluna nova via migração versionada própria
  (`backend/migrations/versions/`), idempotente, seguindo o padrão
  existente de helpers locais por arquivo.

## Critérios de aceitação

- CA-001: agendamento elegível dentro da janela é processado e marcado
  como enviado.
- CA-002: agendamento fora da janela (muito próximo ou muito distante) não
  é selecionado pelo worker.
- CA-003: agendamento com status inválido (ex. `Cancelado`) não é
  selecionado.
- CA-004: agendamento já enviado ou com tentativas esgotadas não é
  selecionado de novo.
- CA-005: clínica sem WhatsApp cadastrado gera erro registrado, sem
  reatribuir ao tutor.
- CA-006: ciclo do worker é pulado quando o lock distribuído está ocupado
  (sem duplo processamento entre instâncias).
- CA-007: com `WHATSAPP_REMINDER_SCHEDULER_ENABLED=false` (default), o
  worker não inicia nenhum envio.
