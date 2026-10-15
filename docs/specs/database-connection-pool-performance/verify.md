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
