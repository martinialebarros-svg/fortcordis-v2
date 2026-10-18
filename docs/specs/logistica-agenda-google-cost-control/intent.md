# Intent - logistica-agenda-google-cost-control

## Decisão vigente — 18/10/2026

A produção dos controles Maps foi autorizada com gasto adicional zero. O modo `cache_only` utiliza apenas rota Google persistida ainda válida ou ajuste manual já autorizado; nenhum lookup/refresh/geocoding Google é enviado. Ausência, expiração ou fonte heurística bloqueiam a operação dependente da rota, preservando as regras da agenda. A configuração omite preços/câmbio/baseline, sem fabricar consumo passado ou saldo gratuito. Implementação e suítes locais integrais aprovadas; publicação/ativação ainda pendentes; contrato e evidências em `../google-maps-enforced-budget/`.

As decisões de abril/maio abaixo são históricas. Lookup ao vivo habilitado por flag e a compatibilidade antiga com heurística não superam o modo de custo zero.

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
