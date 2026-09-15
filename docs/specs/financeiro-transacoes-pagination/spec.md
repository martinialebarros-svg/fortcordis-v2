# Spec — Paginação de Transações

Data: 2026-09-13

## Contrato

- API autenticada `GET /financeiro/transacoes` mantém filtros existentes e resposta
  `{total, items}`; adiciona `search` opcional sobre descrição, paciente e nome da categoria.
- Busca literal, sem diferenciar maiúsculas ASCII, após trim; `%`, `_` e barra
  invertida são escapados. `banho_tosa` continua pesquisável como `Banho e Tosa`.
- Filtros e busca aplicados antes de `count`, `offset`, `limit`.
- Ordenação `data_transacao DESC, id DESC`; sem snapshot entre páginas, registros
  concorrentes podem deslocar offsets.
- Frontend carrega até 100 transações por página e mostra contagem total do servidor.
- Busca usa debounce de 300 ms. Mudança de filtros/busca volta à primeira página.
- Dados da consulta anterior não são apresentados como resultado da nova consulta.
- Respostas canceladas não atualizam resultados. Falhas mostram alerta e nova tentativa,
  não lista vazia. Página final removida retorna à última página válida.
- Resumo monetário continua vindo de `/financeiro/resumo`, nunca da soma da página.
- Ordens, Cobranças, seleção em lote, recibos e mutações permanecem inalterados.

## Aceitação

1. Buscar registro além do antigo limite de 500 e manter total filtrado correto.
2. Navegar por páginas determinísticas e tratar última página/vazio.
3. Resetar busca para página 1; não aplicar filtro textual local à página recebida.
4. Falha recuperável e resposta atrasada cancelada cobertas por testes.
5. Não atribuir redução de latência sem medição no ambiente publicado.

## Segurança e compatibilidade

Sem migração, cálculo financeiro, mudança de autorização ou envio externo.
Clientes antigos continuam suportados. Backend novo é pré-requisito do frontend.
Reverter código restaura comportamento anterior; registros não são modificados.
