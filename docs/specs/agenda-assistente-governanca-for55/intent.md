# Intent - agenda-assistente-governanca-for55

Data: 2026-05-26  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Problema atual

O modulo de agenda precisava equilibrar duas necessidades operacionais:
- manter o fluxo guiado sem bypass precoce para secretaria;
- permitir excecoes controladas quando o cenario real nao cabe nas ofertas (incluindo lancamento retroativo).

Sem essa governanca unificada, havia risco de divergencia entre assistente inteligente, assistente guiado e salvamento final.

## 2) Objetivo

Consolidar governanca do assistente de agendamento para:
- garantir consistencia das regras de oferta e bloqueios;
- reforcar autorizacao por papel para excecoes;
- manter trilha auditavel de decisoes;
- viabilizar casos operacionais legitimos (como cadastro retroativo por admin).

## 3) Nao objetivos

- Criar dashboard visual novo de metricas (somente endpoint nesta fase).
- Redesenhar integralmente a UX da agenda fora do fluxo de assistente.
- Alterar politica comercial de roteirizacao alem das regras definidas para FOR-55.

## 4) Contexto e restricoes

- Restricoes tecnicas: frontend Next.js/React e backend FastAPI; manter compatibilidade com endpoints legados.
- Restricoes de prazo: ciclo de estabilizacao com entregas incrementais em stage.
- Restricoes regulatorio/operacional: excecoes sensiveis devem respeitar papel admin e deixar auditoria.

## 5) Impacto esperado

- Usuarios impactados: secretaria, administradores e coordenacao operacional.
- Modulos impactados: modal de agenda, orquestrador de ofertas, auditoria/metricas.
- Risco de regressao: medio (fluxos de excecao e regras de bloqueio).

## 6) Riscos iniciais

- Risco 1: regra excessivamente rigida bloquear casos reais de operacao.
- Risco 2: regra excessivamente flexivel abrir bypass indevido do fluxo guiado.

## 7) Perguntas abertas

- Deve existir tela dedicada para listar lancamentos retroativos por periodo?
- Qual SLA de revisao para solicitacoes de excecao registradas por nao-admin?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
