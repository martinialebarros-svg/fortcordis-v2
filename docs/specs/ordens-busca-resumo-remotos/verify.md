# Verify

Data: 2026-09-15
Status: aceite autenticado em stage concluído em 18/09/2026 (ver secao propria);
correcao verificada contra Postgres, desempenho nao comprovado no volume de stage.
Base: `fa113ea94fd4387f55b251d91d8db0cf62a48f55` (origin/stage).

## Revalidacao para stage — 2026-09-18

- PR #149 atualizado sobre `8c624d3a43aef9b50ec52466515ffafca63dafe0`,
  sem conflitos e sem alterar o escopo de 12 arquivos da feature.
- Suíte frontend atual: 365 Vitest + 9 Node aprovados; 13 testes de busca,
  agrupamento, resumo e escopo do PDF novamente aprovados. Guardrail SDD aprovado.
- Aceite autenticado e medição continuam pendentes; esta atualização não autoriza produção.
  *(Superado em 18/09/2026 pela secao "Aceite autenticado em stage" abaixo.)*

## Aceite autenticado em stage — 2026-09-18

Fecha o item "Validar em Postgres e stage autenticado" e a medição de
latência/payload. Executado em `app.stage.fortcordis.com.br` com sessão real da
equipe interna, **somente leitura** — nenhuma OS criada, paga, cancelada ou
enviada.

Base de stage: 21 OS, 9 destinatários. Volume pequeno; ver a ressalva no fim.

### Critério 2 — totais independentes da página

`GET /ordens-servico?incluir_resumo=true` com `limit=5` em `skip=0`, `5` e `15`:
`total` = 21 e `resumo` byte a byte idêntico nas três páginas.

```
resumo = {canceladas: 0, pagas: 17, pendentes: 4, valor_pendente: 740, valor_recebido: 3670}
```

### Critério 1 — busca e filtro refletindo no resumo

| Busca | `total` | `valor_recebido` do resumo |
| --- | --- | --- |
| (sem busca) | 21 | 3670 |
| `Aberaldo` (pet) | 7 | 1390 |
| `OS2026050015` (número) | 1 | 230 |

O resumo acompanha o filtro, não fica preso à base inteira.

### Critério 3 — curingas literais

`search=%` → **0** resultados. `search=_` → **0** resultados. Se fossem
interpretados como curinga de SQL, `%` traria as 21. Tratamento literal confirmado
contra Postgres.

### Critério 5 — contrato legado intacto

Sem `incluir_resumo`, a resposta volta como `{total, items}` — sem a chave
`resumo`. A forma antiga não mudou.

### Cobranças — resumo sem leitura de OS

`GET /ordens-servico/cobrancas?limit=50&skip=0` devolve por destinatário apenas
`{chave, nome_destinatario, tipo_destinatario, quantidade_total, quantidade_os,
total_pendente}` — nenhuma OS individual. `total`, `total_os` e `total_pendente`
ficam no topo e não mudam entre páginas (`limit=2` em `skip=0` e `skip=2`: total 9
nas duas).

Conferência cruzada entre as duas agregações, que são caminhos independentes:

- `cobrancas.total_pendente` = **740** = `ordens.resumo.valor_pendente` = **740**
- `cobrancas.total_os` = **21** = total de OS
- Destinatário "Animal Care": resumo diz 3 OS / R$ 510; o detalhe sob demanda
  (`destinatario_chave` + `status=Pendente`) devolve 3 OS somando exatamente
  R$ 510 em `valor_final`.

### Medição de latência e payload

Cinco chamadas por cenário, mediana:

| Cenário | Mediana | Payload |
| --- | --- | --- |
| `limit=100` sem resumo (contrato legado) | 123 ms | 15,7 KB |
| `limit=100` com resumo | 133 ms | 15,8 KB |
| `limit=5` com resumo | 112 ms | 4,0 KB |
| `cobrancas limit=50` | 221 ms | 1,4 KB |
| detalhe por destinatário | 145 ms | - |

**Não há ganho de velocidade a comprovar neste volume, e a ressalva original
estava certa.** Com 21 OS tudo cabe numa página, então a paginação remota não tem
o que economizar; o `resumo` custa ~10 ms de agregação a mais. O desenho (100 por
página, totais remotos, detalhe sob demanda) é sobre escalar para milhares de OS,
e stage não tem massa para demonstrar isso. O que este aceite estabelece é
**correção** — totais certos, busca certa, contrato preservado -, não desempenho.

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
- ~~Validar em Postgres e stage autenticado após autorização de publicação.~~
  **Feito em 18/09/2026** — ver "Aceite autenticado em stage".
- ~~Medir latência/payload antes e depois~~ **medido em 18/09/2026**; segue valendo
  que **não há ganho de velocidade comprovado**, e no volume de stage (21 OS) não há
  como comprovar. O aceite cobre correção, não desempenho.
- Em aberto: medir com massa realista (milhares de OS) para confirmar que o desenho
  entrega o que promete em escala.
