# Intent - csrf-protection-for19

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Problema

Com a sessao migrada para cookie HttpOnly, requests mutating com cookie de sessao precisam de camada explicita anti-CSRF.

## Objetivo

Implementar protecao CSRF para rotas da API com sessao por cookie, sem quebrar compatibilidade de fluxos existentes durante a transicao.
