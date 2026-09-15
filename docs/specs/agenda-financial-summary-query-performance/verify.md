# Verification - resumo financeiro da Agenda sem N+1

## Cobertura automatizada

- `backend/tests/test_agenda_resumo_financeiro.py` preserva filtros de periodo e origem.
- O caso de lote cria doze agendamentos sinteticos sem OS, usa preco negociado da clinica e confirma total de `R$ 1.260,00` com no maximo cinco `SELECT`.

## Comandos locais

```bash
cd backend && venv/bin/python -m unittest tests/test_agenda_resumo_financeiro.py
cd frontend && npm run lint -- --quiet
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run build
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
git diff --check
```

## Aceite em stage

1. Aguardar `SDD Guardrail`, `quality-gate`, `Migration CI` e `Deploy Stage VPS` em sucesso terminal.
2. Abrir `/agenda` autenticado como administrador, no modo lista, sem alterar agendamentos.
3. Confirmar que o card financeiro apresenta o resumo sem carregamento permanente.
4. Confirmar `401` anonimo em uma rota protegida da Agenda e registrar somente status/tempo, sem dados operacionais.
