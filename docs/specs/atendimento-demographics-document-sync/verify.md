# Verify - atendimento-demographics-document-sync

Data: 2026-07-30
Responsavel: Codex
Status: done

## Matriz de rastreabilidade

| Criterio | Evidencia planejada | Status |
| --- | --- | --- |
| CA-001/CA-002 | inspecao do componente do cabecalho e complementacao + lint/build | passed |
| CA-003/CA-004 | `test_atualiza_paciente_e_tutor_no_mesmo_payload_clinico`, `test_atualizacao_parcial_nao_redefine_sexo_omitido` e cobertura do tutor implicito | passed |
| CA-005 | `test_reimpressao_receita_usa_sexo_e_tutor_atualizados` | passed |
| CA-006 | `test_reimpressao_solicitacao_usa_sexo_e_tutor_atualizados` | passed |
| CA-007 | `test_download_pdf_impede_cache_de_reimpressao` + inspecao do cache-buster frontend | passed |
| CA-008 | suites, lint, TypeScript, build, diff check e SDD | passed |

## Comandos planejados

```bash
backend/venv/bin/python -m pytest -q \
  backend/tests/test_tutor_complementar_persistencia.py \
  backend/tests/test_atendimento_document_demographics.py \
  backend/tests/test_atendimento_documentos.py \
  backend/tests/test_atendimento_pdf_auth.py

backend/venv/bin/python -m pytest -q backend/tests

cd frontend
npm run lint
npx tsc --noEmit
npm run build

git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

## Resultado

- Testes direcionados: `20 passed`.
- Suite backend: `520 passed, 13 subtests passed`.
- Frontend: lint, TypeScript e build Next.js aprovados.
- `git diff --check`: aprovado.
- Guardrail SDD: aprovado sobre os arquivos alterados e novos da arvore de
  trabalho, com a feature `atendimento-demographics-document-sync`
  qualificada.
- Avisos observados: apenas deprecacoes ja existentes de Pydantic, SQLAlchemy,
  FastAPI e `crypt`; nenhum erro novo.
