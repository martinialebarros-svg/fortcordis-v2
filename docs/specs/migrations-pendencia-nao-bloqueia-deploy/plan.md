# Plan - migrations-pendencia-nao-bloqueia-deploy

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel - nenhuma migration nova.
- Fase 2 (backend/API): excecao `MigrationDeferred`, runner, migration 59,
  `setup_database.py`.
- Fase 3 (frontend): nao aplicavel.
- Fase 4 (integracao/observabilidade): validacao ponta a ponta simulando o
  fluxo real de deploy com base suja.

## 2) Tarefas por fase

### Fase 1

N/A.

### Fase 2

- [x] T2.1 - `backend/migrations/exceptions.py`: `MigrationDeferred`.
- [x] T2.2 - `run_migrations()`: captura por-migration, lista de adiadas,
  `_LAST_DEFERRED`, `get_deferred_migrations()`.
- [x] T2.3 - Migration 59: `_pendencia_conciliacao` (renomeada de
  `_assert_no_duplicates`) coleta as duas pendencias antes de decidir;
  levanta `MigrationDeferred` unico com as duas mensagens.
- [x] T2.4 - `setup_database.py`: `executar_migracoes()` distingue erro
  real (retorna False) de pendencia adiada (retorna True, reporta a
  lista).
- Criterio de conclusao: suite de testes de migration passa; simulacao
  ponta a ponta (script inline) confirma 76 migrations aplicadas + 1
  adiada com base suja simulada.
- Risco: `MigrationDeferred` precisa herdar de `RuntimeError` para nao
  quebrar qualquer `except RuntimeError` existente - confirmado por teste
  dedicado (`test_migration_deferred_e_runtime_error`).
- Rollback: reverter o commit restaura o `RuntimeError` direto (comporta-
  mento anterior, com o bug).

### Fase 3

N/A.

### Fase 4

- [x] T4.1 - Simulacao ponta a ponta: base com indice unico removido +
  duplicidade inserida -> `executar_migracoes()` -> confirma migrations
  60-64 aplicadas, coluna `dose_mg_kg` e tabela `exame_ajustes` presentes,
  duplicidade preservada, `executar_migracoes()` retorna `True`.
- [x] T4.2 - Teste dedicado de que ERRO REAL (nao pendencia) continua
  abortando a esteira, incluindo migrations posteriores ao erro.
- Criterio de conclusao: os testes de T4.1/T4.2 passam
  (`test_migration_deferred_nao_bloqueia_esteira.py`, 5 testes).
- Risco: nenhum - simulacao roda em subprocess com SQLite temporario,
  isolado do banco de desenvolvimento.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: `test_atendimento_transactional_finalization_migration.py`
  (3 testes existentes renomeados de "interrompe" para "adia" + 2 novos:
  relatar as duas pendencias juntas, `MigrationDeferred` e `RuntimeError`).
- Testes de integracao: `test_migration_deferred_nao_bloqueia_esteira.py`
  (5 testes via subprocess, simulando o processo real de deploy): pendencia
  nao impede migrations seguintes, runner reporta com diagnostico
  acionavel, relatorio zera apos conciliacao, erro real continua
  abortando. Suite completa do backend (`pytest tests/ -q`).
- Testes manuais: nenhum necessario - o cenario e inteiramente de
  infraestrutura de deploy, reproduzido fielmente pelos testes de
  integracao via subprocess (mesmo `DATABASE_URL`/`SECRET_KEY` de
  ambiente que o deploy real usaria).

## 4) Dependencias e bloqueios

Nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest + subprocess).
