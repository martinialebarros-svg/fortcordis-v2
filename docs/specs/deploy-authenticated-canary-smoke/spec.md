# Spec - deploy-authenticated-canary-smoke

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Implementar smoke canary autenticado no deploy:
- obter token (credencial explicita ou token interno mintado no VPS);
- validar `GET /api/v1/admin/hardening-readiness`;
- validar `GET /api/v1/agenda`;
- validar `GET /api/v1/atendimentos/upload-metrics/dedupe/cleanup/status`.

## 2) Requisitos funcionais (RF)

- RF-001: criar script `scripts/deploy_authenticated_canary.py`.
- RF-002: suportar token direto, login com credenciais e fallback de token interno.
- RF-003: falhar deploy se qualquer check canary falhar.
- RF-004: permitir desativacao controlada por env (`ENABLE_AUTH_CANARY=0`).

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem dependencia de novas libs externas.
- NFR-002: mensagens objetivas para diagnostico.
- NFR-003: overhead pequeno no pos-deploy.

## 4) Criterios de aceitacao (CA)

- CA-001: canary autenticado executa apos gate de observabilidade.
- CA-002: deploy falha se runtime.ready=false no endpoint admin.
- CA-003: deploy falha se agenda ou endpoint tecnico de atendimento retornarem erro.
- CA-004: rollback automatico e acionado em falha do canary.
