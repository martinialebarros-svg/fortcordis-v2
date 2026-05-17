# FOR-41 REL-01 Teste de carga focado

## Problema
Precisamos comparar baseline de performance e identificar gargalos residuais nas APIs críticas com um teste reproduzível.

## Objetivo
Criar um harness de carga focado, com métricas de p50/p95/p99 e gates objetivos de erro/latência.

## Resultado esperado
- execução simples por CLI
- saída padronizada em JSON para comparação de baseline
- critério automático de aprovação/reprovação
