# Spec - security-headers-for21

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Implementar baseline de security headers para reduzir superficie de ataques de clickjacking e content sniffing, incluindo CSP inicial com politica conservadora.

## Requisitos funcionais

- RF-001: backend deve enviar `X-Frame-Options: DENY` em todas as respostas HTTP.
- RF-002: backend deve enviar `X-Content-Type-Options: nosniff` em todas as respostas HTTP.
- RF-003: backend deve enviar CSP inicial em respostas de API e health/readiness.
- RF-004: frontend deve enviar CSP inicial, `X-Frame-Options` e `X-Content-Type-Options` em todas as rotas.

## Requisitos tecnicos

- RT-001: politica CSP backend deve ser compatível com endpoints JSON da API.
- RT-002: CSP frontend deve permitir assets e conectividade do app sem regressao funcional imediata.

## Criterios de aceitacao

- CA-001: helper backend retorna `DENY` e `nosniff` para qualquer path.
- CA-002: helper backend inclui CSP para `/api/*`, `/health` e `/ready`.
- CA-003: helper backend nao injeta CSP em paths nao-API (ex.: `/docs`).
- CA-004: `next.config.js` publica os três headers de seguranca para `/:path*`.
