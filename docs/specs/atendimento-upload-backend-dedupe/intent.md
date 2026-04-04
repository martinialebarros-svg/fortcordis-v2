# Intent - atendimento-upload-backend-dedupe

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

A protecao de upload duplicado hoje esta no frontend. Se houver concorrencia, refresh de pagina, automacao externa ou bypass do cliente, o backend ainda pode persistir anexos duplicados equivalentes.

## 2) Objetivo

Adicionar deduplicacao defensiva no backend para uploads de anexos do atendimento, reduzindo duplicidade de registros/arquivos e fortalecendo consistencia do prontuario.

## 3) Nao objetivos

- Nao bloquear anexos realmente diferentes.
- Nao redesenhar o fluxo completo de storage neste ciclo.
- Nao remover a protecao de dedupe do frontend.

## 4) Contexto e restricoes

- Restricoes tecnicas: endpoint e contrato externo de upload devem ser preservados.
- Restricoes de prazo: iteracao incremental com migracao simples e testes existentes ampliados.
- Restricoes regulatorio/operacional: evitar impacto no fluxo clinico e preservar rastreabilidade de anexo.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica e operadores que anexem arquivos em atendimento.
- Modulos impactados: backend `atendimento.py`, `atendimento_upload_service.py`, modelo/migracao de anexos, testes de upload.
- Risco de regressao: medio (dedupe no backend mexe em regra de persistencia).

## 6) Riscos iniciais

- Risco 1: falso positivo de duplicacao em arquivos com mesmo nome/tamanho.
- Risco 2: custo de hash em uploads maiores se calculo nao for eficiente.

## 7) Perguntas abertas

- Pergunta 1: dedupe por hash deve considerar escopo de atendimento+exame ou global?
- Pergunta 2: resposta de duplicado deve retornar `200` com item existente ou `201` idempotente?

Respostas desta iteracao:
- Escopo: `atendimento_id + exame_id (nullable) + hash`.
- Resposta: `200` com item existente e indicador de `deduplicado=true` para clareza operacional.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
