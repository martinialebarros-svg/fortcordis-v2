# Plan - atendimento-exame-laudo-id-staleness

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): adicionar o `elif` de protecao em `_sync_exames`.
- Fase 3 (frontend): nao aplicavel (ver intent.md secao 3).
- Fase 4 (integracao/observabilidade): testes novos + suite completa.

## 2) Tarefas por fase

### Fase 1 / Fase 3

N/A.

### Fase 2

- [x] T2.1 - Adicionar `elif not payload.laudo_id and exame.laudo_id: pass`
  entre o `if` de validacao de propriedade e o `else` de aceitacao direta,
  em `_sync_exames` (`atendimento.py:1903-1919`).
- Criterio de conclusao: os 4 testes existentes de
  `test_atendimento_exame_laudo_id_propriedade.py` continuam passando sem
  modificacao.
- Risco: nenhum identificado - mudanca aditiva dentro de um bloco
  condicional ja existente.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Teste novo: payload sem laudo_id sobre exame ja vinculado
  preserva o vinculo (CA-005).
- [x] T4.2 - Teste novo: payload sem laudo_id sobre exame nunca vinculado
  continua sem vinculo (CA-006, guarda contra regressao oposta).
- [x] T4.3 - Suite completa do backend.
- Criterio de conclusao: `test_atendimento_exame_laudo_id_propriedade.py`
  com 6/6 testes passando; suite completa sem regressao.
- Risco: nenhum.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: `test_atendimento_exame_laudo_id_propriedade.py`
  (6 testes: 4 existentes + 2 novos).
- Testes de integracao: suite completa do backend (`pytest tests/ -q`).
- Testes manuais: nao aplicavel - o cenario (duas abas/sessoes editando o
  mesmo exame por caminhos diferentes) e diretamente reproduzivel e
  determinístico via teste unitario chamando `_sync_exames` duas vezes em
  sequencia, sem depender de timing de rede ou navegador.

## 4) Dependencias e bloqueios

Nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest).
