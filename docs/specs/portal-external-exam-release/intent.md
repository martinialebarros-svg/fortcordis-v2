# Intent - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Problema atual

Alguns laudos finais, como eletrocardiograma, podem ser emitidos fora do Fort Cordis e enviados manualmente para a clinica parceira. Esse fluxo deixa o portal da clinica sem um caminho padronizado para disponibilizar o PDF baixavel quando o exame nao foi gerado pelo modulo interno de laudos.

No uso de telemedicina, esse problema fica maior: o tracado chega sem agendamento previo e o operador pode descobrir, no momento do upload, que tutor e pet ainda nao estao cadastrados. Nessa situacao, sair do fluxo para abrir outra tela atrasa a operacao e aumenta a chance de erro de vinculo.

## 2) Objetivo

Permitir que a equipe Fort Cordis envie o PDF final pelo dropdown `Laudar`, registre esse arquivo como laudo de `Eletrocardiograma` e libere o download no portal da clinica parceira a partir de `Laudos`.

Quando o upload acontecer sem agendamento, o mesmo fluxo deve permitir selecionar a clinica parceira, buscar um paciente ja cadastrado ou cadastrar tutor e pet sem sair da tela.

## 3) Resultado esperado

- PDFs externos de eletrocardiograma podem ser registrados como laudos.
- Eletrocardiogramas aparecem como `Eletrocardiograma`, sem mencionar origem de software externo.
- A liberacao continua respeitando escopo por clinica, paciente e status liberado.
- A liberacao reutiliza o PDF original enviado.
- O fluxo de telemedicina nao depende de agendamento previo para vincular clinica, tutor e pet.
- Se tutor e pet ainda nao existirem, o operador consegue cria-los no mesmo upload.

## 4) Nao objetivos

- Nao integrar automaticamente com softwares externos.
- Nao alterar o fluxo atual de upload de anexos do atendimento.
- Nao criar fluxo de revogacao nesta iteracao.
