# Verificação - PERF-12: paginação SQL da fila de Laudos

## Automática

- `backend/venv/bin/python -m unittest tests/test_laudos_fila_pendentes.py`
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD`
- `npm run lint`, `npx tsc --noEmit --pretty false` e `npm run build` em
  `frontend/`.

## Cenários obrigatórios

1. Exame clínico realizado sem laudo permanece pendente.
2. Agendamento realizado sem Atendimento aparece conforme o serviço e cada
   tipo de um combo aparece de forma independente.
3. Laudo finalizado remove apenas o tipo concluído; rascunho permanece.
4. Uma fila com mais de uma página retorna total exato, página sem repetição e
   SQL com `LIMIT/OFFSET` antes da hidratação.
5. Em stage, abrir `/laudos`, selecionar **Pendentes** e confirmar que a fila
   carrega sem erro persistente.
