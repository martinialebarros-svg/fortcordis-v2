# Plano - PERF-13: indice medido da fila de Laudos

## Etapas

1. Reproduzir em PostgreSQL a subconsulta correlacionada da fonte Agenda com
   agenda, atendimento e laudos sinteticos.
2. Comparar `EXPLAIN ANALYZE` sem indice, com o indice de Laudo e com o
   candidato adicional de Agenda.
3. Migrar apenas o indice de Laudo se o plano passar a utilizá-lo e houver
   ganho material; registrar a rejeicao do outro candidato.
4. Cobrir a migration idempotente e o uso da chave de busca em SQLite, rodar
   as suites e publicar primeiro em stage.

## Rollback

Reverter a migration/commit. O indice nao altera registros nem o contrato da
API; sua remocao volta ao plano anterior.
