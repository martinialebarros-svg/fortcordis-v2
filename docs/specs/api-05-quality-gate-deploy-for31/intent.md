# Intent - api-05-quality-gate-deploy-for31

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Problema

Os workflows de deploy (`stage` e `main`) podiam executar deploy mesmo sem validação de qualidade completa, aumentando risco de publicar regressões de backend/frontend.

## Objetivo

Bloquear deploy automaticamente quando qualquer etapa crítica de qualidade falhar: testes, lint ou build.
