# Intent - fiscal-numero-sequence-for23

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Problema

Mesmo com unicidade em `notas_fiscais.numero` (FOR-22), a geracao baseada em leitura do ultimo registro ainda dependia de retry sob disputa concorrente.

## Objetivo

Implementar geracao concorrente robusta de numero fiscal com sequencia forte em banco (upsert atomico por ano), mantendo compatibilidade de ambientes legados.
