# Plan - atendimento-agenda-transactional-finalization

## Etapas

- [x] Mapear commits, precificacao, geracao de OS e auditoria atuais.
- [x] Definir contratos, atomicidade, idempotencia e tratamento de legado.
- [x] Implementar as restricoes de banco e a migracao diagnostica.
- [x] Validar o vinculo com a Agenda na criacao e atualizacao.
- [x] Implementar a finalizacao transacional no backend.
- [x] Proteger a finalizacao legada quando houver Atendimento vinculado.
- [x] Adicionar a acao explicita e o tipo de horario na interface.
- [x] Corrigir o status `Realizado` para consultar o backend antes de abrir o
  Atendimento, preservando o fluxo operacional de exames.
- [x] Criar regressao de atomicidade, idempotencia, vinculo e migracao.
- [x] Executar testes direcionados e suite completa do pacote.
- [x] Executar ESLint, TypeScript e build.
- [x] Realizar smoke integrado em banco isolado.
- [x] Atualizar `verify.md` com as evidencias.
- [ ] Publicar em stage somente mediante solicitacao explicita.

## Arquivos principais

- `backend/app/api/v1/endpoints/atendimento.py`
- `backend/app/api/v1/endpoints/agenda.py`
- `backend/app/models/atendimento_clinico.py`
- `backend/app/models/ordem_servico.py`
- `backend/app/schemas/atendimento.py`
- `backend/migrations/versions/20260730_59_atendimento_agenda_transactional_finalization.py`
- `backend/tests/test_atendimento_transactional_finalization.py`
- `backend/tests/test_atendimento_transactional_finalization_migration.py`
- `backend/tests/test_fiscal_exportacao_consolidada.py`
- `frontend/app/atendimento/page.tsx`
- `frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx`

## Estrategia de verificacao

1. Testar a acao diretamente com SQLite e entidades reais.
2. Injetar falha de precificacao e confirmar rollback dos tres recursos.
3. Repetir a finalizacao e confirmar a mesma OS.
4. Testar criacao concorrente/duplicada e vinculos incompatíveis.
5. Executar a migracao em bases integras e duplicadas.
6. Rodar os testes de Agenda, Atendimento e a suite backend completa.
7. Rodar lint, TypeScript e build.
8. Executar o fluxo autenticado em copia isolada e inspecionar o banco.
9. Executar o avaliador SDD sobre o pacote.
