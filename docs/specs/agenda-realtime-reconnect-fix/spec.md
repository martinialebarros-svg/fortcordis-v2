# Spec - agenda-realtime-reconnect-fix

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Corrigir sincronizacao da agenda entre abas apos reconexao do SSE.

## Requisitos funcionais

- RF-001: o hook de realtime deve processar evento SSE `connected`.
- RF-002: ao receber `connected`, o callback do consumidor deve ser acionado para permitir refresh da lista.

## Criterios de aceitacao

- CA-001: ao voltar para uma aba que estava em background, a agenda deve atualizar automaticamente sem exigir F5.
- CA-002: exclusao de agendamento em aba A deve refletir na aba B apos reconexao.
