# Handoff - whatsapp-chatbot-atendimento

Data: 2026-08-20  
Responsavel: Martiniano + Claude  
Status: draft

Prompt de continuidade para iniciar a implementação em outra sessão e outro
ambiente. Cole o conteúdo abaixo (da linha `# Contexto` em diante) como primeira
mensagem, ou aponte a sessão nova para este arquivo.

---

# Contexto

Projeto **FortCordis v2** (`martinialebarros-svg/fortcordis-v2`) — sistema de
operação clínica veterinária (cardiologia). Backend FastAPI em `backend/`,
frontend Next.js em `frontend/`, e um serviço Node/TypeScript separado em
`whatsapp-stage-backend/` que integra a WhatsApp Cloud API da Meta.

Trabalhe na branch `claude/fort-cordis-whatsapp-chatbot-njna2q`
(último commit de especificação: `86ed0df`). Não faça push em outra branch.

# Onde o trabalho está

A feature é um **chatbot de atendimento no WhatsApp** para responder clientes.
A fase de especificação está concluída e aprovada; **nenhuma linha de código foi
escrita ainda**.

Leia primeiro, na ordem, e trate como fonte de verdade:

1. `docs/specs/whatsapp-chatbot-atendimento/intent.md`
2. `docs/specs/whatsapp-chatbot-atendimento/spec.md` (33 RF, 26 CA, 7 NFR, 10 CB)
3. `docs/specs/whatsapp-chatbot-atendimento/plan.md` (6 fases)
4. `docs/specs/whatsapp-chatbot-atendimento/verify.md` (matriz, tudo pendente)
5. `docs/SDD-WORKFLOW.md` — o processo obrigatório do projeto

O `README.md` cita `PROJECT_CONTEXT.md`, `CURRENT_TASK.md`, `NEXT_STEPS.md`,
`KNOWN_BUGS.md` e `ARCHITECTURE_DECISIONS.md`. **Esses arquivos não existem no
repositório.** Não perca tempo procurando; a spec acima substitui.

# Decisões já tomadas — não reabra

- **Cérebro no FastAPI, Node só transporte.** O resolvedor de identidade, a base
  de conhecimento, as tools e a auditoria já estão em Python. A troca é HTTP nos
  dois sentidos com token interno; **nada no desenho pode depender de os dois
  serviços compartilharem o mesmo Postgres** (NFR-007).
- **Fila durável com debounce**, não fire-and-forget. Meta exige 200 rápido e a
  geração leva segundos.
- **Copiloto é o padrão.** Modo `suggest` (bot gera, equipe envia) é o default
  institucional; `auto` é restrito a allowlist estreita de intents.
- **Dois interruptores independentes**: `WHATSAPP_BOT_ENABLED` (env, default
  `False`) **e** `configuracoes.whatsapp_bot_atendimento_habilitado` (banco,
  admin, default `false`). O toggle no banco desde o dia 1 é lição registrada de
  `whatsapp-lembrete-automatico-consulta`, que nasceu com env var e teve que
  migrar depois — não repita.
- **Atende as duas personas** (tutor e clínica parceira) desde a Fase 1, com
  allowlist e escopo de dado separados por `match_type`.
- **Roda 24/7**, sem portão de relógio. A convivência com a equipe é resolvida
  por pausa em mensagem humana e por claim.
- **Guardrails clínicos são o requisito mais importante da entrega.** Zero
  conteúdo clínico; emergência não passa pelo gerador; escopo de dado amarrado à
  identidade resolvida; nada de preço/prazo/resultado sem fonte; tools próprias
  em `whatsapp_bot_tools.py` — **é proibido** reaproveitar `TOOL_DEFINITIONS` /
  `execute_tool` de `assistente_ia_tools.py`, que rodam com autoridade de staff
  sobre o banco inteiro.

# Sua tarefa: Fase 1 do `plan.md`

Só schema e configuração. **Nenhuma mudança de comportamento em runtime.**

- `backend/migrations/versions/20260820_75_whatsapp_bot_atendimento.py` —
  tabelas `whatsapp_bot_jobs`, `whatsapp_bot_respostas`,
  `whatsapp_bot_conversa_estado` + colunas `whatsapp_bot_atendimento_habilitado`
  e `whatsapp_bot_modo` em `configuracoes`. Idempotente, no padrão das migrações
  72–74 (helpers locais por arquivo). A 74 é a última existente.
- `backend/app/models/whatsapp_bot.py` e os campos novos em
  `backend/app/models/configuracao.py`.
- Settings `WHATSAPP_BOT_*` em `backend/app/core/config.py` + `backend/.env.example`,
  todas com default seguro (a lista completa está na seção "Configuração" da spec).
- Teste de migração no padrão de `backend/tests/test_whatsapp_reminder_migration.py`
  (idempotência e no-op sem tabela).

Critério de conclusão: migração aplica no sqlite de dev, suíte completa sem
regressão, e o sistema se comporta exatamente como antes.

Não avance para a Fase 2 sem confirmação.

# Armadilhas reais deste código

- **Nono dígito (RF-015, Fase 3, não agora — mas saiba que existe).**
  `canonicalWhatsAppIdentity` em `whatsapp-stage-backend/src/utils/phoneNumber.ts`
  remove o 9 de móveis BR (`5585988018899` -> `558588018899`, confirmado por
  `npm run test:phone-number`), e é essa forma que fica em
  `conversations.wa_phone_number`. Já `normalize_whatsapp_number`
  (`backend/app/services/whatsapp_agenda_service.py:59`) mantém os dígitos e só
  prefixa `55`. `_has_exact_phone` compara string exata, então o cadastro não
  casa com a identidade vinda do Node. Os testes em
  `backend/tests/test_whatsapp_conversation_context.py` só usam formato local e
  nunca exercitam isso. **Não foi confirmado com dado real de stage** — confirme
  antes de tratar como bug fechado.
- **Colisão de advisory lock.** `WHATSAPP_REMINDER_SCHEDULER_DISTRIBUTED_LOCK_KEY`
  e `ASSISTENTE_IA_SCHEDULER_DISTRIBUTED_LOCK_KEY` valem ambas `80433002`
  (`config.py:70` e `:105`). O worker do bot usa `80433003`. Corrigir a colisão
  existente está **fora de escopo** desta spec.
- **Portas divergentes.** O serviço Node sobe em `3000` por padrão
  (`src/index.ts:26`), mas `WHATSAPP_AGENDA_SERVICE_URL` no `.env.example` do
  backend aponta para `3010`. Confira antes de debugar integração local.
- **Caminho quente do webhook.** `POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida`
  (`backend/app/api/v1/endpoints/whatsapp_agenda.py:312`) é chamado pelo Node com
  timeout de 5s e exceções engolidas. O enfileiramento do job (Fase 2) entra
  nesse endpoint e **precisa** de try/except próprio: falha ao enfileirar não
  pode quebrar o push nem estourar o timeout.

# Processo obrigatório

- **SDD guardrail** (`.github/workflows/sdd-guardrail.yml`): qualquer mudança em
  `backend/`, `frontend/` ou `scripts/` exige, **no mesmo diff**, atualização de
  `docs/specs/whatsapp-chatbot-atendimento/spec.md` e `verify.md`. Sem isso o CI
  falha e o deploy é bloqueado. Atualize o `verify.md` com a evidência real de
  cada critério conforme entregar — nunca marque `ok` sem teste ou log.
- Marque as tarefas concluídas no `plan.md` (`- [ ]` -> `- [x]`).
- Commits em conventional commits, mensagem em português sem acentos, no estilo
  do histórico (`docs(whatsapp):`, `feat(agenda):`, `fix(whatsapp):`).
  Explique o *porquê* no corpo, não só o quê.
- Não abra pull request sem pedido explícito.

# Comandos

```bash
# backend (suite completa: ~805 testes hoje)
cd backend
venv/bin/python -m unittest discover -s tests -p "test_*.py"
venv/bin/python -m unittest tests.test_whatsapp_bot_migration -v

# aplicar migracoes no sqlite de dev
venv/bin/python -c "from migrations.runner import run_migrations; run_migrations()"

# servico WhatsApp
cd ../whatsapp-stage-backend && npm run build && npm run test:phone-number

# frontend
cd ../frontend && npx eslint . --max-warnings=0 && npx tsc --noEmit && npx next build
```

# Como trabalhar

- Leia a spec antes de escrever código; ela é detalhada de propósito e cada RF
  tem um motivo registrado no `intent.md`.
- Se encontrar contradição entre a spec e o código real, **pare e avise** — não
  resolva silenciosamente escolhendo um dos lados.
- Não amplie o escopo. Se achar um bug adjacente, registre e siga.
- Reporte com honestidade: se um teste falhou, mostre a saída; se pulou um
  passo, diga qual.
