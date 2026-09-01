# Verificacao - PERF-13: indice medido da fila de Laudos

## Evidencia de plano

Em PostgreSQL local temporario, com dados totalmente sinteticos:

| Cenario | Tempo de execucao | Plano de `laudos` |
| --- | ---: | --- |
| Sem indice novo | 1.217,0 ms | `Seq Scan` |
| Indice de Laudo | 8,7 ms | `Index Scan ix_laudos_agendamento_tipo_created_id` |
| Indice de Laudo + candidato de Agenda | 8,8 ms | mesmo plano de Laudo |

O candidato de Agenda foi descartado: acrescentou custo de escrita e nao
reduziu materialmente o tempo nem eliminou sua varredura nesse fluxo. A
medicao nao usa banco, nomes ou valores reais de pacientes.

## Automatica

- `cd backend && venv/bin/python -m unittest discover -s tests -p 'test_laudos_fila_pendentes.py'`
- `cd backend && venv/bin/python -m unittest discover -s tests -p 'test_laudos_pending_queue_index_migration.py'`
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD`
- `npm run lint`, `npx tsc --noEmit --pretty false` e `npm run build` em
  `frontend/`.

## Stage

1. Confirmar que a migration concluiu com sucesso.
2. Abrir `/laudos`, selecionar **Pendentes** e confirmar que a fila continua
   carregando sem erro persistente.
3. Registrar apenas status, tempo agregado e presenca do indice; nunca dados
   clinicos ou planos brutos.
