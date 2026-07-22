# Verify - assistente-ia-admin-gestao

Data: 2026-07-21
Responsavel: Martiniano + Codex
Status: passed

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | inspecao automatica de todas as rotas e 403 para nao-admin | aprovado |
| CA-002 | endpoint, painel e carregamento do resumo executivo | aprovado |
| CA-003 | testes de pending/rejeicao/aprovacao/TTL | aprovado |
| CA-004 | remarcacao e WhatsApps chamam fluxos oficiais depois do snapshot | aprovado |
| CA-005 | bloqueio validado por `_validar_slot_disponivel` e removido das sugestoes | aprovado |
| CA-006 | endpoint `/acoes` e aba central no build | aprovado |
| CA-007 | teste memoria pending versus approved | aprovado |
| CA-008 | hash, deduplicacao e pesquisa limitada | aprovado em teste focal |
| CA-009 | rascunho isolado e campos oficiais preservados em teste | aprovado |
| CA-010 | feedback, tokens, latencia e metricas | aprovado |
| CA-011 | migration, 359 testes, lint, TypeScript e build | aprovado |
| CA-012 | 12 casos versionados, ferramentas strict e proibicoes | aprovado |
| CA-013 | teste do radar confirma persistencia e ausencia de mutacao operacional | aprovado |
| CA-014 | criacao tipada, calendario semanal e validacao de configuracao | aprovado |
| CA-015 | worker persistente, advisory lock e `skip_locked` no PostgreSQL | aprovado em inspecao e teste focal |
| CA-016 | teste semantico com sinonimo e fonte mais fallback lexical existente | aprovado |
| CA-017 | opt-in visivel, fonte obrigatoria, chunks locais e fila de indexacao | aprovado |
| CA-018 | mock do laboratorio confirma 100% dos casos sem chamada a `execute_tool` | aprovado |
| CA-019 | inspecao automatica inclui todas as novas rotas com guard admin | aprovado |
| CA-020 | migration 54 idempotente, 367 testes, lint, TypeScript e build | aprovado |
| CA-021 | `deploy-stage.yml` usa `OPENAI_API_KEY_STAGE`; `deploy.yml` usa `OPENAI_API_KEY_PROD`; nomes confirmados no repositorio sem leitura dos valores | aprovado |
| CR-001 | seis rotas da base inspecionadas com dependencia `admin`; nao-admin recebe 403 | aprovado |
| CR-002 | serie de cinco meses, filtro de clinica e total financeiro | aprovado |
| CR-003 | localizacao exata e retorno de desambiguacao para multiplos candidatos | aprovado |
| CR-004 | motor real da agenda reutilizado e resposta sem telefone/paciente | aprovado |
| CR-005 | OS e contas a receber retornadas em subtotais separados | aprovado |
| CR-006 | solicitacao cria `pending` sem remover o agendamento | aprovado |
| CR-007 | rejeicao preserva o alvo e impede nova decisao | aprovado |
| CR-008 | aprovacao executa o fluxo oficial e registra auditoria | aprovado |
| CR-009 | expiracao, replay e divergencia de snapshot retornam 409 | aprovado |
| CR-010 | TypeScript, ESLint e build Next com rota `/assistente-ia` | aprovado |
| CR-011 | validador de status e workflows com segredos separados de stage/producao | aprovado |
| CR-012 | reserva gera acao pendente, snapshot com prazo/contatos e zero insercoes antes da decisao | aprovado |
| CR-013 | rejeicao nao chama escrita; aprovacao chama `criar_agendamento` com payload validado | aprovado |
| CR-014 | referencias e regras sao revalidadas na aprovacao, sem override operacional | aprovado |
| CR-015 | cartao de criacao, mensagem, selecao de telefone, copia e abertura manual do WhatsApp | aprovado |
| CR-016 | pedido de ampliacao prepara `update_agenda_exception`, mostra antes/depois e nao escreve configuracao | aprovado |
| CR-017 | rejeicao preserva; aprovacao atualiza somente a excecao solicitada pelo endpoint oficial | aprovado |
| CR-018 | snapshot divergente invalida a acao com 409 | aprovado |

## Evidencias executadas ate agora

```bash
cd backend && ./venv/bin/python -m unittest tests/test_assistente_ia_admin.py tests/test_assistente_ia_migration.py tests/test_assistente_ia_copiloto_migration.py
cd backend && ./venv/bin/python -m unittest tests/test_assistente_ia_evals.py
cd backend && ./venv/bin/python -m unittest tests/test_assistente_ia_autonomy.py tests/test_assistente_ia_autonomy_migration.py
cd backend && ./venv/bin/python -m unittest discover -s tests
cd frontend && npx eslint app/assistente-ia/page.tsx --max-warnings=0
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd backend && ./venv/bin/python -m pip check
python3 -m py_compile <arquivos alterados do backend>
git diff --check
```

## Resultado

- 28 testes focais novos/atualizados aprovados;
- suite completa: 359 testes aprovados;
- migration `20260721_53` executada duas vezes no mesmo SQLite sem divergencia;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build gerou `/assistente-ia` com as seis areas administrativas;
- smoke real do modelo `gpt-5.6-sol`: status `completed` e roteamento correto para `gerar_resumo_executivo`;
- nenhuma chave foi impressa, persistida em codigo ou enviada ao frontend.
- regressao da versao base: criacao/reserva, exclusao e funcionamento excepcional mantiveram preparacao sem escrita, rejeicao, aprovacao e protecao contra concorrencia;
- segredos `OPENAI_API_KEY_STAGE` e `OPENAI_API_KEY_PROD` permanecem separados e os workflows validam o status autenticado;
- stage: quality gate, SDD guardrail, migration CI, deploy e canario autenticado aprovados para `25cd5e0`;
- smoke publico de stage: `/assistente-ia` responde, redireciona sessao anonima ao login, APIs protegidas retornam 401 e o pacote servido contem as seis areas novas.

## Ciclo Radar, Missoes, Semantica e Avaliacoes

- 6 testes focais novos cobrem radar somente de leitura, recorrencia tipada, revogacao de admin, fonte obrigatoria, busca semantica e laboratorio sem execucao;
- migration `20260721_54` exercitada duas vezes no mesmo SQLite;
- suite completa: 367 testes aprovados;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build confirmou `/assistente-ia` com Radar, Missoes, Memoria semantica e Avaliacoes;
- worker aguarda a migration sem loop de erro, recupera execucoes interrompidas e aparece na saude do runtime;
- stage: quality gate, SDD guardrail, migration `20260721_54`, deploy, runtime readiness e canario autenticado aprovados para `896928f`;
- smoke publico de stage: `/assistente-ia` responde 200, API protegida responde 401 sem sessao e o pacote servido contem Radar, Missoes, Memoria semantica e Avaliacoes.
