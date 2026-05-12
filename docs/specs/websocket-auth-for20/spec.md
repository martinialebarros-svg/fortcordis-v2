# Spec - websocket-auth-for20

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Blindar o canal WebSocket com o mesmo modelo de identidade adotado nas rotas HTTP autenticadas.

## Requisitos funcionais

- RF-001: conexoes WebSocket devem exigir token valido no handshake.
- RF-002: o backend deve aceitar token via `Authorization: Bearer` ou cookie de sessao.
- RF-003: conexoes de usuarios inativos devem ser recusadas.
- RF-004: conexoes sem credenciais ou com token invalido devem ser recusadas.

## Requisitos tecnicos

- RT-001: codigos de rejeicao WebSocket devem usar `WS_1008_POLICY_VIOLATION`.
- RT-002: logica de decode/carga de usuario deve evitar duplicacao entre HTTP e WebSocket.

## Criterios de aceitacao

- CA-001: token valido autentica handshake.
- CA-002: ausencia de token gera rejeicao por politica (`1008`).
- CA-003: token invalido gera rejeicao por politica (`1008`).
- CA-004: usuario inativo gera rejeicao por politica (`1008`).
