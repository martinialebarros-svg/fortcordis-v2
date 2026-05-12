# Plan - websocket-auth-for20

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Tarefas

- [x] Implementar extracao de token para conexoes WebSocket (header/cookie).
- [x] Reutilizar decodificacao JWT e carga de usuario em helper compartilhado.
- [x] Aplicar autenticacao obrigatoria no endpoint `/ws/{client_id}`.
- [x] Cobrir cenarios principais com testes unitarios focados.
