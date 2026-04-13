# Intent - atendimento-custom-exam-panels-crud

Data: 2026-04-13  
Responsavel: Codex  
Status: done

## 1) Problema atual

Na aba `Exames` do atendimento, o modal de paineis customizaveis permitia preencher nome, categoria e selecionar exames, mas a criacao falhava com erro generico. O frontend chamava `POST/PUT/DELETE /atendimentos/paineis`, porem o backend atual nao expunha esse CRUD.

## 2) Objetivo

Habilitar criacao, edicao, listagem e exclusao logica de paineis customizados de exames no modulo de atendimento, preservando o fluxo atual da tela e exibindo mensagens de erro mais claras.

## 3) Nao objetivos

- Alterar o catalogo seedado de exames/paineis padrao.
- Redesenhar o modal ou a UX de exames.
- Criar migracao nova neste ciclo.

## 4) Contexto e restricoes

- Restricoes tecnicas: reutilizar as tabelas `painel_exames` e `painel_exames_itens` ja existentes.
- Restricoes de prazo: correcao pontual com validacao rapida para destravar uso clinico.
- Restricoes regulatorio/operacional: nao quebrar a aplicacao de paineis padrao nem a solicitacao de exames existente.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica e operacional que monta paineis de exames no atendimento.
- Modulos impactados: backend `atendimento.py`, schemas de atendimento, frontend `atendimento/page.tsx`.
- Risco de regressao: medio, por tocar no mesmo endpoint grande de atendimento e na tela de exames.

## 6) Riscos iniciais

- Risco 1: colisao de codigo unico em `painel_exames.codigo`.
- Risco 2: painel customizado apagar ou editar painel seedado por engano.

## 7) Perguntas abertas

- Pergunta 1: no futuro, paineis customizados devem ficar por usuario, clinica ou globais?
- Pergunta 2: a coluna `created_by` adicionada em migracao futura deve virar filtro de ownership?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
