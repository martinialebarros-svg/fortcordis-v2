# Spec - configuracoes-auditoria-detalhes-estruturados

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

A tabela "Auditoria de acoes" (`/configuracoes`, aba Usuarios) ganha uma
coluna "Detalhes" com um botao "Ver detalhes"/"Ocultar" por linha, que
expande/colapsa uma linha extra mostrando `item.detalhes` renderizado de
forma legivel: uma mini-tabela Campo/Antes/Depois quando o payload tem
`alteracoes`, mais qualquer outra chave de nivel superior como par
chave-valor.

## 2) Requisitos funcionais (RF)

- RF-001: cada linha da tabela de auditoria com `item.detalhes` nao
  vazio (`Object.keys(item.detalhes).length > 0`) mostra um botao "Ver
  detalhes" na nova coluna "Detalhes"; linhas sem detalhes mostram "-".
- RF-002: clicar em "Ver detalhes" insere uma linha imediatamente abaixo
  (`colSpan=6`) com o conteudo renderizado de `item.detalhes` e troca o
  texto do botao para "Ocultar"; clicar em "Ocultar" recolhe a linha e
  volta o texto para "Ver detalhes". Estado por linha, independente
  (`Record<number, boolean>` por `item.id`).
- RF-003: se `item.detalhes.alteracoes` existir e for um objeto (nao
  array), renderiza como tabela com colunas Campo/Antes/Depois, uma
  linha por chave de `alteracoes`.
- RF-004: as demais chaves de `item.detalhes` (tudo exceto `alteracoes`)
  renderizam como lista `chave: valor`, uma por linha.
- RF-005: valores `null`/`undefined`/string vazia exibem "(vazio)";
  valores objeto/array exibem via `JSON.stringify` (fallback generico,
  nao ha achado atual que produza isso em `detalhes`, mas evita quebrar
  se um call site futuro passar algo assim).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (generico, sem hardcode por achado): o renderizador nao tem
  nenhum `if (acao === "X")` - funciona para qualquer `detalhes` que
  siga o padrao `alteracoes` ou chave-valor simples, de qualquer modulo
  (nao so atendimento).
- NFR-002 (sem mudanca de contrato): nenhum campo novo e pedido ao
  backend - `detalhes` ja era retornado por `GET /admin/auditoria` e ja
  estava tipado no frontend (`AuditoriaEventoItem.detalhes`).
- NFR-003 (legibilidade sob scroll horizontal): a linha expandida usa
  `position: sticky` para permanecer parcialmente visivel mesmo com a
  tabela principal rolada para a direita.

## 4) Contratos tecnicos

### API

Sem mudanca - `GET /api/v1/admin/auditoria` (`require_papel("admin")`)
inalterado; `detalhes` ja fazia parte da resposta.

### Banco/migracoes

Nao aplicavel.

### Frontend

- Arquivo alterado: `frontend/app/configuracoes/page.tsx`.
- Estado novo: `auditoriaExpandida: Record<number, boolean>`.
- Funcoes novas: `formatarValorAuditoria`, `renderizarDetalhesAuditoria`
  (ambas dentro do componente, ao lado de `formatarDataHora`, mesma
  convencao do arquivo).
- Import novo: `Fragment` de `react` (necessario para dar `key` a um
  par de `<tr>` por item dentro do `.map()`, algo que o shorthand `<>`
  nao suporta).

## 5) Compatibilidade e rollout

- Backward compatibility: total - aditivo, nenhuma coluna/comportamento
  existente e removido ou alterado.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit remove a coluna/estado
  novos; a tabela volta a funcionar exatamente como antes.

## 6) Criterios de aceitacao (CA)

- CA-001: um evento `ATENDIMENTO_CONTEUDO_CLINICO_ATUALIZADO` real
  (gerado por um PUT real em `/atendimentos/{id}`) mostra, ao expandir,
  `Campo=queixa_principal`, `Antes=<valor anterior>`,
  `Depois=<valor novo>` corretos.
- CA-002: um evento sem `detalhes` (ou com `detalhes={}`) nao mostra
  botao "Ver detalhes" (mostra "-").
- CA-003: clicar "Ver detalhes" em duas linhas diferentes expande AMBAS
  independentemente (estado por `item.id`, nao um unico toggle global).
- CA-004: `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run
  build` permanecem verdes.

## 7) Casos de borda

- CB-001: `detalhes` com `alteracoes` E outras chaves no mesmo objeto
  (ex.: achado #21 `DOCUMENTO_ATENDIMENTO_ATUALIZADO` tem
  `{"atendimento_id": ..., "alteracoes": {...}}`) renderiza AMBAS as
  secoes (tabela de alteracoes + lista chave-valor do restante).
- CB-002: `alteracoes` sendo um array (nao deveria ocorrer pelo padrao
  atual, mas e verificado) cai no ramo chave-valor simples via
  `!Array.isArray(alteracoes)`, evitando renderizar `.entries()` de um
  array como se fossem colunas Campo/Antes/Depois.

## 8) Fora de escopo

- Link direto de dentro de `/atendimento` para a auditoria filtrada
  daquele atendimento especifico.
- Correcao total do corte visual residual sob scroll horizontal extremo
  (documentado como risco residual, nao um bloqueio).
