# Intent - arch-be-02-modularizar-relatorios-for38

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## Contexto

O endpoint `backend/app/api/v1/endpoints/relatorios.py` concentra lógica extensa de parsing, normalização, cálculo e formatação, aumentando acoplamento e dificultando manutenção.

## Problema

A alta densidade de responsabilidades no mesmo arquivo amplia risco de regressão em ajustes pontuais e torna revisão técnica mais custosa.

## Objetivo

Modularizar `relatorios.py` por extração incremental de helpers para camada de serviço, preservando contratos de API e comportamento funcional.

## Escopo desta iteração

- Extrair constantes e helpers puros/cálculo para `app/services/relatorios_helpers.py`.
- Atualizar `relatorios.py` para consumir funções importadas.
- Validar compilação do backend após extração.

## Fora de escopo

- Refatoração completa de todo o endpoint em uma única entrega.
- Alteração de payload/resposta das rotas de relatório.
