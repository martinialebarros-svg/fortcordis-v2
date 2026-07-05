# Intent - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Problema atual

Alguns laudos finais, como eletrocardiograma, podem ser emitidos fora do Fort Cordis e enviados manualmente para a clinica parceira. Esse fluxo deixa o portal da clinica sem um caminho padronizado para disponibilizar o PDF baixavel quando o exame nao foi gerado pelo modulo interno de laudos.

## 2) Objetivo

Permitir que a equipe Fort Cordis envie o PDF final pelo dropdown `Laudar`, registre esse arquivo como laudo de `Eletrocardiograma` e libere o download no portal da clinica parceira a partir de `Laudos`.

## 3) Resultado esperado

- PDFs externos de eletrocardiograma podem ser registrados como laudos.
- Eletrocardiogramas aparecem como `Eletrocardiograma`, sem mencionar origem de software externo.
- A liberacao continua respeitando escopo por clinica, paciente e status liberado.
- A liberacao reutiliza o PDF original enviado.

## 4) Nao objetivos

- Nao integrar automaticamente com softwares externos.
- Nao alterar o fluxo atual de upload de anexos do atendimento.
- Nao criar fluxo de revogacao nesta iteracao.
