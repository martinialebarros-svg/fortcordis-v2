# Verify - agenda-reserva-expirada-reabilitacao

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_reabilita_reserva_expirada_sem_dados_do_paciente_com_novo_prazo` — reserva sem `paciente_id`, `prazo_confirmacao_horas=6` → `status="Reservado"`, prazo entre +5h45 e +6h15, `prazo_encurtado=false` | passou |
| CA-002 | `test_reabilitacao_usa_prazo_padrao_de_tres_horas_quando_nao_informado` — prazo entre +2h45 e +3h15 | passou |
| CA-003 | `test_reabilitacao_bloqueada_quando_slot_foi_ocupado_por_outro_agendamento` — `409` "Horario indisponivel"; após rollback a reserva segue com status efetivo `Expirado` e prazo no passado | passou |
| CA-004 | `test_reabilitacao_exige_revisao_de_outra_reserva_expirada_sobreposta` — `409 CONFIRMACAO_SLOT_RESERVA_EXPIRADA` com o id da outra reserva; repetindo com `confirmar_slot_reserva_expirada=True` conclui | passou |
| CA-005 | `test_reabilitacao_recusa_agendamento_que_nao_esta_expirado` — `409` "Somente reservas expiradas" | passou |
| CA-006 | `test_prazo_encurtado_para_terminar_antes_do_horario_reservado` — início em +1h, pedido de 3h → prazo `inicio - 5min`, `encurtado=True` | passou |
| CA-007 | `test_reabilitacao_recusada_quando_horario_esta_proximo_demais` — início em +2min → `409` "proximo demais" | passou |
| CA-008 | `test_prazo_explicito_invalido_e_recusado_pela_validacao_de_reserva` — `reserva_expira_em` depois do início → `422` "anterior ao horario reservado" | passou |
| CA-009 | `agenda-reabilitar-reserva.test.ts` › `podeReabilitarReserva` | passou |
| CA-010 | `agenda-reabilitar-reserva.test.ts` › `normalizarPrazoReabilitacaoHoras` (aceita `"3"`, `"0,5"`, `72`; rejeita `""`, `"abc"`, `0.25`, `73`) | passou |
| CA-011 | `agenda-reabilitar-reserva.test.ts` › `calcularPrazoReabilitacao` (cabe / encurtado / indisponível / início desconhecido) | passou |
| CA-012 | `agenda-reabilitar-reserva.test.ts` › `parseDataHoraAgenda` | passou |
| RF-014/RF-015/RF-016 (botão, modal e confirmação nas duas telas) | revisão de código + `tsc`/`eslint`/`next build`; sem ambiente com API e dados reais nesta sessão para clique de ponta a ponta | passou (revisão de código) |

## Comandos executados

```bash
cd backend
python3 -m unittest tests.test_agenda_reabilitar_reserva_expirada
python3 -m unittest discover -s tests -t .

cd ../frontend
npx tsc --noEmit
npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx \
  lib/agenda-reabilitar-reserva.ts lib/agenda-reabilitar-reserva.test.ts --max-warnings=0
npx vitest run
npm run build
```

## Resultado - 2026-08-20

- `unittest tests.test_agenda_reabilitar_reserva_expirada`: 8 testes, OK.
- Suíte completa do backend: **846 testes, OK** (1 skip), sem regressão.
- `tsc --noEmit` e `eslint --max-warnings=0`: sem erros.
- `npx vitest run`: **80 testes** em 14 arquivos (9 novos desta feature),
  sem regressão.
- `npm run build` (`next build`): compilou e tipou sem erros.

## Riscos residuais e observações

- A parte `node --test` do script `npm test` falha neste ambiente para todos
  os arquivos `*.test.ts` de vitest (`ERR_MODULE_NOT_FOUND` ao resolver
  imports TS sem extensão) — inclusive em arquivos não tocados por esta
  feature, como `lib/agenda-shared-actions.test.ts` e `lib/racas.test.ts`.
  É pré-existente e não relacionado a esta mudança; a verificação usa
  `npx vitest run`, como nas features anteriores.
- Não houve teste de ponta a ponta com a API em execução: o clique no botão,
  a confirmação do Fortinho e o refresh da lista foram verificados por
  revisão de código, `tsc`, `eslint` e `next build`. Recomenda-se confirmar
  em stage com uma reserva realmente expirada: (1) botão aparece só no
  status `Expirado`; (2) o "Confirmar até" do modal bate com o prazo que
  volta na mensagem de sucesso; (3) o horário volta a bloquear o slot para
  outros agendamentos.
- O aviso do novo prazo para a clínica continua manual (mensagem de reserva
  pelo modal do agendamento). Se o usuário quiser disparo automático de
  WhatsApp na reabilitação, é uma feature seguinte.
