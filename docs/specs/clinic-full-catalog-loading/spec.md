# Spec - clinic-full-catalog-loading

Data: 2026-07-05  
Responsavel: Codex  
Status: done

## 1) Escopo

Corrigir o carregamento de catalogo de clinicas no frontend para que a busca local considere todas as clinicas ativas disponiveis na API, inclusive em producao quando a base excede o limite padrao de 100 registros por resposta.

## 2) Requisitos funcionais (RF)

- RF-001: a tela `/clinicas` deve carregar todas as clinicas ativas antes de aplicar a busca local.
- RF-002: a busca da tela `/clinicas` deve encontrar clinicas posicionadas depois do primeiro lote de 100 registros da API.
- RF-003: formularios de `Laudos` que carregam clinicas para selecao local devem usar o catalogo completo.
- RF-004: o formulario de `Ultrassonografia Abdominal` que carrega clinicas para selecao local deve usar o catalogo completo.
- RF-005: o carregamento completo deve reutilizar helper compartilhado para evitar duplicacao de logica de paginacao no frontend.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: o contrato existente de `GET /clinicas` permanece inalterado.
- NFR-002: a implementacao nao adiciona dependencias externas.
- NFR-003: o carregamento completo deve ser paginado em lotes fixos para evitar uma unica resposta muito grande.

## 4) Contratos tecnicos

### API

- Endpoint consumido: `GET /clinicas`.
- Parametros usados no frontend: `skip` e `limit`.
- Resposta esperada: `{ total, items }` sem alteracao de schema.

### Frontend

- Novo helper: `frontend/lib/clinicas.ts`.
- Telas afetadas: `frontend/app/clinicas/page.tsx`, `frontend/app/laudos/novo/page.tsx`, `frontend/app/laudos/[id]/editar/page.tsx`, `frontend/app/ultrassonografia-abdominal/components/UltrassonografiaAbdominalForm.tsx`.
- Estrategia: iterar em paginas de 500 itens ate atingir `total` ou esgotar a resposta.

## 5) Compatibilidade e rollout

- Backward compatibility: telas continuam usando a mesma API autenticada; apenas deixam de depender do lote inicial.
- Feature flag: nao.
- Rollback: reverter o helper compartilhado e os consumidores afetados.

## 6) Criterios de aceitacao (CA)

- CA-001: a contagem exibida em `/clinicas` reflete o total de clinicas ativas retornadas pela API completa, nao apenas o primeiro lote.
- CA-002: buscar uma clinica ativa localizada apos a posicao 100 na ordenacao alfabetica retorna resultado em `/clinicas`.
- CA-003: a selecao de clinica em `Laudos > Novo` e `Laudos > Editar` inclui clinicas fora do primeiro lote.
- CA-004: a selecao de clinica em `Ultrassonografia Abdominal` inclui clinicas fora do primeiro lote.

## 7) Casos de borda

- CB-001: se `total` vier zerado, o helper deve retornar lista vazia sem iteracoes extras.
- CB-002: se a ultima pagina vier com menos de 500 itens, o carregamento deve encerrar sem nova requisicao desnecessaria.
- CB-003: se uma tela falhar ao carregar o catalogo completo, o tratamento de erro existente da tela deve ser preservado.

## 8) Fora de escopo

- Trocar a listagem de clinicas para busca remota por termo.
- Alterar o limite padrao do backend para todos os consumidores de `/clinicas`.
