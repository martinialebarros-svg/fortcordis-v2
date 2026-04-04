# Intent - atendimento-upload-progress

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

O envio de anexos na tela de atendimento mostra apenas estado "Enviando..." sem progresso percentual. Em arquivos maiores, o usuario pode interpretar como travamento e repetir acao em outros blocos de upload.

## 2) Objetivo

Adicionar feedback de progresso de upload (0-100%) e comportamento consistente de bloqueio durante envio para reduzir ansiedade operacional e evitar tentativas duplicadas.

## 3) Nao objetivos

- Nao alterar validacoes de tipo/tamanho ja aprovadas no upload hardening.
- Nao criar upload multiplo em lote neste ciclo.
- Nao alterar contratos de API/backend.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter fluxo com `FormData` e endpoint atual de upload.
- Restricoes de prazo: iteracao curta, focada em UX e previsibilidade.
- Restricoes regulatorio/operacional: mensagens claras em portugues para uso clinico.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica que anexa arquivos de exames e documentos.
- Modulos impactados: `frontend/app/atendimento/page.tsx`.
- Risco de regressao: baixo a medio (estado de loading/progresso pode conflitar com UX atual).

## 6) Riscos iniciais

- Risco 1: progresso nao chegar a 100% em redes lentas por falta de `total` reportado.
- Risco 2: bloquear a area errada e impedir operacao paralela legitima.

## 7) Perguntas abertas

- Pergunta 1: mostrar progresso apenas no botao ou tambem em barra visual?
- Pergunta 2: upload geral e upload por exame podem ocorrer em paralelo neste ciclo?

Respostas desta iteracao:
- Mostrar nos dois formatos: texto no botao e barra no card.
- Manter uma operacao de upload ativa por vez, reaproveitando `uploadingAttachmentKey`.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
