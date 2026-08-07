# Verify - migrations-pendencia-nao-bloqueia-deploy

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | test_migration_deferred_nao_bloqueia_esteira.py::test_pendencia_de_dados_nao_impede_migracoes_seguintes | ok |
| CA-002 | aceitacao | mesmo teste - `duplicatas == 2` apos a execucao (nada apagado/alterado) | ok |
| CA-003 | aceitacao | test_migration_deferred_nao_bloqueia_esteira.py::test_apos_conciliacao_a_versao_adiada_entra_no_proximo_deploy | ok |
| CA-004 | aceitacao | test_migration_deferred_nao_bloqueia_esteira.py::test_erro_real_continua_abortando_a_esteira | ok |
| CA-005 | aceitacao | test_migration_deferred_nao_bloqueia_esteira.py::test_relatorio_de_adiadas_zera_apos_a_conciliacao | ok |
| CA-006 | aceitacao | validacao ponta a ponta manual (script inline chamando `setup_database.executar_migracoes()` com base suja) - ver secao 3 | ok |
| CA-007 | aceitacao | test_atendimento_transactional_finalization_migration.py::test_upgrade_relata_as_duas_pendencias_de_uma_vez | ok |
| CB-001 | caso de borda | suite completa do backend (649 testes) roda contra base limpa sem nenhuma pendencia reportada | ok |
| CB-002 | caso de borda | `test_migration_ci_cycle.py` (base vazia, ciclo up/down/up completo) continua passando | ok |
| NFR-001 | consistencia | teste confirma `duplicatas == 2` (nenhum registro alterado) | ok |
| NFR-002 | idempotencia | test_apos_conciliacao_a_versao_adiada_entra_no_proximo_deploy confirma reexecucao limpa | ok |
| NFR-003 | observabilidade | mensagem inclui "agendamento 4242: ids 1,2" no teste de integracao | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
./venv/bin/python -m pytest tests/test_atendimento_transactional_finalization_migration.py \
  tests/test_migration_deferred_nao_bloqueia_esteira.py \
  tests/test_migration_ci_cycle.py -q --no-header

./venv/bin/python -m pytest tests/ -q --no-header
```

Resumo dos resultados:
- Backend (arquivos da feature): 11 passed, 0 failed.
- Backend (suite completa): 649 passed, 0 failed (baseline antes desta
  feature: 642 passed - os +7 desta feature sao 2 testes renomeados +
  novos em `test_atendimento_transactional_finalization_migration.py` e 5
  em `test_migration_deferred_nao_bloqueia_esteira.py`).
- Frontend: N/A (sem mudanca de frontend nesta feature).

## 3) Testes manuais

Validacao ponta a ponta simulando o fluxo real de deploy (nao um teste
automatizado formal, mas execucao manual do caminho completo):

```bash
# base suja: indice unico removido + 2 atendimentos duplicados no mesmo agendamento
# executar_database.executar_migracoes() chamado como o deploy real chamaria
```

Resultado observado:
- `executar_migracoes()` retornou `True` (nao interrompeu o boot).
- 76 migrations aplicadas; migration 20260730_59 ficou em
  `pending_versions` (adiada, nao aplicada, nao registrada como erro).
- Migrations 60 a 64 (posteriores a 59 na ordem) TODAS aplicadas:
  coluna `dose_mg_kg` presente em `prescricoes_itens`, tabela
  `exame_ajustes` presente.
- As 2 linhas duplicadas em `atendimentos_clinicos` permaneceram intactas
  (nenhuma apagada para "resolver" a pendencia).

## 4) Regressao e riscos residuais

- Risco residual 1: a logica de deteccao de duplicidade
  (`STRING_AGG`/`GROUP_CONCAT` por dialeto) so foi exercitada contra
  SQLite nesta sessao - o ambiente de desenvolvimento local nao tem
  Postgres disponivel. A sintaxe SQL usada e a mesma que ja existia antes
  desta feature (nao foi alterada), reduzindo o risco de regressao
  especifica de dialeto.
- Risco residual 2: nao ha alertagem externa (Slack/email) quando uma
  migration fica adiada em producao - o unico sinal e o log do processo de
  deploy e o campo `pending_versions` de `get_migration_status()` (que ja
  alimenta o aviso de runtime existente em `runtime_checks.py`).

## 5) Itens fora de escopo entregues

- Nenhum item fora do escopo combinado foi entregue.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
