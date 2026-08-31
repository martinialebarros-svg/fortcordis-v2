# Intencao - PERF-12: paginação SQL da fila de Laudos

## Problema

A rota `GET /laudos/pendentes` combina duas fontes de pendências, monta todos
os itens em memória e só então aplica `skip` e `limit`. O custo de CPU, memória
e consultas de apoio cresce com toda a fila, inclusive quando a interface pede
uma única página.

## Resultado esperado

O banco deve contar, ordenar e recortar a fila combinada antes da hidratação de
paciente, tutor, clínica e do cálculo de horas úteis. A resposta pública e as
regras que determinam uma pendência permanecem compatíveis.

## Fora de escopo

- Alterar regras clínicas, o prazo de 48 horas úteis ou a marcação de urgência.
- Migrar dados ou criar índices especulativos.
- Alterar o fluxo de criação, continuação ou finalização de Laudos.
