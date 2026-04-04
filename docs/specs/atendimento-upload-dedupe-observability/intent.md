# Intent - atendimento-upload-dedupe-observability

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

Os ciclos de dedupe (frontend, backend e race-guard) estao ativos, mas ainda falta visibilidade operacional para responder rapidamente: quanto dedupe acontece por dia, em quais atendimentos e se houve aumento anormal de colisao.

## 2) Objetivo

Adicionar observabilidade dedicada para o fluxo de upload deduplicado, com logs estruturados e metrica diaria simples para acompanhamento operacional.

## 3) Nao objetivos

- Nao construir stack completa de observabilidade externa (Prometheus/Grafana) neste ciclo.
- Nao alterar regras de negocio de dedupe.
- Nao introduzir painel analitico complexo.

## 4) Contexto e restricoes

- Restricoes tecnicas: aproveitar base atual (Python logging + banco existente).
- Restricoes de prazo: iteracao curta com foco em coleta de dados e consulta.
- Restricoes regulatorio/operacional: nao expor dados sensiveis em logs.

## 5) Impacto esperado

- Usuarios impactados: time tecnico/operacional que monitora incidentes de upload.
- Modulos impactados: endpoint de upload backend, possivel tabela/consulta de metricas.
- Risco de regressao: baixo (mudanca de observabilidade, sem alterar contrato principal).

## 6) Riscos iniciais

- Risco 1: logs ruidosos demais sem padrao.
- Risco 2: metrica sem contexto suficiente para diagnostico.

## 7) Perguntas abertas

- Pergunta 1: guardar metrica agregada em tabela propria ou calcular sob demanda?
- Pergunta 2: granularidade inicial: diaria por clinica ou apenas global?

Respostas desta iteracao:
- Primeira versao: tabela leve de eventos/contadores para consulta diaria.
- Granularidade inicial: diaria global + filtro por clinica opcional.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
