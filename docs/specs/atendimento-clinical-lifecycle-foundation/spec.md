# Spec - atendimento-clinical-lifecycle-foundation

Data: 2026-07-29
Responsavel: Codex
Status: done

## 1) Objetivo

Criar a primeira protecao do ciclo clinico do Atendimento sem antecipar a
integracao transacional completa com Agenda, ordem de servico e auditoria.

Esta entrega deve impedir que um atendimento clinicamente vazio seja concluido,
preservar os indicadores explicitos de conclusao enviados pela interface e
estabilizar o horario operacional usado entre navegador, API e bancos
compativeis.

## 2) Requisitos funcionais

- RF-001: o backend deve aceitar somente os estados canonicos atualmente
  expostos pelo modulo: `Triagem`, `Em atendimento`, `Aguardando exames`,
  `Retorno agendado` e `Concluido`.
- RF-002: variantes apenas de acentuacao e caixa devem ser normalizadas para o
  valor canonico, sem criar novos estados.
- RF-003: a criacao direta com status `Concluido` e a primeira transicao de
  outro estado para `Concluido` devem ser rejeitadas quando faltarem:
  - motivo/queixa principal;
  - ao menos um registro de avaliacao entre anamnese, exame fisico e dados
    clinicos;
  - ao menos uma conclusao/conduta entre diagnostico principal, secundario,
    diferencial e plano terapeutico.
- RF-004: atendimentos legados que ja estejam `Concluido` devem continuar
  editaveis nesta etapa, sem aplicar retroativamente a nova validacao a cada
  autosave.
- RF-005: `triagem_concluida` e `consulta_concluida` enviados na criacao devem
  ser persistidos; a simples presenca de um objeto de triagem vazio nao pode
  marcar a triagem como concluida.
- RF-006: uma transicao valida para `Concluido` deve marcar
  `consulta_concluida=1`.
- RF-007: o contexto obtido a partir da Agenda deve preencher a data e hora do
  atendimento com `agendamento.inicio`.
- RF-008: o identificador do agendamento deve ser apresentado como vinculo
  somente leitura na interface.
- RF-009: paciente, clinica, data/hora, agendamento e status devem ter rotulos
  acessiveis e visiveis.

## 3) Requisitos nao funcionais

- NFR-001 (integridade): a validacao de conclusao deve existir no backend e nao
  depender da interface.
- NFR-002 (compatibilidade): abrir a tela com `paciente_id` ou
  `agendamento_id` nao pode criar um atendimento automaticamente.
- NFR-003 (compatibilidade): registros legados concluidos permanecem
  consultaveis e editaveis.
- NFR-004 (tempo): datas clinicas devem trafegar com offset operacional
  `America/Fortaleza` e manter o mesmo horario apos salvar, autosalvar e
  recarregar.
- NFR-005 (escopo): esta entrega nao altera automaticamente o status da Agenda,
  nao gera OS e nao implementa cancelamento/auditoria; esses itens pertencem a
  uma etapa transacional posterior.

## 4) Contratos

### API de criacao e atualizacao

Quando uma conclusao nao cumprir os requisitos minimos, a API retorna HTTP 422
com uma mensagem humana listando os grupos pendentes.

Estados desconhecidos retornam HTTP 422.

### Data e hora

- A interface envia datas de `datetime-local` com offset `-03:00`.
- A API devolve `data_atendimento`, `data_resultado` e o inicio do contexto da
  Agenda normalizados para o horario operacional.
- Datetimes sem timezone lidos de SQLite sao tratados como horario operacional,
  evitando o deslocamento progressivo a cada salvamento.

## 5) Criterios de aceitacao

- CA-001: criar um atendimento vazio como `Concluido` retorna 422 e nao grava.
- CA-002: mudar um atendimento vazio de `Em atendimento` para `Concluido`
  retorna 422 e preserva o estado anterior.
- CA-003: uma conclusao com queixa, avaliacao e diagnostico ou plano e aceita e
  marca `consulta_concluida=1`.
- CA-004: status desconhecido retorna 422; `Concluído` e normalizado para
  `Concluido`.
- CA-005: triagem vazia com indicador falso permanece nao concluida.
- CA-006: abrir por agendamento preenche a data/hora do agendamento.
- CA-007: salvar e serializar repetidamente uma data operacional nao altera sua
  hora.
- CA-008: o ID do agendamento nao e editavel e todos os controles de contexto
  possuem rotulos.
