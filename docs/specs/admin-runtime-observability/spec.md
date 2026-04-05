# Spec - admin-runtime-observability

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Ampliar o payload de `GET /api/v1/admin/hardening-readiness` para incluir:
- `runtime.readiness_issues`;
- `runtime.observability` completo (monitor 5xx + estado do worker dedupe cleanup).

## 2) Requisitos funcionais (RF)

- RF-001: endpoint admin retorna `runtime.observability`.
- RF-002: endpoint admin retorna `runtime.readiness_issues`.
- RF-003: manter campos existentes para compatibilidade.
- RF-004: acesso segue restrito a admin.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem vazamento de dados para usuarios nao-admin.
- NFR-002: mudanca leve, sem impacto em performance relevante.
- NFR-003: cobertura de teste para novo contrato.

## 4) Criterios de aceitacao (CA)

- CA-001: resposta inclui bloco `runtime.observability`.
- CA-002: resposta inclui lista `runtime.readiness_issues`.
- CA-003: testes automatizados passam cobrindo novo contrato.
- CA-004: endpoint continua retornando `401/403` sem credenciais/permissao.
