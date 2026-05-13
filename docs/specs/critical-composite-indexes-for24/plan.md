# Plan - critical-composite-indexes-for24

Data: 2026-05-13  
Responsavel: Codex  
Status: done

## Plano de execucao

1. Mapear filtros+ordenacoes dominantes em `agenda.py`, `atendimento.py`, `relatorios.py` e `ordens_servico.py`.
2. Definir conjunto minimo de indices compostos com foco em:
   - `agendamentos`
   - `atendimentos_clinicos`
   - `ordens_servico`
3. Aplicar indices no modelo para novos ambientes e migration para ambientes existentes.
4. Validar criacao dos indices com teste automatizado de migration.
5. Rodar regressao rapida de testes relacionados e guardrail SDD.
