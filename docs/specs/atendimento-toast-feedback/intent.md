# Intent - atendimento-toast-feedback

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

Na tela de atendimento, o erro ja aparece em popup, mas o feedback de sucesso ainda fica em banner discreto no topo do layout e pode passar despercebido durante fluxos longos. O resultado e feedback inconsistente: erro em modal leve e sucesso em bloco estatico.

## 2) Objetivo

Padronizar feedback operacional da tela de atendimento com toasts/popup para sucesso e erro, melhorando visibilidade imediata das acoes criticas (salvar, anexar, gerar PDF, excluir), com comportamento previsivel de auto-dismiss e opcao de fechar manualmente.

## 3) Nao objetivos

- Nao criar sistema global de notificacao para todas as paginas neste ciclo.
- Nao alterar regras de negocio de backend nem contratos de API.
- Nao redesenhar layout completo da tela de atendimento.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter `setErro` e `setSucesso` como fonte principal de mensagens neste ciclo.
- Restricoes de prazo: iteracao curta, focada em UX e previsibilidade.
- Restricoes regulatorio/operacional: mensagens devem continuar em portugues claro para uso clinico diario.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica e operacional que usa modulo de atendimento.
- Modulos impactados: `frontend/app/atendimento/page.tsx`.
- Risco de regressao: baixo a medio (toast pode esconder mensagens se timeout/config estiver inadequado).

## 6) Riscos iniciais

- Risco 1: excesso de notificacoes simultaneas durante sequencias de acoes.
- Risco 2: mensagem importante sumir cedo demais por auto-dismiss curto.

## 7) Perguntas abertas

- Pergunta 1: manter banner de sucesso e toast ao mesmo tempo?
- Resposta: nao; usar apenas toast para evitar duplicidade visual.
- Pergunta 2: usar biblioteca externa de toast nesta fase?
- Resposta: nao; implementar com padrao local existente para reduzir risco de dependencia.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
