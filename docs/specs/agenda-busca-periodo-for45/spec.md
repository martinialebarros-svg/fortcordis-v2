# Spec - agenda-busca-periodo-for45

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Evoluir a listagem de Agenda para suportar filtros operacionais por periodo e termos de busca relacionados a paciente/tutor/clinica/servico.

## Requisitos funcionais

- RF-001: aceitar `data_inicio` e `data_fim` para recorte por periodo.
- RF-002: suportar filtro por `paciente_nome` e `tutor_nome` (busca parcial).
- RF-003: suportar filtro por `clinica_id`, `servico_id` e `status` em combinacao com periodo.
- RF-004: manter compatibilidade com busca atual por dia e demais parametros ja existentes.

## Requisitos tecnicos

- RT-001: busca textual deve escapar caracteres especiais de LIKE.
- RT-002: manter ordenacao deterministica por `Agendamento.inicio` e `Agendamento.id`.
- RT-003: manter fallback para campos denormalizados legados (`agendamento.paciente`, `agendamento.tutor`, etc.).

## Criterios de aceitacao

- CA-001: filtros por nome de paciente funcionam no periodo selecionado (incluindo fallback legado).
- CA-002: filtros combinados por tutor/status/clinica/servico retornam resultado correto.
- CA-003: comportamento anterior do endpoint permanece funcional.
