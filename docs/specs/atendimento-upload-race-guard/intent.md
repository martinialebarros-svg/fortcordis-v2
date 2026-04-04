# Intent - atendimento-upload-race-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

O dedupe por hash no backend reduz duplicidade em fluxo normal, mas ainda pode falhar em cenarios de concorrencia (duas requisicoes identicas chegando quase ao mesmo tempo), pois a checagem e insercao ainda nao estao protegidas por garantia forte de unicidade.

## 2) Objetivo

Adicionar protecao transacional para upload identico simultaneo, garantindo comportamento idempotente mesmo sob corrida de requests.

## 3) Nao objetivos

- Nao implementar lock distribuido externo (Redis, etc.) neste ciclo.
- Nao alterar contrato de request do endpoint.
- Nao fazer backfill retroativo dos anexos legados.

## 4) Contexto e restricoes

- Restricoes tecnicas: compatibilidade com SQLite (local) e Postgres (stage/producao).
- Restricoes de prazo: iteracao curta com foco em robustez de escrita.
- Restricoes regulatorio/operacional: fluxo clinico nao pode sofrer bloqueios perceptiveis.

## 5) Impacto esperado

- Usuarios impactados: operadores que enviam anexos simultaneamente ou repetem acao em rede instavel.
- Modulos impactados: endpoint de upload, modelo de anexos, migracoes e testes backend.
- Risco de regressao: medio (mudanca em constraint e tratamento de erro de banco).

## 6) Riscos iniciais

- Risco 1: constraint mal definida bloquear uploads legitimos.
- Risco 2: comportamento divergente de erro de unicidade entre SQLite/Postgres.

## 7) Perguntas abertas

- Pergunta 1: qual chave de unicidade usar para suportar `exame_id` nulo sem ambiguidade?
- Pergunta 2: em corrida, a segunda requisicao deve retornar `200 deduplicado` ou erro de conflito?

Respostas desta iteracao:
- Usar chave derivada `dedupe_key` (escopo de exame + hash) para unicidade simples e portavel.
- Retornar `200` com anexo existente e `deduplicado=true`.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
