# Spec - atendimento-pendencias-filtro

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

`GET /atendimentos` passa a aceitar um filtro `documentacao_incompleta` e a
devolver, em cada item, a lista de pendencias de documentacao clinica (vazia
quando nao ha, ou quando o atendimento nao esta concluido). O frontend ganha
um filtro (checkbox) e um badge por item.

## 2) Requisitos funcionais (RF)

- RF-001: `_calcular_pendencias_documentacao` extraida de
  `_validar_primeira_conclusao_atendimento`, com a mesma logica (3 grupos),
  sem gating de status nem side effects - pura funcao de calculo.
- RF-002: `_condicao_sql_documentacao_incompleta` reproduz a mesma logica em
  SQL (`trim(coalesce(coluna, '')) = ''` por campo, combinado com `and_`/`or_`
  nos 3 grupos).
- RF-003: `GET /atendimentos?documentacao_incompleta=true` filtra
  `status == "Concluido"` E a condicao de pendencia; combinavel com os
  demais filtros existentes (`clinica_id`, `search`, datas).
- RF-004: cada item da listagem ganha `documentacao_pendencias: string[]` -
  populado (recalculado a partir dos campos atuais) quando
  `status == "Concluido"`, vazio caso contrario (atendimento aberto nao e
  "pendencia", e natural estar incompleto).
- RF-005: o frontend adiciona um checkbox "Concluidos com documentacao
  incompleta" no painel de filtros, e um badge amber "Documentacao
  incompleta" (com tooltip listando o que falta) no card de cada item quando
  `documentacao_pendencias` nao esta vazio.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): o filtro roda inteiramente em SQL, antes da
  paginacao (`offset`/`limit`) - nao pagina em memoria.
- NFR-002 (sem N+1): o calculo de pendencias por item usa os campos ja
  carregados na query principal, sem nenhuma consulta adicional por linha.
- NFR-003 (consistencia): a mesma funcao de calculo (`_calcular_pendencias_
  documentacao`) e usada tanto pelo guard de conclusao quanto pela listagem -
  nao ha duas implementacoes divergentes da regra de pendencia em Python.

## 4) Contratos tecnicos

### API

`GET /atendimentos?documentacao_incompleta=true`

Resposta (cada item):
```json
{
  "id": 1,
  "status": "Concluido",
  "documentacao_pendencias": ["diagnostico ou plano terapeutico"],
  "...": "demais campos inalterados"
}
```

Sem o parametro, ou com `documentacao_incompleta=false`, o comportamento e
identico ao anterior, exceto pelo novo campo `documentacao_pendencias`
(sempre presente, vazio quando nao ha pendencia ou o atendimento nao esta
concluido).

### Banco/migracoes

- Nenhuma. So leitura dos campos ja existentes.

### Frontend

- Tela afetada: `/atendimento`, painel "Atendimentos recentes".
- Novo estado: `documentacaoIncompletaFiltro` (checkbox, mesmo padrao dos
  demais filtros - so aplica ao clicar "Aplicar filtros").
- Novo badge no card do item, visivel independente do filtro estar ativo.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - parametro novo e opcional, campo novo na
  resposta e aditivo.
- Estrategia de rollback: reverter o commit. Sem estado persistido.

## 6) Criterios de aceitacao (CA)

- CA-001: `documentacao_incompleta=true` traz somente atendimentos
  `Concluido` com pelo menos uma das tres pendencias.
- CA-002: atendimento `Concluido` com os tres grupos preenchidos nao aparece
  no filtro e tem `documentacao_pendencias == []`.
- CA-003: atendimento nao concluido (`Triagem`, `Em atendimento`, etc.) nunca
  aparece no filtro e sempre tem `documentacao_pendencias == []`, mesmo com
  campos vazios.
- CA-004: completar a documentacao de um atendimento ja concluido (`PUT`)
  faz ele sair do filtro e zera `documentacao_pendencias` na proxima consulta
  - sem depender do historico de auditoria.
- CA-005: `documentacao_incompleta=true` combinado com `status` diferente de
  `Concluido` devolve lista vazia (a condicao de status prevalece).
- CA-006: a suite do modulo permanece verde e cresce em relacao ao baseline
  (98 testes, ao final do pacote anterior).

## 7) Casos de borda

- CB-001: atendimento com todos os campos como string vazia (`""`) ou espacos
  em branco conta como pendencia (mesma semantica de `_tem_texto_clinico`).
- CB-002: filtro nao interfere com paginacao - `total` reflete a contagem
  apos o filtro, nao antes.

## 8) Fora de escopo

- Notificacao ativa de pendencias.
- Alterar os tres grupos de exigencia.
- Qualquer mudanca no fluxo de conclusao em si (isso e o pacote anterior).
