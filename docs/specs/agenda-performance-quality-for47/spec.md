# Spec - agenda-performance-quality-for47

Data: 2026-05-15  
Responsavel: Codex  
Status: done

## Escopo

Fechar qualidade e performance da busca de agenda por periodo com foco em:
- paginacao estavel entre paginas;
- ausencia de duplicidade/salto de registros;
- custo de consulta constante para filtros combinados comuns.

## Requisitos funcionais

- RF-001: a listagem por periodo deve manter ordenacao deterministica por `inicio` e `id`.
- RF-002: a paginacao por `skip/limit` nao pode repetir ou pular registros no mesmo conjunto filtrado.
- RF-003: filtros combinados (`data_inicio`, `data_fim`, `status`, `clinica_id`, `servico_id`, `tutor_nome`) devem manter resposta consistente.

## Requisitos tecnicos

- RT-001: otimizar o `count` da listagem para contar apenas `Agendamento.id`.
- RT-002: manter serializacao e payload atual do endpoint sem breaking changes.
- RT-003: cobrir com testes automatizados de paginacao estavel e custo de queries.

## Criterios de aceitacao

- CA-001: teste de paginacao por periodo valida 3 paginas sem duplicidade e com ordenacao deterministica.
- CA-002: teste com filtros combinados confirma retorno esperado e custo de queries constante (sem N+1).
- CA-003: regressao da suite de agenda por periodo permanece verde.
