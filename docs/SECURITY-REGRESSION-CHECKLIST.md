# Security Regression Checklist (FOR-42)

Checklist objetivo para validar seguranca funcional em stage/producao apos deploy.

## Cobertura

- authz basico (rotas protegidas bloqueiam acesso anonimo);
- csrf (cookie + header);
- cors (preflight e allow-origin);
- cookies de sessao (HttpOnly/Secure);
- security headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`);
- websocket auth (via suite unit de regressao).

## Execucao automatizada

Script:

```bash
bash scripts/security_regression_smoke.sh
```

Com login/csrf completo:

```bash
BASE_URL="https://stage.fortcordis.com.br" \
API_BASE_URL="https://stage.fortcordis.com.br/api/v1" \
ORIGIN="https://stage.fortcordis.com.br" \
AUTH_EMAIL="<email_admin_stage>" \
AUTH_PASSWORD="<senha_admin_stage>" \
RUN_UNIT_TESTS=1 \
PYTHON_BIN="backend/venv/bin/python" \
bash scripts/security_regression_smoke.sh
```

Saida esperada:

- `Resultado: PASS (0 falha(s), X aviso(s))`

## Checklist manual complementar (2-4 min)

1. Frontend login/logout normal no stage.
2. Confirmar em DevTools > Storage > Cookies:
   - `fortcordis_session` com `Secure=true` e `HttpOnly=true`.
3. Abrir modulo protegido (Agenda/Fiscal) sem erro de permissao indevida.
4. Em aba anonima (sem login), abrir URL protegida da API:
   - esperado `401`.
5. Verificar headers em resposta da API:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Content-Security-Policy` presente.

## Troubleshooting rapido

- erro de cookie Secure:
  - validar `APP_ENV` e `AUTH_COOKIE_SECURE` no backend do ambiente.
- erro de CORS:
  - validar `CORS_ALLOW_ORIGINS` e origem usada no browser.
- erro de CSRF:
  - confirmar emissao de `fortcordis_csrf` no login e envio de `x-csrf-token`.
- erro websocket auth:
  - rodar `python3 -m unittest backend/tests/test_websocket_auth.py`.
