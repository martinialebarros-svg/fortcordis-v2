# Intent - admin-runtime-observability

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

Os novos sinais de observabilidade (monitor de `5xx` e estado do worker de cleanup) estao disponiveis em `health/ready`, mas em producao o acesso direto a essas rotas nao esta exposto no dominio publico.

## 2) Objetivo

Expor esses sinais em endpoint tecnico autenticado de admin ja existente (`/api/v1/admin/hardening-readiness`) para operacao segura sem abrir telemetria sensivel publicamente.

## 3) Nao objetivos

- Nao abrir endpoint publico anonimo com detalhes de saude interna.
- Nao alterar politica de auth/permissoes.
- Nao integrar alerta externo nesta iteracao.

## 4) Restricoes

- Sem breaking changes no contrato atual do endpoint admin.
- Baixo risco e rollout rapido.

## 5) Definition of Ready

- [x] Escopo definido.
- [x] Objetivo de seguranca alinhado.
