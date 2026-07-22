# Verify - assistente-ia-admin-gestao

Data: 2026-07-22
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
| CA-012 | 13 casos versionados, ferramentas strict e proibicoes | aprovado |
| CA-013 | teste do radar confirma persistencia e ausencia de mutacao operacional | aprovado |
| CA-014 | criacao tipada, calendario semanal e validacao de configuracao | aprovado |
| CA-015 | worker persistente, advisory lock e `skip_locked` no PostgreSQL | aprovado em inspecao e teste focal |
| CA-016 | teste semantico com sinonimo e fonte mais fallback lexical existente | aprovado |
| CA-017 | opt-in visivel, fonte obrigatoria, chunks locais e fila de indexacao | aprovado |
| CA-018 | mock do laboratorio confirma 100% dos casos sem chamada a `execute_tool` | aprovado |
| CA-019 | inspecao automatica inclui todas as novas rotas com guard admin | aprovado |
| CA-020 | migration 54 idempotente, 367 testes, lint, TypeScript e build | aprovado |
| CA-021 | `deploy-stage.yml` usa `OPENAI_API_KEY_STAGE`; `deploy.yml` usa `OPENAI_API_KEY_PROD`; nomes confirmados no repositorio sem leitura dos valores | aprovado |
| CA-022 | remarcacao explicita, contexto antes do rascunho incompleto e gravacao direta do rascunho completo | aprovado em contrato local |
| CA-023 | chamada obrigatoria, bloqueio direto, orcamento de 800 tokens e diagnostico de resposta sem ferramenta | aprovado em contrato local |
| CA-024 | teste de feedback negativo confirma sugestao pending e contexto aprovado inalterado | aprovado em teste focal |
| CA-025 | testes de aprovacao confirmam memoria v1, ajuste v2 e contrato ativo unico | aprovado em teste focal |
| CA-026 | teste de rejeicao e restauracao confirma historico v1/v2/v3 append-only | aprovado em teste focal |
| CA-027 | laboratorio inclui contrato determinista e confirma zero chamadas a `execute_tool` | aprovado em teste focal |
| CA-028 | inspecao automatica cobre as novas rotas com guard admin | aprovado em teste focal |
| CA-029 | migration 55 executada duas vezes no mesmo SQLite | aprovado em teste focal |
| CA-030 | suite completa e frontend locais; smokes dos dois ambientes apos publicacao | aprovado localmente, release pendente |

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

## Ciclo de aprendizado continuo supervisionado - 22/07/2026

- feedback negativo com correcao esperada cria sugestao pendente com origem rastreavel e sem mudar o prompt ativo;
- aprovacao cria ou atualiza memoria, registra versao imutavel e substitui o contrato de regressao ativo;
- rejeicao nao altera memoria e restauracao de versao antiga cria uma nova versao, sem apagar historico;
- laboratorio combina roteamento do modelo e contratos deterministas, sem executar ferramentas;
- migration `20260722_55` foi executada duas vezes no mesmo SQLite;
- 37 testes focais do admin, autonomia e migration aprovados;
- suite completa: 373 testes aprovados;
- ESLint, TypeScript, `pip check`, `git diff --check` e build Next aprovados;
- build confirmou `/assistente-ia` com Aprendizados, versoes, restauracao e contratos de regressao;
- smokes de stage e producao serao registrados depois da publicacao guardada do mesmo SHA.

## Resultado

- 28 testes focais novos/atualizados aprovados;
- suite completa: 359 testes aprovados;
- migration `20260721_53` executada duas vezes no mesmo SQLite sem divergencia;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build gerou `/assistente-ia` com as seis areas administrativas;
- smoke real do modelo `gpt-5.6-sol`: status `completed` e roteamento correto para `gerar_resumo_executivo`;
- nenhuma chave foi impressa, persistida em codigo ou enviada ao frontend.

## Ciclo Radar, Missoes, Semantica e Avaliacoes

- 6 testes focais novos cobrem radar somente de leitura, recorrencia tipada, revogacao de admin, fonte obrigatoria, busca semantica e laboratorio sem execucao;
- migration `20260721_54` exercitada duas vezes no mesmo SQLite;
- suite completa: 367 testes aprovados;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build confirmou `/assistente-ia` com Radar, Missoes, Memoria semantica e Avaliacoes;
- worker aguarda a migration sem loop de erro, recupera execucoes interrompidas e aparece na saude do runtime.

## Ciclo de calibracao de roteamento - 22/07/2026

- linha de base real em producao: 10/12 casos, nota 83,3%;
- o caso de remarcacao nao informava o motivo exigido pelo schema estrito;
- o pedido generico de rascunho selecionou corretamente `obter_contexto_laudo`, mas o dataset esperava gravacao imediata sem conteudo;
- o dataset agora separa contexto primeiro de gravacao com conteudo completo e inclui motivo explicito na remarcacao;
- as instrucoes reais e do laboratorio preservam confirmacao da remarcacao, isolamento do rascunho e proibicao de finalizar o laudo;
- 10 testes focais do contrato e da autonomia aprovados;
- suite completa: 368 testes aprovados;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados.

## Segunda calibracao de roteamento - 22/07/2026

- primeira avaliacao apos a publicacao: 11/13 casos, nota 84,6%;
- o rascunho clinico foi corrigido, mas remarcacao e bloqueio retornaram sem `function_call`;
- o laboratorio agora explicita que `solicitar_*` apenas prepara acao pendente, exige resposta por ferramenta, cobre bloqueio direto e amplia o orcamento de saida para 800 tokens;
- respostas sem ferramenta passam a registrar status e motivo de incompletude por caso, sem executar nenhuma ferramenta real.
- 11 testes focais e a suite completa com 369 testes foram aprovados;
- `py_compile`, `pip check` e `git diff --check` aprovados.
