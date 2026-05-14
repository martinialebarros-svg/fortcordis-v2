# Spec - api-01-n-plus-one-atendimento-for27

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Refatorar a montagem dos campos derivados `total_exames` e `tem_prescricao` na listagem de atendimentos para carregamento em lote por página.

## Requisitos funcionais

- RF-001: o endpoint deve continuar retornando `total` e `items` com o mesmo formato atual.
- RF-002: cada item deve manter os campos `total_exames` e `tem_prescricao` com valores corretos.
- RF-003: a ordenação e paginação existentes devem permanecer inalteradas.

## Requisitos tecnicos

- RT-001: remover consultas por item (`count`/`first`) para `Exame` e `PrescricaoClinica`.
- RT-002: usar consulta agregada por `atendimento_id` para exames da página corrente.
- RT-003: usar consulta distinta por `atendimento_id` para presença de prescrição na página corrente.
- RT-004: manter compatibilidade com SQLAlchemy/SQLite usados na suíte de testes.

## Criterios de aceitacao

- CA-001: para uma página com múltiplos atendimentos, os campos `total_exames` e `tem_prescricao` continuam corretos.
- CA-002: a execução faz no máximo uma consulta agregada em `exames` para a página.
- CA-003: a execução faz no máximo uma consulta distinta em `prescricoes_clinicas` para a página.
