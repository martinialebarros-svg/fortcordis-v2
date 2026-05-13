# Intent - critical-composite-indexes-for24

Data: 2026-05-13  
Responsavel: Codex  
Status: done

## Problema

Consultas de Agenda, Atendimento e Relatorios financeiros usam combinacao de filtros por periodo/status/clinica/servico e ordenacao temporal, pressionando p95 em cenarios com crescimento de volume.

## Objetivo

Adicionar indices compostos nas tabelas criticas para reduzir varredura ampla e melhorar latencia p95 sem alterar contrato das APIs.
