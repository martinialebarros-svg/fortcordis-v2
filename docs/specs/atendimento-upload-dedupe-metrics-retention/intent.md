# Intent - atendimento-upload-dedupe-metrics-retention

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

A tabela `upload_dedupe_metricas` passou a registrar eventos diariamente, mas ainda nao existe politica de retencao. Sem limpeza, o volume tende a crescer continuamente e pode afetar custo/consulta no medio prazo.

## 2) Objetivo

Definir e implementar retencao automatica de metricas de dedupe (janela inicial de 90 dias), mantendo utilidade operacional sem crescimento indefinido da tabela.

## 3) Nao objetivos

- Nao remover logs de aplicacao.
- Nao criar data warehouse historico nesta iteracao.
- Nao alterar semantica dos eventos de dedupe existentes.

## 4) Contexto e restricoes

- Restricoes tecnicas: compativel com SQLite (local) e Postgres (stage/producao).
- Restricoes de prazo: iteracao curta, com limpeza simples e segura.
- Restricoes operacionais: preservar dados recentes para suporte e auditoria tecnica.

## 5) Impacto esperado

- Usuarios impactados: time tecnico/operacional.
- Modulos impactados: backend (migracoes/rotina), tabela `upload_dedupe_metricas`.
- Risco de regressao: baixo (escopo restrito a metrica auxiliar).

## 6) Riscos iniciais

- Risco 1: limpeza agressiva remover dados ainda necessarios para analise.
- Risco 2: rotina de limpeza concorrendo com consulta e degradando performance.

## 7) Perguntas abertas

- Pergunta 1: retenção inicial de 90 dias atende operação?
- Pergunta 2: limpeza será sob demanda (endpoint/admin) ou automática no startup/cron?

Respostas desta iteracao:
- Retencao inicial: 90 dias.
- Execucao: rotina backend simples acionavel manualmente e preparada para agendamento posterior.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
