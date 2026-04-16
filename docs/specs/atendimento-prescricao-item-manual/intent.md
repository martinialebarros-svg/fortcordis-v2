# Intent - atendimento-prescricao-item-manual

Data: 2026-04-15  
Responsavel: Codex  
Status: approved

## 1) Problema atual

Na aba de prescricao do atendimento, o botao `Item manual` nao abre um editor perceptivel quando a receita ainda esta no estado inicial vazio. O clique substitui um item vazio por outro item vazio e a UI continua mostrando o estado de receita vazia, parecendo que nada aconteceu.

## 2) Objetivo

Garantir que o clique em `Item manual` abra de fato o fluxo de edicao manual da prescricao, com feedback visual claro e sem exigir que o usuario altere outro estado antes.

## 3) Nao objetivos

- Reestruturar o workspace completo de prescricoes.
- Alterar regras clinicas de calculo, sugestao de dose ou PDF.
- Modificar backend, banco ou contratos de API.

## 4) Contexto e restricoes

- Restricoes tecnicas: a correcao deve ficar restrita ao frontend de `atendimento`.
- Restricoes de prazo: precisa ser pequena o suficiente para entrar no proximo deploy de stage.
- Restricoes regulatorio/operacional: evitar regressao no fluxo clinico de prescricao durante atendimento.

## 5) Impacto esperado

- Usuarios impactados: veterinarios e equipe operacional que montam prescricoes no atendimento.
- Modulos impactados: frontend `atendimento`, workspace de prescricoes.
- Risco de regressao: baixo, concentrado no estado inicial e no reset do editor manual.

## 6) Riscos iniciais

- Risco 1: abrir o editor manual e nao resetar corretamente ao limpar o ultimo item.
- Risco 2: manter a tela em estado inconsistente ao carregar outro atendimento.

## 7) Perguntas abertas

- Pergunta 1: o time quer manter o scroll automatico para a secao de itens como comportamento padrao?
- Pergunta 2: vale adicionar teste E2E futuro para esse fluxo de prescricao?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
