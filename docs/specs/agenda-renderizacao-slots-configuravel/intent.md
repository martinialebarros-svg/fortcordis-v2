# Intent - agenda-renderizacao-slots-configuravel

Data: 2026-05-28
Responsavel: Martiniano + Codex
Status: done

## Problema

As visoes da agenda estavam renderizando com granularidades diferentes (ex.: 5 min no FullCalendar e 30 min na panoramica), e sem uma configuracao unica para periodo exibido da grade.

## Objetivo

Permitir configurar, de forma centralizada:

- periodo de renderizacao da grade (inicio/fim) quando desejado;
- tamanho dos slots (minutos), aplicado de forma consistente nas visoes da Agenda.

## Resultado esperado

- Mesmo intervalo de slot em Agenda panoramica, FullCalendar e assistente guiado.
- Opcao para usar janela fixa de renderizacao (ex.: 08:00-20:00 ou 08:00-15:00).
- Sem necessidade de migracao de banco.
