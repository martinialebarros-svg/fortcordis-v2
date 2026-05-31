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

## 5) Atualizacao 2026-05-31 (hardening de custos e rollout seguro)

Durante a revisao pre-deploy para `stage`, foram aplicados ajustes complementares para reduzir custo com seguranca operacional:
- adicionar resumo de custo/quotas de Google Maps no backend;
- manter lookup ao vivo do Google habilitado por padrao na leitura para evitar perda de precisao sem rollout explicito;
- manter modo sem trafego como padrao (`TRAFFIC_UNAWARE`) para reduzir custo por chamada;
- corrigir recomendacoes de limite por minuto para nao inflar quotas em cenarios de baixo volume.
