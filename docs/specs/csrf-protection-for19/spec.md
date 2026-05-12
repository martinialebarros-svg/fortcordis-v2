# Spec - csrf-protection-for19

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Proteger contra CSRF em requests mutating da API quando a autenticacao estiver baseada em cookie de sessao.

## Requisitos funcionais

- RF-001: requests mutating com cookie de sessao devem passar por verificacao CSRF.
- RF-002: login deve emitir cookie CSRF legivel pelo frontend para envio em header.
- RF-003: logout deve remover cookie CSRF.
- RF-004: requests com par cookie/header CSRF valido devem ser aceitos.
- RF-005: requests com sinal explicito de origem cross-site devem ser rejeitados.

## Requisitos tecnicos

- RT-001: middleware deve considerar `Origin`/`Referer` e `Sec-Fetch-Site` para defesa adicional.
- RT-002: protecao deve ser configuravel via settings (`CSRF_PROTECTION_ENABLED`).

## Criterios de aceitacao

- CA-001: POST autenticado com token CSRF valido retorna sucesso.
- CA-002: POST autenticado com origem cross-site explicita retorna 403.
- CA-003: GETs nao sofrem bloqueio CSRF.
- CA-004: login/logout manipulam cookie CSRF corretamente.
