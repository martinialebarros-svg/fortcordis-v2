# Intent - agenda-sugestoes-janela-operacional-for49

Data: 2026-05-18
Responsavel: Martiniano + Codex
Status: done

## Problema

O assistente de proximidade ainda podia considerar ancoras em dias/horarios que, pela configuracao da agenda, estavam fechados ou fora da janela operacional.

## Objetivo

Garantir que as sugestoes automáticas de agendamento respeitem integralmente agenda fechada, feriados e janelas especiais, reduzindo sugestoes operacionais invalidas.

## Resultado esperado

- Nao sugerir ancoras em dia fechado.
- Nao sugerir ancoras fora da janela ativa do dia.
- Expor telemetria de itens ignorados por janela para facilitar diagnostico.
