# Intent — PERF-17: telemetria persistente de latência

## Problema

O monitor atual conserva p95/p99 apenas na memória do processo. Um reinício
remove a evidência e impede comparar uma rota lenta entre releases. Ele também
não mostra quanto da latência veio de consultas ao banco ou de espera pelo pool
de conexões.

## Objetivo

Persistir, por tempo limitado, amostras agregadas das cinco famílias de rota
prioritárias para que administradores localizem regressões por release, sem
registrar URL completa, parâmetros, usuário, paciente ou conteúdo clínico.

## Fora de escopo

- Alterar protocolos TLS/HTTP, configuração de vhosts ou hosts institucionais.
- Rastrear endpoints fora da lista prioritária.
- Armazenar payloads, identificadores clínicos ou dados pessoais.
- Fazer da telemetria um pré-requisito para servir uma requisição.
