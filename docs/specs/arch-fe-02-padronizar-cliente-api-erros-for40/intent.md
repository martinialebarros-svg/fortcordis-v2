# Intent - arch-fe-02-padronizar-cliente-api-erros-for40

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## Contexto

O frontend possui tratamento de erro distribuido e inconsistente entre telas, com repeticao de padroes como `error.response?.data?.detail || error.message` e uso misto de cliente `api` e `axios` cru.

## Problema

Esse padrao aumenta custo de manutencao, dificulta padronizacao de mensagens para usuario e gera risco de regressao ao evoluir autenticacao/interceptors.

## Objetivo

Padronizar cliente API e tratamento de erros no frontend, com utilitario compartilhado de extracao de mensagem e uso consistente nos modulos prioritarios do ciclo.

## Escopo desta iteracao

- Criar utilitario comum para extracao de erro (`sync` e `async`).
- Integrar utilitario ao interceptor do `frontend/lib/axios.ts`.
- Migrar modulos alvo da FOR-40 (atendimento, servicos e transacao modal).

## Fora de escopo

- Migrar 100% das telas frontend no mesmo commit.
- Trocar `alert` globalmente por sistema de toast.
