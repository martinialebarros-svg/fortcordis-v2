# Handoff - whatsapp-chatbot-atendimento

Data: 2026-08-23
Responsável: Martiniano + Codex
Status: em implementação; Fases 1-3 concluídas, Fase 4 corrigida localmente e
aguardando smoke real, Fases 5-6 pendentes

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
- A branch já foi sincronizada por merge com `origin/stage` de 2026-08-23.
- Preserve o checkout principal e alterações não relacionadas. Não publique,
  não abra PR e não promova para `stage`/produção sem pedido explícito.

Antes de editar, rode `git status --short --branch` e leia, nesta ordem:

1. `docs/specs/whatsapp-chatbot-atendimento/intent.md`
2. `docs/specs/whatsapp-chatbot-atendimento/spec.md`
3. `docs/specs/whatsapp-chatbot-atendimento/plan.md`
4. `docs/specs/whatsapp-chatbot-atendimento/verify.md`
5. `docs/SDD-WORKFLOW.md`

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

## Bloqueio externo atual

Não há `OPENAI_API_KEY` utilizável no worktree e nenhuma chave foi gravada em
`backend/.env`. O usuário autorizou criar uma chave nova e gravá-la nesse
arquivo ignorado pelo Git, mas o conector OpenAI Platform continua retornando:

`This app connection requires reauthentication before other actions on this app can succeed.`

O app aparece habilitado em **Configurações -> Plug-ins**, mas a reautorização
precisa ser concluída em **Configurações -> Conexões -> OpenAI Platform**. Não
imprima, copie para logs ou versione a chave. Antes de criar outra, verifique se
a tentativa anterior não criou uma chave remota duplicada. Confirme com o
usuário no último passo antes de gravar qualquer segredo.

## Próxima sequência recomendada

1. Finalizar validação local da correção: suíte completa do backend, build/teste
   do serviço Node e checagem do diff.
2. Reautorizar OpenAI Platform, criar/gravar a chave somente após confirmação e
   executar um smoke controlado com provider real, sempre em `suggest`.
3. Confirmar que uma pergunta de preço chama `consultar_preco_tabela`, que uma
   pergunta de laudo chama `consultar_status_laudo`, que o rascunho é persistido
   com tokens/tools e que nada é enviado ao cliente.
4. Só então iniciar a Fase 5: painel de rascunho na central, ações
   Enviar/Editar/Descartar, selo do bot e controles por conversa/Configurações.
5. Manter a Fase 6 bloqueada até haver preview e métricas reais de `suggest` em
   stage. `auto` não deve ser ligado por inferência.

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
