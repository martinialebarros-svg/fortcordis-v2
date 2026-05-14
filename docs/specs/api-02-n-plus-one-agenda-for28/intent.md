# Intent - api-02-n-plus-one-agenda-for28

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Problema

A API de Agenda precisava de blindagem contra regressao de N+1 ao carregar dados relacionados (paciente, tutor, clinica e servico), especialmente em cenarios de listagem paginada.

## Objetivo

Padronizar a consulta de listagem da Agenda com join unico de relacionados e adicionar teste de regressao de query-count para evitar retorno do padrao N+1.
