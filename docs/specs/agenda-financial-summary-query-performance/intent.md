# Intent - resumo financeiro da Agenda sem N+1

## Problema

O endpoint administrativo `GET /agenda/resumo-financeiro` calcula a previsao de cada agendamento sem Ordem de Servico chamando a precificacao individualmente. Cada chamada repete leituras de servico, clinica e tabelas de preco, fazendo a quantidade de consultas crescer com a quantidade de itens da Agenda.

## Objetivo

Calcular as previsoes do resumo financeiro em lote, mantendo os mesmos valores, prioridade de precificacao e fallbacks atuais, com uma quantidade limitada de consultas por resposta.

## Fora de escopo

- Alterar valores negociados, tabelas ou regras comerciais.
- Criar indice sem uma medicao `EXPLAIN ANALYZE` especifica.
- Alterar o contrato JSON, permissao administrativa ou a interface da Agenda.

## Restricoes

- A rota continua retornando `0.00` para uma previsao sem dados validos, sem derrubar os demais itens.
- Tabelas de precificacao ausentes em ambientes legados continuam caindo no fallback ja existente.
- A medicao de consultas usa dados sinteticos, sem registrar pacientes, tutores ou valores reais.
