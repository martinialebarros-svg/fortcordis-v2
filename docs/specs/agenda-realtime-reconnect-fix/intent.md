# Intent - agenda-realtime-reconnect-fix

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Problema

Quando a aba da agenda fica em background, o SSE desconecta por visibilidade.
Ao voltar para a aba, a conexao e restabelecida, mas eventos perdidos (como `deleted`) nao sao reaplicados automaticamente.

## Objetivo

Garantir refresh automatico da agenda apos reconexao SSE para evitar estado visual desatualizado entre abas.
