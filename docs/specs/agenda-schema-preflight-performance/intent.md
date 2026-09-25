# Intenção — PERF-22: preflight de schema fora da requisição da Agenda

## Problema

A telemetria exata de stage da release `c758af1` mostrou que `GET /api/v1/agenda`
executa dez consultas no p95 e concentra a maior parte da latência no banco. O
endpoint ainda chama uma compatibilidade legada que inspeciona tabelas e colunas
em cada nova sessão HTTP, embora as colunas já sejam mantidas por migrações.

## Resultado esperado

Executar essa compatibilidade uma única vez no startup da API, antes de aceitar
requisições, e retirar a inspeção de schema de todos os caminhos HTTP da Agenda.
O comportamento clínico, os contratos da API e a compatibilidade com bancos
locais antigos devem permanecer inalterados.

## Fora de escopo

- Alterar filtros, paginação, ordenação ou serialização da Agenda.
- Criar ou modificar dados clínicos para medir desempenho.
- Remover as migrações existentes ou a compatibilidade legada.
- Publicar diretamente em produção.
