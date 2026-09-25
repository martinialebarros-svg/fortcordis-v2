# Plano — PERF-22: preflight de schema fora da requisição da Agenda

1. Preservar `_ensure_agendamento_workflow_columns` como compatibilidade legada.
2. Abrir uma sessão curta no startup da API, executar a compatibilidade e sempre
   fechar a sessão, inclusive se a validação falhar.
3. Remover todas as chamadas da compatibilidade feitas por leituras e mutações
   HTTP da Agenda.
4. Cobrir por teste que o startup executa o preflight uma vez e fecha a sessão.
5. Cobrir por teste que `listar_agendamentos` não chama o preflight e mantém no
   máximo quatro `SELECTs` internos no cenário sintético.
6. Rodar testes focados, suítes de Agenda e startup, compilação, diff e guardrail
   SDD.
7. Em stage, repetir pelo menos 100 leituras e comparar consultas, banco, app,
   pool e erros contra a linha de base da release `c758af1`.

## Rollback

Reverter o commit restaura as chamadas por requisição. Não há migração de dados
nem alteração de contrato, portanto o rollback é apenas de código.
