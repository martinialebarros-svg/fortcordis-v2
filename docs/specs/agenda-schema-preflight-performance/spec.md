# Especificação — PERF-22: preflight de schema fora da requisição da Agenda

## Contrato funcional

- RF-001: o startup da API executa `_ensure_agendamento_workflow_columns` uma
  única vez por processo usando uma sessão dedicada.
- RF-002: a sessão dedicada é fechada mesmo quando o preflight falha.
- RF-003: nenhum endpoint ou helper do caminho HTTP da Agenda chama a inspeção
  de schema.
- RF-004: a compatibilidade legada continua adicionando colunas ausentes em
  bancos locais antigos; em bancos migrados, apenas valida e retorna.
- RF-005: filtros, paginação, autorização, locks de escrita e respostas da
  Agenda permanecem inalterados.

## Requisitos não funcionais

- NFR-001: `listar_agendamentos` usa no máximo quatro `SELECTs` internos no
  cenário sintético sem autenticação HTTP.
- NFR-002: em stage, a meta é reduzir `Consultas p95` da rota principal de 10
  para no máximo 6, sem aumentar `App p95`, pool ou 5xx.
- NFR-003: nenhuma URL, consulta SQL, parâmetro, usuário ou dado clínico é
  persistido como telemetria.
- NFR-004: nenhuma migração nova é necessária; as colunas já são cobertas pelas
  migrações `20260707_46`, `20260719_51` e `20260823_75`.

## Linha de base de stage

Release `c758af1`, janela de 24 horas, coleta autenticada e somente leitura:

- `/api/v1/agenda`: 127 amostras, p95 `298,95 ms`, banco p95 `234,21 ms`,
  app p95 `70,86 ms`, consultas p95 `10`, pool p95 `0,14 ms`, zero 5xx.
- `/api/v1/agenda/relacionados`: 104 amostras, p95 `83,58 ms`, consultas p95
  `7`, zero 5xx.
- `/api/v1/agenda/resumo-financeiro`: 104 amostras, p95 `89,70 ms`, consultas
  p95 `7`, zero 5xx.
- Um pico simultâneo acima de `3.200 ms` nas duas auxiliares ocorreu durante a
  carga sintética rápida; o p95 permaneceu abaixo de `90 ms` e a repetição
  espaçada não reproduziu o pico.

## Critérios de aceitação

- CA-001: teste prova execução única do preflight no startup e fechamento da
  sessão.
- CA-002: teste prova ausência do preflight na listagem HTTP.
- CA-003: teste limita a listagem a quatro `SELECTs` internos.
- CA-004: suítes de Agenda e startup permanecem verdes.
- CA-005: guardrail SDD e verificação de sintaxe passam.
- CA-006: publicação futura em stage confirma release correto, zero 5xx e pelo
  menos 100 amostras da rota principal.
