# Intent - atendimento-upload-cancel-retry

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

Com progresso de upload ja visivel, ainda falta controle operacional para interromper envio em andamento. Quando o usuario seleciona arquivo errado ou percebe atraso anormal, ele precisa aguardar fim/erro para tentar novamente.

## 2) Objetivo

Adicionar cancelamento explicito de upload em andamento e permitir reenvio imediato, reduzindo tempo perdido e friccao no fluxo de anexos.

## 3) Nao objetivos

- Nao implementar fila de uploads paralelos.
- Nao alterar endpoint/backend de upload.
- Nao criar historico de tentativas de upload neste ciclo.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter `uploadingAttachmentKey` como trava principal de um upload por vez.
- Restricoes de prazo: iteracao curta somente em frontend.
- Restricoes regulatorio/operacional: mensagens claras em portugues e sem ambiguidade para equipe clinica.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica no modulo de atendimento.
- Modulos impactados: `frontend/app/atendimento/page.tsx`.
- Risco de regressao: baixo a medio (gerenciamento de estado de cancelamento e progresso).

## 6) Riscos iniciais

- Risco 1: estado preso apos cancelamento (botao continuar desabilitado).
- Risco 2: cancelar upload e limpar contexto errado quando houver alternancia rapida entre blocos.

## 7) Perguntas abertas

- Pergunta 1: cancelar deve aparecer como erro ou confirmacao neutra?
- Pergunta 2: manter arquivo selecionado apos cancelamento para reenvio rapido?

Respostas desta iteracao:
- Cancelamento sera exibido como confirmacao de sucesso neutra (`Upload cancelado.`).
- Arquivo selecionado sera mantido para facilitar reenvio imediato.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
