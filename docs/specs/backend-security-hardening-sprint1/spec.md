# Spec - backend-security-hardening-sprint1

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Registrar e validar hardening de seguranca no backend cobrindo:
- CORS configuravel por ambiente com padrao seguro.
- Autenticacao obrigatoria para modulo fiscal.
- Matriz de autorizacao cobrindo `fiscal` e `relatorios`.
- Remocao de fallback legado de senha em texto plano.
- Fail-fast para `SECRET_KEY` fraca em producao e runbook de rotacao.
- Migracao de sessao para cookie `HttpOnly` com suporte transitorio a `Bearer`.

## 2) Requisitos funcionais (RF)

- RF-001: backend deve resolver `CORS_ALLOW_ORIGINS` por ambiente (JSON array ou CSV).
- RF-002: `allow_credentials` deve ser desativado quando `*` estiver configurado em CORS.
- RF-003: endpoints do modulo fiscal devem exigir usuario autenticado.
- RF-004: matriz de permissao deve mapear caminhos `/api/v1/fiscal/*` para modulo `fiscal`.
- RF-005: matriz de permissao deve mapear caminhos `/api/v1/relatorios/*` para modulo `relatorios`.
- RF-006: login nao deve aceitar senha em texto plano, mesmo com flag legada ativa.
- RF-007: em `APP_ENV=production`, `SECRET_KEY` fraca/default deve impedir startup quando enforcement estiver ativo.
- RF-008: login deve definir cookie de sessao `HttpOnly` para autenticacao.
- RF-009: backend deve aceitar autenticacao por `Bearer` ou cookie de sessao durante transicao.
- RF-010: endpoint de logout deve invalidar cookie de sessao no cliente.
- RF-011: deploy da `stage` deve forcar `APP_ENV=stage` e `AUTH_COOKIE_SECURE=true` para evitar emissao de cookie inseguro.
- RF-012: emissao de cookie deve considerar tambem requisicoes HTTPS via proxy (`X-Forwarded-Proto=https`) para manter `Secure=true`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): eliminar superficie de permissao implicita para `fiscal`/`relatorios`.
- NFR-002 (operacao): manter dev local funcional com defaults seguros sem bloquear produtividade.
- NFR-003 (observabilidade): endpoint de hardening deve expor flags de ambiente relevantes.
- NFR-004 (governanca): documentar processo de rotacao de `SECRET_KEY`.

## 4) Contratos tecnicos

### API

- `backend/app/api/v1/endpoints/fiscal.py`: router com dependencia global `Depends(get_current_user)`.
- `backend/app/core/security.py`: mapeamento de prefixos incluindo `fiscal` e `relatorios`.

### Auth

- `backend/app/api/v1/endpoints/auth.py`: `verify_password` valida apenas hashes bcrypt.
- `backend/app/api/v1/endpoints/auth.py`: `POST /auth/login` define cookie de sessao e `POST /auth/logout` remove cookie.
- `backend/app/api/v1/endpoints/auth.py`: seguranca de cookie considera `APP_ENV`/`AUTH_COOKIE_SECURE` e fallback por `X-Forwarded-Proto`/scheme HTTPS.
- `backend/app/core/security.py`: `get_current_user` aceita token via `Bearer` ou cookie de sessao.
- `backend/app/api/v1/endpoints/atendimento.py`: autenticacao de PDF aceita cookie para evitar quebra de download.

### Runtime/Config

- `backend/app/main.py`: CORS por `CORS_ALLOW_ORIGINS`.
- `backend/app/core/config.py`: adiciona `APP_ENV` e `ENFORCE_STRONG_SECRET_KEY_IN_PRODUCTION`.
- `backend/app/core/runtime_checks.py`: fail-fast de `SECRET_KEY` em producao.
- `backend/start_server.py`: bloqueio quando `SECRET_KEY` ausente em producao.
- `scripts/deploy_prod_vps.sh`: em deploy com `BRANCH=stage`, garante `APP_ENV=stage` e `AUTH_COOKIE_SECURE=true` no `backend/.env`.

### Documentacao operacional

- `backend/docs/SECRET_KEY_ROTATION_RUNBOOK.md` define rotacao, impacto e rollback.

## 5) Compatibilidade e rollout

- Backward compatibility: mantida para dev/stage (sem bloqueio automatico de chave fraca fora de producao).
- Rollout: push em `stage`, validacao do workflow `Deploy to Stage (VPS)` e monitoramento de `/ready`.
- Rollback: reverter commit de hardening e redeploy em `stage`.

## 6) Criterios de aceitacao (CA)

- CA-001: requests anonimos para `/api/v1/fiscal/*` retornam 401/403.
- CA-002: usuarios sem permissao em `fiscal`/`relatorios` recebem 403.
- CA-003: senha em texto plano e rejeitada no login.
- CA-004: em producao com `SECRET_KEY` fraca, startup falha com erro explicito.
- CA-005: runbook de rotacao de chave disponivel no repositorio.
- CA-006: login cria cookie de sessao `HttpOnly` e sessoes autenticadas funcionam sem header manual.
- CA-007: logout remove cookie de sessao e exige novo login.
- CA-008: cookie de sessao em `stage` deve ser emitido com flag `Secure`.

## 7) Casos de borda

- CB-001: `CORS_ALLOW_ORIGINS` em JSON invalido deve cair para parser por virgula.
- CB-002: CORS com `*` nao deve habilitar credenciais.
- CB-003: ambientes legados que usam `ENV`/`ENVIRONMENT` devem ser detectados como producao.

## 8) Fora de escopo

- Protecao CSRF (`FOR-19`).
