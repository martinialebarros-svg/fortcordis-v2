# Verificação

## Testes automatizados

- Executar `python -m unittest tests.test_agenda_alteracao_servico_hoje` (a partir de `backend/`).
- Validar os cenários: admin sem confirmação recebe `409`; não-admin recebe `403` ao tentar trocar o serviço de um atendimento já iniciado; admin confirmado troca o serviço e preserva o intervalo já iniciado; não-admin troca o serviço livremente quando o atendimento de hoje ainda não começou.
- A massa do cenário "já iniciado" calcula `max(agora - 2 horas, inicio do dia local)`, evitando que o cenário deixe de representar um atendimento iniciado entre 00:00 e 01:59 em Fortaleza.
- Em 2026-08-08, os 4 testes direcionados passaram (`Ran 4 tests ... OK`), assim como a suíte mais ampla de permissões e agendamento (`test_agenda_delete_permissions`, `test_recepcao_agenda_permission_migration`, `test_secretaria_agenda_permission_migration`, `test_agenda_duracao_servico_create`, `test_agenda_concorrencia_slot`, `test_agenda_origem_domiciliar`, `test_atendimento_vinculo_agendamento_guard` — 44 testes, `OK`).

## Frontend

- `npx tsc --noEmit` no diretório `frontend/` sem erros novos.
- Abrir um agendamento já iniciado como admin, trocar o serviço e salvar.
- Confirmar que a ação exibe `Confirmar alteração do serviço`, permite voltar e só envia a confirmação após aceite.
- Como perfil secretária, abrir um agendamento de hoje cujo atendimento ainda não começou e trocar o serviço: a troca deve salvar sem exigir confirmação administrativa.

## Regressão operacional

- Em agendamento futuro do mesmo dia, confirmar que a duração do novo serviço continua sendo recalculada e conflitos de slot/deslocamento continuam bloqueados.
- Em agendamento de outra data, confirmar que o fluxo de edição permanece inalterado.
