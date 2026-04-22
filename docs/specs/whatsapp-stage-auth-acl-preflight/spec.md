# Spec - whatsapp-stage-auth-acl-preflight

## Requisitos funcionais

- RF-001: backend WhatsApp stage deve exigir autenticacao para rotas `/conversations*` e `/agents*`.
- RF-002: backend deve aceitar `Authorization: Bearer <token>` e validar o usuario no backend principal via `/api/v1/auth/me`.
- RF-003: backend deve aceitar `X-WhatsApp-Internal-Token` para automacoes quando configurado.
- RF-004: ACL por papeis deve ser configuravel por env para leitura e escrita.
- RF-005: frontend `/whatsapp-stage` deve enviar bearer token automaticamente nas chamadas para `/whatsapp/*`.
- RF-006: smoke-tests do backend WhatsApp devem aceitar headers de autenticacao quando fornecidos por env.

## Requisitos operacionais

- RO-001: deploy stage deve preencher defaults seguros de auth/ACL quando ausentes.
- RO-002: deploy stage deve rodar smoke WhatsApp por padrao.
- RO-003: deve existir script de preflight para validar env, health, gate de auth e smoke opcional.
- RO-004: runbook stage/prod deve incluir passo explicito do preflight WhatsApp.
- RO-005: deploy deve autocorrigir placeholders legados no `.env` do WhatsApp stage sem sobrescrever valores reais.
- RO-006: deploy deve autocorrigir placeholders legados exatos (`stage_*`) de forma deterministica no `.env` do WhatsApp stage antes dos fallbacks genericos.

## Criterios de aceitacao

- CA-001: requsicao sem token em `/agents` retorna `401` quando auth habilitada.
- CA-002: requisicao com token interno valido em `/agents` retorna `2xx`.
- CA-003: build do `whatsapp-stage-backend` permanece verde.
- CA-004: `npm run test:whatsapp-retry` permanece verde.
- CA-005: preflight retorna `PASS` quando ambiente esta conforme.
