# Spec - deploy-runtime-observability-gate

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Implementar gate pos-deploy no VPS para validar:
- `/health` retornando `readiness=ready`;
- `/ready` respondendo com HTTP `200`;
- `checks.observability.http_5xx_monitor.alert_active=false`;
- `checks.observability.upload_dedupe_cleanup_worker` em estado saudavel.

## 2) Requisitos funcionais (RF)

- RF-001: criar script de validacao de observabilidade executavel no VPS.
- RF-002: integrar script ao `deploy_prod_vps.sh`.
- RF-003: manter `deploy_stage_vps.sh` coberto por reutilizacao do script de prod.
- RF-004: falhar deploy quando condicoes criticas nao forem atendidas.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem dependencia de credenciais admin no pipeline.
- NFR-002: sem dependencia de bibliotecas Python externas.
- NFR-003: mensagens de erro objetivas para troubleshooting.

## 4) Criterios de aceitacao (CA)

- CA-001: deploy falha se `/ready` nao retornar 200.
- CA-002: deploy falha se `alert_active=true` no monitor de `5xx`.
- CA-003: deploy falha se worker de cleanup estiver habilitado e nao estiver `running/thread_alive`.
- CA-004: deploy segue normalmente quando todas as validacoes passam.
