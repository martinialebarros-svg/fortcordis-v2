# Plan - agenda-assistente-nox-readonly

Data: 2026-06-07
Responsavel: Martiniano + Codex
Status: in-progress

## Plano

1. Criar token dedicado por variavel de ambiente para acesso externo read-only.
2. Expor endpoint de contexto minimo da agenda com janela limitada.
3. Sanitizar payload removendo tutor, telefone, observacoes e dados clinicos/financeiros.
4. Reutilizar regras existentes de agenda semanal, feriados, excecoes e rota/oferta.
5. Cobrir token, privacidade e limite de janela com testes focais.
6. Documentar contrato tecnico e smoke operacional.
