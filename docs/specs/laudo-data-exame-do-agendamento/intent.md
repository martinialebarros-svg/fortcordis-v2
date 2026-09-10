# Intent - laudo-data-exame-do-agendamento

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema atual

Ao abrir o upload de exame a partir de um agendamento
(`/laudos/eletrocardiograma/upload?agendamento_id=<id>`), o campo
"Data de realizacao" vem preenchido com a data de hoje, e nao com a data em que
o exame foi agendado.

A causa esta na ordem dos efeitos da pagina. O efeito de montagem ja semeia
`dataExame` com `getTodayDateInput()`; quando o `GET /agenda/{id}` responde, o
efeito do agendamento usa `setDataExame((current) => current || ...)` e, como
`current` ja tem a data de hoje, a data agendada e descartada. O default do
agendamento nunca chega a ser aplicado.

Na pratica isso vale para todo exame carregado com atraso em relacao ao dia da
realizacao: o laudo nasce com a data errada e so fica correto se alguem lembrar
de ajustar o campo manualmente.

O fluxo estruturado (`/laudos/novo`, ecocardiograma e pressao arterial) ja
prioriza a data do agendamento, mas escreve `agendamento.data` cru no
`<input type="date">`, sem normalizar e sem cair para `inicio` quando `data`
vem vazia.

## 2) Objetivo

Com agendamento vinculado, "Data de realizacao" nasce com a data agendada.
Sem agendamento (telemedicina, upload avulso), continua nascendo com a data do
dia.

## 3) Nao objetivos

- Nao travar o campo: a data continua editavel manualmente em qualquer caso.
- Nao mexer no backend, no contrato de `POST /laudos/eletrocardiograma/upload-pdf`
  nem em `GET /agenda/{id}`.
- Nao alterar o fluxo de ultrassonografia abdominal, que ja aplica
  `agendamento.data` corretamente.
- Nao derivar data de exame a partir de `atendimento_id` (o atendimento e do
  dia; hoje ja e a resposta certa nesse caminho).

## 4) Contexto e restricoes

- `GET /agenda/{id}` devolve `data` ("YYYY-MM-DD", derivada de `inicio` quando
  o registro nao tem o campo) e `inicio` ("YYYY-MM-DD HH:MM:SS", horario local
  de Fortaleza).
- `calendarDateInput` preserva a data-calendario de valores date-only e de
  meia-noite; para datetimes sem timezone ele assume UTC e converte para
  America/Fortaleza, o que desloca o dia em horarios da madrugada. Por isso
  `data` deve ser preferida a `inicio`, que fica so como fallback.
- Se `GET /agenda/{id}` falhar, o campo nao pode ficar vazio.
