# Plan - backend-security-hardening-sprint1

Data: 2026-05-11  
Responsavel: Codex  
Status: done

## Fases

1. Endurecer CORS por ambiente.
2. Fechar auth + authz para `fiscal` e `relatorios`.
3. Eliminar fallback de senha em texto plano.
4. Aplicar politica de `SECRET_KEY` em producao e publicar runbook.
5. Validar com testes focados e deploy em `stage`.

## Tarefas

- [x] T1 Implementar `CORS_ALLOW_ORIGINS` no backend principal.
- [x] T2 Aplicar `Depends(get_current_user)` no modulo fiscal.
- [x] T3 Incluir `fiscal` e `relatorios` na matriz de permissao.
- [x] T4 Remover fallback de senha plaintext em `verify_password`.
- [x] T5 Adicionar `APP_ENV` + enforcement de chave forte em producao.
- [x] T6 Publicar runbook de rotacao de `SECRET_KEY`.
- [x] T7 Rodar testes focados de permissao, fiscal e runtime checks.

## Rollback

- Reverter commit `4b958fb` (hardening) e redeploy em `stage`.
