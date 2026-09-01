# Especificacao - PERF-13: indice medido da fila de Laudos

## Escopo

A migration cria `ix_laudos_agendamento_tipo_created_id` para a subconsulta
que resolve o ultimo `Laudo` por `agendamento_id`, tipo normalizado e ordem
`created_at`/`id` decrescente.

## Requisitos

- RF-001: a migration e idempotente e nao falha quando a tabela ou colunas
  ainda nao existem em bancos legados.
- RF-002: em PostgreSQL, o indice inclui `status` para a verificacao posterior
  ao lookup sem ampliar a chave de ordenacao.
- RF-003: em SQLite, a mesma chave logica e criada sem `INCLUDE`, que nao e
  suportado pelo dialeto.
- RF-004: a rota `GET /laudos/pendentes` e seu JSON permanecem inalterados.

## Criterios de aceitacao

- Uma fixture PostgreSQL sintetica de 20.000 agendamentos, 6.500 laudos e 650
  atendimentos reduz o plano de aproximadamente 1.217 ms para 8,7 ms e troca
  a varredura sequencial de `laudos` pelo indice novo.
- O candidato `agendamentos(status, urgente_laudo, inicio, id)` nao demonstra
  ganho adicional material e nao e migrado.
- O teste de migration confirma criacao repetivel e uso da chave pela consulta
  de ultimo laudo.
