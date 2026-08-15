# Verificação

## Testes automatizados

- Executar `python -m unittest backend/tests/test_agenda_alteracao_servico_hoje.py`.
- Validar os cenários: admin sem confirmação recebe `409`; não-admin recebe `403`; admin confirmado troca o serviço e preserva o intervalo já iniciado.
- A massa calcula `max(agora - 2 horas, inicio do dia local)`, evitando que o cenário deixe de ser "de hoje" entre 00:00 e 01:59 em Fortaleza.
- Em 2026-08-02, durante a janela critica apos a meia-noite, os 3 testes direcionados passaram e a suite completa do backend concluiu com 528 testes aprovados e 1 ignorado.

## Frontend

- Executar lint direcionado em `app/agenda/NovoAgendamentoModal.tsx`.
- Abrir um agendamento de hoje como admin, trocar o serviço e salvar.
- Confirmar que a ação exibe `Confirmar alteração do serviço`, permite voltar e só envia a confirmação após aceite.

## Regressão operacional

- Em agendamento futuro do mesmo dia, confirmar que a duração do novo serviço continua sendo recalculada e conflitos de slot/deslocamento continuam bloqueados.
- Em agendamento de outra data, confirmar que o fluxo de edição permanece inalterado.
