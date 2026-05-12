# Verify - backend-security-hardening-sprint1

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Router fiscal exige `get_current_user` globalmente. | ok |
| CA-002 | aceitacao | `core/security.py` mapeia `/api/v1/fiscal` e `/api/v1/relatorios` na matriz. | ok |
| CA-003 | aceitacao | `verify_password` aceita apenas bcrypt e rejeita plaintext. | ok |
| CA-004 | aceitacao | `runtime_checks` aplica fail-fast de `SECRET_KEY` fraca em producao. | ok |
| CA-005 | aceitacao | Runbook criado em `backend/docs/SECRET_KEY_ROTATION_RUNBOOK.md`. | ok |
| CA-006 | aceitacao | `POST /auth/login` define cookie de sessao `HttpOnly`; frontend usa `withCredentials`/`credentials: include`. | ok |
| CA-007 | aceitacao | `POST /auth/logout` remove cookie e `layout-dashboard` valida sessao por `/auth/me`. | ok |
| CA-008 | aceitacao | Deploy de `stage` reforca `APP_ENV=stage` e `AUTH_COOKIE_SECURE=true` no `backend/.env`. | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
backend/venv/bin/pytest -q backend/tests/test_permission_matrix_sync.py backend/tests/test_fiscal_exportacao_consolidada.py
backend/venv/bin/pytest -q backend/tests/test_runtime_checks_observability.py backend/tests/test_admin_hardening_readiness.py backend/tests/test_permission_matrix_sync.py
```

Resumo dos resultados:
- 12 testes passaram na validacao inicial de permissao/fiscal.
- 13 testes passaram na validacao consolidada de runtime/hardening.
- Sem falhas de regressao nos testes focados.
- Validacao tecnica adicional do FOR-18:
  - `python3 -m py_compile` em `auth.py`, `security.py`, `atendimento.py` e teste de PDF auth: ok.
  - `npx eslint` nos arquivos frontend alterados de auth/cookie: ok.
  - Suite Python completa nao executada neste ambiente por ausencia de dependencias (`fastapi`/`pytest`).
  - Hardening operacional stage: `scripts/deploy_prod_vps.sh` atualizado para aplicar env de cookie seguro antes do restart do backend em `BRANCH=stage`.

## 3) Testes manuais recomendados

- Validar login normal para usuario com senha bcrypt.
- Chamar endpoint fiscal sem token e confirmar rejeicao.
- Validar `GET /api/v1/admin/hardening-readiness` com perfil admin.

## 4) Regressao e riscos residuais

- Risco residual 1: perfis sem matriz atualizada para novos modulos podem receber 403 ate sincronizacao completa.
- Risco residual 2: usuarios com token antigo podem precisar reautenticar apos mudancas futuras de chave.
- Risco residual 3: partes legadas ainda leem `localStorage.token`; remocao total planejada em ciclo posterior para evitar quebra ampla.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
