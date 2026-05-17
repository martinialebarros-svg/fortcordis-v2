# Spec - arch-fe-01-modularizar-atendimento-for39

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## 1) Escopo funcional

Refatoracao incremental de `atendimento/page.tsx` por extracao de utilitarios puros para modulo compartilhado, sem alterar regras de negocio e sem mudancas visuais para usuario final.

## 2) Requisitos funcionais (RF)

- RF-001: mover utilitarios de data (`nowLocalInput`, `isoToLocalInput`, `isoToOptionalLocalInput`) para modulo dedicado.
- RF-002: mover utilitarios de exibicao/arquivo (`formatDate`, `formatBytes`, `parseDownloadFilename`) para modulo dedicado.
- RF-003: mover utilitarios de parsing (`normalizePeso`, `parseDecimalInput`, `parseStringListInput`) para modulo dedicado.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): sem degradacao perceptivel de runtime.
- NFR-002 (seguranca/permissoes): nenhuma alteracao de permissao/autenticacao.
- NFR-003 (manutenibilidade): reduzir codigo utilitario local e duplicacao no `page.tsx`.

## 4) Contratos tecnicos

### API

- Endpoint: sem alteracoes.
- Metodo: sem alteracoes.
- Payload: sem alteracoes.
- Resposta: sem alteracoes.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx`.
- Modulo novo: `frontend/lib/atendimento-utils.ts`.
- Regras de exibicao/erro: inalteradas.

## 5) Compatibilidade e rollout

- Backward compatibility: preservada.
- Feature flag: nao.
- Estrategia de rollback: reverter commit da extracao.

## 6) Criterios de aceitacao (CA)

- CA-001: `npx eslint app/atendimento/page.tsx lib/atendimento-utils.ts` executa sem erro.
- CA-002: `npm run build` no frontend executa sem erro.
- CA-003: comportamento funcional da tela de atendimento permanece inalterado.

## 7) Casos de borda

- CB-001: datas invalidas continuam com fallback anterior.
- CB-002: nomes de arquivo com `filename*` seguem decodificacao UTF-8.

## 8) Fora de escopo

- Extracao completa de hooks de estado/efeitos neste mesmo commit.
- Alteracao de componentes de UI da consulta/triagem.
