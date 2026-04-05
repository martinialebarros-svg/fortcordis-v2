# Intent - atendimento-upload-dedupe-retention-automation

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: draft

## 1) Problema atual

A retencao de metricas de dedupe foi implementada, mas a limpeza ainda depende de execucao manual via endpoint tecnico. Isso cria risco operacional de esquecer a rotina e voltar a ter crescimento indefinido da tabela `upload_dedupe_metricas`.

## 2) Objetivo

Automatizar a limpeza de metricas expiradas (janela de 90 dias) com execucao recorrente, segura e auditavel, sem depender de acao manual da equipe.

## 3) Nao objetivos

- Nao criar dashboard novo nesta iteracao.
- Nao alterar a semantica dos eventos `upload_novo`, `dedupe_precheck` e `dedupe_collision`.
- Nao implementar arquivamento historico externo.

## 4) Contexto e restricoes

- Restricoes tecnicas: compativel com SQLite (local) e Postgres (stage/producao).
- Restricoes de prazo: iteracao curta para reduzir risco operacional imediato.
- Restricoes operacionais: nao degradar startup nem fluxo de upload.

## 5) Impacto esperado

- Usuarios impactados: time tecnico e operacao.
- Modulos impactados: backend (startup/rotina de cleanup, endpoint de status, logs).
- Risco de regressao: baixo a medio (toca inicializacao e manutencao de dados).

## 6) Riscos iniciais

- Risco 1: execucao concorrente em mais de uma instancia gerar limpeza duplicada.
- Risco 2: automacao com configuracao invalida falhar silenciosamente.

## 7) Perguntas abertas

- Pergunta 1: qual cadence inicial (24h, 12h ou 6h)?
- Pergunta 2: status do ultimo cleanup deve ficar apenas em log ou tambem via endpoint tecnico?

Respostas propostas para esta iteracao:
- Cadence inicial: 24h.
- Observabilidade: manter log e adicionar endpoint tecnico de status.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
