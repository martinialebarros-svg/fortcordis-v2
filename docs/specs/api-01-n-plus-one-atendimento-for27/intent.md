# Intent - api-01-n-plus-one-atendimento-for27

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Problema

A listagem de atendimentos executava consultas adicionais por item da página para calcular `total_exames` e `tem_prescricao`, criando padrão N+1 com degradação progressiva de latência conforme aumento de volume.

## Objetivo

Eliminar o N+1 no endpoint `GET /api/v1/atendimentos`, mantendo o contrato de resposta e reduzindo o custo por página para consultas em lote.
