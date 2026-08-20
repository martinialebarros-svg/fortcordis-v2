# Plan - agenda-reserva-formalizacao-dados-pendentes

## Fase 1 - reordenar botões de status (sem dependência externa)

- [x] P1.1 `PROXIMOS_STATUS.Reservado` em `agenda-shared-actions.ts`:
  `["Agendado", "Confirmado", "Cancelado"]`;
- [x] P1.2 novo teste `agenda-shared-actions.test.ts` cobrindo a ordem
  (`obterProximosStatus` e `obterAcoesStatusPorFluxo`).

## Fase 2 - encadear aviso de dados pendentes (sem dependência externa)

- [x] P2.1 `enviarModeloAgendaPeloFortCordis` em
  `NovoAgendamentoModal.tsx`: após sucesso do envio de `reservation`,
  chama `POST /agenda/{id}/whatsapp/modelo` com `template_key:
  "appointmentMissingData"` (modelo já aprovado, só nunca era
  auto-enviado), em `try/catch` próprio para não derrubar o feedback de
  sucesso da reserva se esse segundo envio falhar;
- [x] P2.2 feedback ao usuário reflete os dois cenários (aviso enviado
  junto / aviso falhou mas reserva ok).

## Fase 3 - verificação

- [x] P3.1 `npx tsc --noEmit`, `npx eslint --max-warnings=0` (arquivos
  tocados), `npx vitest run` (69 testes, sem regressão), `npx next
  build` — todos sem erros.

## Fase 4 - novo modelo "agendamento formalizado" (bloqueada)

Não implementada nesta entrega — depende de aprovação de um novo modelo
pelo WhatsApp Business Manager (texto proposto em `intent.md`). Quando
aprovado:
- [ ] adicionar entrada no catálogo
  (`whatsapp-stage-backend/src/templates/approvedTemplates.ts` e
  `backend/app/services/whatsapp_agenda_service.py`);
- [ ] botão "Avisar que foi agendado" na tela de edição do agendamento
  existente (não só no modal de criação) — local escolhido pelo usuário;
- [ ] testes cobrindo o novo endpoint/fluxo.

## Rollback

- Fase 1: reverter a ordem do array restaura o comportamento anterior
  (cosmético, sem risco).
- Fase 2: remover a chamada encadeada restaura o comportamento anterior
  (reserva enviada sozinha, sem o aviso automático). Nenhuma migração
  envolvida em nenhuma das duas fases.
