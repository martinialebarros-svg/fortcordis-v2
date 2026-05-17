# FOR-42 REL-02 Regressao de seguranca completa

## Problema
As camadas de seguranca (authz/csrf/cors/ws/cookies/headers) foram implementadas em sprints diferentes e faltava uma regressao unica, repetivel e operacional.

## Objetivo
Consolidar um checklist de regressao de seguranca com execucao automatizada e validacoes manuais curtas para stage/producao.

## Resultado esperado
- smoke script unico para regressao de seguranca
- checklist operacional documentado
- rastreabilidade SDD com criterios de aceite verificaveis
