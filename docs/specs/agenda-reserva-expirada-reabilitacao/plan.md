# Plan - agenda-reserva-expirada-reabilitacao

## Fase 1 - backend: endpoint de reabilitação

- [x] P1.1 constantes do prazo em `app/api/v1/endpoints/agenda.py`
  (`PRAZO_REABILITACAO_RESERVA_HORAS_PADRAO/MIN/MAX`,
  `MARGEM_MINIMA_PRAZO_RESERVA_MIN`);
- [x] P1.2 `ReabilitarReservaPayload` (horas, prazo explícito, as duas
  confirmações) junto aos demais payloads do módulo;
- [x] P1.3 helper `_calcular_prazo_reabilitacao_reserva` — resolve o prazo em
  horário local, encurta para `inicio - 5 min` quando o pedido não cabe e
  recusa (409) horário próximo demais;
- [x] P1.4 endpoint `POST /agenda/{id}/reabilitar-reserva`: exige status
  `Expirado`, aplica o novo prazo, reaplica as validações de origem, prazo,
  funcionamento, slot e deslocamento, grava com `_commit_agenda_write`,
  audita `AGENDAMENTO_RESERVA_REABILITADA` e emite realtime
  `status_changed`;
- [x] P1.5 mensagem do guard `_exigir_confirmacao_reativacao_reserva_expirada`
  passa a citar o botão novo (o caminho `Expirado → Agendado` continua igual).

## Fase 2 - frontend: helpers compartilhados

- [x] P2.1 `frontend/lib/agenda-reabilitar-reserva.ts` com
  `podeReabilitarReserva`, `normalizarPrazoReabilitacaoHoras`,
  `parseDataHoraAgenda` e `calcularPrazoReabilitacao` (espelha as regras do
  backend para o preview do modal);
- [x] P2.2 `frontend/lib/agenda-reabilitar-reserva.test.ts` cobrindo faixa de
  horas, parsing da data da API, prazo normal, prazo encurtado e horário
  indisponível.

## Fase 3 - frontend: botão e modal nas duas telas de agenda

- [x] P3.1 `/agenda` (lista): botão "Reabilitar reserva" no card de
  agendamentos `Expirado`, modal com o campo de horas + "Confirmar até",
  tratamento de `CONFIRMACAO_SLOT_RESERVA_EXPIRADA` via `fortinho.confirm`
  e feedback de sucesso via `fortinho.notify`;
- [x] P3.2 `/agenda/fullcalendar`: mesmo botão no painel do agendamento
  selecionado, mesmo modal, sucesso em `mensagemStatus` e erro em `erro`
  (idioma da tela).

## Fase 4 - verificação

- [x] P4.1 novo `backend/tests/test_agenda_reabilitar_reserva_expirada.py`
  (8 testes) + suíte completa do backend;
- [x] P4.2 frontend: `tsc --noEmit`, `eslint --max-warnings=0` nos arquivos
  tocados, `vitest run`, `next build`.

## Rollback

- Frontend: remover o botão/modal das duas telas (ou só esconder o botão)
  volta ao comportamento anterior; os helpers novos ficam sem uso.
- Backend: o endpoint é aditivo — nenhuma coluna nova, nenhuma migração.
  Removê-lo (e reverter a mensagem do guard) restaura o estado anterior, em
  que `Expirado` só podia ir para `Agendado` com dados de paciente/tutor.
- Reservas já reabilitadas continuam válidas como qualquer outra reserva
  (status `Reservado` + `reserva_expira_em`), inclusive para o worker de
  expiração.
