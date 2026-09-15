# Intent — PERF-18: gate autenticado de latência

## Problema

O canário pós-deploy atual confirma autorização e contratos mínimos, mas uma
resposta lenta ainda pode encerrar a esteira como sucesso. A telemetria
persistente já mostra que a Agenda possui cauda de latência relevante em
produção; erros HTTP de autenticação também não podem ser confundidos com um
canário válido.

## Objetivo

Fazer o canário autenticado medir uma pequena amostra de `GET /api/v1/agenda`
no release recém-instalado e interromper o deploy quando seu p95 exceder o
limite explícito, preservando o rollback existente.

## Fora de escopo

- Alterar regra clínica, filtros ou dados da Agenda.
- Registrar payloads, nomes, tokens, parâmetros ou dados clínicos.
- Executar carga concorrente ou substituir testes de performance dedicados.
