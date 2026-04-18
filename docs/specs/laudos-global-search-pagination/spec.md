# Spec - laudos-global-search-pagination

Data: 2026-04-18  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Corrigir a tela de laudos para:
- consultar a API com busca remota em toda a base;
- permitir filtro por data do laudo/exame;
- manter carga inicial paginada e enxuta;
- mostrar total real de resultados e permitir carregar paginas adicionais na tela.

## 2) Requisitos funcionais (RF)

- RF-001: o endpoint `GET /laudos` deve aceitar `search` para pesquisar por titulo, paciente, tutor, clinica, status e tipo.
- RF-002: o endpoint `GET /laudos` deve aceitar `data` para filtrar por `data_exame` ou `data_laudo`.
- RF-003: o backend deve enriquecer a listagem com paciente, tutor e clinica usando consulta unica com joins.
- RF-004: a tela `/laudos` deve consultar o backend conforme o usuario digita, sem depender apenas do lote inicial.
- RF-005: a tela `/laudos` deve exibir o total real de laudos retornado pela API.
- RF-006: a tela `/laudos` deve permitir carregar mais paginas sem duplicar registros.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: a abertura inicial da tela deve continuar limitada a 100 laudos por pagina.
- NFR-002: a busca deve aceitar formatos de data `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` e `YYYY/MM/DD`.
- NFR-003: a implementacao nao deve exigir novas dependencias externas.

## 4) Criterios de aceitacao (CA)

- CA-001: buscar por nome do animal retorna laudos antigos fora do primeiro lote inicial.
- CA-002: buscar por nome do tutor ou da clinica retorna laudos fora do primeiro lote inicial.
- CA-003: filtrar por data retorna laudos cuja `data_exame` ou `data_laudo` corresponda ao dia informado.
- CA-004: a aba de laudos mostra total coerente e permite carregar mais resultados.
- CA-005: o backend continua compilando e a pagina continua passando no lint.
