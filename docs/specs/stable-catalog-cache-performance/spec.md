# Spec - stable-catalog-cache-performance

Data: 2026-08-31
Responsavel: Codex / equipe FortCordis
Status: em desenvolvimento

## Requisitos funcionais

- RF-001: apenas os catálogos de `clinicas` e `servicos` podem usar o cache desta entrega.
- RF-002: uma entrada válida deve durar no máximo cinco minutos e distinguir variantes, como `limit=500`, `limit=1000` e a listagem paginada.
- RF-003: chamadas concorrentes da mesma sessão, catálogo e variante devem compartilhar uma única solicitação.
- RF-004: respostas rejeitadas não podem ser armazenadas; a próxima leitura deve poder tentar novamente.
- RF-005: uma resposta bem-sucedida de `POST`, `PUT`, `PATCH` ou `DELETE` em uma clínica ou serviço deve invalidar todas as variantes daquele catálogo.
- RF-006: se a sessão autenticada mudar, as entradas e solicitações pendentes da sessão anterior não podem ser reaproveitadas.

## Requisitos não funcionais

- NFR-001: o cache é somente de memória no navegador e não grava payloads em disco ou armazenamento persistente.
- NFR-002: dados operacionais, financeiros, clínicos e de pessoas não usam o cache desta feature.
- NFR-003: as páginas devem manter os mesmos estados de carregamento e tratamento de erro já existentes.

## Critérios de aceitação

- CA-001: leituras repetidas da mesma variante dentro do TTL não executam nova chamada.
- CA-002: expiração, falha, invalidação e troca de sessão resultam em nova chamada quando necessário.
- CA-003: Agenda, Financeiro, Atendimento, relatórios e telas administrativas consomem as variantes de catálogos mapeadas.
- CA-004: testes, lint, TypeScript, build e guardrail SDD terminam sem falhas.
- CA-005: em stage, abrir filtros de Agenda e a aba de Ordens do Financeiro preserva os resultados e não apresenta erro de carregamento.

## Rollout

Entrega inicialmente para `stage`. A promoção para produção depende de workflow terminal e smoke autenticado das rotas afetadas.
