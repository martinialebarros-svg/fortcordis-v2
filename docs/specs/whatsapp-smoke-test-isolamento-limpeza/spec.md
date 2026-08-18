# Spec - whatsapp-smoke-test-isolamento-limpeza

## Requisitos funcionais

- RF-001: o deploy de produção (`.github/workflows/deploy.yml`) passa
  `ENABLE_WHATSAPP_STAGE_SMOKE=0` para `scripts/deploy_prod_vps.sh`; o
  smoke test do serviço WhatsApp não roda mais em produção.
- RF-002: o deploy de stage continua com o smoke test habilitado
  (`ENABLE_WHATSAPP_STAGE_SMOKE="1"` já hardcoded em
  `scripts/deploy_stage_vps.sh`, inalterado).
- RF-003: `GET /admin/whatsapp-smoke-cleanup/preview` (autenticado, mesmo
  `requireApiAuth` de `/conversations`/`/agents`) retorna, sem apagar
  nada: quantas linhas seriam apagadas em `conversations`, `agents`,
  `messages`, `message_status_events`, `webhook_events` e `audit_logs`,
  mais uma amostra de até 10 IDs de conversa e 10 emails de atendente.
- RF-004: `POST /admin/whatsapp-smoke-cleanup/execute` (autenticado, com
  checagem adicional de `req.authUser.papeis.includes("admin")`) apaga, em
  uma única transação: `message_status_events` e `webhook_events` por
  marcador de conteúdo, `audit_logs` referenciando as conversas/atendentes
  de smoke identificados, depois as `conversations` e `agents` de smoke
  (cascata cuida de `messages` e `conversation_participants`).
- RF-005: sem o papel `admin`, `execute` retorna `403` e não apaga nada.

## Requisitos não funcionais

- NFR-001 (segurança de dados): nenhuma query usa prefixo de telefone
  como critério de exclusão — só marcadores que a Graph API real nunca
  produz (`wamid.smoke.%`, `agent.smoke.%@example.com`, `WABA_SMOKE`).
- NFR-002 (atomicidade): `execute` roda dentro de `withTransaction` — se
  qualquer `DELETE` falhar, nada é apagado.
- NFR-003 (idempotência): rodar `execute` de novo sem dados novos de
  smoke retorna todas as contagens zeradas, sem erro.

## Contratos de API

### `GET /admin/whatsapp-smoke-cleanup/preview`

Resposta `200`:
```json
{
  "would_delete": {
    "conversations": 2, "agents": 2, "messages": 12,
    "message_status_events": 2, "webhook_events": 0, "audit_logs": 16
  },
  "sample_conversation_ids": ["1", "13"],
  "sample_agent_emails": ["agent.smoke.169...@example.com"]
}
```

### `POST /admin/whatsapp-smoke-cleanup/execute`

Sem corpo. Resposta `200`:
```json
{ "deleted": { "conversations": 2, "agents": 2, "message_status_events": 2, "webhook_events": 0, "audit_logs": 16 } }
```
`403` se `req.authUser.papeis` não contiver `"admin"`.

## Critérios de aceitação

- CA-001: uma conversa/agente real (sem os marcadores de smoke) nunca
  aparece na contagem do preview nem é apagado pelo execute.
- CA-002: uma conversa de smoke criada propositalmente some depois do
  execute, junto com sua mensagem, `message_status_events` e
  `webhook_events` associados.
- CA-003: `execute` sem papel `admin` retorna `403` e não altera nada no
  banco.
- CA-004: depois de um deploy de produção, o smoke test não roda mais
  (nenhuma conversa/atendente novo de smoke aparece).
