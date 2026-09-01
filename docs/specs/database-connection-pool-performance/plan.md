# Plano - PERF-14: pool de conexoes resiliente

## Etapas

1. Confirmar que o engine atual nao possui configuracao explicita de pool.
2. Expor variaveis validadas para capacidade, espera, reciclagem, conexao e
   `pre_ping`.
3. Aplicar as opcoes somente a PostgreSQL; preservar SQLite para desenvolvimento
   e CI.
4. Cobrir as opcoes com testes unitarios e atualizar o plano de desempenho.
5. Validar localmente, publicar em stage e aceitar a rota autenticada antes de
   eventual promocao para producao.

## Rollback

Reverter o commit restaura a criacao anterior do engine. As variaveis novas sao
opcionais e possuem defaults seguros, portanto nao exigem mudanca manual de
segredos nos ambientes.
