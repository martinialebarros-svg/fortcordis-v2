# Verify - laudo-whatsapp-liberacao-status

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_aviso_whatsapp_com_sucesso_persiste_status_enviado`: chama o endpoint com `send_approved_utility_template` mockado com sucesso, confere `whatsapp_liberacao_status == "enviado"` | passou |
| CA-002 | `test_aviso_whatsapp_com_falha_persiste_status_falhou`: chama o endpoint com `send_approved_utility_template` levantando `WhatsAppTemplateDeliveryError`, confere `whatsapp_liberacao_status == "falhou"` e `whatsapp_liberacao_erro` preenchido | passou |
| CA-003 | Ambos os testes acima também chamam `listar_laudos(...)` depois do envio e conferem que os 3 campos aparecem no item retornado (equivalente a um reload da lista) | passou |
| CA-004 | Verificação manual em navegador: laudo sem envio prévio de WhatsApp não mostra nenhuma badge na linha (só depois do primeiro clique ela aparece) | passou |
| CA-005 | Migração testada isoladamente: `Laudo.__table__.create()` + `upgrade()` chamado duas vezes seguidas na mesma conexão sqlite, sem exceção na segunda chamada | passou |
| CA-006 | Nos dois testes, `registrar_auditoria` é mockado e o `acao` do `call_args.kwargs` é conferido (`LAUDO_PORTAL_WHATSAPP_ENVIADO` / `LAUDO_PORTAL_WHATSAPP_FALHOU`) | passou |
| CA-007 | `test_aviso_whatsapp_com_falha_persiste_status_falhou` confere `ctx.exception.status_code == 502` | passou |

## Comandos executados

```bash
cd backend
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/test_laudo_portal_whatsapp_status.py -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -k "laudo" -q

cd frontend
npx tsc --noEmit
npx eslint app/laudos/page.tsx --max-warnings=0
npx next build
```

## Resultado - 2026-08-21

- `pytest tests/test_laudo_portal_whatsapp_status.py`: 2 testes novos
  passaram.
- `pytest tests/ -k "laudo"`: 83 testes passaram (nenhuma regressão nos
  testes pré-existentes de laudos, incluindo `test_laudo_portal_release.py`).
- Migração `20260821_75_laudo_whatsapp_liberacao_status.py` testada
  isoladamente contra sqlite (criação de tabela `laudos` via metadata +
  `upgrade()` chamado duas vezes): idempotente, tipos de coluna corretos
  (`VARCHAR`, `DATETIME`, `TEXT`).
- `tsc --noEmit`: sem erros.
- `eslint app/laudos/page.tsx --max-warnings=0`: sem erros.
- `next build`: passou; rota `/laudos` gerada (8.71 kB).

## Verificação manual em navegador

Ambiente isolado: backend FastAPI + frontend Next.js locais, sqlite
temporário (à parte de `backend/fortcordis.db`), com um stub HTTP no lugar
do `whatsapp-stage-backend` (`WHATSAPP_AGENDA_SERVICE_URL` apontando para
ele) para simular sucesso/falha do provedor sem depender do WhatsApp real.
Usuário admin seed, um laudo de teste já "Liberado no portal" com clínica
vinculada.

1. Clique no ícone de WhatsApp (stub respondendo 200) → toast teal "Aviso
   enviado pelo WhatsApp oficial da Fort Cordis." aparece, badge "✓
   WhatsApp enviado" surge ao lado de "Liberado no portal" sem reload.
   Nenhum `alert()` disparado (confirmado via console).
2. Reload da página → badge "WhatsApp enviado" continua aparecendo (veio
   de `GET /laudos`, confirmando a persistência no backend).
3. Stub alterado para responder 502 → clique de novo → toast rose com a
   mensagem real de erro ("Simulacao: numero de WhatsApp invalido no
   provedor.") e badge muda para "WhatsApp falhou"; `title` do badge
   inspecionado via DOM confirma a mesma mensagem de erro no tooltip.
4. Reload da página → badge "WhatsApp falhou" persiste.

Resultado: todos os critérios (CA-001 a CA-004) confirmados visualmente,
end-to-end, contra o backend e frontend reais (não só os testes
automatizados).

## Risco residual

O status refletido é "a API aceitou o envio", não "a mensagem chegou ao
tutor/clínica". Uma falha silenciosa depois da aceitação (ex.: número
desativado no WhatsApp) continuaria mostrando "WhatsApp enviado". Cobrir
esse caso exigiria integrar com o status assíncrono do
`whatsapp-stage-backend` (webhook), que ficou fora de escopo (ver
`intent.md`).
