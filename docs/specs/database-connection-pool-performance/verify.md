# Verificacao - PERF-14: pool de conexoes resiliente

## Evidencia prevista

- `backend/tests/test_database_connection_pool.py` confirma as opcoes
  PostgreSQL, a preservacao de SQLite e a rejeicao de capacidade invalida.
- A suite focada confirma que a criacao global do engine continua compativel
  com SQLite usado no CI.
- `py_compile`, lint e o guardrail SDD cobrem integridade de codigo e docs.

## Aceitacao em ambientes

1. Em stage, aguardar sucesso de quality gate, deploy e Migration CI.
2. Confirmar rota publica e API protegida sem sessao.
3. Com sessao autenticada, abrir Laudos e selecionar Pendentes, registrando
   apenas estados de carregamento e erro.
4. Antes de producao, confirmar que `origin/main` e ancestral do snapshot stage.

## Risco residual

As configuracoes limitam degradacao, mas a medicao historica de saturacao do
pool ainda depende da PERF-17.


## Diagnostico e preparacao — 2026-10-15

- Deploy de producao `38776547787` falhou por `EMAXCONNSESSION` e voltou a
  `16dfb36980bb14ca4a9b8b5dab492f06236287d6`. O limite session mode e 15;
  nao confundir com o limite PostgreSQL de 60 conexoes.
- SSH somente leitura confirmou um processo API e um worker de producao,
  ambos com defaults 5+5 e Node sem limite explicito (default 10). A API
  e o Node de producao usam o mesmo projeto Supabase; stage usa outro projeto.
- Consulta agregada ao Supabase confirmou 15 sessoes de aplicacao no instante
  da verificacao (13 ociosas e 2 ociosas em transacao); nenhum texto de
  conversa, nome de cliente ou credencial foi coletado.
- Orcamento preparado: 3+3+2=8, deixando sete sessoes para outras conexoes
  e setup. A aplicacao e canarios serao conferidos apos reiniciar os pools.

- Ajuste numerico aplicado somente em producao, com backup protegido (0600) em
  `~/fortcordis-runtime-backups/pool-budget-20261015T215620Z`. API reiniciada
  pela regra sudo existente; Node/worker aplicarao os novos limites no deploy.
- API apos restart: pool efetivo 3/overflow 0; health/ready HTTP 200 sem alertas;
  nenhum EMAXCONNSESSION no startup observado. Canary autenticado passou:
  cinco amostras, p50 86,41 ms, p95 115,16 ms (limite 1200 ms), release16dfb369.
- Quatro testes de configuracao do pool passaram. A suite backend sobre a
  integracao em stage72327f com a feature passou: 1896 testes, 44 skips.

## Incidente de busca de horarios — 2026-10-15

### Observado em producao (somente leitura)

- SHA instalado `01b13fb62950db1efca3f8fea673d906be529784`, backend ativo.
- Logs de 15/10, 21h30–21h33 (America/Fortaleza), mostram repetidos HTTP 500
  em `POST /api/v1/agenda/assistente/ofertas` e na busca de tutores por
  `QueuePool limit of size 3 overflow 0 reached`, timeout de 15 segundos.
- O traceback de ofertas termina em `_listar_bloqueios_ativos`, na
  introspeccao `inspect(db.bind)`. Esse caminho solicita uma segunda conexao
  enquanto a sessao da requisicao ja ocupa uma.
- O SSE usa autenticacao com sessao de banco e resposta continua. Na versao
  fixada FastAPI 0.104.1, o encerramento da dependencia ocorre depois do fim
  da resposta; uma aba conectada pode reter a conexao de autenticacao.

### Regressao local

- `test_agenda_connection_pool.py`: antes da correcao, tres testes produziram
  quatro erros de timeout com pool de uma conexao e overflow zero; depois,
  passaram. Cobrem tabela ausente/cache, bloqueios ativos, rollback de dados
  pendentes e preservacao dos HTTP 409 nas transicoes de atendimento vinculado.
- `test_tutor_schema_pool.py`: os tres cenarios (tabela ausente, schema legado
  e schema atual) falharam antes com timeout e passaram apos reutilizar a
  conexao. A suite de tutores totalizou 17 testes aprovados.
- A suite focada de Agenda/pool/schema/primeira saida/preferencias/orquestrador
  totalizou 92 testes aprovados.
- `test_agenda_stream_connection_pool.py`: FastAPI 0.104.1 real, JWT e matriz
  de permissao preservados. Antes, o stream ativo ocupava a unica conexao;
  depois, ocupa zero e permite outra consulta autenticada HTTP 200. Tres
  testes aprovados cobrem eventos, desconexao durante `connected`, descarte
  de subscribers e respostas 401/403. A revisao independente reexecutou os
  cenarios SSE/tutores sem encontrar problemas pendentes.
- Os sete novos testes de regressao passaram juntos; `git diff --check` e
  o guardrail SDD sobre arquivos alterados/novos tambem passaram.
- Suite geral final: `python -m unittest discover -s backend/tests -p
  'test_*.py'` executou 1.861 testes em 85,623 s, com 1.832 aprovados e 29
  ignorados, sem falhas. Ambiente local com `DATABASE_URL=sqlite:///:memory:`
  e papel de processo `api`.
- Integracao para publicacao sobre `origin/stage` `12a7c422`: 1.903 testes
  backend executados, 1.859 aprovados e 44 ignorados, sem falhas (81,023 s).
  Lint frontend, TypeScript e guardrail SDD aprovados no mesmo snapshot.

### Limite da evidencia

- Reproducao usa banco SQLite efemero e QueuePool limitado; nao mede latencia
  nem concorrencia do PostgreSQL em producao.
- Publicacao e smoke de stage/producao ainda nao executados para esta
  correcao. O deploy deve verificar simultaneamente SSE aberto e consultas
  autenticadas, alem do canario existente, antes de considerar resolvido o
  incidente no ambiente real.
