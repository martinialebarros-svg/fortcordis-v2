# Spec - dashboard-mobile-notification-clearance

Data: 2026-08-11
Responsavel: Codex
Status: concluido

## Escopo funcional

Os avisos em tempo real de Agenda, Calendario e Atendimento nao podem se sobrepor ao controle de abrir/fechar o menu do shell protegido no mobile.

## Requisitos

- RF-001: em viewport abaixo de `lg`, cada aviso fixo no canto superior direito deve iniciar abaixo do cabecalho mobile, incluindo `safe-area-inset-top` quando presente.
- RF-002: Agenda, Calendario e Atendimento devem manter seus avisos acessiveis e clicaveis.
- RF-003: a partir de `lg`, os avisos mantem a posicao atual de `top-4`.
- NFR-001: a mudanca nao altera API, autenticacao, navegacao ou semantica dos avisos.

## Criterios de aceitacao

- CA-001: em 375x812, um aviso visivel nao cobre o botao de menu do cabecalho.
- CA-002: em desktop, os avisos continuam no canto superior direito com a distancia atual da borda.
- CA-003: lint, verificacao de tipos e build do frontend concluem sem erro.

## Compatibilidade e rollback

- Backward compatibility: mantida; somente o posicionamento responsivo muda.
- Migracao: nao aplicavel.
- Rollback: reverter as classes de posicionamento dos tres avisos.
