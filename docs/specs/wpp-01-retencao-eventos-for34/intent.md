# FOR-34 WPP-01 Politica de retencao de eventos WhatsApp

## Problema
A tabela `webhook_events` cresce continuamente com eventos historicos, sem rotina automatica de retencao.

## Objetivo
Implementar cleanup automatico com janela configuravel e metrica operacional de execucao.

## Resultado esperado
- remocao periodica de eventos antigos
- rastreabilidade de cada execucao de cleanup
