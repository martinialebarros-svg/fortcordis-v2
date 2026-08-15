# Spec - migrations-pendencia-nao-bloqueia-deploy

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

Nova excecao `MigrationDeferred` (subclasse de `RuntimeError`) sinaliza
pendencia de dados, distinta de erro real. O runner adia a versao que a
levanta (nao registra em `schema_migrations`, continua com as demais) e
reporta o que foi adiado. `executar_migracoes()` deixa de mascarar
pendencias como sucesso silencioso. A migration 20260730_59 passa a
reportar as duas possiveis pendencias (atendimento e OS) de uma vez.

## 2) Requisitos funcionais (RF)

- RF-001: `MigrationDeferred` existe em `backend/migrations/exceptions.py`,
  herda de `RuntimeError` (compatibilidade com qualquer `except RuntimeError`
  existente).
- RF-002: `run_migrations()` captura `MigrationDeferred` por migration
  individualmente (dentro do loop, nao no nivel da funcao); ao capturar,
  NAO registra a versao em `schema_migrations`, adiciona a versao+motivo a
  uma lista de adiadas, e continua para a PROXIMA migration na ordem.
- RF-003: qualquer excecao que NAO seja `MigrationDeferred` continua
  interrompendo `run_migrations()` imediatamente (comportamento anterior
  preservado).
- RF-004: `run_migrations()` guarda a lista de adiadas da ultima execucao
  em um estado de modulo (`_LAST_DEFERRED`), limpo no inicio de cada
  chamada.
- RF-005: `get_deferred_migrations()` retorna `_LAST_DEFERRED` (o que foi
  de fato adiado na ultima execucao real) - NAO reexecuta migrations
  especulativamente.
- RF-006: `executar_migracoes()` (setup_database.py) so retorna `False`
  (indicando falha real) quando `run_migrations()` levanta uma excecao que
  nao seja `MigrationDeferred`; quando ha migrations adiadas, retorna
  `True` e imprime a lista de pendencias com o motivo de cada uma.
- RF-007: a migration 20260730_59 coleta as pendencias de
  `atendimentos_clinicos` E `ordens_servico` ANTES de decidir; se qualquer
  uma existir, levanta `MigrationDeferred` com as duas mensagens
  concatenadas (nao levanta na primeira e esconde a segunda).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/consistencia): nenhum registro e apagado ou alterado
  para "resolver" a duplicidade - a migration so verifica e relata.
- NFR-002 (idempotencia): reexecutar `run_migrations()` sobre uma base com
  a mesma pendencia produz o mesmo resultado (adia de novo); apos a
  conciliacao dos dados, a proxima execucao aplica a migration
  normalmente sem intervencao manual no runner.
- NFR-003 (observabilidade): a mensagem de pendencia inclui os ids
  especificos dos registros conflitantes (ex.: "agendamento 10: ids 1,2"),
  suficiente para localizar e conciliar sem investigacao adicional.

## 4) Contratos tecnicos

### API

- Nao aplicavel - mudanca e em scripts de infraestrutura de deploy, sem
  rota HTTP envolvida.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma nova (a mudanca e no comportamento do
  runner, nao no schema).
- Indices/constraints: os dois indices unicos parciais que a migration 59
  cria continuam os mesmos; a mudanca e apenas em COMO a ausencia deles
  (por pendencia) e comunicada e tratada pelo runner.
- Migracao necessaria: nao (esta feature nao adiciona migration nova).

### Frontend

- Nao aplicavel.

## 5) Compatibilidade e rollout

- Backward compatibility: total - o caminho de sucesso (sem pendencia) e
  identico ao comportamento anterior; migrations existentes que nunca
  levantam `MigrationDeferred` nao mudam de comportamento.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (silenciar a excecao sem interromper o boot, mas tambem sem
  aplicar as migrations seguintes corretamente sinalizadas).

## 6) Criterios de aceitacao (CA)

- CA-001: uma migration que levanta `MigrationDeferred` e adiada; as
  migrations POSTERIORES a ela na ordem sao aplicadas mesmo assim.
- CA-002: a versao adiada nao e apagada nem alterada nos dados que
  causaram a pendencia.
- CA-003: apos conciliar os dados manualmente, a proxima execucao de
  `run_migrations()` aplica a versao antes adiada, sem qualquer acao no
  codigo do runner.
- CA-004: uma migration que levanta um erro REAL (nao
  `MigrationDeferred`) continua interrompendo a esteira - as migrations
  seguintes a ela nao sao aplicadas.
- CA-005: `get_deferred_migrations()` reflete exatamente o que a ultima
  chamada de `run_migrations()` adiou, e fica vazio apos a conciliacao.
- CA-006: `executar_migracoes()` (fluxo real de deploy) roda ate o fim e
  reporta a pendencia, sem interromper o boot da aplicacao nem mascarar a
  pendencia como sucesso silencioso.
- CA-007: a migration 59 relata as duas pendencias (atendimento e OS) na
  mesma mensagem quando ambas existem simultaneamente.

## 7) Casos de borda

- CB-001: nenhuma migration pendente (base limpa) - comportamento
  inalterado, nenhuma mensagem de adiada.
- CB-002: todas as migrations descobertas sao novas (primeiro deploy em
  base vazia) - continua funcionando (nenhuma delas levanta
  `MigrationDeferred` em base vazia, porque nao ha duplicidade possivel).

## 8) Fora de escopo

- Conciliacao automatica dos dados duplicados.
- Alertagem/notificacao externa (Slack, email) quando uma migration fica
  adiada - hoje o unico canal e o log de deploy (`print`).
