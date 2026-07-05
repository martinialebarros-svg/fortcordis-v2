# Intent - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Problema atual

Alguns laudos finais, como eletrocardiograma, podem ser emitidos fora do Fort Cordis e enviados manualmente para a clinica parceira. Esse fluxo deixa o portal da clinica sem um caminho padronizado para disponibilizar o PDF baixavel quando o exame nao foi gerado pelo modulo interno de laudos.

## 2) Objetivo

Permitir que a equipe Fort Cordis anexe o PDF final ao exame do atendimento e libere esse arquivo no portal da clinica parceira com uma acao explicita.

## 3) Resultado esperado

- Exames externos com PDF anexado podem ser publicados no portal da clinica.
- Eletrocardiogramas aparecem como `Eletrocardiograma`, sem mencionar origem de software externo.
- A liberacao continua respeitando escopo por clinica, paciente e status liberado.
- Exames sem PDF nao podem ser liberados.

## 4) Nao objetivos

- Nao integrar automaticamente com softwares externos.
- Nao alterar o fluxo atual de upload de anexos do atendimento.
- Nao criar fluxo de revogacao nesta iteracao.
