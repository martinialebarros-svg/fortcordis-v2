# Verify - agenda-reserva-formalizacao-dados-pendentes

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `agenda-shared-actions.test.ts`: `obterProximosStatus("Reservado")` retorna `["Agendado", "Confirmado", "Cancelado"]` | passou |
| CA-002 | mesmo arquivo: índice de "Agendado" menor que o de "Confirmado" em `obterAcoesStatusPorFluxo` | passou |
| CA-003 | revisão de código: `enviarModeloAgendaPeloFortCordis` chama `POST .../whatsapp/modelo` com `template_key: "appointmentMissingData"` logo após o `POST .../whatsapp/reserva` bem-sucedido | passou (revisão de código; sem credenciais reais da Graph API neste ambiente para testar envio de ponta a ponta) |
| CA-004 | revisão de código: chamada do aviso está em `try/catch` isolado, `avisoDadosPendentesEnviado` controla só o texto do feedback, não o `envioAutomaticoStatus` | passou (revisão de código) |

## Comandos executados

```bash
cd frontend
npx tsc --noEmit
npx eslint app/agenda/NovoAgendamentoModal.tsx lib/agenda-shared-actions.ts lib/agenda-shared-actions.test.ts --max-warnings=0
npx vitest run
npx next build
```

## Resultado - 2026-08-19

- `tsc --noEmit`, `eslint --max-warnings=0`: sem erros.
- `vitest run`: 69 testes passaram (2 novos desta feature, sem
  regressão nos 67 já existentes).
- `next build`: passou.

Risco residual: o envio automático do aviso de dados pendentes não foi
testado de ponta a ponta contra a Graph API real neste ambiente (sem
token válido localmente) — só revisão de código e verificação dos
testes unitários da lógica de estado. Recomenda-se o usuário confirmar
em stage/produção que as duas mensagens chegam encadeadas na próxima
reserva real enviada.

## Bug crítico corrigido: validação bloqueava o caso de uso real - 2026-08-19

Usuário reproduziu com precisão em produção: (1) reserva com
paciente/tutor preenchidos → mensagem sai; (2) reserva SEM preencher
paciente/tutor → modal mostra erro "Cadastre e vincule o animal e o
tutor..." e nada é enviado. Esse é exatamente o caso de uso que ele quer
suportar (reservar o horário antes de saber quem é o paciente).

- `test_build_reservation_template_aceita_reserva_sem_paciente_tutor_vinculados`:
  `recipient_type="clinica"`, paciente/tutor nulos → sucesso,
  `pet_name == "seu pet"`. Passou.
- `test_build_reservation_template_exige_tutor_quando_destinatario_e_tutor`:
  `recipient_type="tutor"`, tutor nulo → `409`. Passou.
- `test_build_agenda_utility_template_missing_data_aceita_sem_paciente_tutor`:
  `template_key="appointmentMissingData"`, paciente/tutor nulos →
  sucesso, `parameters[1] == "seu pet"`. Passou.
- `test_build_agenda_utility_template_outros_modelos_continuam_exigindo_paciente_tutor`:
  `template_key="appointmentReminder"`, paciente/tutor nulos → `409`
  (comportamento antigo preservado para os modelos que realmente
  precisam do paciente já identificado). Passou.
- Suíte completa do backend: 820 testes (4 novos), sem regressão.
- Frontend: `tsc --noEmit`, `eslint --max-warnings=0`, `vitest run` (69
  testes), `next build` — todos sem erros, após aplicar o mesmo
  placeholder no preview da mensagem.

Risco residual: não foi possível testar de ponta a ponta contra a Graph
API real (token indisponível neste ambiente) que o texto final
("...reservou o atendimento de seu pet para...") fica gramaticalmente
aceitável em português — recomenda-se o usuário conferir o texto exato
na próxima reserva real sem paciente vinculado.
