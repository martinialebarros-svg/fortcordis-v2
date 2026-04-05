# Intent - backend-runtime-proactive-monitoring

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O backend possui `health` e `ready`, mas ainda sem sinalizacao proativa consolidada para:
- aumento recente de erros HTTP `5xx`;
- estado operacional do worker de auto-cleanup de metricas dedupe.

Hoje esses sinais ficam dispersos em logs e dificultam deteccao rapida de degradacao.

## 2) Objetivo

Adicionar monitoramento proativo leve no runtime para consolidar alertas operacionais em `health/readiness`, com foco em seguranca operacional e estabilidade.

## 3) Nao objetivos

- Nao integrar com provedor externo de observabilidade (Sentry/Datadog/etc.).
- Nao alterar contratos de negocio de endpoints funcionais.
- Nao transformar alertas em bloqueio duro de startup.

## 4) Contexto e restricoes

- Solucao deve ser simples, de baixo risco e reversivel.
- Deve manter compatibilidade com ambiente atual (single process e multi-instancia best effort).
- Nao pode degradar performance de requisicoes.

## 5) Impacto esperado

- Melhor visibilidade de degradacao sem depender exclusivamente de logs.
- Reducao de tempo de diagnostico em incidentes.
- Base pronta para evolucoes futuras de observabilidade.

## 6) Riscos iniciais

- Risco 1: monitor de 5xx gerar falso positivo por janela mal calibrada.
- Risco 2: adicionar campos em health quebrar consumidores muito rigidos.

## 7) Perguntas abertas

- Pergunta 1: alerta de 5xx deve marcar `ready=false`?
- Pergunta 2: estado do worker deve ser apenas warning ou erro de readiness?

Resposta adotada nesta iteracao:
- `5xx` alto gera **warning operacional** (nao derruba readiness).
- worker de cleanup desabilitado por config nao gera alerta; habilitado e inativo gera warning.

## 8) Definition of Ready (gate para spec)

- [x] Objetivo e escopo claros.
- [x] Riscos mapeados.
- [x] Decisao de impacto em readiness definida.
