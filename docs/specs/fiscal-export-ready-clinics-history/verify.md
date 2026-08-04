# Verify - fiscal-export-ready-clinics-history

Data: 2026-08-04
Responsavel: Codex
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidência | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | `test_filtro_de_clinicas_completas_usa_mesma_regra_da_validacao_final` | ok |
| CA-002 | aceitação | cartão `totalClinicasSel` e cartão `totalSel` derivados dos `Set` de caixas marcadas | ok |
| CA-003 | aceitação | `test_endpoint_de_exportacao_registra_historico_apos_gerar_arquivo` | ok |
| CA-004 | aceitação | `test_registra_e_lista_historico_da_emissao_sem_dados_de_paciente` | ok |
| CA-005 | aceitação | regra `listar_clinicas_invalidas_para_exportacao` coberta pelo teste de filtro | ok |
| NFR-001 | não funcional | `campos_fiscais_pendentes_da_clinica` é reutilizada pela lista e validação final | ok |
| NFR-002 | não funcional | router fiscal já exige `get_current_user`; emissão recebe usuário autenticado | ok |
| NFR-003 | não funcional | `registrar_emissao_relatorio_fiscal` executa antes de retornar `StreamingResponse` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m pytest backend/tests/test_fiscal_exportacao_consolidada.py backend/tests/test_fiscal_numero_sequence.py backend/tests/test_fiscal_numero_unicidade.py -q
(cd frontend && NODE_PATH=/Users/martiniano/fortcordis-v2/frontend/node_modules /Users/martiniano/fortcordis-v2/frontend/node_modules/.bin/eslint app/fiscal/components/ExportacaoDadosContabeisPage.tsx --max-warnings=0)
DATABASE_URL=sqlite:////tmp/fortcordis-fiscal-import-check.db SECRET_KEY=... /Users/martiniano/fortcordis-v2/backend/venv/bin/python -c "from app.api.v1.endpoints import fiscal"
git diff --check
```

Resumo dos resultados:
- Backend: 11 testes fiscais passaram.
- Frontend: ESLint e checagem TypeScript focada no componente passaram. A configuração temporária utiliza as dependências do checkout principal, pois o worktree limpo não contém `node_modules`.
- Migração: criação idempotente da tabela validada em SQLite.
- Diff: aprovado.

## 3) Testes manuais

- Cenario 1: alternar “somente cadastros completos” e conferir que os incompletos não podem ser marcados.
- Cenario 2: marcar e desmarcar clínicas/OS e conferir o cartão de valor.
- Cenario 3: exportar em ambos os tipos e conferir a linha recém-criada no histórico.

## 4) Regressão e riscos residuais

- Risco residual 1: o histórico não impede duplicidade de emissão; essa decisão permanece humana.
- Risco residual 2: cadastros antigos podem exigir complementação antes de entrarem no filtro padrão.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisão de release

- [x] Aprovado para stage.
- [ ] Aprovado para produção (aguarda solicitação explícita de publicação).
- [ ] Não aprovado (descrever motivo).
