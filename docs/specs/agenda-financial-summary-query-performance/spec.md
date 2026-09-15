# Specification - resumo financeiro da Agenda sem N+1

## Escopo

O endpoint `GET /agenda/resumo-financeiro` passa a agrupar as previsoes de agendamentos sem valor final de OS e a resolver precos em lote.

## Requisitos funcionais

- RF-001: a resposta, filtros, campos e permissao `admin` do endpoint permanecem inalterados.
- RF-002: a prioridade continua sendo preco negociado ativo da clinica, depois tabela da clinica, depois preco legado do servico.
- RF-003: atendimento domiciliar sem clinica continua usando o preco domiciliar e depois o preco legado.
- RF-004: servico ou clinica inexistente, ou falha de precificacao, nao interrompe o resumo; a previsao daquele item e `0.00`.
- RF-005: as leituras de precificacao usam conjuntos de IDs, sem repetir consultas para cada agendamento.

## Requisitos nao funcionais

- RNF-001: para uma pagina com varios agendamentos da mesma combinacao, a quantidade de consultas e limitada por tipo de entidade, nao pelo total de itens.
- RNF-002: tabelas de preco ausentes mantem o fallback compativel com ambientes legados.
- RNF-003: testes de desempenho usam somente fixtures sinteticas.

## Criterios de aceitacao

- CA-001: doze agendamentos sem OS com preco negociado retornam o mesmo total esperado.
- CA-002: o teste da rota observa no maximo cinco `SELECT` nesse cenario, em vez de uma leitura adicional por agendamento.
- CA-003: filtros existentes de periodo e origem continuam retornando os mesmos totais.
