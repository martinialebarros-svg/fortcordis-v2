# Intent - websocket-auth-for20

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Problema

O endpoint `/ws/{client_id}` aceitava conexoes sem autenticacao, abrindo superficie para consumo indevido de eventos em tempo real.

## Objetivo

Exigir autenticacao JWT (header Bearer ou cookie de sessao HttpOnly) no handshake WebSocket, com rejeicao explicita para credenciais invalidas ou usuarios inativos.
