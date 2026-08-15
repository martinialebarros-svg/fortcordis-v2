# Verify - atendimento-performance-nplus1-timeline

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | test_atendimento_sync_batching_nplus1.py::test_painel_de_8_exames_com_mesmo_catalogo_faz_uma_unica_query_de_catalogo | ok |
| CA-002 | aceitacao | test_atendimento_sync_batching_nplus1.py::test_5_exames_com_catalogos_distintos_faz_uma_query_com_in | ok |
| CA-003 | aceitacao | test_atendimento_sync_batching_nplus1.py::test_prescricao_com_5_itens_por_medicamento_id_faz_uma_unica_query | ok |
| CA-004 | aceitacao | test_atendimento_sync_batching_nplus1.py::test_prescricao_com_medicamento_id_invalido_continua_levantando_422 | ok |
| CA-005 | aceitacao | test_atendimento_timeline_limitada.py::test_reaproveita_lista_de_atendimentos_ja_buscada_sem_reconsultar | ok |
| CA-006 | aceitacao | test_atendimento_timeline_limitada.py::test_exames_e_laudos_sao_limitados_mesmo_com_centenas_no_historico | ok |
| CA-007 | aceitacao | test_atendimento_timeline_limitada.py::test_sem_atendimentos_paciente_faz_a_propria_query_limitada | ok |
| CB-001 | caso de borda | garantido pelo `if catalogo_ids else {}` - nao gera SQL com IN vazio | ok (por construcao) |
| CB-002 | caso de borda | `medicamento_ids_sem_nome` so inclui itens SEM `medicamento_nome` - confirmado pela condicao no set comprehension | ok (por construcao) |
| NFR-001 | performance | CA-001/CA-002/CA-003 provam O(1) query por tabela de referencia | ok |
| NFR-002 | performance | CA-006 prova que o volume historico total nao afeta o numero de eventos retornados | ok |
| NFR-003 | correcao | suite completa (673/673) confirma que a reordenacao final continua correta | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
./venv/bin/python -m pytest tests/test_atendimento_sync_batching_nplus1.py \
  tests/test_atendimento_timeline_limitada.py -v --no-header

./venv/bin/python -m pytest tests/ -q --no-header
```

Resumo dos resultados:
- Backend (arquivos da feature): 7 passed, 0 failed (4 + 3).
- Backend (suite completa): 673 passed, 0 failed (baseline antes deste
  pacote: 666).
- Frontend: N/A (sem mudanca de frontend nesta feature).

## 3) Testes manuais

Nao aplicavel - contagem de query e uma propriedade puramente mecanica,
capturada via instrumentacao real do driver SQLite
(`event.listen(engine, "before_cursor_execute", ...)`) - o mesmo SQL que
seria emitido contra Postgres em producao, so trocando o dialeto.

## 4) Regressao e riscos residuais

- Risco residual 1: o batching assume que `CatalogoExame`/`PainelExame`/
  `Medicamento` nao mudam DURANTE o processamento de um unico payload
  (correto - sao entidades de referencia, nao editadas pelo mesmo
  fluxo que as consome).
- Risco residual 2: a timeline agora pode OMITIR exames/laudos antigos
  além do `limite` que antes apareciam (comportamento intencional da
  correcao - trade-off explicito entre completude historica ilimitada e
  performance previsível, documentado no intent.md).

## 5) Itens fora de escopo entregues

Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
