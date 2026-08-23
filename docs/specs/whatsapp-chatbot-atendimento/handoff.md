# Handoff - whatsapp-chatbot-atendimento

Data: 2026-08-23
Responsável: Martiniano + Codex + Claude
Status: em implementação; Fases 1-5 concluídas e validadas em stage; reenvio
único confirmado pela Meta como `delivered`, estado reconciliado e proteção
preventiva publicada no SHA `29f68f22`; Fase 6 **parcialmente entregue** —
P6.1 (evals de guardrail) e P6.5 (métricas) implementados e commitados
localmente (código em `3880a87d`+`e2bc474a`, HEAD em `6ba81f02`), ainda
**não publicados em stage**; P6.2, P6.3 e P6.4
pendentes

Este arquivo é a instrução de continuidade para outra sessão ou outro usuário.
Cole o conteúdo da seção `# Instrução para continuar` como primeira mensagem.

---

# Instrução para continuar

Continue a implementação do chatbot de atendimento do WhatsApp no projeto
FortCordis v2.

## Repositório e branch

- Repositório: `/Users/martiniano/fortcordis-v2`
- Worktree isolado atual:
  `/Users/martiniano/fortcordis-v2/.claude/worktrees/whatsapp-chatbot-handoff-2d02ad`
- Branch: `claude/whatsapp-chatbot-handoff-2d02ad`
- `origin/stage` e o runtime de stage estão no SHA
  `29f68f2295864bd42de4a6947ba02fbb8344adf1`.
- `origin/main` e produção permanecem no SHA
  `447ddc530fa0a3ea135eeff427fca1eed637b65d`.
- O código da Fase 5, o hotfix do nono dígito e a proteção de reenvio do bot já
  foram publicados em stage.
- **Novo desde a última sessão**: a branch local está em `6ba81f02`, três
  commits à frente de `origin/stage` — a instrumentação da Fase 6 em
  `3880a87d` (P6.1 + P6.5) e `e2bc474a` (memoização), mais este commit
  documental. Nada foi publicado: `origin/stage` segue em `29f68f22` e
  `origin/main`/produção em `447ddc53`. Não promova para produção.
- Preserve o checkout principal e alterações não relacionadas. Não promova
  para produção. O callback e a publicacao de stage ja foram verificados; antes
  de enviar nova mensagem externa ou modificar callback, verify token,
  assinaturas ou credenciais, obtenha confirmação explícita no momento da ação.

Antes de editar, rode `git status --short --branch` e leia, nesta ordem:

1. `docs/specs/whatsapp-chatbot-atendimento/intent.md`
2. `docs/specs/whatsapp-chatbot-atendimento/spec.md`
3. `docs/specs/whatsapp-chatbot-atendimento/plan.md`
4. `docs/specs/whatsapp-chatbot-atendimento/verify.md`
5. `docs/specs/whatsapp-stage-meta-isolation/spec.md`
6. `docs/specs/whatsapp-stage-meta-isolation/verify.md`
7. `docs/SDD-WORKFLOW.md`

Depois confirme o estado corrente com:

```bash
git status --short --branch
git fetch origin stage main
git rev-parse HEAD origin/stage origin/main
gh run view 32663269023 --json status,conclusion,url,headSha,name
gh run view 32663268982 --json status,conclusion,url,headSha,name
```

## Estado implementado

- Fase 1: schema, modelos, migração idempotente e configurações.
- Fase 2: webhook, fila durável com debounce, worker, retry, advisory lock e
  reconciliação HTTP com o serviço Node.
- Fase 3: interruptores, modo por conversa, pausa/claim, janela de 24h,
  identidade tutor/clínica, nono dígito, emergência e handoff.
- Fase 4: provider OpenAI, personas, tools próprias e escopadas, guardrails,
  auditoria e geração somente de rascunho/handoff; envio automático ainda não
  existe.
- Fase 5 em stage: painel de rascunho com enviar/editar/descartar, selo de envio
  assistido, controles por conversa, card institucional, endpoints de revisão
  e transporte Node idempotente.
- Hotfix da Fase 5: `whatsappGraphRecipient` mantém a conversa canônica sem o
  nono dígito e recompõe a forma móvel E.164 somente no destinatário enviado à
  Graph API, para texto e anexo.
- Segurança do reenvio: falha de mensagem do bot volta ao endpoint idempotente
  Python; falha histórica já substituída por entrega não oferece novo botão.

A auditoria identificou D1-D4 e todas foram corrigidas localmente:

- intent fora da allowlist é `draft`, não `blocked`;
- segurança editorial (`aprovado`) é separada de elegibilidade a `auto`;
- há loop stateless de `function_call`/`function_call_output` com `store=False`,
  no máximo duas rodadas, e preço/status são renderizados do payload literal;
- fonte é específica por intent; uma tool de horário não autoriza preço/laudo;
- erros HTTP, logs e `whatsapp_bot_jobs.last_error` não expõem telefone completo;
- contexto de agendamento impede pet cruzado mesmo em cadastro inconsistente;
- `WHATSAPP_BOT_MAX_TOKENS_PER_DAY=100000` cria
  `draft/teto_global_tokens` sem nova chamada paga quando o teto é atingido.

Arquivos principais alterados nesta correção:

- `backend/app/services/whatsapp_bot_providers.py`
- `backend/app/services/whatsapp_bot_generation.py`
- `backend/app/services/whatsapp_bot_guardrails.py`
- `backend/app/services/whatsapp_bot_prompt.py`
- `backend/app/services/whatsapp_bot_context.py`
- `backend/app/services/whatsapp_bot_worker_service.py`
- testes `backend/tests/test_whatsapp_bot_*`
- `spec.md`, `plan.md`, `verify.md` e este handoff

Arquivos principais da Fase 5:

- `backend/app/api/v1/endpoints/whatsapp_bot.py`
- `backend/tests/test_whatsapp_bot_endpoints.py`
- `backend/app/services/whatsapp_bot_gates.py`
- `whatsapp-stage-backend/src/controllers/conversationsController.ts`
- `whatsapp-stage-backend/migrations/init.sql`
- `whatsapp-stage-backend/scripts/test-inbox-ui-contracts.ts`
- `frontend/app/whatsapp-stage/page.tsx`
- `frontend/app/configuracoes/page.tsx`
- `frontend/app/globals.css`
- `spec.md`, `plan.md`, `verify.md` e este handoff

## Credencial e smoke real

Uma chave nova chamada `fortcordis-whatsapp-chatbot` foi criada em
**Personal / Default project** e gravada como `OPENAI_API_KEY` apenas no
`backend/.env` ignorado pelo Git deste worktree. Nunca imprima, copie para logs,
commite ou transfira esse valor sem autorização explícita.

Smoke local real já executado com dados fictícios, em `suggest` e sem envio:

- modelo `gpt-5.6-sol`;
- decisão `draft`, motivo `modo_suggest`;
- `consultar_preco_tabela` foi chamada e retornou `ok`;
- uso agregado: 2.462 tokens de entrada e 199 de saída;
- latência: 8.735 ms;
- texto final presente; nenhum envio ao WhatsApp foi acionado.

Smoke real de stage concluído em `2026-08-23`, também em `suggest` e sem envio:

- preflight remoto com `RUN_SMOKE=1`: `PASS`, 0 falhas e 0 avisos;
- preview inicial: os dois portões desligados, modo `suggest` e nenhum job
  pendente depois do smoke sintético;
- runtime atual: `WHATSAPP_BOT_ENABLED=true`, toggle do banco ligado, modo
  institucional `suggest`; produção não foi alterada;
- o primeiro teste real caiu corretamente em `handoff/identidade_nao_resolvida`
  porque o contato estava em duas clínicas e um tutor, sem gastar tokens;
- após confirmação explícita, o contato foi removido somente das clínicas IDs
  8 e 51 em stage, preservado no tutor ID 192 e a correção foi auditada;
- o segundo teste real gerou o job `21`, `done`, decisão
  `draft/modo_suggest`, persona `tutor`, modelo `gpt-5.6-sol`, prompt
  `whatsapp-bot-v1-tutor-95dba6ab`, tool `consultar_preco_tabela` confirmada,
  2.592 tokens de entrada, 280 de saída e latência de 11.794 ms;
- o texto ficou em `whatsapp_bot_respostas.texto_gerado`, enquanto
  `texto_enviado` permaneceu vazio; a inbox mostrou um único inbound
  `received` e zero mensagens `from_me` na janela do teste.

Publicação e smoke da Fase 5 concluídos em `2026-08-23`:

- `origin/stage` e a VPS avançaram por fast-forward para `02566851`;
- Deploy to Stage run `32661248713` e Migration CI run `32661248721`:
  `success` terminal;
- migração Node aplicada e índice `ux_messages_bot_idempotency_key` presente;
- serviços backend, frontend e WhatsApp `active`; health/readiness/canário e
  restore drill aprovados;
- stage: raiz/health `200`, rota protegida `401`, `/whatsapp-stage` `307` para
  `app.stage` e `200` no destino;
- bundles servidos continham os marcadores da nova central e Configurações;
- Chrome autenticado mostrou o rascunho do job `21`, Enviar/Editar/Descartar,
  controles por conversa e card institucional; editar abriu e cancelar
  preservou o texto, sem erros no console;
- toggle continuou ligado, modo `suggest` selecionado e `auto` desabilitado;
- depois de confirmação explícita, **Enviar** foi acionado uma vez. A Meta
  recusou antes da aceitação com `OAuthException/131030` porque a conversa
  estava sem o nono dígito e o destinatário permitido, com ele;
- a tentativa ficou em uma única linha Node `failed`, sem `wa_message_id`; o
  rascunho Python voltou a `draft`, sem texto enviado, feedback ou atendente;
- a correção de destinatário Graph foi publicada no SHA `5f6ca72b`. Deploy run
  `32662352928` e Migration CI run `32662352859` terminaram em `success`; VPS,
  serviços, health, rota protegida e transformação móvel foram validados;
- após nova autorização explícita, **Reenviar** foi clicado uma única vez. A
  linha `2437` recebeu ID da Meta e chegou a `delivered`;
- o reenvio genérico criou a linha como `agent_api`; isso foi reconciliado sem
  nova chamada externa: metadata/chave idempotente migraram para a entrega, a
  falha `2430` ficou marcada como substituída e a resposta `7` passou a `sent`
  com texto, feedback, atendente e pausa. A auditoria foi gravada uma vez;
- o hotfix de UI para reenvios futuros do bot usarem o endpoint Python e para
  esconder o botão da falha substituída foi publicado somente em stage no SHA
  `29f68f22`. Os workflows, o runtime, os serviços e a tela autenticada foram
  validados;
- produção permaneceu em `447ddc53`, saudável e sem alteração.

## Sessão de 2026-08-23 (Fase 6, parte 1): instrumentação

Entregue e commitado localmente, **sem publicar**:

- **P6.1 — evals de guardrail.** `backend/evals/whatsapp_bot_cases.json` com 27
  casos e `backend/tests/test_whatsapp_bot_evals.py` com 9 testes. Cada caso
  declara texto candidato, estado do turno e veredito esperado, e roda por
  `avaliar_resposta` **sem LLM e sem rede** — como o eval do assistente, que
  também valida contrato em vez de gastar chamada paga. Cobre os quatro grupos
  clínicos (inclusive resposta ancorada em trecho da base, que não é passe
  livre), vazamento de laudo, fonte ausente **e fonte de outra intent**, valor e
  prazo não ancorados com os pares aprovados, o bloco comum da CA-024 nas duas
  personas, intents cruzadas de persona e o teto de caracteres. `teto_diario`
  fica declaradamente de fora (depende de contagem no banco, já coberto em
  `test_whatsapp_bot_generation`).
- **Guard de integridade da métrica.** `avaliar_resposta` usa o **nome do grupo**
  da deny-list como `motivo`, com `type: ignore`. Um grupo novo no JSON com nome
  fora de `MotivoBloqueio` passaria em runtime e sujaria a agregação por motivo
  sem quebrar teste algum. Isso agora é travado por teste, e o guard foi
  **verificado como não vazio**: simulando um grupo `conteudo_experimental`,
  `avaliar_resposta` produz de fato `motivo="conteudo_experimental"`, fora do
  `Literal`.
- **P6.5 — métricas.** `backend/app/services/whatsapp_bot_metrics_service.py` e
  `GET /api/v1/whatsapp/bot/metricas?dias=7`, somente leitura, **sem migração**
  (tudo deriva de colunas existentes), com 11 testes. Quatro decisões de medição
  que mudam a leitura do número:
  - aceite limpo separado de aceite editado, porque o endpoint de envio grava
    `feedback="positivo"` mesmo quando o atendente reescreveu o texto — o
    feedback sozinho **superestima** a qualidade do rascunho;
  - rascunho pendente fora do denominador do aceite, senão a taxa mede backlog
    em vez de qualidade;
  - faixa de horário pela janela operacional da agenda, a mesma fonte do texto
    de handoff da RF-033 (memoizada, com equivalência travada por teste em 168
    pontos e 1 consulta para 25 linhas);
  - custo não finge zero: com `WHATSAPP_BOT_*_COST_PER_MILLION=0.0` (default),
    `custo_configurado=false` e os valores vêm `null`, com tokens ainda somados.
- `pronto_para_decidir_auto` é **checklist, não autorização**: reporta
  `decididos_por_persona`, o mínimo adotado (20 por persona) e quais personas
  atingiram amostra. Um teste fixa que o campo não habilita nada.

Novas configurações (defaults seguros, já em `.env.example`):
`WHATSAPP_BOT_INPUT_COST_PER_MILLION=0.0` e
`WHATSAPP_BOT_OUTPUT_COST_PER_MILLION=0.0`.

Validação executada nesta sessão:

- suíte completa do backend **994/994**; focada do bot **139/139**;
  `test_whatsapp_conversation_context` + `test_configuracoes_autorizacao`
  **15/15**;
- gate SDD local aprovado no diff `origin/stage..HEAD` (código acompanhado de
  `spec.md` + `verify.md`);
- revalidação externa **sem autenticação**: stage raiz `200`,
  `app.stage/whatsapp/health` `200`, `/whatsapp/conversations` `401`;
  produção raiz `200`, health `200`, rota protegida `401`, `origin/main`
  inalterado.

Não executado, e por quê:

- **P6.2 (preview em stage) não rodou: falta credencial.** O endpoint exige
  papel autenticado e não havia `CANARY_BEARER_TOKEN`/`CANARY_USERNAME`/
  `CANARY_PASSWORD` no ambiente desta sessão. Não pedi nem manipulei segredo
  para isso. Além disso, `GET /whatsapp/bot/metricas` **ainda não existe em
  stage** — só passa a existir depois de publicar `e2bc474a`.
- **Teste real de `consultar_status_laudo`** continua pendente: exige stage
  autenticado e é passo posterior à observação.
- Nenhum clique em Enviar/Reenviar/Descartar. A resposta `7` não foi tocada.
- Nada publicado, nada promovido, nenhuma configuração Meta alterada.

## Próxima sequência recomendada

1. **Publicar a instrumentação da Fase 6 em stage.** A branch está em
   `6ba81f02`, três commits à frente de `origin/stage`. Sem publicar,
   `GET /whatsapp/bot/metricas` não existe no runtime e a observação da Fase 6
   não pode começar. Revalide stage e produção antes e depois. Não promova para
   produção.
2. **P6.2 — preview de elegibilidade em stage.** Exige credencial autenticada
   (`CANARY_BEARER_TOKEN` ou `CANARY_USERNAME`/`CANARY_PASSWORD`), que não
   estava disponível na sessão anterior. Rode `GET /api/v1/whatsapp/bot/preview`
   e registre o resultado no `verify.md`. É somente leitura (CA-019).
3. **P6.3 — abrir a janela de observação.** Mantenha stage em `suggest` com
   `auto` bloqueado e deixe acumular pelo menos uma semana de tráfego real.
   Consulte `GET /api/v1/whatsapp/bot/metricas?dias=7` e transcreva os números
   no `verify.md`, na seção "Números a coletar na Fase 6.3".
4. **Ao ler as métricas, saiba o que cada número quer dizer.** `taxa_aceite`
   inclui rascunho editado; `taxa_aceite_sem_edicao` é o número que mede a
   qualidade real do rascunho, e a diferença entre os dois é o trabalho que a
   equipe teve. Rascunho pendente não entra no denominador. `custo_total` vem
   `null` até alguém configurar `WHATSAPP_BOT_*_COST_PER_MILLION`.
5. **Teste real de `consultar_status_laudo`** em stage, com mensagem sem
   conteúdo clínico e sem envio automático, depois da observação começar.
6. **Não habilite `auto` por inferência.** `pronto_para_decidir_auto` é
   checklist de amostra, não autorização. Peça autorização específica e registre
   a decisão com número no `verify.md`.

## Limites obrigatórios da próxima sessão

- Preserve o checkout principal e alterações não relacionadas.
- Não promova nada para produção sem autorização explícita.
- Não envie nem reenvie a resposta `7`: já está `delivered` e reconciliada.
- Não clique em Enviar, Reenviar ou Descartar sem confirmação explícita no
  momento da ação. Descartar grava feedback persistente.
- Não altere callback, verify token, assinaturas, credenciais ou configuração da
  Meta sem confirmação explícita.
- Nunca exiba nem registre tokens e segredos.
- Mantenha o bot em `suggest`.
- Toda alteração de código atualiza `spec.md` e `verify.md` no mesmo ciclo (gate
  SDD). Valide localmente com
  `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD`.

## Diagnostico e isolamento Meta de stage (2026-08-23)

- VPS, health, auth, token e identidade Graph estavam saudaveis.
- O app FortZap continuava apontando para
  `https://app.fortcordis.com.br/whatsapp/webhook`; por isso stage nao recebia
  mensagens reais.
- O workflow de producao ainda copiava o `.env` Meta de stage; isso foi removido
  localmente.
- Stage agora falha fechado se `PHONE_NUMBER_ID`, `META_APP_ID` ou
  `WHATSAPP_BUSINESS_ACCOUNT_ID` coincidirem com producao.
- Novas GitHub Variables exigidas: `WHATSAPP_PHONE_NUMBER_ID_STAGE`,
  `WHATSAPP_META_APP_ID_STAGE`, `WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE`.
- Identidade exclusiva criada em 2026-08-23:
  - app `FortZap Stage`, App ID `1683447519419173`;
  - `Test WhatsApp Business Account`, WABA ID `4413513738886247`;
  - numero de teste `+1 555-639-7864`, Phone Number ID `1161616897025933`.
- GitHub Variables cadastradas: `WHATSAPP_PHONE_NUMBER_ID_STAGE`,
  `WHATSAPP_META_APP_ID_STAGE` e `WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE`.
- GitHub Secrets substituidos sem exibir valores:
  `WHATSAPP_APP_SECRET_STAGE`, `WHATSAPP_VERIFY_TOKEN_STAGE` e
  `WHATSAPP_ACCESS_TOKEN_STAGE`.
- `WHATSAPP_ACCESS_TOKEN_STAGE` foi substituido em `2026-08-23T11:19:26Z` por
  um token Meta `SYSTEM_USER` sem expiracao (`expires_at=0`). A validacao Graph
  confirmou App ID `1683447519419173`, WABA ID `4413513738886247`, Phone Number
  ID `1161616897025933` e as permissoes `whatsapp_business_management` e
  `whatsapp_business_messaging`. O valor nao foi impresso nem persistido em
  arquivo e a area de transferencia foi limpa.
- Usuario de sistema `FortZap Stage` criado como `Employee`, ID
  `61593589415414`, com apenas dois ativos:
  - app `FortZap Stage`: acesso total;
  - WABA de teste: `Números de telefone (apenas visualização)` e `Mensagens`.
  Nenhum app, WABA ou numero de producao foi atribuido a esse usuario.
- A verificacao de seguranca foi concluida no perfil reconhecido do Chrome e o
  token de acesso Meta sem expiracao foi emitido para o usuario de sistema
  isolado. Nao gerar outro token de acesso salvo se esta credencial for
  explicitamente revogada ou falhar em validacao futura. Isso e distinto do
  verify token do callback, que pode ser rotacionado de forma coordenada.
- A publicação protegida de stage concluiu no SHA `abc5a380`:
  - Deploy to Stage run `32637525688`: `success`;
  - Migration CI run `32637525655`: `success`;
  - SDD guardrail, quality gate, identidade Meta, health do backend WhatsApp,
    smokes internos, canário autenticado e restore drill passaram.
- Smokes externos posteriores ao deploy:
  - `https://stage.fortcordis.com.br/`: HTTP `200`;
  - `/whatsapp-stage`: HTTP `307` para autenticação e `200` após seguir o
    redirecionamento;
  - `/whatsapp/health`: HTTP `200`;
  - `/whatsapp/conversations` sem credencial: HTTP `401`;
  - `https://app.stage.fortcordis.com.br/whatsapp/health`: HTTP `200`;
  - callback de stage sem desafio: HTTP `403`, comportamento esperado antes da
    verificação Meta.
- Produção foi revalidada depois do deploy: raiz e health HTTP `200`, rota
  protegida HTTP `401`, `origin/main` inalterado. Nenhum callback foi alterado.
- O verify token de stage foi rotacionado sem exposicao, salvo no GitHub Secret
  em `2026-08-23T13:45:45Z` e sincronizado no runtime pela tentativa 2 do run
  `32637525688`, concluida com `success` no mesmo SHA.
- A Meta verificou o callback
  `https://app.stage.fortcordis.com.br/whatsapp/webhook`; `messages` esta
  assinado em `v26.0`. O painel tambem manteve/assinou automaticamente campos
  operacionais frequentes; nenhum foi removido sem autorizacao.
- As URLs legais publicas de stage foram salvas e a Meta confirmou a publicacao
  do app `FortZap Stage`.
- O numero controlado de Martiniano ja constava na lista de destinatarios. A
  mensagem padrao de saida foi enviada e confirmada como recebida no celular.
- O primeiro inbound publicado nao chegou a stage porque o app nao estava
  inscrito na WABA. `GET /subscribed_apps` mostrava apenas o app interno
  `WA DevX Webhook Events 1P App`.
- `POST /4413513738886247/subscribed_apps` adicionou `FortZap Stage`; a consulta
  posterior confirmou os dois apps inscritos, sem remover o interno da Meta.
- A mensagem real posterior apareceu como `Recebida` na inbox de stage, na
  conversa Martiniano Barros, `Em atendimento`, sem atendente e sem resposta
  automatica. A captura do usuario e a verificacao independente da UI
  confirmaram a persistencia.
- A abertura do App Secret foi cancelada: o E2E provou que a assinatura
  `X-Hub-Signature-256` ja e valida. Nenhum segredo foi revelado, rotacionado ou
  enviado ao GitHub/VPS nessa etapa e nenhum deploy adicional foi executado.

## Validação

O worktree reutiliza o venv do checkout principal em
`/Users/martiniano/fortcordis-v2/backend/venv` e as dependências do frontend por
symlink ignorado. Validação mais recente (Fase 6, parte 1): **139/139** testes focados do bot
e **994/994** na suíte completa. Validação anterior da Fase 5: **119/119**
testes focados do bot,
**9/9** de autorização, serviço Node com build e contratos da inbox, frontend
com ESLint, `tsc --noEmit` e `next build`, todos aprovados. A suíte completa do
backend foi reexecutada nesta fase e terminou em **974/974**, sem falhas;
`test:phone-number` e `git diff --check` também passaram.

```bash
cd /Users/martiniano/fortcordis-v2/.claude/worktrees/whatsapp-chatbot-handoff-2d02ad/backend
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest discover -s tests -p "test_whatsapp_bot*.py" -v
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest tests.test_whatsapp_conversation_context tests.test_configuracoes_autorizacao -v
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest discover -s tests -p "test_*.py"

cd ../whatsapp-stage-backend
npm run build
npm run test:phone-number
npm run test:inbox-ui

cd ../frontend
npm run build
./node_modules/.bin/eslint app/whatsapp-stage/page.tsx app/configuracoes/page.tsx --max-warnings=0
./node_modules/.bin/tsc --noEmit
```

Atualize `spec.md` e `verify.md` no mesmo diff de qualquer mudança em código,
como exige o SDD guardrail. Registre somente evidência realmente executada.

## Relatório executivo para a nova sessão

- Entregue: implementação das Fases 1-4, correções D1-D4, identidade Meta de
  stage isolada, token permanente de usuário de sistema, secrets/variables,
  publicação protegida, callback, `messages`, publicacao Meta, inscricao WABA e
  transporte E2E; Fase 5 publicada e validada visualmente em stage.
- Comprovado: workflows terminais verdes, desafio Meta aceito, saída entregue,
  inbound real persistido, preflight remoto formal, geração real com tool de
  preço, rascunho auditado e ausência de envio automático.
- Não executado: clique de Enviar/Descartar na Fase 5, demais casos manuais da
  matriz, observação de uma semana e qualquer promoção para produção.
- Bloqueio atual: `auto` permanece deliberadamente indisponível até haver dados
  reais de aceite e segurança da Fase 6.
- Fase 6, parte 1 (2026-08-23): evals de guardrail (P6.1) e métricas (P6.5)
  entregues e commitados (código em `3880a87d`+`e2bc474a`), ainda não
  publicados. P6.2 ficou
  bloqueado por falta de credencial autenticada nesta sessão.
- Próximo marco: teste controlado de uma ação de revisão com confirmação
  específica e início das métricas de `suggest`; produção permanece intacta.

## Limites de segurança

- Não reutilize `TOOL_DEFINITIONS`/`execute_tool` de
  `assistente_ia_tools.py`; as tools do bot vivem em módulo próprio e recebem
  escopo resolvido pelo backend.
- Não coloque `tutor_id`/`clinica_id` no schema visível ao modelo.
- Não envie conteúdo clínico, preço negociado, cobrança, OS ou conteúdo de
  laudo.
- Não faça teste real em `auto` antes da fase de observação em `suggest`.
- Não registre corpo completo da mensagem, telefone completo, token interno ou
  chave OpenAI.
