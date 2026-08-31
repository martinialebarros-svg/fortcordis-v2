# Especificação - PERF-12: paginação SQL da fila de Laudos

## Contrato preservado

`GET /laudos/pendentes` continua aceitando `skip` e `limit` e retorna
`{ total, items }`. Cada item preserva identificadores, tipo, estado de
rascunho, urgência, nomes de apoio e indicadores de prazo.

## Regras funcionais

- A fonte clínica inclui exames de agendamentos `Realizado` sem laudo ou com
  laudo em rascunho.
- A fonte da Agenda inclui agendamentos `Realizado` sem Atendimento Clínico,
  conforme os tipos previstos para o serviço, inclusive combos.
- Um laudo finalizado exclui apenas seu tipo correspondente da fonte Agenda;
  o rascunho mais recente continua disponível para edição.
- A ordem prioriza urgência e, em seguida, a data de referência mais antiga.
- Somente os itens da página recebem hidratação de paciente/tutor/clínica e
  cálculo de horas úteis.

## Critérios de aceitação

- Nenhuma lista integral é montada e recortada em memória.
- A consulta paginada inclui `LIMIT` e `OFFSET`; `total` permanece exato.
- A segunda página não repete itens da primeira e a ordenação é estável.
- Testes existentes das duas fontes e dos combos continuam verdes.
