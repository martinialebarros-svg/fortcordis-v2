# Verify

Data: 2026-09-15
Status: backend e interfaces de Ordens e Cobranças implementados localmente; não publicado.
Base: `fa113ea94fd4387f55b251d91d8db0cf62a48f55` (origin/stage).

## Evidências

- `test_ordens_busca_resumo.py`: 13 testes aprovados, SQLite isolado, 505 OS
  sintéticas. Busca nos cinco campos; caracteres literais; rótulo domiciliar;
  totais filtrados, zeros, valores decimais, ordenação e paginação; duas SELECTs.
- Agrupamentos: totais completos com um destinatário por página, chaves de
  tutor/clínica com mesmo ID, detalhes sem canceladas, filtros, vazio e duas
  consultas agregadas sem materialização de OS/contatos individuais.
- `test_ordens_servico_domiciliar.py`: 4 testes existentes aprovados.
- `test_portal_clinica_recibo.py`: 3 testes existentes aprovados.
- `compileall` dos dois arquivos Python, `git diff --check` e guardrail SDD
  sobre diff e arquivos novos: aprovados. Revisão confirma que o contrato legado
  e dependências de autenticação permanecem intactos.
- `npm test`: 322 Vitest + 9 Node aprovados. Inclui seleção entre páginas,
  busca/filtros, falha com retry, resposta atrasada e deep link por ID.
- `ordens-selection.test.ts`: 8 testes (incluídos na suíte acima) com IDs de
  páginas diferentes, divergência de status/valor/destinatário, exclusão/falha,
  IDs ausentes/duplicados e concorrência limitada a cinco leituras.
- `npx tsc --noEmit`, lint e build aprovados (43 páginas estáticas).
- Cobranças: 7 testes do carregador completo e 4 testes de interface cobrem
  resumos sem leitura inicial de OS, paginação remota, segundo lote, falha parcial,
  duplicação, mudança de totais/valores, limite máximo e cancelamento/resposta
  atrasada após nova busca. Nenhuma chamada de escrita nesses cenários.
- PDF: teste de escopo confirma que busca literal `%` e chave de clínica não
  ampliam o conjunto pendente. Não houve renderização visual do PDF neste ciclo;
  seu gerador/layout não foi alterado, apenas os parâmetros de seleção.
- Total backend selecionado: 20 testes. Aviso não bloqueante no build/testes:
  base Browserslist desatualizada; dependências não foram atualizadas neste ciclo.
- Não houve aceite de navegador publicado nem teste real de pagamento/envio.
- Sem leitura de dados reais, mutações financeiras ou mensagens externas.

## Rastreabilidade

| Critério | Evidência | Status |
|---|---|---|
| 1 | search_full_base_and_all_visible_fields + filters_apply_to_items_count_and_summary | ok local |
| 2 | summary_independent_of_page_and_decimal_sum | ok local |
| 3 | literal_wildcards_and_empty_search + rótulo domiciliar | ok local |
| 4 | two_reads_no_n_plus_one | ok local |
| 5 | old_contract_unchanged_and_stable_pages + regressão OS domiciliar | ok local |

## Ainda pendente para a otimização completa

- Cobranças já usa 50 resumos por página e detalhes completos sob demanda em
  lotes de 100, com teto de 10000 OS/30 segundos. Totais independem da página.
- A aba Ordens já usa 100 por página, total remoto e snapshots selecionados fora
  da página. Troca de filtro/aba limpa explicitamente a seleção, não a troca de página.
- Validar em Postgres e stage autenticado após autorização de publicação.
- Medir latência/payload antes e depois; não há ganho de velocidade comprovado aqui.
