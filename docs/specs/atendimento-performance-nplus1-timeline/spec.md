# Spec - atendimento-performance-nplus1-timeline

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`_sync_exames` e `_sync_prescricao` passam a pre-buscar
`CatalogoExame`/`PainelExame`/`Medicamento` em lote (uma query por tabela,
usando `.filter(id.in_(ids))`) antes do loop, em vez de uma query por item.
`_montar_timeline_paciente` ganha parametros opcionais `limite` e
`atendimentos_paciente` para reaproveitar dados ja buscados e limitar
`Exame`/`Laudo`.

## 2) Requisitos funcionais (RF)

- RF-001: antes do loop de `_sync_exames`, computar
  `catalogo_ids = {item.catalogo_exame_id for item in exames_payload if item.catalogo_exame_id}`
  e `catalogos_por_id = {c.id: c for c in db.query(CatalogoExame).filter(CatalogoExame.id.in_(catalogo_ids)).all()}`
  (vazio se `catalogo_ids` vazio - sem query se nao ha nada para buscar).
  Mesmo padrao para `PainelExame`.
- RF-002: dentro do loop, `catalogo_exame`/`painel_exame` passam a ser
  `catalogos_por_id.get(payload.catalogo_exame_id)` /
  `paineis_por_id.get(payload.painel_exame_id)` (ou `None` se o id for
  falsy) - mesma semantica de fallback que a query individual tinha
  (id invalido/inexistente -> `None`).
- RF-003: `_obter_nome_medicamento` deixa de receber `db` e passa a
  receber `medicamentos_por_id: Dict[int, Medicamento]` como terceiro
  parametro; a logica interna (nome explicito > lookup por id > 422) e
  preservada.
- RF-004: antes do loop de `_sync_prescricao`, computar
  `medicamento_ids_sem_nome` (apenas itens sem `medicamento_nome` mas com
  `medicamento_id`) e `medicamentos_por_id` em uma unica query `.in_()`.
- RF-005: `_montar_timeline_paciente` ganha `limite: int = 12` (keyword-only)
  e `atendimentos_paciente: Optional[List[AtendimentoClinico]] = None`
  (keyword-only). Se `atendimentos_paciente` for fornecido, reaproveita em
  vez de reconsultar `AtendimentoClinico`; caso contrario, busca com
  `.order_by(desc).limit(limite)`.
- RF-006: `Exame`/`Laudo` dentro de `_montar_timeline_paciente` passam a
  usar `.order_by(desc).limit(limite)` em vez de `.order_by(asc)` sem
  limite.
- RF-007: `historico_paciente` passa a chamar
  `_montar_timeline_paciente(db, paciente_id, limite=limite, atendimentos_paciente=atendimentos)`,
  reaproveitando a lista que o proprio endpoint ja busca.
- RF-008: `timeline_paciente` (endpoint isolado, sem lista pre-buscada)
  ganha parametro de query `limite: int = 12` e passa
  `limite=limite` para `_montar_timeline_paciente`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): numero de queries a `catalogo_exames`/
  `painel_exames`/`medicamentos` por chamada de sync passa a ser O(1) em
  relacao ao numero de itens do payload (1 query por tabela referenciada,
  nao 1 por item).
- NFR-002 (performance): custo de `_montar_timeline_paciente` passa a ser
  limitado por `limite`, independente do volume historico total do
  paciente.
- NFR-003 (correcao): a ordem final dos eventos da timeline (agrupados por
  ano, ordenados por data) nao muda - o `sorted()` existente ja reordena
  tudo, independente da ordem de entrada dos dados buscados.

## 4) Contratos tecnicos

### API

- `GET /atendimentos/paciente/{paciente_id}/timeline`: novo parametro de
  query opcional `limite` (default 12) - backward compatible, nenhum
  cliente existente passava esse parametro (endpoint sem caller no
  frontend, confirmado por busca).
- `GET /atendimentos/paciente/{paciente_id}/historico`: sem mudanca de
  contrato (o `limite` ja existia).
- `PUT /atendimentos/{id}` / `POST /atendimentos`: sem mudanca de
  contrato - a otimizacao e interna, nao observavel pelo cliente exceto
  pela latencia menor.

### Banco/migracoes

Nenhuma alteracao de schema.

### Frontend

Nenhuma alteracao necessaria.

## 5) Compatibilidade e rollout

- Backward compatibility: total.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (mais lento, mas correto).

## 6) Criterios de aceitacao (CA)

- CA-001: 8 exames no payload com o MESMO `catalogo_exame_id` geram
  exatamente 1 SELECT em `catalogo_exames`.
- CA-002: 5 exames no payload com `catalogo_exame_id` DISTINTOS geram
  exatamente 1 SELECT em `catalogo_exames` (via `IN`).
- CA-003: 5 itens de prescricao sem `medicamento_nome` (so `medicamento_id`)
  geram exatamente 1 SELECT em `medicamentos`.
- CA-004: `medicamento_id` invalido/inexistente sem nome continua
  levantando 422 (comportamento preservado).
- CA-005: quando o chamador passa `atendimentos_paciente`, nenhuma query
  adicional e feita em `atendimentos_clinicos`.
- CA-006: mesmo com centenas de exames/laudos no historico do paciente, o
  numero de eventos `exame_solicitado`/`laudo` na timeline resultante fica
  limitado a `limite`.
- CA-007: sem `atendimentos_paciente` (endpoint `/timeline` isolado), a
  funcao continua funcionando e aplica seu proprio limite.

## 7) Casos de borda

- CB-001: payload de exames vazio (`catalogo_ids` vazio) nao dispara
  nenhuma query de catalogo - so o `if catalogo_ids else {}` evita a
  query com `IN ()` vazio (que seria valido mas desnecessario).
- CB-002: item de prescricao com `medicamento_nome` preenchido nunca entra
  em `medicamento_ids_sem_nome`, mesmo que tambem tenha `medicamento_id` -
  nome explicito sempre tem prioridade (comportamento pre-existente).

## 8) Fora de escopo

- Cache entre requisicoes.
- Paginacao cursor-based na timeline.
- Mudar o `limite` default de `historico_paciente`.
