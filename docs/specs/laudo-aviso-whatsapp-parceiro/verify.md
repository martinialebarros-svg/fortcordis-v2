# Verify - laudo-aviso-whatsapp-parceiro

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_aviso_vai_para_clinica_e_para_parceiro_liberados`: confere as duas chamadas a `send_approved_utility_template`, os dois `destination` e o `{{1}}` de cada uma ("Clinica Parceira" / "Dra Isadora Bastos"), com os demais parâmetros iguais | passou |
| CA-002 | Mesmo teste: `idempotency_key` da clínica é a recebida (`idem-parceiro-001`), a do parceiro é `idem-parceiro-001-vet`, com `len <= 128` | passou |
| CA-003 | `test_laudo_sem_clinica_avisa_somente_o_parceiro`: laudo sem `clinic_id` responde 200, envia só para o parceiro e devolve `clinica.status == "ignorado"` (`motivo == "sem_vinculo"`) | passou |
| CA-004 | `test_parceiro_sem_liberacao_no_portal_nao_recebe_aviso`: sem `PortalPartnerReleaseTarget`, só a clínica recebe e `veterinario_parceiro` volta `ignorado`/`nao_liberado` | passou |
| CA-005 | `test_parceiro_sem_whatsapp_cadastrado_nao_bloqueia_a_clinica`: parceiro sem `whatsapp`/`telefone` volta `ignorado`/`sem_whatsapp`, sem erro, e a clínica é avisada | passou |
| CA-006 | `test_aviso_vai_para_clinica_e_para_parceiro_liberados`: `whatsapp_parceiro_status == "enviado"`, `_em` preenchido e auditoria `LAUDO_PORTAL_WHATSAPP_PARCEIRO_ENVIADO` na ordem esperada | passou |
| CA-007 | `test_falha_no_parceiro_mantem_200_e_persiste_o_erro`: resposta 200, `whatsapp_parceiro_status == "falhou"`, `_erro` persistido e auditoria `LAUDO_PORTAL_WHATSAPP_PARCEIRO_FALHOU` | passou |
| CA-008 | `test_falha_na_clinica_continua_502_sem_perder_o_envio_do_parceiro`: `HTTPException` 502 com o `detail` do provedor, `whatsapp_liberacao_status == "falhou"` e `whatsapp_parceiro_status == "enviado"` gravados | passou |
| CA-009 | `test_laudo_sem_destino_com_whatsapp_responde_409`: laudo sem clínica e com parceiro sem número responde 409 sem chamar o provedor. O 409 de laudo não liberado continua coberto pelos testes pré-existentes de `test_laudo_portal_whatsapp_status.py` | passou |
| CA-010 | `test_aviso_vai_para_clinica_e_para_parceiro_liberados` e `test_falha_no_parceiro_mantem_200_e_persiste_o_erro` chamam `listar_laudos` depois do envio e conferem `whatsapp_parceiro_status`/`_erro` no item (equivale ao reload da lista) | passou |
| CA-011 | `test_migracao_do_status_do_parceiro_e_idempotente`: tabela `laudos` mínima criada por SQL, `upgrade()` chamado duas vezes na mesma conexão e as 3 colunas presentes ao fim | passou |
| CA-012 | Badge nova renderizada a partir de `whatsapp_parceiro_status` em `frontend/app/laudos/page.tsx`, com `title` do erro; a badge da clínica continua inalterada | pendente - confirmar em stage |
| CA-013 | `lib/laudo-whatsapp-aviso.test.ts`: `getDestinosAvisoWhatsApp`/`podeAvisarWhatsApp` cobrem os quatro casos (clínica + parceiro, só clínica, só parceiro, nenhum) | passou |
| CA-014 | `lib/laudo-whatsapp-aviso.test.ts`: confirmação e título nomeiam os destinatários nos três arranjos | passou |
| CA-015 | `lib/laudo-whatsapp-aviso.test.ts`: `resumirRespostaAvisoWhatsApp` devolve `tom: "alerta"` com o erro do provedor quando só o parceiro falha | passou |

## Comandos executados

```bash
cd backend
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/test_laudo_portal_whatsapp_parceiro.py -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -k "laudo" -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -k "whatsapp or portal" -q

cd frontend
npx vitest run
npx tsc --noEmit
npx eslint app/laudos/page.tsx "app/laudos/[id]/page.tsx" lib/laudo-whatsapp-aviso.ts lib/laudo-whatsapp-aviso.test.ts --max-warnings=0
npx next build
```

## Resultado - 2026-09-16

- `pytest tests/test_laudo_portal_whatsapp_parceiro.py`: 8 testes novos passaram.
- `pytest tests/ -k "laudo"`: 103 testes passaram, incluindo os 2 de
  `test_laudo_portal_whatsapp_status.py`, que cobrem o contrato antigo do
  endpoint (sucesso, falha 502, auditoria) e seguiram verdes sem alteração.
- `pytest tests/ -k "whatsapp or portal"`: 537 passaram, 7 pulados.
- `vitest run`: 43 arquivos, 308 testes passaram (11 são os novos de
  `laudo-whatsapp-aviso`).
- `tsc --noEmit` e `eslint --max-warnings=0`: sem erros.
- `next build`: passou.

## Verificação manual

Pendente, e dividida em dois ambientes de propósito.

**Em stage dá para conferir a interface, não a entrega.** O modelo aprovado
`laudo_disponivel_portal` existe na conta de produção, não na de stage, então
qualquer envio em stage recusa 4xx por desenho — está registrado em
[whatsapp-portal-clinic-invite-template/verify.md](../whatsapp-portal-clinic-invite-template/verify.md)
e no `docs/RUNBOOK-STAGE-PROD.md`. Em stage, com laudo liberado para clínica e
parceiro:

1. O botão aparece em laudo só com veterinário parceiro (CA-013).
2. A confirmação nomeia os dois destinatários (CA-014).
3. Com a recusa 4xx esperada, as duas badges de falha aparecem — uma por
   destino — e sobrevivem ao reload (CA-012, CA-010), o que também exercita o
   caminho de erro.

**Em produção, com número próprio como destino**, confirmar o que só a conta
aprovada entrega: as duas mensagens chegam — clínica e parceiro — cada uma com
o próprio nome em `{{1}}` (CA-001), e as badges ficam verdes.

## Risco residual

- Quando o envio da clínica falha (502) e o do parceiro dá certo, a tela mostra
  só a falha da clínica: a badge do parceiro só aparece no reload seguinte, já
  que o corpo da resposta se perde no erro HTTP. O dado persistido está certo.
- O status continua sendo "a API aceitou o envio", não "a mensagem chegou" -
  mesma limitação de
  [laudo-whatsapp-liberacao-status](../laudo-whatsapp-liberacao-status/verify.md).
- O parceiro recebe no número do cadastro (`whatsapp`, ou `telefone` como
  fallback). Cadastro desatualizado manda o aviso de laudo para o número
  errado; não há tela para escolher outro destino na hora do envio.
