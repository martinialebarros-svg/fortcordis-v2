# Plan - laudos-fila-pendentes-agenda

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Sequencia de fases

- Fase 1 (backend - modelo): campos `Exame.urgente`,
  `Laudo.finalizado_em` + migrations + evento SQLAlchemy.
- Fase 2 (backend - calculo de horas uteis): funcao
  `horas_uteis_entre` + testes de borda.
- Fase 3 (backend - endpoints): `GET /laudos/pendentes`,
  `GET /laudos/agilidade`, habilitar `urgente` no `PUT /exames/{id}`.
- Fase 4 (frontend): aba "Pendentes" + card de agilidade em
  `/laudos`.
- Fase 5 (verificacao): testes automatizados + manual ponta a ponta.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `Exame.urgente = Column(Boolean, nullable=False, default=False)`.
- [x] T1.2 `Laudo.finalizado_em = Column(DateTime(timezone=True), nullable=True)`.
- [x] T1.3 Migration idempotente para os 2 campos.
- [x] T1.4 Evento SQLAlchemy (`before_insert`/`before_update`) no
  modelo `Laudo`: se `status == "Finalizado"` e `finalizado_em is None`,
  preenche com `utcnow()`.
- [x] T1.5 Teste de migration (idempotencia).
- [x] T1.6 Teste do evento: criacao direta com status Finalizado
  (caso do upload de ECG) e atualizacao Rascunho -> Finalizado (caso
  do `atualizar_laudo`) preenchem `finalizado_em`; editar de novo
  depois nao muda o valor.

### Fase 2

- [x] T2.1 `horas_uteis_entre(inicio, fim, feriados)` em modulo de
  servico novo (`backend/app/services/laudo_agilidade_service.py`),
  reaproveitando `carregar_agenda_feriados`/`obter_feriado`
  (`backend/app/core/agenda_config.py`).
- [x] T2.2 Testes de borda: intervalo todo num dia util; intervalo
  cruzando um fim de semana (sexta a tarde -> segunda de manha);
  intervalo cruzando um feriado cadastrado; `fim <= inicio` retorna 0.

### Fase 3

- [x] T3.1 `GET /laudos/pendentes` - query com os joins de RF-5,
  campos de RF-6, ordenacao de RF-7, `total` de RF-8.
- [x] T3.2 `GET /laudos/agilidade` - janelas atual/anterior (RF-9 a
  RF-11).
- [x] T3.3 `PUT /exames/{exame_id}` para de ignorar `urgente` no dict
  de atualizacao (endpoint generico ja existe, so falta parar de
  descartar o campo).
- [x] T3.4 Testes: fila retorna os casos certos (CA-1 a CA-6),
  toggle de urgente (CA-7), agilidade (CA-11).

### Fase 4

- [x] T4.1 Aba "Pendentes" em `frontend/app/laudos/page.tsx` (junto de
  "laudos"/"exames"), com contagem no rotulo.
- [x] T4.2 Lista de itens com selos (Atrasado/Rascunho em aberto),
  botao de urgencia, ordenacao urgente-primeiro.
- [x] T4.3 Links de acao (`/laudos/novo?...` / `/laudos/{id}/editar`).
- [x] T4.4 Card de agilidade (percentual no prazo, tempo medio,
  tendencia).
- [x] T4.5 Estado vazio.

### Fase 5

- [x] T5.1 Suite completa do backend (`pytest tests/ -q`).
- [x] T5.2 `tsc`/`eslint`/`build` do frontend.
- [x] T5.3 Verificacao manual local: seed de exames/agendamentos em
  cenarios variados (realizado sem laudo, realizado com rascunho,
  nao realizado, atrasado cruzando fim de semana, urgente) + laudos
  finalizados em datas variadas para o indicador de agilidade.

## 3) Dependencias e bloqueios

- Dependencia 1: nenhuma - sem servico externo novo, reaproveita
  `agenda_feriados` ja configurado.

## 4) Checklist para iniciar execucao

- [x] `intent.md` escrito.
- [x] `spec.md` escrito.
- [x] `intent.md`/`spec.md` aprovados por Martiniano.
- [x] Fases e rollback revisados.
