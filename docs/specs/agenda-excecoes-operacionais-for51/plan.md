# Plan - agenda-excecoes-operacionais-for51

Data: 2026-05-21
Responsavel: Martiniano + Codex
Status: in-progress

## Tarefas

- [x] Implementar no modal o ramo de desfecho por papel (admin vs nao-admin).
- [x] Bloquear ajuste manual para nao-admin no ramo `sem_opcao`.
- [x] Implementar concessao explicita de excecao para admin antes de liberar data/hora manual.
- [x] Criar endpoint de persistencia estruturada para `solicitacao_excecao` e `encerramento_sem_agendamento`.
- [x] Anexar trilha textual de excecao concedida nas observacoes ao salvar agendamento.
- [x] Adicionar testes de backend para endpoint novo.
- [x] Executar lint/build/tests e consolidar evidencias no verify.
