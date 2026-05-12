# Intent - security-headers-for21

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Problema

As respostas HTTP de app e API nao tinham baseline explicita de headers de seguranca, reduzindo a protecao contra clickjacking e sniffing de MIME.

## Objetivo

Adicionar baseline de `Content-Security-Policy`, `X-Frame-Options` e `X-Content-Type-Options` com rollout seguro para backend e frontend.
