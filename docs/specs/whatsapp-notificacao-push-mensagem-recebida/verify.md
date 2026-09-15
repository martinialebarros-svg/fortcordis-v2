# Verify - whatsapp-notificacao-push-mensagem-recebida

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_mensagem_recebida_esta_no_catalogo_de_acoes` | passou |
| CA-002 | `test_build_title_usa_contato_quando_disponivel` (com e sem contato) | passou |
| CA-003 | `test_build_body_trunca_em_160_caracteres` (300 chars → 160) | passou |
| CA-004 | `test_send_whatsapp_message_push_notification_monta_payload_correto`: `assertNotIn("exclude_user_id", kwargs)` | passou |
| CA-005 | `curl` local sem header `X-FortCordis-WhatsApp-Token` → `401 {"detail":"Credencial interna do WhatsApp invalida."}` | passou |
| CA-006 | Inspeção de código: `alternarTipoPushAgenda` agora inclui `TIPOS_PUSH_WHATSAPP_OPCOES` na reconstrução (bug corrigido antes do deploy, sem esse fix o checkbox seria descartado ao salvar) | passou |

## Comandos executados

```bash
cd backend
venv/bin/python -m unittest tests.test_whatsapp_push_notification -v
venv/bin/python -m unittest discover -s tests -p "test_*.py"   # 810 testes, sem regressao

cd ../whatsapp-stage-backend
npx tsc --noEmit

cd ../frontend
npx eslint app/configuracoes/page.tsx --max-warnings=0
npx tsc --noEmit
npx next build
```

## Verificação manual (endpoint real, backend local)

1. Adicionado temporariamente `WHATSAPP_AGENDA_INTERNAL_TOKEN` ao `.env`
   local (já havia `WEB_PUSH_VAPID_PUBLIC_KEY`/`PRIVATE_KEY` configurados
   de antes).
2. `POST /api/v1/integracoes/whatsapp/notificacoes/mensagem-recebida` sem
   header do token → `401`.
3. Mesmo endpoint com o token correto e um payload de mensagem de teste →
   `200 {"sent":0,"failed":0,"deactivated":0}` (zero porque não há
   nenhuma subscription push real neste ambiente local — confirma que o
   pipeline completo roda sem erro até `send_web_push_payload`).
4. Token de teste removido do `.env` local depois da verificação.

## Resultado final - 2026-08-18

- Testes novos: 5 passaram.
- Suíte completa do backend: 810 testes passaram, sem regressão.
- `tsc --noEmit` (whatsapp-stage-backend e frontend): limpo.
- ESLint (frontend): sem avisos.
- `next build`: passou, rota `/configuracoes` e `/whatsapp-stage` geradas
  normalmente.
- Smoke manual do endpoint: passou (401 sem token, 200 com token e
  contagens corretas).

Risco residual: não foi possível testar o envio real de uma notificação
até um navegador (exigiria uma subscription push real de teste); a
verificação cobre até `send_web_push_payload`, que já é código existente
e usado em produção pelos módulos de agenda/financeiro. Deep-link para a
conversa específica não foi implementado (clique na notificação abre a
central geral, não a conversa exata) — mitigado pela ordenação de não
lidas já existente.
