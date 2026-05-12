# Intent - fiscal-numero-unico-for22

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Problema

`notas_fiscais.numero` nao possuia unicidade em banco, permitindo colisao de numero fiscal sob concorrencia ou inconsistencias de dados.

## Objetivo

Garantir unicidade de numero fiscal com migration segura, validacao preventiva de duplicidades e estrategia de retry no fluxo de criacao de NF.
