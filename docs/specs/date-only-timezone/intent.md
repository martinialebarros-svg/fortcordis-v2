# Intent - date-only-timezone

Data: 2026-08-02
Responsavel: Equipe Fort Cordis
Status: approved

## 1) Problema atual

Campos que representam somente uma data podiam ser convertidos como instantes UTC no navegador. Em Fortaleza, um exame selecionado para o dia 25 podia ser mostrado como dia 24 depois do salvamento.

## 2) Objetivo

Garantir que a data selecionada para exame, laudo e outros campos de calendario seja preservada em toda a jornada: entrada, API, armazenamento, listas, documentos e portais.

## 3) Nao objetivos

- Nao alterar horarios reais de agenda, auditoria, login, sessao ou liberacao de laudo.
- Nao migrar registros historicos no banco nem alterar o schema.
- Nao alterar regras clinicas de liberacao de laudo.

## 4) Contexto e restricoes

- Restricao tecnica: diferenciar semanticamente data sem horario de timestamp no frontend e no backend.
- Restricao operacional: usar `America/Fortaleza` como fuso da operacao.
- Restricao de seguranca: preservar a rastreabilidade de horarios reais em auditoria e portais.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica, clinicas parceiras, veterinarios parceiros e tutores.
- Modulos impactados: laudos, portais, financeiro, fiscal, pacientes, configuracoes e ultrassonografia.
- Risco de regressao: medio, pois uma conversao generica pode afetar campos que tem horario real.

## 6) Riscos iniciais

- Risco 1: tratar timestamp real como data de calendario e esconder horario operacional.
- Risco 2: registros legados em meia-noite UTC continuarem com um dia incorreto na interface.
- Risco 3: uma tela nova voltar a usar `new Date("YYYY-MM-DD")` sem o helper central.

## 7) Definition of Ready

- [x] Sintoma confirmado com laudo de eletrocardiograma.
- [x] Regra de data operacional definida.
- [x] Escopo de timestamps que nao devem ser alterados definido.
- [x] Plano de validacao local e de stage definido.
