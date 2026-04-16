# Intent - agenda-open-current-day

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Problema atual

Ao abrir a tela `frontend/app/agenda/page.tsx` na visualizacao de lista, o filtro de data iniciava vazio. Isso fazia a consulta inicial cair no fluxo sem intervalo fechado do dia, contrariando a expectativa operacional de ver primeiro os agendamentos do dia corrente.

## 2) Objetivo

Garantir que a agenda abra ja posicionada no dia atual e carregue os agendamentos dessa data logo no primeiro acesso, reduzindo atrito para a equipe operacional.

## 3) Nao objetivos

- Alterar contratos do backend de agenda.
- Mudar a experiencia da visao panoramica semanal.
- Introduzir novos filtros ou preferencias persistidas por usuario.

## 4) Contexto e restricoes

- Restricoes tecnicas: a mudanca deve ser restrita ao frontend existente, sem exigir novos endpoints.
- Restricoes de prazo: precisa ser pequena e segura para destravar deploy imediato em `stage`.
- Restricoes regulatorio/operacional: nao pode esconder navegacao manual entre datas nem alterar a listagem fora do contexto da data selecionada.

## 5) Impacto esperado

- Usuarios impactados: equipe que usa a agenda no dia a dia.
- Modulos impactados: `frontend/app/agenda/page.tsx`.
- Risco de regressao: baixo, concentrado na logica de filtro inicial e navegacao de data.

## 6) Riscos iniciais

- Risco 1: a tela continuar enviando consulta sem `data_inicio` e `data_fim` quando a lista abrir.
- Risco 2: limpar manualmente o campo de data gerar estado inconsistente no filtro.

## 7) Perguntas abertas

- Pergunta 1: nenhuma para este ciclo.
- Pergunta 2: preferencia persistida de data por usuario fica fora deste escopo.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
