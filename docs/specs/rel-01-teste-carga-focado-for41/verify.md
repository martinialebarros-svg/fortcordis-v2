# Verificacao

## Validação técnica
- `python3 -m unittest backend/tests/test_focused_load_test.py`
- `python3 scripts/focused_load_test.py --help`

## Critérios
1. script gera resumo JSON por endpoint com p95/p99.
2. gates de erro/p95 retornam código de saída de falha quando excedidos.
3. execução com `--output-json` persiste baseline para comparação futura.
