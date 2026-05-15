# Plan - api-03-otimizar-agregacoes-relatorios-for29

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Plano de execucao

1. Mapear no endpoint de relatorio quais campos de `Agendamento` sao efetivamente utilizados nas agregacoes.
2. Introduzir estrutura leve para consumo interno das agregacoes.
3. Trocar a consulta base para `with_entities` com colunas minimas.
4. Criar teste de regressao para garantir que colunas pesadas nao voltem para a consulta.
5. Executar testes de regressao cruzada com Agenda para garantir estabilidade.
