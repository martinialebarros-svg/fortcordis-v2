# Spec - atendimento-lista-filtros-paginacao

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Evoluir o painel de casos da tela de Atendimento para suportar filtro de periodo, filtro de clinica, busca textual, filtro de status e navegacao por paginas.

## Requisitos funcionais

- RF-001: permitir filtrar atendimentos por `data_inicio` e `data_fim`.
- RF-002: permitir filtrar atendimentos por clinica.
- RF-003: manter filtro por status e busca textual.
- RF-004: permitir navegar entre paginas da listagem.
- RF-005: exibir total de resultados e pagina atual.

## Requisitos tecnicos

- RT-001: consumir endpoint `GET /api/v1/atendimentos` com `limit` e `skip`.
- RT-002: enviar filtros via query string (`search`, `status`, `clinica_id`, `data_inicio`, `data_fim`).
- RT-003: manter compatibilidade visual com o layout atual do modulo.

## Criterios de aceitacao

- CA-001: usuario consegue localizar atendimento antigo usando periodo + busca.
- CA-002: usuario consegue restringir por clinica e status sem recarregar modulo inteiro.
- CA-003: botoes de pagina anterior/proxima respeitam limites de pagina.
