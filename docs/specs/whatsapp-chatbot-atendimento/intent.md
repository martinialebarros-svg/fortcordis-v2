# Intent - whatsapp-chatbot-atendimento

Data: 2026-08-20  
Responsavel: Martiniano + Claude  
Status: draft

## Problema

Hoje toda mensagem que chega no WhatsApp da Fort Cordis espera uma pessoa. A
central de atendimento (`frontend/app/whatsapp-stage/page.tsx`) já mostra a
conversa, o vínculo cadastral e o histórico, mas quem responde é sempre um
atendente humano — inclusive nas perguntas que se repetem todo dia ("qual o
horário?", "o laudo do meu cachorro saiu?", "vocês atendem em domicílio?",
"como faço para agendar?").

Fora do horário comercial ninguém responde. A janela de 24h de atendimento da
Meta (`whatsapp-stage-backend/src/services/customerServiceWindow.ts`) fecha em
silêncio e, quando a equipe volta, só resta reengajar por template aprovado.

A infraestrutura para resolver isso já existe e não está sendo usada para
atendimento:

- webhook assinado, idempotente e com dedupe por `payload_hash`
  (`whatsapp-stage-backend/src/controllers/webhookController.ts`);
- envio de texto livre (`POST /conversations/:id/messages`) e de templates
  aprovados, com inbox humano, claim/unclaim e status por conversa;
- resolução de telefone para clínica/tutor/pets/agendamentos/OS
  (`backend/app/api/v1/endpoints/whatsapp_contexto.py:202`);
- notificação Node -> Python a cada mensagem recebida, com token interno
  (`POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida`);
- stack de IA com tool calling, ação pendente com aprovação humana, base de
  conhecimento com embeddings e auditoria (`backend/app/services/assistente_ia_*.py`).

O que falta é a camada que decide **se** e **o que** responder.

## Objetivo

Responder automaticamente o cliente no WhatsApp nas perguntas de baixo risco e
alta frequência — inclusive fora do horário comercial — reduzindo o tempo de
primeira resposta, sem nunca dar orientação clínica e sem nunca expor dado de
um cliente para outro.

## Escopo inicial

- **Motor de decisão no backend principal (FastAPI), não no serviço Node.** O
  resolvedor de identidade, a base de conhecimento, as tools, o ORM clínico e a
  auditoria já estão em Python; o serviço Node continua sendo transporte da
  Cloud API. A comunicação nos dois sentidos já existe e é reaproveitada:
  Node -> Python pelo endpoint de mensagem recebida
  (`whatsappPushNotificationService.ts`, header `X-FortCordis-WhatsApp-Token`) e
  Python -> Node pelas rotas de conversa/automação (header
  `x-whatsapp-internal-token`, mesmo `WHATSAPP_INTERNAL_API_TOKEN`). **Nenhuma
  parte do desenho depende de os dois serviços compartilharem o mesmo Postgres.**
- **Fila durável, não fire-and-forget.** O push de mensagem recebida hoje é
  `void ... catch` e pode se perder sem consequência; perder a resposta ao
  cliente tem. A geração leva segundos e a Meta exige `200` rápido, então o
  trabalho sai do caminho do webhook para um worker, no mesmo padrão de
  `whatsapp_reminder_scheduler_service.py`.
- **Debounce por conversa.** Cliente manda três mensagens curtas seguidas
  ("oi" / "queria marcar" / "pro meu cachorro"). Sem espera, o bot responde três
  vezes e fora de ordem.
- **Dois modos, com o seguro como padrão:** `suggest` (copiloto — o bot gera, a
  equipe revisa e envia) e `auto` (envio direto, restrito a uma allowlist
  estreita de intents). O padrão institucional nasce em `suggest`.
- **Guardrails clínicos duros**, detalhados na spec: zero conteúdo clínico,
  emergência vai direto para humano, escopo de dados amarrado à identidade
  resolvida, nada de preço/prazo/resultado sem fonte.

## Fora de escopo

- **Agendamento autônomo pelo bot.** O caminho existe (template de reserva
  aprovado + padrão `AssistenteIAAcaoPendente` de proposta com aprovação
  humana), mas entra em spec própria depois que o copiloto tiver histórico. Na
  Fase 1 o bot explica *como* agendar e passa para humano.
- **Reengajamento proativo.** Fora da janela de 24h a Meta só permite template
  aprovado; o bot não dispara template. Cliente que volta 30h depois cai nos
  fluxos de template que já existem.
- **Áudio, imagem e documento recebidos.** Mensagens não textuais viram handoff
  nesta entrega (o inbox já sabe exibi-las).
- **Envio de laudo ou conteúdo de laudo.** No máximo "está pronto" / "ainda não",
  respeitando as regras de liberação do portal (`portal-laudo-release`).
- **Reaproveitar `TOOL_DEFINITIONS` do assistente interno.** As 23 tools de
  `assistente_ia_tools.py` operam com autoridade de staff sobre o banco inteiro.
  O bot de cliente ganha módulo próprio, com escopo obrigatório.

## Riscos e decisões

- **Toggle no banco desde o primeiro dia, não env var.** Lição registrada em
  `whatsapp-lembrete-automatico-consulta`: a habilitação por env var custou
  edição de pipeline/SSH a cada mudança e acabou migrando para
  `configuracoes.whatsapp_lembrete_automatico_habilitado`. Aqui já nasce assim:
  `WHATSAPP_BOT_ENABLED` (env, kill-switch profundo, default `False`) **e**
  `configuracoes.whatsapp_bot_atendimento_habilitado` (banco, admin, default
  `false`). Ambos precisam estar ligados para qualquer envio real.
- **Responsabilidade clínica é o maior risco do projeto.** Uma resposta
  automática com qualquer coisa parecida com diagnóstico, dose ou prognóstico é
  dano real, não bug de UX. Por isso o validador de saída bloqueia e vira
  rascunho em vez de enviar, e emergência nem chega ao gerador.
- **Divergência de normalização de telefone entre os dois serviços.**
  `canonicalWhatsAppIdentity` (Node, `src/utils/phoneNumber.ts`) remove o nono
  dígito de móveis brasileiros para usar como chave de identidade;
  `normalize_whatsapp_number` (Python, `whatsapp_agenda_service.py:59`) mantém os
  dígitos e só prefixa `55`. Pela leitura do código, um tutor cadastrado como
  `(85) 99999-8888` normaliza para `5585999998888`, enquanto a conversa vinda do
  Node chega como `558599998888` — e `_has_exact_phone` compara string exata, ou
  seja, não casa. Os testes de `test_whatsapp_conversation_context.py` passam
  números em formato local e nunca exercitam a forma canônica do Node, então
  isso não está coberto. **Precisa ser confirmado com dado real de stage**: se
  confirmado, o painel de vínculo cadastral da central já erra hoje, e para o bot
  seria pior — cairia em `not_found` e ficaria inútil (falha para o lado seguro,
  mas inútil). Tratado como requisito obrigatório desta entrega (RF-015).
- **Chave de advisory lock própria.** Hoje
  `WHATSAPP_REMINDER_SCHEDULER_DISTRIBUTED_LOCK_KEY` e
  `ASSISTENTE_IA_SCHEDULER_DISTRIBUTED_LOCK_KEY` valem ambas `80433002`
  (`app/core/config.py:70` e `:105`), o que faz os dois workers competirem pelo
  mesmo lock. O worker do bot usa `80433003`; corrigir a colisão existente fica
  fora desta spec, mas está registrado.
- **Começar como copiloto, não como resposta automática.** O modo `suggest`
  mede a qualidade real contra clientes reais com risco zero de reputação, e a
  taxa de aceite dos rascunhos é o dado que autoriza (ou não) ligar o `auto`.
- **Número reaproveitado / contato ambíguo.** `resolve_whatsapp_context` já
  distingue `matched` / `ambiguous` / `not_found`. Fora de `matched` o bot não
  cita nenhum dado de registro — é a defesa contra vazar dado de um cliente para
  outro quando uma operadora reatribui um número.

## Perguntas abertas

- O bot atende tutor, clínica parceira, ou os dois na Fase 1? O contexto já
  distingue os dois por `match_type`, mas são personas e escopos de dado
  diferentes — dá para ligar um de cada vez.
- Modo `auto` roda 24/7 ou só fora do expediente (dentro do expediente fica em
  `suggest`, com a equipe no controle)?
- Quem revisa periodicamente as transcrições e o feedback dos rascunhos
  recusados? Sem dono, a allowlist de intents nunca evolui.
- Node e Python compartilham o mesmo Postgres em stage/produção? O desenho não
  depende disso (tudo via HTTP), mas a resposta destrava simplificações na
  varredura de reconciliação.

## Definition of Ready (gate para spec)

- [x] Problema e objetivo estão claros.
- [x] Escopo e não escopo estão explícitos.
- [x] Restrições estão registradas (Meta 24h, responsabilidade clínica, dois
      interruptores, sem dependência de banco compartilhado).
- [x] Riscos iniciais estão mapeados.
- [ ] Perguntas abertas respondidas com o usuário.
