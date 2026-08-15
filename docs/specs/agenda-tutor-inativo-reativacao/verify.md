# Verify - agenda-tutor-inativo-reativacao

Data: 2026-08-04

Responsavel: Codex
Status: verified-local

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `backend/tests/test_tutor_inativo_reativacao.py::test_tutor_inativo_exige_confirmacao_e_volta_para_a_busca_apos_reativacao` | ok |
| CA-002 | mesmo teste: confirmacao reativa e `listar_tutores(busca="genival")` retorna o ID original | ok |
| CA-003 | mesmo teste: primeira tentativa deixa `ativo=0` e telefone inalterado | ok |
| CA-004 | `backend/tests/test_tutor_inativo_reativacao.py::test_tutor_ativo_com_mesmo_nome_continua_idempotente` | ok |

## Comandos executados

```bash
cd backend && venv/bin/python -m pytest tests/test_tutor_inativo_reativacao.py tests/test_tutor_panorama_georef.py
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx
cd frontend && npx tsc --noEmit
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
git diff --check
```

Resultados:

- Backend: `7 passed` em `test_tutor_inativo_reativacao.py` e `test_tutor_panorama_georef.py`.
- Frontend: ESLint focado, `tsc --noEmit` e `npm run build` passaram.
- Integridade e SDD: `git diff --check` e o guardrail SDD passaram no commit da correcao.

## Verificacao manual

1. Tentar cadastrar um tutor que exista apenas como inativo e confirmar que o modal oferece "Reativar tutor".
2. Escolher "Manter como esta" e verificar que o cadastro permanece inativo e sem pet novo vinculado.
3. Repetir, escolher "Reativar tutor" e buscar o nome no seletor de Tutor da Agenda.
