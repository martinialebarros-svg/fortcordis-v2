# Intent - agenda-excecao-deslocamento-persistente

Data: 2026-08-23
Responsavel: Martiniano + Claude
Status: implementado (aguardando validacao em stage)

## Problema

Fluxo real relatado pelo usuário (admin):

1. O assistente de agenda não encontrou opção aderente e o admin **concedeu a
   exceção operacional** para salvar o agendamento manualmente, aceitando que o
   deslocamento até aquele destino passa do limite de rota.
2. O agendamento seguiu como reserva, o prazo de confirmação venceu e o worker
   moveu para `Expirado`.
3. A clínica confirmou depois do prazo. O admin tentou usar
   "Agendar após confirmação tardia" (`PATCH /agenda/{id}/status`) e levou de
   volta o erro:
   *"O tempo de deslocamento entre X e Y é de aproximadamente N minutos e
   excede o limite operacional de M minutos para um trecho da rota."*

Ou seja: a exceção que o admin já havia concedido não valia nada na tentativa
seguinte.

## Causa raiz

A concessão nunca foi persistida como dado:

- `confirmar_conflito_deslocamento` é um booleano **transiente do payload**:
  `_validar_deslocamento_agendamento` (backend/app/api/v1/endpoints/agenda.py)
  só o consulta na requisição em curso e nada é gravado.
- A "exceção manual concedida por admin" que aparece nas observações é texto
  livre montado no `NovoAgendamentoModal`, e o evento
  `ASSISTENTE_AGENDA_EXCECAO_CONCEDIDA` em `auditoria_eventos` é append-only —
  nenhuma validação lê nenhum dos dois de volta.
- `PATCH /agenda/{id}/status`, usado pelo botão genérico de status (e portanto
  por "Agendar após confirmação tardia"), **nunca implementou** o parâmetro de
  confirmação que `POST /agenda`, `PUT /agenda/{id}` e
  `POST /agenda/{id}/reabilitar-reserva` já tinham. Não havia caminho algum
  para o admin passar por esse bloqueio nessa tela.
- Mesmo em `reabilitar-reserva`, onde o backend aceitava o parâmetro, o
  frontend nunca o enviava nem tratava o código `CONFLITO_DESLOCAMENTO`.

## Decisao de produto

A exceção passa a ser **persistida no agendamento** e reaplicada nas ações
seguintes, com uma trava de escopo: se horário, destino (clínica ou domicílio)
ou serviço mudarem depois da concessão, a exceção **é invalidada** e a
validação volta a rodar normalmente. Racional: a exceção foi aprovada para
aquela rota específica; manter a exceção viva depois de uma remarcação
mascararia um conflito novo, que o admin nunca avaliou.

Alternativa considerada e recusada: manter a exceção válida indefinidamente
para o agendamento (mais simples, mas silencia conflito diferente do aprovado).

## Escopo desta implementação

- Colunas `agendamentos.excecao_deslocamento_*` (quem/quando/motivo + assinatura
  da rota aprovada) e migração `20260823_75`.
- `_validar_deslocamento_agendamento` passa a aceitar a exceção persistida
  além da confirmação da requisição, e informa ao chamador qual das duas
  liberou o bloqueio.
- `PATCH /agenda/{id}/status` ganha `confirmar_conflito_deslocamento`
  (restrito a admin, como nos outros endpoints) e `motivo_excecao_deslocamento`.
- Concessão e reuso da exceção ficam registrados em `auditoria_eventos`
  (`AGENDA_EXCECAO_DESLOCAMENTO_CONCEDIDA` / `..._APLICADA`), para que aplicar
  uma exceção antiga nunca seja silencioso.
- Frontend: troca de status e reabilitação de reserva passam a tratar o 409
  `CONFLITO_DESLOCAMENTO` oferecendo a confirmação ao admin, nas duas telas de
  agenda.

## Fora de escopo

- Revogar manualmente uma exceção concedida pela UI.
- Expiração por tempo da exceção (hoje ela vive enquanto a rota aprovada
  continuar a mesma).
- Reavaliar a exceção quando um agendamento **vizinho** muda: o escopo cobre os
  campos do próprio agendamento. O evento de auditoria de reuso é a mitigação.
