# Intent - frontend-performance-agenda-atendimento

Data: 2026-04-13  
Responsavel: Codex  
Status: done

## 1) Problema atual

As rotas `agenda/fullcalendar` e `atendimento` estavam concentrando JavaScript demais no carregamento inicial. Isso aumentava o custo de download e execucao no navegador, principalmente em telas com grande volume de UI client-side e dependencias pesadas.

## 2) Objetivo

Reduzir o bundle inicial dessas duas rotas sem alterar comportamento funcional, priorizando carregamento sob demanda, modularizacao de UI e remocao de codigo morto que vinha se acumulando no frontend.

## 3) Nao objetivos

- Reescrever a arquitetura completa do frontend.
- Alterar contrato de API.
- Mudar layout funcional das telas alem do necessario para modularizacao.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter compatibilidade com Next.js atual e com o comportamento existente de agenda e atendimento.
- Restricoes de prazo: entrega incremental com validacao manual entre rodadas.
- Restricoes regulatorio/operacional: evitar regressao em fluxos clinicos criticos, especialmente agenda, prescricao, exames e anexos.

## 5) Impacto esperado

- Usuarios impactados: equipe que usa agenda e atendimento no navegador.
- Modulos impactados: `frontend/app/agenda/*`, `frontend/app/atendimento/*`, analyzer de bundle e checklist de performance.
- Risco de regressao: medio, porque a tela de atendimento era monolitica e foi quebrada em varios componentes lazy.

## 6) Riscos iniciais

- Risco 1: `dynamic import` atrasar UI essencial ou quebrar modais e workspaces.
- Risco 2: limpeza de codigo legado no `page.tsx` remover fechamento JSX errado ou dependencias ainda em uso.

## 7) Perguntas abertas

- Pergunta 1: o proximo gargalo sera `First Load JS shared by all` ou ainda resta ganho relevante dentro de `atendimento`?
- Pergunta 2: vale abrir um novo ciclo focado em shared chunks e paginas inteiras marcadas como `"use client"`?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
