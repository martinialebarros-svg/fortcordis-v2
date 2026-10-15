# Spec - whatsapp-lembrete-automatico-consulta

## Requisitos funcionais

- RF-001: `agendamentos` ganha `whatsapp_reminder_sent_at` (timestamp,
  nulo), `whatsapp_reminder_attempts` (inteiro, default 0, não nulo) e
  `whatsapp_reminder_last_error` (texto, nulo).
- RF-002: um worker em background, quando habilitado pelo toggle persistido
  (`configuracoes.whatsapp_lembrete_automatico_habilitado=true`), varre periodicamente
  agendamentos elegíveis e tenta enviar o lembrete de cada um.
- RF-003: um agendamento é elegível quando: `status` está em `{Agendado,
  Reservado, Confirmado}` no modelo legado, ou `{Agendado, Confirmado}` com
  `WHATSAPP_REMINDER_SERVICE_TEMPLATE_ENABLED=true`; `whatsapp_reminder_sent_at IS NULL`;
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
  Agenda), com `template_key="appointmentReminder"` enquanto
  `WHATSAPP_REMINDER_SERVICE_TEMPLATE_ENABLED=false` (default), ou
  `template_key="appointmentReminderService"` quando explicitamente habilitado,
  e chave de
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
- RF-010: `GET /agenda/whatsapp/lembrete-preview` (autenticado, mesma
  dependência dos demais endpoints de agenda) retorna a contagem e a lista
  de agendamentos elegíveis agora — mesmo filtro do worker, mas somente
  leitura, sem chamar `send_agenda_utility_template`.
- RF-011: `configuracoes.whatsapp_lembrete_automatico_habilitado` (boolean,
  default `false`) é a fonte de verdade de liga/desliga do worker,
  gravável só por admin via `PUT /configuracoes`, seguindo o mesmo padrão
  já usado por `fortinho_habilitado`.
- RF-012: o worker consulta `whatsapp_lembrete_automatico_habilitado` a
  cada ciclo de poll (não mais uma única vez na criação da thread); se a
  consulta falhar por qualquer motivo, assume desabilitado.
- RF-013: `GET /agenda/whatsapp/lembrete-preview` reporta
  `reminder_scheduler_enabled` a partir dessa mesma coluna, não de env var.
- RF-014: a variante com servico preserva destinatario, paciente, data e hora e
  acrescenta o servico completo vinculado ao agendamento como quinta variavel.
  Nome ausente ou maior que 300 caracteres gera erro registrado sem envio.
  O modelo manual continua explicito: pedir `appointmentReminder` sempre gera
  quatro variaveis, independentemente da flag do scheduler.

## Requisitos não funcionais

- NFR-001 (segurança de envio): o toggle persistido de lembrete e
  `WHATSAPP_AGENDA_ENABLED` são independentes; ambos precisam estar
  `true` para qualquer envio real acontecer. Default de ambos: desligado.
  A antiga env `WHATSAPP_REMINDER_SCHEDULER_ENABLED` nao controla o worker.
- NFR-002 (observabilidade): o estado do worker (`enabled`,
  `thread_alive`, `poll_seconds`) é exposto em
  `build_runtime_report()["observability"]["whatsapp_reminder_scheduler_worker"]`,
  no mesmo formato dos demais workers.
- NFR-003 (migração): coluna nova via migração versionada própria
  (`backend/migrations/versions/`), idempotente, seguindo o padrão
  existente de helpers locais por arquivo.
- NFR-004 (cutover do servico): a flag da variante nao habilita o scheduler,
  preserva janela/tentativas/toggle/locks e nao limpa marcadores de envio ou
  reenvia lembretes anteriores. Ela permanece desligada ate aprovacao Meta e
  publicacao autorizada; o servico Node rejeita a variante pendente antes de
  reservar entrega ou acessar a Graph API. Nenhuma migracao nova e necessaria.

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
- CA-007: com `configuracoes.whatsapp_lembrete_automatico_habilitado=false`
  (default), o worker roda o ciclo de poll mas nunca chama
  `run_whatsapp_reminder_scheduler_due_once`, então não inicia nenhum
  envio.
- CA-010: `GET /configuracoes` retorna `whatsapp_lembrete_automatico_habilitado`
  para qualquer usuário logado; `PUT /configuracoes` só aceita mudar esse
  valor se `current_user.tem_papel("admin")`, senão `403`.
- CA-011: alternar o toggle em `PUT /configuracoes` reflete imediatamente
  em `GET /agenda/whatsapp/lembrete-preview` (`reminder_scheduler_enabled`),
  sem precisar reiniciar o backend.
- CA-008: `GET /agenda/whatsapp/lembrete-preview` lista os agendamentos
  elegíveis (mesmo critério do worker) sem enviar nenhuma mensagem e sem
  alterar `whatsapp_reminder_sent_at`/`attempts`.
- CA-009: o preview mostra só os últimos 4 dígitos do número de destino,
  nunca o número completo.
- CA-012: flag desligada preserva o envio anterior de quatro parametros;
  ligada escolhe a variante de cinco parametros com o mesmo destino,
  agendamento e chave de idempotencia.
- CA-013: servico ausente na variante habilitada incrementa a tentativa e
  registra erro, mantendo `whatsapp_reminder_sent_at IS NULL` sem chamar envio.
- CA-014: com a flag ligada, preview/worker nao selecionam reservas pendentes
  e preservam suas tentativas/marcadores; o envio manual da variante retorna
  409 nesse status. A flag desligada preserva a elegibilidade legada.


## Ativacao operacional protegida — 2026-10-15

A publicacao comum preserva a flag de runtime. A ativacao explicita usa
`DEPLOY_ACTIVATE_WHATSAPP_REMINDER_SERVICE=1` pelo input do workflow de
producao, somente em `main`, depois de Node compilado/saudavel, canario e
restore drill. O contrato compilado deve aprovar a WABA de producao.
O worker e parado antes de atualizar a flag; API e worker sao reiniciados
com verificacao de readiness/atividade. Falhas restauram o valor anterior
ou a ausencia da chave antes do rollback. Stage nao herda o opt-in.
