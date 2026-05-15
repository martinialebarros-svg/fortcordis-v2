# Intent - api-04-telemetria-p95-p99-for30

Data: 2026-05-15  
Responsavel: Codex  
Status: done

## Problema

A operação não tinha visão consolidada de latência por endpoint crítico. Sem p95/p99 por rota, gargalos de desempenho ficam escondidos e a priorização de otimizações perde precisão.

## Objetivo

Adicionar telemetria de latência por endpoint prioritário (top 5) com percentis p95/p99 e exposição no relatório de runtime para suporte ao dashboard operacional.
