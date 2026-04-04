# Intent - atendimento-upload-duplicate-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

Mesmo com progresso e cancelamento implementados, ainda existe risco de envio duplicado em cliques muito rapidos ou acionamentos repetidos do mesmo arquivo/contexto em janelas curtas.

## 2) Objetivo

Evitar uploads duplicados no frontend, protegendo o fluxo contra double-click e tentativas repetidas do mesmo arquivo enquanto uma requisicao equivalente estiver em andamento.

## 3) Nao objetivos

- Nao adicionar deduplicacao no backend neste ciclo.
- Nao alterar modelo de dados de anexos.
- Nao bloquear uploads diferentes e legitimos (arquivo/contexto distintos).

## 4) Contexto e restricoes

- Restricoes tecnicas: manter endpoint atual e fluxo `uploadAnexoArquivo`.
- Restricoes de prazo: iteracao curta somente frontend.
- Restricoes regulatorio/operacional: feedback claro quando tentativa duplicada for bloqueada.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica no modulo atendimento.
- Modulos impactados: `frontend/app/atendimento/page.tsx`.
- Risco de regressao: baixo a medio (regra de deduplicacao pode bloquear caso legitimo se assinatura ficar ampla demais).

## 6) Riscos iniciais

- Risco 1: falso positivo de duplicidade para arquivos distintos com mesmo nome.
- Risco 2: bloqueio permanecer apos falha/cancelamento por cleanup incompleto.

## 7) Perguntas abertas

- Pergunta 1: assinatura de duplicidade deve incluir `nome+tamanho+lastModified+contexto`?
- Pergunta 2: ao bloquear duplicado, mensagem deve ser erro ou aviso neutro?

Respostas desta iteracao:
- Usar assinatura `contexto + nome + tamanho + lastModified`.
- Retornar aviso neutro de operacao em andamento (sem toast de erro vermelho).

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
