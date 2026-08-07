# Intent - migrations-pendencia-nao-bloqueia-deploy

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

A migration `20260730_59_atendimento_agenda_transactional_finalization.py`
levanta `RuntimeError` quando encontra duplicidade de atendimento ou de OS
ativa por agendamento (base legada suja) - isso e correto, ela nao deve
criar o indice unico parcial sem conciliacao previa. O problema esta em
`executar_migracoes()` (`backend/setup_database.py`): ela capturava esse
`RuntimeError`, imprimia o erro e retornava `False` **sem interromper o
boot da aplicacao**. Consequencia real: as migrations SEGUINTES na ordem
(60 a 64 - colunas de calculo mg/kg, tabelas fiscais, historico de ajuste
de exame) nunca chegavam a ser aplicadas pelo runner, porque
`run_migrations()` parava no primeiro `RuntimeError` e nunca retomava - e
mesmo assim o processo de deploy seguia adiante, deixando o app rodar com
schema incompleto contra codigo que espera aquelas colunas.

## 2) Objetivo

Uma pendencia de conciliacao de dados em UMA migration especifica nao pode
impedir a aplicacao de migrations SEM relacao com ela. O deploy deve
continuar avancando o schema no que for possivel, reportando claramente o
que ficou pendente e por que, para conciliacao posterior.

## 3) Nao objetivos

- Nao inclui automatizar a conciliacao dos dados duplicados (decisao
  clinica de qual registro duplicado prevalece, fora do escopo de
  qualquer automação).
- Nao inclui alterar o comportamento do runner para erros que NAO sejam
  pendencia de dados (esses devem continuar interrompendo a esteira - o
  schema fica em estado desconhecido e seguir seria pior).

## 4) Contexto e restricoes

- Restricoes tecnicas: o runner (`migrations/runner.py`) e um mecanismo
  proprio deste projeto (nao Alembic) - qualquer mudanca de contrato afeta
  todas as migrations existentes que usam `upgrade(connection, dialect)`.
- Restricoes de prazo: nenhuma - mas o bug e ativo a cada deploy enquanto
  houver uma base com duplicidade preexistente.
- Restricoes regulatorio/operacional: nenhuma.

## 5) Impacto esperado

- Usuarios impactados: nenhum usuario final diretamente - impacto e
  operacional (quem faz deploy).
- Modulos impactados: `backend/migrations/runner.py`,
  `backend/setup_database.py`, a migration 20260730_59 especificamente.
- Risco de regressao: baixo - a mudanca so afeta o caminho de EXCECAO do
  runner; o caminho de sucesso (nenhuma pendencia) e idêntico ao anterior.

## 6) Riscos iniciais

- Risco 1: transformar toda excecao em "adiada" mascararia erros reais de
  schema - mitigado com uma excecao dedicada (`MigrationDeferred`) que so a
  migration 59 levanta deliberadamente; qualquer outra excecao continua
  abortando a esteira (testado explicitamente).
- Risco 2: sondar pendencias reexecutando migrations especulativamente
  seria arriscado em producao (DDL nao transacional, ordem entre
  migrations dependentes) - descartado; `get_deferred_migrations()` so
  reporta o que a ultima execucao real de `run_migrations()` de fato
  adiou, sem reexecutar nada.

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada (SQLite). Nao foi possivel
testar contra Postgres real (ambiente de desenvolvimento local usa SQLite);
a logica de deteccao de duplicidade e agnostica de dialeto (usa
`STRING_AGG`/`GROUP_CONCAT` condicionalmente, ja existia antes desta
feature).

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
