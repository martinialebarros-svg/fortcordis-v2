# Intent - arch-fe-01-modularizar-atendimento-for39

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## Contexto

A tela `frontend/app/atendimento/page.tsx` permanece extensa e com utilitarios locais duplicados, o que dificulta manutencao, revisao e evolucao segura.

## Problema

Com alta concentracao de responsabilidades no mesmo arquivo, pequenas mudancas elevam risco de regressao e atrasam ciclos de entrega.

## Objetivo

Reduzir acoplamento e tamanho efetivo do `page.tsx` por extracao incremental de utilitarios e blocos reutilizaveis, preservando comportamento funcional atual.

## Escopo desta iteracao

- Extrair utilitarios de data, arquivo e parsing numerico/textual para modulo compartilhado.
- Atualizar `page.tsx` para consumir os utilitarios externos.
- Validar build/lint apos a extracao.

## Fora de escopo

- Reescrita completa da pagina de atendimento em um unico ciclo.
- Mudanca de UX/fluxo funcional da tela.
