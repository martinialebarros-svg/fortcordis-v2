# Especificacao

## Requisitos funcionais
- RF-01: documentar checklist inicial de triagem com comandos executaveis.
- RF-02: cobrir cenario de indisponibilidade da API WhatsApp backend.
- RF-03: cobrir cenario de falha de autenticacao/autorizacao (401/403).
- RF-04: cobrir cenario de erro de webhook (validacao/assinatura).
- RF-05: cobrir cenario de backlog de `webhook_events` e falha do cleanup worker.
- RF-06: incluir etapa de pos-incidente com evidencias minimas.

## Requisitos nao funcionais
- RNF-01: linguagem objetiva e orientada a operacao (SRE-lite).
- RNF-02: comandos devem refletir paths/services reais ja usados no projeto.
- RNF-03: runbook deve ser referenciado nos docs de deploy/preflight.
