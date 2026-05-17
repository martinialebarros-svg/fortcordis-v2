# FOR-47 AG-03 Performance e qualidade da busca de agenda por periodo

Data: 2026-05-17  
Responsavel: Codex  
Status: em progresso

## Problema

Com filtros avancados por periodo, a listagem da Agenda precisava reduzir custo de consulta em janelas amplas sem perder estabilidade de paginacao e sem regressao funcional.

## Objetivo

Melhorar o plano de execucao da listagem para operar em custo constante (sem N+1), preservando ordenacao deterministica e resultados consistentes entre paginas com filtros combinados.

