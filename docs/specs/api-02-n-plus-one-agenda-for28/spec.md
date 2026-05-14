# Spec - api-02-n-plus-one-agenda-for28

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Remover padroes de query por item na API de Agenda e consolidar acesso aos dados relacionados em consulta unica com joins.

## Requisitos funcionais

- RF-001: endpoint `GET /api/v1/agenda` deve continuar retornando a lista com nomes de paciente, tutor, clinica e servico.
- RF-002: endpoint `GET /api/v1/agenda/hoje` deve retornar os mesmos campos com dados relacionados consistentes.
- RF-003: filtros existentes de `GET /api/v1/agenda` devem continuar sem alteracao de contrato.

## Requisitos tecnicos

- RT-001: centralizar query base com joins em helper reutilizavel para reduzir risco de divergencia.
- RT-002: evitar selects adicionais por item para tabelas relacionadas na listagem.
- RT-003: adicionar teste de regressao que valide ausencia de lazy-load por item na listagem.

## Criterios de aceitacao

- CA-001: listagem da Agenda funciona com filtros existentes e retorna itens esperados.
- CA-002: consulta de listagem utiliza joins com relacionados sem selects isolados por item.
- CA-003: suite de testes da Agenda continua verde apos a mudanca.
