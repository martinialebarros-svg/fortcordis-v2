# Spec - atendimento-exame-laudo-id-staleness

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`_sync_exames` (`backend/app/api/v1/endpoints/atendimento.py`) passa a
preservar `Exame.laudo_id` quando o payload chega vazio/None para um
exame que ja tem um laudo vinculado no banco.

## 2) Requisitos funcionais (RF)

- RF-001: se `payload.laudo_id` for truthy e diferente do `exame.laudo_id`
  atual, validar propriedade (mesmo paciente) antes de aceitar - **inalterado**.
- RF-002: se `payload.laudo_id` for falsy/None E `exame.laudo_id` (valor
  atual no banco) for truthy, **nao alterar** `exame.laudo_id` - novo.
- RF-003: nos demais casos (payload igual ao atual, ou ambos vazios),
  aplicar `exame.laudo_id = payload.laudo_id` - **inalterado** (efetivamente
  um no-op nesses casos).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (correcao): nenhum dos 4 comportamentos previamente testados em
  `test_atendimento_exame_laudo_id_propriedade.py` pode regredir.
- NFR-002 (minimizacao de raio de mudanca): a correcao fica inteiramente
  dentro do bloco `if/elif/else` existente, sem alterar assinatura de
  funcao, schema ou contrato de API.

## 4) Contratos tecnicos

### API

- Sem mudanca de contrato de request/response em `PUT /atendimentos/{id}`
  nem `POST /atendimentos`. O comportamento muda apenas para o caso
  especifico descrito no intent.md - o cliente nao precisa saber disso
  para continuar funcionando (ele so faz round-trip do valor recebido).

### Banco/migracoes

- Nenhuma alteracao de schema.

### Frontend

- Nenhuma alteracao. Ver intent.md secao 3 para a analise de por que a
  peculiaridade de `mergeAutoSavedFormState` (page.tsx:1320) nao precisa
  de correcao complementar.

## 5) Compatibilidade e rollout

- Backward compatibility: total - o unico payload que muda de
  comportamento e exatamente o caso de bug (payload vazio sobre vinculo
  existente), que nunca deveria ter apagado o vinculo.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (aceitar o payload vazio incondicionalmente).

## 6) Criterios de aceitacao (CA)

- CA-001: `laudo_id` de outro paciente continua sendo ignorado (teste
  existente, deve continuar passando).
- CA-002: `laudo_id` do mesmo paciente continua sendo aceito em exame novo
  (teste existente, deve continuar passando).
- CA-003: `laudo_id` inexistente continua sendo ignorado (teste existente,
  deve continuar passando).
- CA-004: reenviar o mesmo `laudo_id` ja vinculado preserva o vinculo
  (teste existente, deve continuar passando).
- CA-005 (novo): payload sem `laudo_id` para um exame que JA tem laudo
  vinculado no banco preserva o vinculo em vez de apaga-lo.
- CA-006 (novo, caso de borda): payload sem `laudo_id` para um exame que
  NUNCA teve laudo continua sem laudo (a protecao nao pode se tornar um
  "ignorar sempre" incondicional).

## 7) Casos de borda

- CB-001: exame novo (sem id previo) com laudo_id vazio - `exame.laudo_id`
  e `None` por padrao do model, entao o `elif` (`exame.laudo_id` atual
  truthy) nunca dispara; comportamento inalterado (CA-006).
- CB-002: dois exames diferentes no mesmo payload, um com laudo vinculado
  e payload vazio, outro sem laudo e payload vazio - cada exame e avaliado
  independentemente dentro do loop de `_sync_exames`; nao ha
  compartilhamento de estado entre iteracoes.

## 8) Fora de escopo

- Auditoria de mudanca de `laudo_id` em `exame_ajustes`.
- Correcao da peculiaridade de merge no frontend (justificada como
  inofensiva no intent.md).
- UI de vinculo/desvinculo de laudo dentro do atendimento.
