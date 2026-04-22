# Intent - logistica-agenda-google-cost-control

Data: 2026-04-22  
Responsavel: Codex  
Status: done

## 1) Problema atual

A agenda faz consultas de deslocamento repetidas para os mesmos pares de clinicas durante os loops de sugestao/validacao, elevando custo de Google Maps desnecessariamente. Em paralelo, a heuristica local podia ser invalidada de forma agressiva so por existir API key configurada.

## 2) Objetivo

Reduzir custo de Google Maps no modulo de logistica/agenda sem perder compatibilidade operacional:
- deduplicar consultas de `obter_duracao_deslocamento` por requisicao na agenda;
- reduzir refresh agressivo de heuristica quando ha API key;
- manter rota de observabilidade `/logistica/cobertura-matriz`.

## 3) Nao objetivos

- Nao alterar contrato das rotas de agenda.
- Nao alterar algoritmo base de calculo de deslocamento.
- Nao introduzir migracao de banco.

## 4) Restricoes

- Preservar comportamento atual como padrao seguro para producao.
- Guardrail SDD precisa aprovar o diff para liberar deploy em `stage`.
