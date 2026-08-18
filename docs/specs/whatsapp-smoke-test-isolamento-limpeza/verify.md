# Verify - whatsapp-smoke-test-isolamento-limpeza

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `scripts/test-smoke-cleanup.ts`: conversa/agente de controle (`Contato real ...`/`Atendente Real ...`) permanecem no banco depois do `execute` | passou |
| CA-002 | Mesmo script: conversa de smoke, mensagem (`wamid.smoke.<id>.inbound`), `message_status_events` e `webhook_events` associados somem depois do `execute` | passou |
| CA-003 | Mesmo script: `execute` com `papeis: ["recepcao"]` retorna `403` sem apagar nada; só com `papeis: ["admin"]` a exclusão acontece | passou |
| CA-004 | `.github/workflows/deploy.yml` com `ENABLE_WHATSAPP_STAGE_SMOKE=0`; `deploy_prod_vps.sh` só roda o smoke quando essa variável é `"1"` (inspeção de código) | passou |

## Bug encontrado e corrigido antes do deploy

Primeira versão do `previewSmokeCleanup`/`executeSmokeCleanup` reusava o
mesmo padrão `wamid.smoke.%` (ancorado no início) para `webhook_events.raw_body`,
que é o JSON bruto do webhook — o marcador não fica no começo da string,
então o `LIKE` nunca casava. `scripts/test-smoke-cleanup.ts` pegou isso
antes do deploy: a asserção `webhook_events de smoke deveria ter sido
apagado` falhou (`1 !== 0`). Corrigido com um padrão de substring
dedicado (`%wamid.smoke.%`, `%` nas duas pontas) só para essa tabela.

## Comandos executados

```bash
cd whatsapp-stage-backend
npx tsc --noEmit
npm run test:smoke-cleanup   # contra Postgres local com dados reais de smoke residual
```

## Verificação manual (Postgres local)

1. Antes de qualquer mudança, `fortcordis_stage` local tinha 2 conversas e
   2 agentes reais de smoke (residuais de sessões anteriores deste
   projeto).
2. `GET /admin/whatsapp-smoke-cleanup/preview` (via curl, auth desabilitada
   localmente) reportou corretamente `conversations: 2, agents: 2,
   messages: 12, message_status_events: 2, audit_logs: 16`.
3. `POST /admin/whatsapp-smoke-cleanup/execute` sem `authUser` (auth
   desabilitada localmente, papel vazio) retornou `403` como esperado —
   confirma que o endpoint fecha por padrão quando não há prova de papel
   admin.
4. `npm run test:smoke-cleanup` criou seus próprios dados de controle e de
   smoke, rodou preview + execute com um `authUser` simulado
   (`papeis: ["admin"]`), e confirmou que só os dados de smoke (os 2
   residuais + os criados pelo próprio teste) foram removidos — dados de
   controle permaneceram intactos.
5. Confirmado via `psql` direto: `fortcordis_stage` local zerou para 0
   conversas e 0 agentes após a limpeza.

## Resultado final - 2026-08-18

- `tsc --noEmit`: passou.
- `npm run test:smoke-cleanup`: passou (após corrigir o bug do padrão de
  `webhook_events`).
- Limpeza manual do Postgres local de dev confirmada (0 conversas, 0
  agentes remanescentes).

Risco residual: a causa raiz (smoke test sem banco isolado) continua
ativa em stage — decisão deliberada do usuário, já que stage é onde faz
sentido validar o deploy end-to-end. A limpeza em stage e produção real
(via `POST /admin/whatsapp-smoke-cleanup/execute` autenticado como admin)
precisa ser executada pelo usuário depois do deploy, do mesmo jeito que o
preview do lembrete automático — não tenho credenciais para chamar
endpoints autenticados nesses ambientes.
