# Spec - fiscal-exportacao-contabil-ux

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Refatorar a experiencia do modulo fiscal para fluxo de preparacao e exportacao de dados contabeis por periodo e clinica.

## Requisitos funcionais

- RF-001: ao abrir `/fiscal`, usuario deve acessar diretamente a tela de exportacao contabil.
- RF-002: o menu lateral deve usar nomenclatura de exportacao fiscal.
- RF-003: textos da tela devem enfatizar consolidacao por periodo/clinica e envio a contabilidade.
- RF-004: mensagens de configuracao fiscal devem mencionar exportacao de relatorio contabil.

## Requisitos tecnicos

- RT-001: manter rotas existentes `/fiscal/nova` e `/fiscal/exportar` compativeis.
- RT-002: evitar mudancas de contrato backend para este ajuste (somente UX/roteamento frontend).

## Criterios de aceitacao

- CA-001: `/fiscal` renderiza o componente `ExportacaoDadosContabeisPage`.
- CA-002: menu lateral exibe "Exportacao Fiscal".
- CA-003: tela exibe titulo e chamadas orientadas a exportacao contabil.
- CA-004: texto de configuracoes fiscais remove referencia a exportar "notas fiscais".
