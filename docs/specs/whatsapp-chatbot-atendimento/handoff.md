# Handoff - whatsapp-chatbot-atendimento

Data: 2026-08-23
Responsável: Martiniano + Codex
Status: em implementação; Fases 1-3 concluídas, Fase 4 corrigida e validada;
identidade Meta exclusiva publicada em stage no SHA `abc5a380`; callback Meta,
E2E controlado e Fases 5-6 pendentes

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
  `abc5a380e6202dae8bb96b57250abd0f08a0beba`.
- `origin/main` e produção permanecem no SHA
  `447ddc530fa0a3ea135eeff427fca1eed637b65d`.
- O HEAD deste worktree pode estar um commit documental local à frente de
  `origin/stage`, contendo apenas este handoff atualizado. Não faça push ou
  deploy automático desse commit ao retomar.
- Preserve o checkout principal e alterações não relacionadas. Não promova
  para produção. Antes de modificar callback, verify token ou assinatura
  `messages`, obtenha confirmação explícita no momento da ação.

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
gh run view 32637525688 --json status,conclusion,url,headSha,name
gh run view 32637525655 --json status,conclusion,url,headSha,name
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

## Próxima sequência recomendada

1. Retomar pelo pedido de confirmação deixado ao usuário: configurar no app
   **FortZap Stage** o callback
   `https://app.stage.fortcordis.com.br/whatsapp/webhook`, transmitir um verify
   token exclusivo de stage e assinar `messages`. A mensagem atual do usuário
   solicita apenas o handoff por falta de créditos e **não** deve ser tratada
   como confirmação do corte externo.
2. O verify token atual está armazenado como GitHub Secret e no `.env` remoto,
   mas não deve ser exibido ou recuperado por logs. Como a área de transferência
   foi limpa, use uma destas opções somente após confirmação: transferência
   direta e silenciosa do VPS para o campo do painel, ou rotação segura de um
   novo token com atualização atômica de GitHub Secret, VPS e painel Meta.
3. Configure o callback no painel do app `FortZap Stage` — nunca no app de
   produção — e assine somente o campo `messages`.
4. Execute o preflight final com assinatura obrigatória e smoke funcional:
   `RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh`. Não use o bypass
   pre-corte `WHATSAPP_REQUIRE_SUBSCRIBED_APP=0` nessa validação final.
5. Faça um E2E controlado com o número de teste da Meta, sempre em `suggest`, e
   confirme entrada na inbox de stage, geração do rascunho e resposta esperada.
6. Revalide produção: callback ainda em
   `https://app.fortcordis.com.br/whatsapp/webhook`, health `200` e rota
   protegida `401`.
7. Confirmar que preço chama `consultar_preco_tabela`, laudo chama
   `consultar_status_laudo`, o rascunho é persistido com tokens/tools e nada é
   enviado ao cliente.
8. Só então iniciar a Fase 5: painel de rascunho na central, ações
   Enviar/Editar/Descartar, selo do bot e controles por conversa/Configurações.
9. Manter a Fase 6 bloqueada até haver preview e métricas reais de `suggest` em
   stage. `auto` não deve ser ligado por inferência.

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
- O corte Meta continua pendente e requer nova confirmação explícita.

## Validação

Use um ambiente Python 3.12 com `backend/requirements.txt`. No worktree atual,
os testes foram executados num venv temporário fora do repositório porque não há
`backend/venv`. Última validação local: backend completo **971/971**, serviço
Node com build, teste de identidade de telefone e contratos da inbox aprovados.

```bash
cd /Users/martiniano/fortcordis-v2/.claude/worktrees/whatsapp-chatbot-handoff-2d02ad/backend
python -m unittest discover -s tests -p "test_whatsapp_bot*.py" -v
python -m unittest tests.test_whatsapp_conversation_context tests.test_configuracoes_autorizacao -v
python -m unittest discover -s tests -p "test_*.py"

cd ../whatsapp-stage-backend
npm run build
npm run test:phone-number
npm run test:inbox-ui
```

Atualize `spec.md` e `verify.md` no mesmo diff de qualquer mudança em código,
como exige o SDD guardrail. Registre somente evidência realmente executada.

## Relatório executivo para a nova sessão

- Entregue: implementação das Fases 1-4, correções D1-D4, identidade Meta de
  stage isolada, token permanente de usuário de sistema, secrets/variables e
  publicação protegida de stage.
- Comprovado: workflows terminais verdes e smokes de stage/produção.
- Não executado: alteração de callback, assinatura `messages`, E2E real e
  promoção para produção.
- Bloqueio atual: confirmação humana no momento da alteração externa da Meta.
- Próximo marco: callback de stage verificado + `messages` assinado + preflight
  final + E2E em `suggest`, mantendo produção intacta.

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
