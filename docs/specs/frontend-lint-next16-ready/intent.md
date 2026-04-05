# Intent - frontend-lint-next16-ready

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: draft

## 1) Problema atual

O frontend ainda usa `next lint`, que esta deprecado no Next 15 e sera removido no Next 16.

## 2) Objetivo

Migrar o comando de lint para ESLint CLI, mantendo o mesmo conjunto de regras e sem regressao de build/deploy.

## 3) Nao objetivos

- Nao alterar regras de lint da aplicacao.
- Nao migrar para flat config nesta iteracao.
- Nao alterar comportamento funcional do frontend.

## 4) Restricoes

- Mudanca deve ser pequena e reversivel.
- Deve permanecer compativel com pipeline atual de deploy.

## 5) Definition of Ready

- [x] Escopo claro.
- [x] Criterios de aceite definidos.
