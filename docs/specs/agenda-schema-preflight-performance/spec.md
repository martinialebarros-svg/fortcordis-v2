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
- RF-006: `_obter_regras_agenda` seleciona somente `agenda_semanal`,
  `agenda_feriados` e `agenda_excecoes`. A consulta não transfere logomarca,
  assinatura ou campos de documentos, nem materializa a entidade completa.
  Não há cache entre chamadas: alterações confirmadas continuam visíveis na
  leitura seguinte, inclusive quando a sessão já retém uma entidade antiga.

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
- CA-007: testes preservam regras normalizadas e padrões sem configuração,
  verificam leitura de alterações confirmadas e ausência dos binários no SQL.

## Investigação de stage — 26/10/2026

Os dois gates do release `a78beb9f` tiveram p95 de `3.037,19 ms` e
`2.226,37 ms`, acima do limite inalterado de `1.200 ms`. As dez amostras
persistidas têm duas respostas lentas, mas SQL máximo de `210,78 ms` e espera
de pool máxima de `51,40 ms`. Esses cronômetros não cobrem necessariamente
fetch de resultados, pre-ping, finalização de transação ou fila de execução;
não permitem atribuir toda a diferença à serialização.

Consulta SQL de leitura confirmou `569.017` bytes de logomarca, `60.447` de
assinatura e apenas `783` bytes nos três campos de regras em stage. O caminho
anterior lia a entidade completa em cada listagem. A projeção remove esse
tráfego desnecessário sem modificar os binários armazenados. Essa constatação
é um desperdício comprovado, não prova isolada da causa dos picos.

A entrega e validação são restritas a stage. Não alterar limites do pool,
limite do gate, autenticação, políticas Maps, regras operacionais nem produção.
