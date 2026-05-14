# Verify - api-01-n-plus-one-atendimento-for27

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | Teste `test_listar_atendimentos_carrega_exames_e_prescricao_em_lote` valida `total_exames` e `tem_prescricao` para múltiplos atendimentos. | ok |
| CA-002 | No mesmo teste, captura SQL confirma uma única consulta agregada com `count` em `exames`. | ok |
| CA-003 | No mesmo teste, captura SQL confirma uma única consulta `distinct` em `prescricoes_clinicas`. | ok |

## Validacoes executadas

- `cd backend && ./venv/bin/python -m unittest -q tests.test_atendimento_list_n_plus_one`
