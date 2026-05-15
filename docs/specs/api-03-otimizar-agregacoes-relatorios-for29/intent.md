# Intent - api-03-otimizar-agregacoes-relatorios-for29

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Problema

O endpoint de relatorio gerencial carregava objetos completos de `Agendamento` para todo o periodo, aumentando uso de memoria e custo de serializacao ORM em cenarios de volume.

## Objetivo

Reduzir pegada de memoria das agregacoes de relatorios carregando apenas colunas necessarias para os calculos do periodo.
