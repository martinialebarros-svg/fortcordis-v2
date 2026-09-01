# Intencao - PERF-13: indice medido da fila de Laudos

## Problema

Depois que a fila de Laudos passou a paginar no banco, a fonte de
agendamentos ainda procura o ultimo laudo de cada tipo com uma subconsulta
correlacionada. A tabela `laudos` nao possui uma chave que acompanhe essa
busca e sua ordenacao, fazendo o custo crescer com o volume de laudos.

## Resultado esperado

Adicionar somente o indice que reduza comprovadamente o plano de busca do
ultimo laudo por agendamento e tipo, preservando a regra de usar o laudo mais
recente mesmo quando ele esta finalizado.

## Fora de escopo

- Alterar quais servicos geram laudo, os estados clinicos ou a ordenacao da
  fila.
- Criar indice adicional para `agendamentos` sem ganho mensurado.
- Expor planos de consulta, credenciais ou dados clinicos na interface.
