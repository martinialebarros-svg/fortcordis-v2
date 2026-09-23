# Intent — PERF-21: observabilidade por subrota da Agenda

## Problema

A telemetria atual agrega todas as leituras sob o prefixo
`/api/v1/agenda`. A linha mistura lista, relacionados, resumo financeiro,
configuração e stream, impedindo atribuir os picos p99 à operação responsável.
Além disso, o tempo de banco não informa quantas consultas ocorreram nem quanto
da resposta foi gasto na aplicação fora do banco e do pool.

## Objetivo

Separar as cinco leituras operacionais da Agenda em grupos exatos e acrescentar
contagem de consultas e tempo de aplicação à telemetria administrativa, sem
persistir query string, filtros, IDs, usuário ou conteúdo clínico.

## Fora de escopo

- Alterar consultas, paginação ou regras da Agenda.
- Remover ainda a inspeção de schema do caminho crítico.
- Registrar SQL, parâmetros, payloads ou identificadores.
- Adicionar fornecedor externo de observabilidade.
- Publicar a alteração sem validação posterior em stage.
