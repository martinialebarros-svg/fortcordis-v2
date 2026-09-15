# Intent - whatsapp-lembrete-automatico-consulta

## Problema

O lembrete de consulta (template Meta `appointmentReminder`, já aprovado e
com envio manual funcionando desde `agenda-whatsapp-cloud-api`) dependia
inteiramente de alguém lembrar de clicar no botão certo na Agenda. Não havia
nenhum lembrete automático por tempo, mesmo com a peça mais cara (aprovação
do template na Meta) já pronta.

## Objetivo

Enviar automaticamente o lembrete de consulta 24h antes do horário
agendado, para a clínica parceira responsável pelo agendamento, sem
depender de ação manual.

## Escopo inicial

- worker em background no backend principal, no mesmo padrão já usado por
  `push_scheduler_service.py` (thread daemon + poll + lock distribuído
  opcional via Postgres advisory lock);
- reaproveita as funções de serviço já existentes
  (`build_agenda_utility_template` + `send_agenda_utility_template`) sem
  nenhuma chamada HTTP nova — o worker chama em processo, do mesmo jeito que
  o botão manual da Agenda chama;
- controle de estado por agendamento (`whatsapp_reminder_sent_at`,
  `whatsapp_reminder_attempts`, `whatsapp_reminder_last_error`) para nunca
  enviar duas vezes e limitar tentativas em caso de erro;
- destinatário padrão: **clínica parceira** (mesmo canal já usado no fluxo
  manual de reserva), não o tutor diretamente — decisão confirmada com o
  usuário.
- janela: **24h antes** do horário do agendamento — decisão confirmada com
  o usuário.

## Fora de escopo

- envio direto ao tutor (fica como parâmetro de configuração
  `WHATSAPP_REMINDER_RECIPIENT_TYPE` para o futuro, mas o padrão e o único
  caminho testado nesta entrega é clínica);
- fallback automático para o tutor quando a clínica não tem WhatsApp
  cadastrado — nesse caso a linha fica marcada como erro, visível para
  revisão manual, sem tentar outro destinatário por conta própria;
- reagendamento/cancelamento automático baseado na resposta do lembrete
  (os botões `Confirmar presença`/`Solicitar alteração` do template já
  eram tratados pelo webhook existente de `agenda-whatsapp-cloud-api`; esta
  entrega não muda esse fluxo, só passa a disparar o envio inicial sem
  clique manual);
- lembrete para o fluxo 100% manual antigo (`agenda-reserva-whatsapp-manual`,
  sem Cloud API) — o worker só processa agendamentos elegíveis pelo mesmo
  contrato usado pelo botão manual da Cloud API.

## Riscos e decisões

- **Dois interruptores independentes**: `WHATSAPP_AGENDA_ENABLED` (já
  existente, kill-switch geral de qualquer envio real, manual ou
  automático) e `WHATSAPP_REMINDER_SCHEDULER_ENABLED` (novo, default
  `False`) — o worker só dispara envio de fato se AMBOS estiverem
  habilitados. Isso permite testar o botão manual em stage sem ligar o
  worker automático, e vice-versa.
- Piso de antecedência mínima (`WHATSAPP_REMINDER_MIN_LEAD_MINUTES`,
  default 45min): agendamentos criados/reagendados muito próximos do
  horário nunca entram na janela elegível — evita lembrete "de última
  hora" para reagendamento feito em cima da hora. Resolve sozinho, sem
  lógica de tolerância separada.
- Retentativa limitada (`WHATSAPP_REMINDER_MAX_ATTEMPTS`, default 3): após
  esgotar as tentativas, a linha para de ser reprocessada mas não é
  marcada como enviada — fica visível via consulta simples
  (`attempts >= MAX AND sent_at IS NULL`) para quem for dar suporte.
- Idempotência: chave `appointment-reminder-{agendamento_id}` é estável por
  agendamento, reaproveitando o mesmo mecanismo de idempotência já usado
  pelo catálogo de templates aprovados no serviço WhatsApp.
- Não reatribui responsabilidade quando o destinatário não tem WhatsApp
  válido — decisão deliberada para não mandar mensagem institucional da
  Fort Cordis para o tutor sem essa ter sido a escolha operacional.

## Adendo - preview somente leitura antes de habilitar

Antes de ligar o lembrete automático em stage/produção pela primeira vez, é
preciso ver o alcance real: quais agendamentos já cadastrados cairiam na
janela elegível agora, sem enviar nada. Adicionado
`GET /api/v1/agenda/whatsapp/lembrete-preview` (mesma autenticação dos
demais endpoints de agenda) que reaproveita a mesma função de elegibilidade
do worker, mas apenas lista o resultado (nome da clínica, se há WhatsApp
válido, últimos 4 dígitos do destino) — nunca chama `send_agenda_utility_template`.

## Adendo - liga/desliga passa para Configurações (banco), não mais env var

Testado em stage com a habilitação via env var (`WHATSAPP_REMINDER_SCHEDULER_ENABLED`,
escrita no `.env` da VPS por um passo do pipeline de deploy). Ao testar em
produção, o preview mostrou 10 agendamentos reais elegíveis imediatamente
em 8 clínicas — o usuário decidiu não habilitar ainda (quer revisar os
números de WhatsApp cadastrados primeiro) e pediu um toggle de verdade em
Configurações, em vez de precisar me pedir para editar pipeline/SSH cada
vez.

Mudança: o liga/desliga do worker passa a ser a coluna
`configuracoes.whatsapp_lembrete_automatico_habilitado` (mesmo padrão do
toggle `fortinho_habilitado` já existente — gravável só por admin via
`PUT /configuracoes`), lida a cada ciclo do worker
(`is_reminder_scheduler_enabled_in_db()`), não mais uma env var lida uma
única vez na criação da thread. A env var `WHATSAPP_REMINDER_SCHEDULER_ENABLED`
foi removida (de `config.py`, `.env.example` e do passo correspondente em
`deploy-stage.yml`, que só existia para escrevê-la via SSH). `WHATSAPP_AGENDA_ENABLED`
continua como está — é o interruptor mais profundo, no envio de fato, e
não muda com este adendo.

Consequência: a thread do worker agora sempre inicia (mesmo padrão dos
demais workers de background), e o ciclo de poll consulta o banco antes de
decidir se processa algo naquele ciclo — falha na consulta fecha para
`False` (nunca dispara por acidente se o banco estiver indisponível).
