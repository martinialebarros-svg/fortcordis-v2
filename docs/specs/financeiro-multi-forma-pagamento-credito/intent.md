# Intent - financeiro-multi-forma-pagamento-credito

Data: 2026-05-25  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Problema atual

O fluxo financeiro de recebimento da Ordem de Servico (OS) era limitado a forma unica de pagamento, sem estrutura para taxa por adquirente/bandeira e sem governanca de credito para cliente/clinica no mesmo ato de recebimento.

## 2) Objetivo

Habilitar recebimento multiplo por OS com calculo de taxa por forma, registro auditavel de excedente em credito e visualizacao desses impactos nos modulos operacionais e relatorios financeiros.

## 3) Nao objetivos

- Implementar conciliacao bancaria automatica.
- Implementar parcelamento com cronograma D+N por adquirente.
- Implementar consumo automatico de credito fora do fluxo de recebimento da OS.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter compatibilidade com payload legado de recebimento (`forma_pagamento` unica).
- Restricoes de prazo: entrega incremental em `stage` com smoke operacional.
- Restricoes regulatorio/operacional: alteracoes em cadastro de meios de pagamento exigem papel admin e trilha de auditoria.

## 5) Impacto esperado

- Usuarios impactados: secretaria, financeiro e administradores.
- Modulos impactados: Agenda Lista, FullCalendar, Financeiro, Relatorios, endpoints de OS e Financeiro.
- Risco de regressao: medio (recebimento de OS e fluxo de desfazer recebimento).

## 6) Riscos iniciais

- Risco 1: divergencia de comportamento entre os 3 modais de recebimento.
- Risco 2: inconsistencias no saldo de credito ao desfazer recebimentos.

## 7) Perguntas abertas

- Deve existir permissao dedicada para usar credito no recebimento, separada de admin?
- O consumo de credito deve aceitar prioridade por paciente ou por tutor quando ambos existirem?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
