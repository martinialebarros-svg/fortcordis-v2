# Verify - laudo-aviso-whatsapp-parceiro

Data: 2026-09-16
Responsavel: Martiniano
Status: done

> A matriz usa as colunas `ID | Tipo | Evidencia | Status` do
> `docs/specs/templates/verify.md` de proposito: o gate de promocao
> (`scripts/ci/check_promotion_verify_pending.py`) so le tabela que tenha
> coluna `Status`. Matriz em outro formato passa despercebida pelo gate.

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_aviso_vai_para_clinica_e_para_parceiro_liberados`: confere as duas chamadas a `send_approved_utility_template`, os dois `destination` e o `{{1}}` de cada uma ("Clinica Parceira" / "Dra Isadora Bastos"), com os demais parametros iguais. Entrega real conferida em producao no laudo 1106 (secao 3) | ok |
| CA-002 | aceitacao | Mesmo teste: `idempotency_key` da clinica e a recebida (`idem-parceiro-001`), a do parceiro e `idem-parceiro-001-vet`, com `len <= 128` | ok |
| CA-003 | aceitacao | `test_laudo_sem_clinica_avisa_somente_o_parceiro`: laudo sem `clinic_id` responde 200, envia so para o parceiro e devolve `clinica.status == "ignorado"` (`motivo == "sem_vinculo"`) | ok |
| CA-004 | aceitacao | `test_parceiro_sem_liberacao_no_portal_nao_recebe_aviso`: sem `PortalPartnerReleaseTarget`, so a clinica recebe e `veterinario_parceiro` volta `ignorado`/`nao_liberado`. Em stage, o titulo do botao mudou de "Avisar clinica" para "Avisar clinica e veterinario parceiro" so depois da liberacao | ok |
| CA-005 | aceitacao | `test_parceiro_sem_whatsapp_cadastrado_nao_bloqueia_a_clinica`: parceiro sem `whatsapp`/`telefone` volta `ignorado`/`sem_whatsapp`, sem erro, e a clinica e avisada. O espelho disso rodou em stage: clinica sem numero foi ignorada e o parceiro seguiu sendo destino | ok |
| CA-006 | aceitacao | `test_aviso_vai_para_clinica_e_para_parceiro_liberados`: `whatsapp_parceiro_status == "enviado"`, `_em` preenchido e auditoria `LAUDO_PORTAL_WHATSAPP_PARCEIRO_ENVIADO` na ordem esperada | ok |
| CA-007 | aceitacao | `test_falha_no_parceiro_mantem_200_e_persiste_o_erro`: resposta 200, `whatsapp_parceiro_status == "falhou"`, `_erro` persistido e auditoria `LAUDO_PORTAL_WHATSAPP_PARCEIRO_FALHOU`. Reproduzido em stage com a recusa real do provedor | ok |
| CA-008 | aceitacao | `test_falha_na_clinica_continua_502_sem_perder_o_envio_do_parceiro`: `HTTPException` 502 com o `detail` do provedor, `whatsapp_liberacao_status == "falhou"` e `whatsapp_parceiro_status == "enviado"` gravados | ok |
| CA-009 | aceitacao | `test_laudo_sem_destino_com_whatsapp_responde_409`: laudo sem clinica e com parceiro sem numero responde 409 sem chamar o provedor. O 409 de laudo nao liberado segue coberto por `test_laudo_portal_whatsapp_status.py` | ok |
| CA-010 | aceitacao | Os dois testes de envio chamam `listar_laudos` depois e conferem `whatsapp_parceiro_status`/`_erro` no item; em stage, a badge continuou na linha depois do reload, vinda de `GET /laudos` | ok |
| CA-011 | aceitacao | `test_migracao_do_status_do_parceiro_e_idempotente`: tabela `laudos` minima criada por SQL, `upgrade()` chamado duas vezes na mesma conexao e as 3 colunas presentes ao fim. Aplicada em stage no deploy (`[Migrations] OK 20260916_85`) | ok |
| CA-012 | aceitacao | Verificacao manual em stage (secao 3): badge `fc-wa-envio-badge fc-wa-envio-badge-falhou`, texto "WhatsApp parceiro falhou", `title` com o erro do provedor, sobrevivendo ao reload | ok |
| CA-013 | aceitacao | `lib/laudo-whatsapp-aviso.test.ts` cobre os quatro arranjos de destino; em stage, so a linha com parceiro liberado trouxe o botao dos dois destinos | ok |
| CA-014 | aceitacao | `lib/laudo-whatsapp-aviso.test.ts` mais o dialogo real em stage: "Enviar para Martiniano Barros e Martiniano o aviso de laudo disponivel?" | ok |
| CA-015 | aceitacao | `lib/laudo-whatsapp-aviso.test.ts` (`tom: "alerta"`) e o toast em stage: "O envio para o veterinario parceiro falhou: ..." | ok |

## 2) Comandos executados

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

### Resultado - 2026-09-16

- `pytest tests/test_laudo_portal_whatsapp_parceiro.py`: 8 testes novos passaram.
- `pytest tests/ -k "laudo"`: 103 testes passaram, incluindo os 2 de
  `test_laudo_portal_whatsapp_status.py`, que cobrem o contrato antigo do
  endpoint (sucesso, falha 502, auditoria) e seguiram verdes sem alteração.
- `pytest tests/ -k "whatsapp or portal"`: 537 passaram, 7 pulados.
- `vitest run`: 43 arquivos, 308 testes passaram (11 são os novos de
  `laudo-whatsapp-aviso`).
- `tsc --noEmit` e `eslint --max-warnings=0`: sem erros.
- `next build`: passou.

## 3) Verificação manual

Dividida em dois ambientes de propósito: **stage confere a interface, não a
entrega.** O modelo aprovado `laudo_disponivel_portal` existe na conta de
produção, não na de stage, então qualquer envio em stage recusa 4xx por
desenho — registrado em
[whatsapp-portal-clinic-invite-template/verify.md](../whatsapp-portal-clinic-invite-template/verify.md)
e no `docs/RUNBOOK-STAGE-PROD.md`.

### Feito em stage - 2026-09-16

Fixture: laudo 49 (paciente Bolinha), clínica "Martiniano Barros" (id 51, **sem
WhatsApp cadastrado**) e veterinário parceiro "Martiniano" (id 49, com
WhatsApp). O laudo já estava liberado para a clínica; o parceiro foi vinculado
e liberado no portal durante o roteiro.

1. **Botão e título por destino (CA-013, CA-014).** Na Central de laudos, só a
   linha do laudo 49 traz o botão "Avisar clínica e veterinário parceiro pelo
   WhatsApp oficial"; as outras 7 linhas com aviso disponível seguem com
   "Avisar clínica pelo WhatsApp oficial". Antes da liberação do parceiro, esse
   mesmo laudo mostrava o título só da clínica — o gate de CA-004 aparece
   também na interface.
2. **Confirmação (CA-014).** O diálogo veio com "Enviar para Martiniano Barros
   e Martiniano o aviso de laudo disponível?".
3. **Envio (CA-005, CA-007).** Recusa esperada do provedor. A clínica, sem
   número cadastrado, foi ignorada sem erro (`whatsapp_liberacao_status`
   seguiu nulo) e o parceiro gravou `falhou` com
   "WhatsApp provider rejected or did not complete the template delivery".
4. **Aviso âmbar (CA-015).** O toast trouxe "O envio para o veterinário
   parceiro falhou: ..." — o ramo `alerta` do resumo, o mesmo que aplica as
   classes âmbar.
5. **Badge (CA-012, CA-010).** `fc-wa-envio-badge fc-wa-envio-badge-falhou`,
   texto "WhatsApp parceiro falhou", `title` com o erro do provedor; depois de
   recarregar a página a badge continuou lá, agora vinda de `GET /laudos`.

Não exercitado em stage, por falta de fixture: laudo **sem clínica nenhuma**,
só com parceiro (CA-003/CA-013). Fica coberto por
`test_laudo_sem_clinica_avisa_somente_o_parceiro` e pelos testes de
`lib/laudo-whatsapp-aviso.test.ts`.

### Feito em produção - 2026-09-16, 23:07 (local)

O que stage não conseguia validar — a entrega com o modelo aprovado — foi
conferido em produção, no laudo 1106 (Eletrocardiograma, paciente Dimmu,
Clinica Veterinária São Jose). O veterinário destinatário entrou por **vínculo
de clínica**, não pelo campo nomeado do laudo: a difusão de
[portal-veterinario-multiplas-clinicas](../portal-veterinario-multiplas-clinicas/verify.md)
foi promovida logo depois desta feature e estendeu o endpoint para percorrer
todos os veterinários liberados.

| Hora | Evento na auditoria | Detalhe |
| --- | --- | --- |
| 23:07:08 | `LAUDO_LIBERADO_PORTAL_EXTERNO` | `destinos_liberados_agora.veterinarios_por_vinculo: [144]` |
| 23:07:11 | `LAUDO_PORTAL_PARTNER_NOTIFICATION_SENT` | e-mail de liberação para a parceira, via smtp |
| 23:07:46.715 | `LAUDO_PORTAL_WHATSAPP_ENVIADO` | número da clínica (sufixo 7422), `message_id` próprio |
| 23:07:46.748 | `LAUDO_PORTAL_WHATSAPP_PARCEIRO_ENVIADO` | número da parceira (sufixo 7972), `origem: vinculo_clinica`, `partner_id: 144` |

A confirmação nomeou os dois ("Enviar para Clinica Veterinária São Jose e Dra
Camila Rebouças o aviso de laudo disponível?") e a linha do laudo ficou com as
duas badges verdes — "WhatsApp enviado" e "WhatsApp parceiro enviado" —, com
`whatsapp_liberacao_status` e `whatsapp_parceiro_status` ambos `enviado`
(CA-001, CA-006, CA-012 confirmados com envio real).

Antes disso, uma tentativa no mesmo laudo (22:57) tinha saído só para a
clínica: a liberação das 22:50 registrou `veterinarios_por_vinculo: []`, porque
o vínculo da parceira com a clínica ainda não existia. O gate de CA-004 fez o
que devia — quem não está liberado no portal não recebe aviso — e o caso serve
de lembrete: vínculo criado depois da liberação exige liberar o laudo de novo.

## 4) Risco residual

- Quando o envio da clínica falha (502) e o do parceiro dá certo, a tela mostra
  só a falha da clínica: a badge do parceiro só aparece no reload seguinte, já
  que o corpo da resposta se perde no erro HTTP. O dado persistido está certo.
- O status continua sendo "a API aceitou o envio", não "a mensagem chegou" -
  mesma limitação de
  [laudo-whatsapp-liberacao-status](../laudo-whatsapp-liberacao-status/verify.md).
- O parceiro recebe no número do cadastro (`whatsapp`, ou `telefone` como
  fallback). Cadastro desatualizado manda o aviso de laudo para o número
  errado; não há tela para escolher outro destino na hora do envio.
- Não dá para avisar só um destino: o botão dispara para todos os liberados.
  Quando a clínica já foi avisada e falta só o veterinário — exatamente o que
  aconteceu na conferência em produção —, a clínica recebe a mensagem de novo.
  Um seletor de destino resolveria; ficou fora desta spec.
