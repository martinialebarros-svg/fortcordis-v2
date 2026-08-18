# Verify - whatsapp-equipe-atendentes-edicao

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | Teste `edita e desativa um atendente na secao Configurar equipe` em `page.test.tsx`: altera nome/perfil e confirma `PATCH /whatsapp/agents/7` com o corpo esperado e a lista recarregada | passou |
| CA-002 | Mesmo teste: clique em "Desativar" confirma `PATCH` com `{ "active": false }` e a mensagem "Atendente desativado." | passou |
| CA-003 | `handleUpdateAgent` bloqueia o submit e mostra "Email do atendente é obrigatório." quando `editAgentEmail` está vazio, antes de chamar `requestJson` | passou (inspeção de código, mesmo padrão de `handleCreateAgent`) |
| CA-004 | `curl -X PATCH http://127.0.0.1:3000/agents/9999` retornou `404` | passou |
| CA-005 | `curl -X PATCH http://127.0.0.1:3000/agents/1 -d '{"email":""}'` retornou `400` com `{"error":"email must be a non-empty string"}` | passou |

## Comandos previstos

```bash
cd whatsapp-stage-backend
npx tsc --noEmit

cd ../frontend
npx eslint app/whatsapp-stage/page.tsx app/whatsapp-stage/page.test.tsx --max-warnings=0
npx vitest run app/whatsapp-stage/page.test.tsx
```

## Verificação manual (API)

Com PostgreSQL local (`fortcordis_stage`) e o backend do serviço WhatsApp
(`npm run dev`, porta 3000) no ar, sem autenticação habilitada
(`WHATSAPP_API_AUTH_ENABLED=false`, valor padrão do `.env` local):

1. `PATCH /agents/1` com `{"name":"Agente Teste Editado","role":"supervisor"}`
   retornou `200` com os campos atualizados e os demais campos preservados.
2. `PATCH /agents/1` com `{"active":false}` retornou `200` com `active:false`,
   preservando nome/perfil.
3. Reversão dos dados de teste para o estado original confirmada com um
   terceiro `PATCH`.
4. `PATCH /agents/9999` (inexistente) retornou `404`.
5. `PATCH /agents/1` com `{"email":""}` retornou `400`.

Não foi feita verificação end-to-end pelo navegador: a página
`/whatsapp-stage` exige sessão válida contra o backend principal
(`/api/v1/auth/me`), e o ambiente local usa o banco de dados real do usuário
(`fortcordis.db`), sem credenciais de teste conhecidas neste ciclo. A
cobertura de componente (`page.test.tsx`) exercita o mesmo fluxo de
requisições que o navegador dispararia.

## Resultado final - 2026-08-18

- `npx tsc --noEmit` (whatsapp-stage-backend): passou.
- ESLint direcionado da página e do teste (frontend): passou sem avisos.
- Vitest direcionado (`page.test.tsx`): 7 testes passaram (1 novo, cobrindo
  editar e desativar).
- Testes manuais de API via `curl` (edição parcial, toggle de status, 404,
  validação de email vazio): passaram.
- `evaluate_guardrail` deve qualificar `whatsapp-equipe-atendentes-edicao`
  (spec.md e verify.md alterados no mesmo ciclo do código de
  `whatsapp-stage-backend/` e `frontend/`).

Risco residual: desativar um atendente não reatribui automaticamente as
conversas já vinculadas a ele; a conversa mantém `last_agent_id` apontando
para o atendente inativo até que alguém transfira manualmente.
