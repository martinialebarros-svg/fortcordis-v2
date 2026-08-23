# Spec - whatsapp-chatbot-atendimento

Data: 2026-08-20
Responsavel: Martiniano + Claude
Status: draft

## Escopo funcional

Motor de resposta automática para o WhatsApp de atendimento, rodando no backend
principal (FastAPI), com o serviço `whatsapp-stage-backend` mantido como
transporte da Cloud API. Cada mensagem recebida vira um job com debounce; um
worker resolve a identidade do remetente, monta contexto, gera uma resposta com
LLM restrita a tools e base de conhecimento, aplica guardrails e então **sugere**
o texto na central de atendimento (modo `suggest`, padrão) ou **envia** direto
(modo `auto`, restrito a uma allowlist estreita de intents). Agendamento
autônomo, reengajamento por template e mídia recebida ficam fora.

Atende **as duas personas desde a primeira fase** — tutor e clínica parceira,
com prompts, allowlists e escopos de dado separados — e **roda 24/7**, sem
janela de horário própria: a convivência com a equipe é resolvida pelos portões
de pausa e claim, não por relógio.

## Requisitos funcionais

### Gatilho e fila

- RF-001: `WhatsAppInboundMessageNotificationRequest` ganha os campos
  **opcionais** `wa_phone_number`, `wa_message_id`, `message_type` e
  `message_timestamp`, e `notifyPushForInboundMessage`
  (`whatsapp-stage-backend/src/services/whatsappPushNotificationService.ts`)
  passa a enviá-los. Opcionais porque os dois serviços têm deploys
  independentes: Node novo com Python antigo, e Python novo com Node antigo,
  precisam continuar funcionando (no segundo caso o job não é enfileirado pelo
  gatilho e cai na varredura de reconciliação da RF-006).
- RF-002: o endpoint `POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida`
  (`whatsapp_agenda.py:312`), além do push que já dispara, enfileira uma linha em
  `whatsapp_bot_jobs`. O enfileiramento é envolvido em try/except próprio: falha
  ao enfileirar registra log e **não** altera a resposta do push nem propaga erro
  para o Node (que usa timeout de 5s e engole exceções).
- RF-003: `whatsapp_bot_jobs.wa_message_id` é `UNIQUE`. Reentrega de webhook pela
  Meta, que o Node já deduplica por `payload_hash`/`wa_message_id`, não gera
  segundo job nem resposta duplicada.
- RF-004 (debounce): o job nasce com
  `scheduled_for = now() + WHATSAPP_BOT_DEBOUNCE_SECONDS` (default 12s). Se
  chegar mensagem nova na mesma conversa enquanto existir job `pending`, o job
  anterior passa a `superseded` e o novo assume o `scheduled_for`. Só o último
  job responde, considerando todas as mensagens do intervalo.
- RF-005: worker em background no mesmo padrão de
  `whatsapp_reminder_scheduler_service.py` (thread daemon iniciada e parada com
  os demais workers em `app/main.py`, poll, lock local e advisory lock opcional
  do Postgres), com chave própria `WHATSAPP_BOT_SCHEDULER_DISTRIBUTED_LOCK_KEY`
  = `80433003`, distinta das demais.
- RF-006 (reconciliação): a cada `WHATSAPP_BOT_RECONCILE_EVERY_CYCLES` ciclos o
  worker consulta `GET /conversations` no serviço Node, seleciona as conversas
  com `last_inbound_at` dentro dos últimos `WHATSAPP_BOT_RECONCILE_WINDOW_MINUTES`
  e enfileira job para a última mensagem inbound que não tenha job nem resposta
  registrada. Cobre o caso do backend principal estar fora do ar no momento do
  webhook.
- RF-007: job com falha incrementa `attempts` e grava `last_error`; ao atingir
  `WHATSAPP_BOT_MAX_ATTEMPTS` (default 3) para de ser reprocessado e fica
  visível para suporte (`attempts >= MAX AND status = 'error'`), sem nunca
  enviar nada pela metade.

### Portões de decisão

- RF-008: o bot só age se **todos** forem verdade: `WHATSAPP_BOT_ENABLED=true`
  (env) **e** `configuracoes.whatsapp_bot_atendimento_habilitado=true` (banco,
  gravável só por admin). O toggle do banco é lido a cada ciclo do worker; falha
  na leitura fecha para desabilitado.
- RF-009: o estado por conversa vive em `whatsapp_bot_conversa_estado`, chaveado
  pela identidade canônica do telefone (`wa_identity`), com `modo`
  (`off` | `suggest` | `auto`), `pausado_ate` e `handoff_motivo`. Sem linha, a
  conversa herda `configuracoes.whatsapp_bot_modo` (default `suggest`).
- RF-010: mensagem `from_me = true` enviada por humano na conversa, ou claim da
  conversa por um atendente, pausa o bot por
  `WHATSAPP_BOT_HANDOFF_PAUSE_HOURS` (default 12). Mensagem enviada pelo próprio
  bot não pausa.
- RF-011: pedido explícito de humano (termos como "atendente", "pessoa",
  "humano", "falar com alguém") força handoff imediato: o bot não gera resposta,
  a conversa vai para `status = pending` via `PATCH /conversations/:id/status`, e
  a equipe é avisada por `criar_alerta_interno` + push.
- RF-012: se a janela de 24h estiver fechada
  (`describeCustomerServiceWindow(...).is_open == false` para o
  `last_inbound_at` da conversa), o bot não envia nada — texto livre fora da
  janela é bloqueado pela Meta e o bot não dispara template.
- RF-013: mensagem de tipo diferente de `text` (áudio, imagem, documento,
  sticker, reação, interativo) não é respondida pelo bot: vira handoff com
  motivo registrado.
- RF-032 (24/7): o bot não tem janela de horário própria — atende a qualquer
  hora, todo dia. A convivência com a equipe durante o expediente é resolvida
  pelos portões que já existem (pausa por mensagem humana e por claim, RF-010),
  não por relógio. Consequência assumida: dentro do expediente o bot pode
  responder antes de um atendente que já estava lendo a conversa; o debounce da
  RF-004 é a folga que torna isso raro, e o CB-009 cobre a corrida.

### Identidade e contexto

- RF-014: o contexto vem de `resolve_whatsapp_context`
  (`app/api/v1/endpoints/whatsapp_contexto.py:202`), chamado em processo, com o
  telefone da conversa.
- RF-015 (**nono dígito**): a resolução passa a ser tolerante às duas formas do
  número. `canonicalWhatsAppIdentity` (Node) remove o nono dígito de móveis
  brasileiros (`55DD9XXXXXXXX` -> `55DDXXXXXXXX`) e é essa forma que fica em
  `conversations.wa_phone_number`; `normalize_whatsapp_number` (Python) mantém
  os dígitos e só prefixa `55`. `_has_exact_phone` passa a comparar o número
  cadastrado e o número consultado **pelas duas formas** (com e sem o nono
  dígito), mantendo `normalized_phone` na resposta como está hoje para não
  quebrar quem já consome o endpoint.
- RF-016: quando `resolution != "matched"` (`ambiguous` ou `not_found`), o bot
  não menciona nenhum dado de registro — nome de pet, agendamento, ordem de
  serviço, valor, data. Responde só com informação institucional pública e
  oferece handoff.
- RF-017: as duas personas entram desde a Fase 1. Persona, prompt, allowlist de
  intent e escopo de dados variam por `match_type` (`tutor` e `clinica`);
  nenhuma das duas enxerga dado da outra. Um número que resolve para clínica
  nunca recebe resposta com dado de tutor de outra clínica, e vice-versa.

### Geração

- RF-018: as tools do bot ficam em `app/services/whatsapp_bot_tools.py`, módulo
  próprio. É proibido reaproveitar `TOOL_DEFINITIONS`/`execute_tool` de
  `assistente_ia_tools.py`, que operam com autoridade de staff. Toda tool do bot
  recebe o `tutor_id`/`clinica_id` já resolvido como **filtro aplicado no
  código**, nunca como instrução de prompt.
- RF-019 (allowlist de intents do modo `auto`, Fase 1): a lista é **por
  persona**, e intent fora dela **sempre** vira rascunho, mesmo com a conversa
  em `auto`.
  - `tutor`: horário de funcionamento, endereço e área de atendimento, como
    agendar, formas de contato, "o laudo do meu pet saiu?" (só `pronto` /
    `ainda não`, sem nenhum conteúdo do laudo) e preço de serviço em tabela.
  - `clinica`: horário de funcionamento, área e dias de atendimento, como
    solicitar exame/agendar, formas de contato, status de laudo de paciente
    **daquela clínica** (só `pronto` / `ainda não`) e preço de serviço em
    tabela.
  - Fora da allowlist nas duas personas na Fase 1, sempre rascunho: qualquer
    coisa de ordem de serviço, cobrança, valor em aberto, repasse ou
    negociação comercial — mesmo com o dado disponível no contexto.
- RF-020: a resposta só pode afirmar o que veio da **tool específica da intent**
  ou de `search_knowledge` (`assistente_ia_management.py:701`) nas intents
  institucionais. Consultar horário, por exemplo, não autoriza afirmar preço ou
  status de laudo. Sem a fonte correspondente, o bot não responde: gera
  rascunho e oferece handoff. Proibido responder de memória do modelo.
- RF-021: o prompt é versionado em `WHATSAPP_BOT_PROMPT_VERSION` e a versão fica
  gravada em cada resposta, no mesmo espírito de `PROMPT_VERSION` do ai-echo.

### Guardrails de saída

- RF-022: um validador de saída bloqueia a resposta quando ela contém
  diagnóstico, orientação de medicação ou dose, prognóstico, avaliação de
  sintoma ("é normal?", "é grave?"), promessa de prazo não confirmada por tool
  ou valor não vindo de tabela de preço. Bloqueio nunca vira silêncio: vira
  rascunho com o motivo registrado e handoff sinalizado.
- RF-023 (emergência): termos de emergência na entrada ("não está respirando",
  "desmaiou", "convulsão", "sangramento", "atropelado", "engasgado" e afins,
  em lista versionada) **não passam pelo gerador**. Resposta fixa e curta
  orientando contato telefônico imediato,
  `criar_alerta_interno(nivel="critico")`, push para a equipe e handoff com
  `handoff_motivo = "emergencia"`.
- RF-024: toda mensagem enviada pelo bot se identifica como atendimento
  automático e diz como falar com uma pessoa.
- RF-033 (expediente no texto do handoff): como o bot roda 24/7 mas a equipe
  não, todo handoff precisa dizer **quando** uma pessoa responde, não só que
  vai transferir. Dentro da janela de funcionamento, o texto informa que a
  conversa foi passada para a equipe; fora dela, informa o próximo horário de
  atendimento. A fonte é a janela operacional da agenda já existente
  (`_agenda_day_window`/`_agenda_configuration_rules` em
  `assistente_ia_tools.py`, mesma base de `consultar_funcionamento_agenda`),
  incluindo exceções e feriados. Handoff de emergência (RF-023) é exceção:
  orienta contato telefônico imediato em qualquer horário.
- RF-025: teto de `WHATSAPP_BOT_MAX_REPLIES_PER_CONVERSATION_DAY` (default 20)
  respostas automáticas por conversa por dia e de
  `WHATSAPP_BOT_MAX_REPLY_CHARS` (default 900) caracteres por resposta.

### Registro, envio e UI

- RF-026: `whatsapp_bot_respostas` grava, por job processado: decisão
  (`sent` | `draft` | `suppressed` | `handoff` | `blocked`), motivo, texto
  gerado, texto efetivamente enviado, modelo, versão de prompt, tools usadas,
  tokens de entrada/saída, latência e `resolution`/`match_type` do contexto.
- RF-027: no modo `auto` o envio usa
  `POST /conversations/:id/messages` do serviço Node com header
  `x-whatsapp-internal-token`, e o `metadata` da mensagem marca a origem
  (`{"origem": "bot", "resposta_id": ...}`) para o histórico distinguir bot de
  humano.
- RF-028: na central de atendimento, rascunho pendente aparece acima do
  composer com as ações **Enviar**, **Editar e enviar** e **Descartar**;
  descartar grava feedback negativo na resposta.
- RF-029: mensagens enviadas pelo bot têm selo visual próprio na timeline da
  conversa.
- RF-030: a central permite, por conversa, alternar `auto` / `suggest` / `off` e
  "pausar bot por 12h".
- RF-031: card "Atendimento automático (WhatsApp)" em Configurações -> Empresa,
  no mesmo padrão do card do lembrete automático, com o toggle institucional e o
  modo padrão, graváveis só por admin.

## Requisitos não funcionais

- NFR-001 (segurança de envio): defaults desligados —
  `WHATSAPP_BOT_ENABLED=False`, `whatsapp_bot_atendimento_habilitado=false`,
  `whatsapp_bot_modo='suggest'`. Nenhum envio automático a cliente acontece sem
  duas decisões deliberadas e separadas.
- NFR-002 (latência do webhook): o enfileiramento no endpoint de mensagem
  recebida é uma única linha e não pode adicionar mais que ~50ms ao caminho já
  existente; toda a geração roda no worker, fora do request do Node.
- NFR-003 (observabilidade): estado do worker (`enabled`, `thread_alive`,
  `poll_seconds`, `pending_jobs`, `last_cycle_at`) exposto em
  `build_runtime_report()["observability"]["whatsapp_bot_worker"]`
  (`app/core/runtime_checks.py`), no mesmo formato dos demais workers.
- NFR-004 (privacidade em log): corpo de mensagem de cliente e número completo
  nunca aparecem em log em texto puro, seguindo a redação já adotada no serviço
  Node (`wpp-03-redacao-logs-for36`). Preview em log é truncado e o número é
  mascarado nos últimos 4 dígitos, como no preview do lembrete.
- NFR-005 (custo): além do teto por conversa da RF-025, teto global diário
  configurável; ao estourar, nenhuma nova chamada paga é aberta, o resultado
  vira `draft` com motivo `teto_global_tokens` e segue para revisão da equipe,
  sem parar o atendimento humano.
- NFR-006 (migração): migração versionada e idempotente
  `backend/migrations/versions/20260820_75_whatsapp_bot_atendimento.py`, no
  padrão de helpers locais por arquivo já usado nas migrações 72-74.
- NFR-007 (independência de banco): nenhuma consulta do backend principal lê ou
  escreve diretamente nas tabelas do `whatsapp-stage-backend`
  (`conversations`, `messages`); toda troca é por HTTP com token interno.

## Contratos técnicos

### API

Alteração (retrocompatível):

- `POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida`
  - payload ganha `wa_phone_number?`, `wa_message_id?`, `message_type?`,
    `message_timestamp?`;
  - resposta ganha `bot_job_enqueued: bool`.

Novos (autenticados como os demais endpoints de WhatsApp, papéis
`admin,recepcao,veterinario,cardiologista`):

- `GET /api/v1/whatsapp/bot/conversas/{wa_identity}/estado` -> modo, pausa,
  motivo de handoff, rascunho pendente.
- `PATCH /api/v1/whatsapp/bot/conversas/{wa_identity}/estado` -> altera modo /
  pausa.
- `POST /api/v1/whatsapp/bot/respostas/{resposta_id}/enviar` -> envia o
  rascunho (texto original ou editado) via serviço Node e marca a decisão.
- `POST /api/v1/whatsapp/bot/respostas/{resposta_id}/descartar` -> descarta com
  feedback.
- `GET /api/v1/whatsapp/bot/preview` -> somente leitura: quantas conversas e
  jobs estariam em cada estado agora, sem gerar nem enviar nada (mesmo papel do
  `lembrete-preview`, que existe justamente para inspecionar alcance antes de
  ligar).

### Banco/migrações

Migração `20260820_75_whatsapp_bot_atendimento.py`:

- `whatsapp_bot_jobs`: `id`, `wa_identity`, `conversation_id`, `wa_message_id`
  (UNIQUE), `status` (`pending|processing|done|error|superseded`),
  `scheduled_for`, `attempts` (default 0), `last_error`, `created_at`,
  `updated_at`. Índice em (`status`, `scheduled_for`).
- `whatsapp_bot_respostas`: `id`, `job_id`, `wa_identity`, `conversation_id`,
  `decisao`, `motivo`, `texto_gerado`, `texto_enviado`, `modelo`,
  `prompt_version`, `tools_usadas` (JSON), `input_tokens`, `output_tokens`,
  `latencia_ms`, `resolution`, `match_type`, `feedback` (`null|positivo|negativo`),
  `enviado_por_id`, `created_at`.
- `whatsapp_bot_conversa_estado`: `wa_identity` (PK), `modo`, `pausado_ate`,
  `handoff_motivo`, `atualizado_por_id`, `updated_at`.
- `configuracoes`: `whatsapp_bot_atendimento_habilitado` (bool, default
  `false`), `whatsapp_bot_modo` (varchar, default `suggest`).

### Configuração

Novas em `app/core/config.py` + `.env.example`, todas com default seguro:
`WHATSAPP_BOT_ENABLED=False`, `WHATSAPP_BOT_MODEL` (default igual a
`ASSISTENTE_IA_MODEL`), `WHATSAPP_BOT_PROMPT_VERSION`,
`WHATSAPP_BOT_DEBOUNCE_SECONDS=12`, `WHATSAPP_BOT_SCHEDULER_POLL_SECONDS=5`,
`WHATSAPP_BOT_SCHEDULER_DISTRIBUTED_LOCK_ENABLED=True`,
`WHATSAPP_BOT_SCHEDULER_DISTRIBUTED_LOCK_KEY=80433003`,
`WHATSAPP_BOT_MAX_ATTEMPTS=3`, `WHATSAPP_BOT_HANDOFF_PAUSE_HOURS=12`,
`WHATSAPP_BOT_MAX_REPLIES_PER_CONVERSATION_DAY=20`,
`WHATSAPP_BOT_MAX_TOKENS_PER_DAY=100000`,
`WHATSAPP_BOT_MAX_REPLY_CHARS=900`,
`WHATSAPP_BOT_RECONCILE_EVERY_CYCLES=60`,
`WHATSAPP_BOT_RECONCILE_WINDOW_MINUTES=30`.

### Frontend

- `frontend/app/whatsapp-stage/page.tsx`: painel de rascunho acima do composer,
  selo de mensagem enviada pelo bot na timeline, controle de modo/pausa por
  conversa.
- `frontend/app/configuracoes/page.tsx`: card "Atendimento automático
  (WhatsApp)" ao lado dos cards Fortinho e Lembrete automático.

## Compatibilidade e rollout

- Retrocompatível: campos novos do payload Node -> Python são opcionais; as
  tabelas são novas; as colunas de `configuracoes` nascem com default seguro.
- Feature flags: `WHATSAPP_BOT_ENABLED` (env) e
  `configuracoes.whatsapp_bot_atendimento_habilitado` (banco), independentes.
- Rollback: desmarcar o toggle em Configurações para o bot parar sem deploy.
  Remover a chamada do worker em `main.py` restaura o comportamento anterior; as
  tabelas novas podem ficar sem uso, sem migração reversa.

## Critérios de aceitação

- CA-001: mensagem inbound de texto com o bot habilitado cria exatamente um job
  `pending` com `scheduled_for` no futuro.
- CA-002: reentrega do mesmo `wa_message_id` não cria segundo job.
- CA-003: três mensagens em sequência dentro da janela de debounce deixam um
  único job ativo; os anteriores ficam `superseded` e apenas uma resposta é
  produzida, considerando o texto das três.
- CA-004: falha ao enfileirar o job não altera o retorno do push nem levanta
  erro no endpoint de mensagem recebida.
- CA-005: com `WHATSAPP_BOT_ENABLED=false` **ou** o toggle do banco em `false`,
  nenhum job é processado e nenhuma mensagem é enviada.
- CA-006: conversa em modo `suggest` produz rascunho e **nunca** chama o envio
  no serviço Node.
- CA-007: humano envia mensagem na conversa -> `pausado_ate` passa a ficar no
  futuro e o próximo job é encerrado como `suppressed`.
- CA-008: janela de 24h fechada -> decisão `suppressed`, sem envio.
- CA-009: mensagem de áudio/imagem/documento -> decisão `handoff`, sem geração.
- CA-010: "quero falar com um atendente" -> handoff imediato, conversa em
  `pending`, alerta interno criado, sem chamada ao LLM.
- CA-011: entrada com termo de emergência -> resposta fixa, alerta de
  `nivel="critico"`, `handoff_motivo = "emergencia"`, e o gerador não é chamado.
- CA-012 (**nono dígito**): tutor cadastrado como `(85) 99999-8888` é resolvido
  como `matched` tanto para `5585999998888` quanto para a identidade canônica
  `558599998888` vinda do Node.
- CA-013: `resolution = "ambiguous"` ou `"not_found"` -> a resposta gerada não
  contém nome de pet, data de agendamento, número de OS nem valor.
- CA-014: intent fora da allowlist, com a conversa em `auto`, resulta em
  `draft`, não em `sent`.
- CA-015: resposta candidata com conteúdo clínico é bloqueada pelo validador,
  vira `blocked` + rascunho, e o motivo fica gravado.
- CA-016: resposta sem fonte (nenhuma tool e nenhum trecho de conhecimento
  recuperado) não é enviada.
- CA-017: atingido o teto diário por conversa, novas mensagens viram `suppressed`
  com motivo de teto, sem envio.
- CA-018: modo `auto` com todos os portões abertos envia via serviço Node e a
  mensagem aparece no histórico com `metadata.origem = "bot"`.
- CA-019: `GET /api/v1/whatsapp/bot/preview` não gera, não envia e não altera
  nenhum job.
- CA-020: `PUT /configuracoes` só aceita alterar `whatsapp_bot_atendimento_habilitado`
  e `whatsapp_bot_modo` de admin (`403` para os demais), e a mudança reflete no
  ciclo seguinte do worker sem restart.
- CA-021: ciclo do worker é pulado quando o advisory lock está ocupado, sem
  processamento duplicado entre instâncias.
- CA-022: nenhum log emitido pelo fluxo do bot contém o corpo completo da
  mensagem do cliente nem o número completo.
- CA-023 (escopo entre personas): conversa resolvida como `clinica` produz
  resposta apenas com agendamentos/pacientes daquela clínica, e conversa
  resolvida como `tutor` apenas com os pets daquele tutor — nenhuma das duas
  alcança dado da outra.
- CA-024: intent de ordem de serviço, cobrança ou valor em aberto, em conversa
  `auto`, resulta em `draft` nas duas personas, mesmo com o dado presente no
  contexto.
- CA-025: handoff disparado fora da janela de funcionamento informa o próximo
  horário de atendimento; dentro da janela, informa que a conversa foi passada
  para a equipe. Handoff de emergência mantém o texto de contato imediato nos
  dois casos.
- CA-026: claim de atendente durante a janela de debounce faz o job terminar
  como `suppressed`, sem envio e sem rascunho novo.

## Casos de borda

- CB-001: cliente manda mensagem enquanto o worker já está processando o job
  anterior daquela conversa — o job em `processing` não é substituído; a
  mensagem nova gera job próprio, que ao rodar reavalia os portões (inclusive
  a pausa que a resposta anterior possa ter criado).
- CB-002: serviço Node indisponível na hora do envio — job vai para `error` com
  retry; ao esgotar tentativas, vira rascunho para a equipe, nunca envio cego
  depois de muito tempo.
- CB-003: backend principal fora do ar no momento do webhook — nenhum job é
  criado; a varredura de reconciliação recupera dentro da janela configurada.
- CB-004: `resolve_whatsapp_context` levanta `HTTPException` de número inválido
  (fora de 12-15 dígitos) — tratado como `not_found`, sem quebrar o job.
- CB-005: dois números diferentes do mesmo tutor (fixo e móvel) — cada conversa
  tem sua identidade canônica e seu próprio estado; não há merge nesta entrega.
- CB-006: cliente responde a um template de reserva com botão — o fluxo de
  `agendaButtonService` continua tratando, e o bot não gera resposta para
  mensagens do tipo `button`/`interactive` (RF-013).
- CB-007: mensagem chega exatamente no limite da janela de 24h e a janela fecha
  durante o debounce — o portão da RF-012 é reavaliado no momento do envio, não
  no do enfileiramento.
- CB-008: deploy do Node novo antes do Python novo — campos extras são ignorados
  pelo Python antigo; deploy do Python novo antes do Node novo — o gatilho não
  traz `wa_message_id` e a reconciliação assume.
- CB-009: atendente dá claim ou começa a responder durante a janela de debounce
  — os portões são reavaliados no momento em que o job roda, depois do
  debounce, então o job termina como `suppressed` e o bot não fala por cima da
  pessoa. É o caso mais provável de acontecer no dia a dia com o bot 24/7
  ligado durante o expediente.
- CB-010: a janela de funcionamento da agenda não é necessariamente a janela em
  que alguém está de olho no inbox. Enquanto não existir configuração própria de
  horário de atendimento, RF-033 usa a janela da agenda como proxy — registrado
  como limitação conhecida, não como equivalência.

## Fora de escopo

- Agendamento, remarcação ou cancelamento executados pelo bot.
- Disparo de template aprovado pelo bot (inclusive reengajamento fora da janela).
- Resposta a áudio, imagem, documento ou mensagem interativa.
- Envio de laudo ou de qualquer conteúdo clínico de laudo.
- Correção da colisão de `DISTRIBUTED_LOCK_KEY` entre o worker de lembrete e o
  do assistente IA (registrada no `intent.md`, corrigir em spec própria).
- Unificação de identidade entre múltiplos números do mesmo cliente.
