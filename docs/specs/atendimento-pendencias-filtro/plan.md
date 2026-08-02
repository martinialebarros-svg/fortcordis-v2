# Plan - atendimento-pendencias-filtro

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): extrair calculo puro, condicao SQL equivalente, novo
  parametro e novo campo em `listar_atendimentos`.
- Fase 3 (frontend): checkbox de filtro e badge por item.
- Fase 4 (integracao/observabilidade): testes novos, suite completa,
  smoke HTTP, lint/tsc/build.

## 2) Tarefas por fase

### Fase 2

- [x] T2.1 Extrair `_calcular_pendencias_documentacao` de
  `_validar_primeira_conclusao_atendimento` (mesma logica, sem gating de
  status nem raise).
- [x] T2.2 `_condicao_sql_documentacao_incompleta` com `trim(coalesce(...))`
  por campo e `and_`/`or_` nos 3 grupos.
- [x] T2.3 `listar_atendimentos`: parametro `documentacao_incompleta`,
  filtro combinado com `status == "Concluido"`.
- [x] T2.4 Campo `documentacao_pendencias` em cada item, calculado a partir
  dos campos ja carregados (sem query extra), so quando `status ==
  "Concluido"`.
- Criterio de conclusao: filtro e campo funcionam, sem N+1.
- Risco: divergencia entre a condicao SQL e o calculo Python.
- Rollback: reverter o commit.

### Fase 3

- [x] T3.1 Estado `documentacaoIncompletaFiltro`, incluido em
  `carregarLista`/`limparFiltrosLista`.
- [x] T3.2 Checkbox no painel de filtros.
- [x] T3.3 Badge amber no card do item, com tooltip das pendencias.
- Criterio de conclusao: ESLint, `tsc --noEmit`, `npm run build` aprovados.
- Risco: nenhum.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `test_atendimento_documentacao_incompleta_filtro.py` novo: filtro,
  campo por item, atendimento aberto nao sinaliza, combinacao com `status`.
- [x] T4.2 Rodar `pytest tests/ -k atendimento` e a suite completa.
- [x] T4.3 Smoke HTTP via `TestClient`: ciclo completo (criar, concluir com
  pendencia confirmada, aparecer no filtro, completar via `PUT`, sair do
  filtro).
- [x] T4.4 Lint, TypeScript e build do frontend.
- Criterio de conclusao: suite verde, `verify.md` com rastreabilidade.
- Risco: nenhum residual conhecido.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes de integracao: `listar_atendimentos` direto (SQLite isolado),
  cobrindo filtro e campo por item.
- Smoke HTTP: ciclo completo via `TestClient`, provando que a sinalizacao e
  recalculada ao vivo (nao depende do log de auditoria).
- Testes manuais: sem runner no frontend; roteiro no `verify.md`.

## 4) Dependencias e bloqueios

- Dependencia 1: `atendimento-conclusao-confirmavel` (a funcao que este
  pacote extrai) - **atendida**, ja em producao.
- Sem bloqueios de infraestrutura conhecidos (sem migration).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: SQLite isolado por teste em `backend/venv`.
