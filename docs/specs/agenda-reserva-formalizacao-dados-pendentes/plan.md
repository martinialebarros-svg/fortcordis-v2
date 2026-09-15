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

## Fase 3b - remover validação que bloqueava o caso de uso real (bug crítico)

Usuário reportou, após a Fase 2 estar no ar, que reservas reais para
clínicas ("Lá no Pet", "Pet do Parque") chegavam de verdade no WhatsApp
mas nunca apareciam na Central de Atendimento. Reprodução guiada revelou
que `build_reservation_template`/`build_agenda_utility_template` exigiam
paciente+tutor já vinculados para QUALQUER envio — inclusive para
`appointmentMissingData`, que existe justamente para pedir esses dados
quando eles NÃO existem ainda.

- [x] P3b.1 novo helper `_resolver_paciente_tutor_opcionais` — busca
  paciente/tutor sem exigir que existam; só erro se a referência for
  órfã (aponta pra registro inexistente) ou se paciente/tutor vinculados
  forem inconsistentes entre si;
- [x] P3b.2 `build_reservation_template` usa o helper; placeholder
  `"seu pet"` quando paciente ausente; ainda exige tutor quando
  `recipient_type == "tutor"`;
- [x] P3b.3 `build_agenda_utility_template`: relaxação só para
  `template_key == "appointmentMissingData"`; outros modelos mantêm a
  validação estrita original;
- [x] P3b.4 preview do frontend (`obterMensagemAgendaAtual`) usa o mesmo
  placeholder para os mesmos dois modelos, mantendo consistência com o
  que será enviado de fato;
- [x] P3b.5 4 novos testes em `test_whatsapp_agenda_service.py` cobrindo
  os dois builders com/sem paciente-tutor e os dois tipos de
  destinatário; suíte completa do backend (820 testes) sem regressão.

## Fase 4 - novo modelo "agendamento formalizado"

Continuada em `docs/specs/agenda-formalizacao-portal-clinicas/` — o
modelo `agendamento_formalizado` foi submetido à Meta (texto proposto
neste `intent.md`, status "Em análise") e o catálogo/parâmetros já
estão implementados; em vez de um botão manual na tela de edição, o
disparo agora é automático (clínica preenche os dados via o link do
Portal Clínicas → sistema envia `appointmentFormalized` sozinho).

## Rollback

- Fase 1: reverter a ordem do array restaura o comportamento anterior
  (cosmético, sem risco).
- Fase 2: remover a chamada encadeada restaura o comportamento anterior
  (reserva enviada sozinha, sem o aviso automático). Nenhuma migração
  envolvida em nenhuma das duas fases.
