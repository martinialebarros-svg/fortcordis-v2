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
