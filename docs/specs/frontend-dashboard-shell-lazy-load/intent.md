# Intent - frontend-dashboard-shell-lazy-load

Data: 2026-04-14  
Responsavel: Codex  
Status: done

## 1) Problema atual

Depois da reducao de bundle das rotas `agenda/fullcalendar` e `atendimento`, o proximo alvo de performance passou a ser o shell compartilhado das paginas protegidas. O `layout-dashboard` ainda carregava logo no primeiro paint recursos opcionais como bootstrap de push notifications, tratamento de `push_snooze`, limpeza de overlays orfaos e a camada visual do `Fortinho`.

## 2) Objetivo

Reduzir o JavaScript inicial das rotas protegidas movendo efeitos e overlays opcionais do shell para chunks lazy, sem alterar autenticacao, navegacao, logout ou os fluxos existentes de agenda e notificacoes.

## 3) Nao objetivos

- Reescrever o layout protegido inteiro.
- Reduzir de forma agressiva o `First Load JS shared by all` do framework.
- Alterar contratos de backend ou permissao de notificacoes.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter compatibilidade com Next.js atual, com o `FortinhoProvider` e com os fluxos de push existentes.
- Restricoes de prazo: entrega incremental, com smoke test manual posterior.
- Restricoes operacionais: evitar regressao em login, logout, sidebar, query string de `push_snooze` e limpeza de overlays presos na UI.

## 5) Impacto esperado

- Usuarios impactados: todos os usuarios autenticados que navegam pelo dashboard e modulos protegidos.
- Modulos impactados: `frontend/app/layout-dashboard.tsx`, `frontend/components/fortinho/*`, `frontend/components/layout/*`.
- Risco de regressao: medio, porque o shell e compartilhado por varias rotas protegidas.

## 6) Riscos iniciais

- Risco 1: lazy load de bootstrap atrasar ou quebrar sincronizacao de push notifications.
- Risco 2: mover a camada visual do Fortinho quebrar avisos/confirmacoes em telas que usam `useFortinho`.
- Risco 3: extrair limpeza de overlay e `push_snooze` causar regressao silenciosa so perceptivel em casos de borda.

## 7) Perguntas abertas

- Pergunta 1: o ganho adicional restante esta mais no shell do dashboard ou ja nao compensa atacar esse nivel?
- Pergunta 2: apos este ciclo, vale priorizar tipagem/manutencao do shell ou abrir nova rodada de performance em outros modulos?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
