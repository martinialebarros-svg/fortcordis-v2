# Verify - fiscal-clinic-period-consolidated-export

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_endpoint_lista_apenas_clinicas_com_os_no_periodo_por_data_atendimento` | ok |
| CA-002 | aceitacao | UI atualiza `clinicasSel` para todas as clinicas retornadas no modo multi | ok |
| CA-003 | aceitacao | `test_csv_e_xlsx_exportam_linhas_consolidadas_por_clinica` | ok |
| CA-004 | aceitacao | teste valida Clinica A com total `350.0` e ISS `17.5` | ok |
| CA-005 | aceitacao | teste valida ausencia de `OS Referencia`, `Paciente`, `Tutor` e `Servico` | ok |
| NFR-001 | nao funcional | busca de OS usa `/fiscal/os-para-fiscal` com multiplos `clinica_ids` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/bin/python -m pytest backend/tests/test_fiscal_exportacao_consolidada.py
npm exec eslint app/fiscal/components/ExportacaoDadosContabeisPage.tsx
npx tsc --noEmit
git diff --check
```

Resumo dos resultados:
- Backend: 3 testes passaram.
- Frontend: ESLint do arquivo fiscal passou.
- TypeScript: `npx tsc --noEmit` passou.
- Diff: `git diff --check` passou.

## 3) Testes manuais

- Cenario 1: selecionar periodo deve carregar apenas clinicas com OS.
- Cenario 2: modo varias clinicas deve iniciar com todas as clinicas elegiveis marcadas.
- Cenario 3: exportar lote deve produzir relatorio consolidado por clinica.

## 4) Regressao e riscos residuais

- Risco residual 1: contabilidade pode solicitar alguma coluna antiga de volta em formato consolidado.
- Risco residual 2: se uma clinica tiver dados cadastrais incompletos, a validacao multiclinica continua bloqueando a exportacao.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado.
