# Verify - financeiro-pendencias-cobranca-pdf

Data: 2026-06-12
Responsavel: Martiniano + Codex
Status: done (hotfix de 2026-06-12); ajuste de tabela de 2026-10-06 validado localmente, sem publicacao

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | regressao | `_gerar_pdf_cobranca_pendencias` usa `pagesize=A4` sem referencia a `agrupar` | ok |
| CA-002 | regressao | teste focal gera bytes de PDF com item pendente de exemplo | ok |
| CA-003 | regressao | `frontend/app/financeiro/page.tsx` extrai `detail` de erro em `blob` para o PDF de pendencias | ok |
| HOTFIX-001 | ci | workflow `Deploy to VPS` apontou estrutura SDD incompleta; `intent.md` e `plan.md` adicionados ao mesmo diretorio da feature | ok |
| CA-004 | layout | Teste `tests.test_pdf_cobranca_pendencias_layout` com campos longos e caracteres especiais; renderizacoes sintetica e do caso encaminhado sem sobreposicao na tabela | ok local |
| CA-005 | layout | PDF sintetico de 60 linhas: 3 paginas A4, cabecalho repetido, total na ultima pagina; todas as paginas inspecionadas sem colisao com rodape | ok local |
| CA-006 | regressao | Testes focais do backend (5 passaram), assinatura `%PDF`, texto e logomarca equivalentes ao PDF original; filtros e contrato de download sem alteracao | ok local |

## 2) Testes automatizados do hotfix de 2026-06-12

Comandos registrados naquele ciclo:

```bash
cd backend && ./venv/bin/python -m py_compile app/api/v1/endpoints/ordens_servico.py
cd frontend && npx eslint app/financeiro/page.tsx
cd frontend && npx tsc --noEmit
backend/venv/bin/python -m unittest backend/tests/test_sdd_guardrail.py
```

Resumo:
- `./venv/bin/python -m py_compile app/api/v1/endpoints/ordens_servico.py`: ok
- geracao focal de PDF com `_gerar_pdf_cobranca_pendencias` e item de exemplo: ok (`%PDF`, 2816 bytes); dados do exemplo omitidos deste documento
- `npx eslint app/financeiro/page.tsx`: ok
- `npx tsc --noEmit`: ok
- `backend/venv/bin/python -m unittest backend/tests/test_sdd_guardrail.py`: ok (`5 passed`)

## 3) Smoke manual recomendado

- Abrir Financeiro em producao/stage com OS pendentes.
- Clicar em `Baixar PDF` no card de uma clinica com pendencias.
- Confirmar que o arquivo PDF baixa e abre.
- Repetir no botao geral de pendencias, se houver mais de uma clinica filtrada.

## 4) Riscos residuais

- A validacao local nao substitui o smoke autenticado no ambiente publicado com dados reais.

## 5) Validacao local do ajuste de tabela de 2026-10-06

Os resultados das secoes 1 e 2 marcados como `ok` pertencem ao hotfix de 2026-06-12. Para o ajuste atual:

- `tests.test_pdf_cobranca_pendencias_layout` passou: celulas `Paragraph` com texto longo e caracteres especiais, altura dinamica da linha e largura da tabela dentro da area util. Um caso sintetico com OS, paciente, tutor e servico longos foi renderizado e inspecionado sem invasao de colunas.
- `tests.test_ordens_servico_domiciliar` e `tests.test_pdf_cobranca_pendencias_layout`: 5 testes passaram no total.
- `py_compile` do endpoint: passou. Guardrail SDD: 5 testes passaram. `git diff --check`: passou.
- PDF do caso encaminhado: regenerado localmente sem incluir dados do paciente nesta verificacao; 1 pagina A4 renderizada e inspecionada, sem sobreposicao da tabela. As 40 linhas de texto extraido coincidem com o original apos normalizacao de espacos; a logomarca incorporada tem o mesmo hash.
- PDF sintetico com 60 linhas: 3 paginas, cabecalho repetido, total na ultima pagina; todas as paginas inspecionadas sem colisao com o rodape.
- Ruff indisponivel no venv do backend; lint Python nao verificado neste ciclo.

Validacao restrita ao ambiente local. Nao houve publicacao em stage ou producao.
