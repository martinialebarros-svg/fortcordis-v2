# Verify - promocao-bloqueia-criterio-pendente

Data: 2026-09-13
Responsavel: Martiniano
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | gate rodado sobre `9da6868e...adf346ea` reprova apontando `RF-002, RF-003 / CA-002` de `receita-emitida-em-fuso-operacional` (secao 3) | ok |
| CA-002 | aceitacao | na mesma execucao, `atendimento-continuidade-pos-alta` aparece como feature promovida e nao gera apontamento | ok |
| CA-003 | aceitacao | `test_generico_em_prosa_tecnica_nao_e_pendencia` cobre o `indice unico parcial de idempotency_key` | ok |
| CA-004 | aceitacao | `test_status_que_comeca_bem_e_termina_pendente` cobre `aprovado em stage; producao pendente`, `passou localmente; proximo deploy pendente` e `ok/pendente` | ok |
| CA-005 | aceitacao | `test_vocabulario_de_aprovacao_do_repo_nao_e_pendencia` | ok |
| CA-006 | aceitacao | execucao com `--allow-pending` sai `PASSED` e ainda imprime o `CA-002` liberado (secao 3) | ok |
| CA-007 | aceitacao | diff `7bbd98c3...adf346ea` (so workflows) sai `Nenhuma feature de docs/specs no diff` | ok |
| RF-003 | funcional | `test_ignora_templates_e_arquivos_fora_de_specs` | ok |
| RF-004 | funcional | `test_le_apenas_tabela_com_coluna_status`: a tabela `Etapa/Resultado` com celula `pendente` e ignorada | ok |
| RF-008 | funcional | saida nomeia arquivo, identificador e status; `test_tabela_sem_coluna_id_ainda_reporta` cobre tabela sem coluna ID | ok |
| NFR-001 | nao funcional | regra final aplicada aos 1628 status do repo (fora templates): 49 marcados, todos pendencia real; o unico falso positivo conhecido foi eliminado pela regra forte/generico | ok |
| NFR-002 | nao funcional | script usa apenas `git diff` e leitura de arquivo | ok |

## 2) Testes automatizados executados

```bash
python3 -m unittest backend.tests.test_promotion_verify_pending
```

Resultado: 10 testes, todos passando.

## 3) Execucao contra a promocao real (PR #117)

| Cenario | Comando | Resultado |
| --- | --- | --- |
| Promocao com criterio aberto | `--base-sha 9da6868e --head-sha adf346ea` | `FAILED`, aponta `RF-002, RF-003 / CA-002: pendente` |
| Mesma promocao com a label | idem `--allow-pending` | `PASSED`, pendencia ainda listada |
| Diff sem specs | `--base-sha 7bbd98c3 --head-sha adf346ea` | `PASSED`, gate dispensado |

## 4) Dogfooding

O gate foi executado sobre o proprio diff desta entrega: a feature
`promocao-bloqueia-criterio-pendente` nao tem criterio aberto, entao a sua
propria promocao passa.

## 5) Nada pendente

Todos os criterios desta spec estao fechados. Se algum ficasse aberto, este
mesmo gate reprovaria a promocao desta feature.
