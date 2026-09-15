# Plan - resumo financeiro da Agenda sem N+1

## Sequencia

1. Mapear as leituras disparadas por `calcular_preco_servico` dentro do loop de agendamentos.
2. Carregar servicos, clinicas, precos negociados e precos de tabela por conjuntos de IDs.
3. Aplicar a mesma prioridade de preco em memoria para cada combinacao solicitada.
4. Cobrir o resumo com varios agendamentos sem OS e contar apenas os `SELECT` executados pela rota.
5. Validar contrato existente, lint, TypeScript, build, guardrail SDD e stage antes de qualquer promocao.

## Risco e rollback

O risco funcional e divergir da prioridade de precificacao individual. O teste usa preco negociado por clinica e o rollback e reverter somente o commit desta feature, restaurando o calculo individual anterior.

## Criterio tecnico

Para agendamentos com a mesma combinacao clinica/servico, o total de `SELECT` do resumo permanece limitado e nao cresce com a quantidade de agendamentos.
