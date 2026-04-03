# Spec - atendimento-pdf-auth-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Endurecer a autenticacao dos endpoints de PDF do atendimento para operar em modo header-only. A entrega inclui regra explicita de rejeicao para `access_token` em query string, manutencao do fluxo normal com bearer token em header e testes automatizados que previnem regressao.

## 2) Requisitos funcionais (RF)

- RF-001: endpoints `GET /atendimentos/{id}/prescricao/pdf` e `GET /atendimentos/{id}/exames/pdf` devem autenticar apenas por `Authorization: Bearer <token>`.
- RF-002: requests contendo `access_token` na query string devem ser rejeitadas explicitamente.
- RF-003: requests sem header bearer valido devem retornar `401` com `WWW-Authenticate: Bearer`.
- RF-004: requests autenticadas corretamente por header devem continuar funcionando sem alteracao de payload de sucesso.
- RF-005: adicionar testes automatizados cobrindo cenarios de rejeicao e sucesso do helper de auth para PDF.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): impedir uso de credencial em URL para reduzir vazamento em logs/historico/proxies.
- NFR-002 (confiabilidade): manter comportamento deterministico de erro (`400` para query token, `401` para credencial ausente/invalida, `403` para usuario inativo).
- NFR-003 (observabilidade): manter mensagens de erro claras para diagnostico rapido em stage/producao.

## 4) Contratos tecnicos

### API

- Endpoints:
- `GET /api/v1/atendimentos/{atendimento_id}/prescricao/pdf`
- `GET /api/v1/atendimentos/{atendimento_id}/exames/pdf`
- Metodo: `GET`
- Auth obrigatoria:
- Aceito: header `Authorization: Bearer <jwt>`
- Nao aceito: query string `?access_token=...`
- Erros esperados:
- `400` quando `access_token` vier na URL.
- `401` quando faltar bearer token ou token for invalido.
- `403` quando usuario autenticado estiver inativo.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx` (sem mudanca funcional prevista).
- Estado de UI esperado: downloads de PDF continuam via `api.get(...)` com header automatico do interceptor.
- Regra de erro: request com auth invalida continua propagando erro da API.

## 5) Compatibilidade e rollout

- Backward compatibility: clientes usando header bearer permanecem compativeis.
- Breaking change controlada: clientes que usarem query token passarao a receber `400`.
- Feature flag: nao.
- Estrategia de rollback: revert do commit de hardening e reteste rapido dos endpoints PDF.

## 6) Criterios de aceitacao (CA)

- CA-001: request com `?access_token=...` recebe `400` com mensagem orientando uso de header.
- CA-002: request sem `Authorization` recebe `401`.
- CA-003: request com bearer invalido recebe `401`.
- CA-004: request com bearer valido retorna objeto `User` no helper de auth, permitindo fluxo normal do endpoint.
- CA-005: testes automatizados novos passam localmente.

## 7) Casos de borda

- CB-001: request com query token e header valido ao mesmo tempo (deve continuar bloqueando por query token).
- CB-002: header `Authorization` sem prefixo `Bearer`.
- CB-003: JWT valido para email de usuario inexistente.
- CB-004: JWT valido para usuario inativo.

## 8) Fora de escopo

- Refatoracao completa do modulo de autenticacao global.
- Rotacao de JWT, refresh token e SSO.
- Mudancas de layout/UX na tela de atendimento.
