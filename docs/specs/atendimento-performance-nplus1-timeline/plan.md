# Plan - atendimento-performance-nplus1-timeline

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): batching de `_sync_exames`/`_sync_prescricao` +
  limite em `_montar_timeline_paciente`.
- Fase 3 (frontend): nao aplicavel.
- Fase 4 (integracao/observabilidade): testes de contagem de query.

## 2) Tarefas por fase

### Fase 2

- [x] T2.1 - `_sync_exames`: pre-busca em lote de `CatalogoExame`/
  `PainelExame` antes do loop; substituicao das 2 queries in-loop por
  lookups em dict.
- [x] T2.2 - `_obter_nome_medicamento`: assinatura muda de
  `(db, medicamento_id, medicamento_nome)` para
  `(medicamento_id, medicamento_nome, medicamentos_por_id)`.
- [x] T2.3 - `_sync_prescricao`: pre-busca em lote de `Medicamento` (so
  ids sem nome) antes do loop.
- [x] T2.4 - `_montar_timeline_paciente`: novos parametros `limite`/
  `atendimentos_paciente`; `Exame`/`Laudo` passam a usar
  `.order_by(desc).limit(limite)`.
- [x] T2.5 - `historico_paciente`: passa `atendimentos` (ja buscado) e
  `limite` (ja recebido) para `_montar_timeline_paciente`.
- [x] T2.6 - `timeline_paciente`: novo parametro de query `limite: int = 12`.
- Criterio de conclusao: os testes de T4.1 passam.
- Risco: nenhum chamador de `_obter_nome_medicamento` alem do unico
  confirmado antes da mudanca de assinatura.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - `test_atendimento_sync_batching_nplus1.py` (4 testes: 8
  exames mesmo catalogo, 5 exames catalogos distintos, 5 itens de
  prescricao, medicamento_id invalido continua 422).
- [x] T4.2 - `test_atendimento_timeline_limitada.py` (3 testes: reaproveita
  lista sem reconsultar, exames/laudos limitados mesmo com volume alto,
  funciona sem lista pre-buscada).
- [x] T4.3 - Suite completa do backend.
- Criterio de conclusao: 673/673 (era 666 apos o pacote anterior, +7
  deste: 4 + 3).
- Risco: nenhum.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: 7 testes novos, usando `event.listen(engine,
  "before_cursor_execute", ...)` para capturar e contar SQL real emitido -
  mesmo padrao ja usado em `test_atendimento_list_n_plus_one.py`.
- Testes de integracao: suite completa do backend.
- Testes manuais: nao aplicavel - contagem de query e uma propriedade
  deterministica, diretamente observavel via instrumentacao do driver SQL,
  sem depender de volume real de dados em producao.

## 4) Dependencias e bloqueios

- Dependencia 1: padrao de captura de SQL via `event.listen` (ja
  estabelecido em `test_atendimento_list_n_plus_one.py`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest).
