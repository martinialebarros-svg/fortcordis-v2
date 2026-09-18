# Verify - laudo-portal-revogar-parceiro

Data: 2026-09-18
Responsavel: Martiniano
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_revoga_o_acesso_do_parceiro_sem_tocar_no_resto`: a linha do parceiro revogado fica com `revoked_at` preenchido e a chamada responde com o estado do laudo | ok |
| CA-002 | aceitacao | Mesmo teste: `portal_veterinarios_destinos` traz `liberado: false` para o revogado e `veterinario_parceiro` volta a `portal_destinos_pendentes` | ok |
| CA-003 | aceitacao | Mesmo teste: `laudo.status` segue `Liberado no portal` e `portal_clinica_liberado` continua `true` | ok |
| CA-004 | aceitacao | Mesmo teste: a linha do veterinario por vinculo segue com `revoked_at` nulo e `liberado: true` | ok |
| CA-005 | aceitacao | `test_revogar_duas_vezes_responde_409` e `test_parceiro_sem_liberacao_responde_409` | ok |
| CA-006 | aceitacao | `test_laudo_inexistente_responde_404_e_sem_exame_responde_409` | ok |
| CA-007 | aceitacao | `test_revoga_o_acesso_do_parceiro_sem_tocar_no_resto` confere `acao == "LAUDO_PORTAL_PARCEIRO_REVOGADO"` e os detalhes (`laudo_id`, `exame_id`, `partner_id`) | ok |
| CA-008 | aceitacao | `test_liberar_de_novo_reativa_a_mesma_linha`: `_upsert_portal_partner_release_target` devolve o mesmo `target.id` com `revoked_at` nulo | ok |
| CA-009 | aceitacao | `test_parceiro_revogado_nao_recebe_mais_aviso_por_whatsapp`: depois da revogacao o parceiro volta a `ignorado`/`nao_liberado` e o numero dele nao aparece nas chamadas ao provedor | ok |

## 2) Comandos executados

```bash
cd backend
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/test_laudo_portal_revogar_parceiro.py -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -k "laudo or whatsapp or portal" -q
```

### Resultado - 2026-09-18

- `pytest tests/test_laudo_portal_revogar_parceiro.py`: 6 testes novos passaram.
- `pytest -k "laudo or whatsapp or portal"`: 641 passaram, 7 pulados — nenhuma
  regressao no fluxo de liberacao nem no do aviso por WhatsApp.

## 3) Verificacao manual

Sem tela neste ciclo, entao a conferencia foi na propria rota, autenticado:

```bash
curl -X POST "$API/laudos/<laudo_id>/portal/veterinarios/<partner_id>/revogar" \
  -H "Authorization: Bearer $TOKEN"
```

### Feito em stage - 2026-09-18

A rota foi usada para terminar a limpeza da fixture das specs anteriores: o
laudo 49 tinha ficado com o parceiro 49 ainda liberado no portal, sobra que
nenhuma rota alcancava antes desta.

1. Primeira chamada: **200**, com `revogado_em` gravado e
   `portal_veterinarios_destinos: []` na resposta — o parceiro saiu dos
   destinos do laudo.
2. `portal_clinica_liberado` seguiu `true` e o status do laudo continuou
   `Liberado no portal`: a liberacao da clinica, que e anterior a fixture, nao
   foi tocada (CA-003).
3. Segunda chamada no mesmo alvo: **409** "Este veterinario nao esta liberado no
   portal para este laudo" (CA-005).

A conferencia visual continua pendente para o ciclo da tela — a lista de
"liberado para" com o botao de revogar em `laudos/[id]`.

## 4) Risco residual

- Revogar vale para o estado atual, nao e trava: um clique em "No portal"
  devolve o acesso, inclusive para quem entra por difusao de clinica. Bloqueio
  permanente por parceiro seria outro conceito, e nao esta escrito em lugar
  nenhum.
- A rota olha so o exame mais recente do laudo. Laudo com mais de um exame
  vinculado — situacao que o fluxo nao produz hoje — teria as liberacoes dos
  exames anteriores fora do alcance dela.
- Sem tela, o acesso indevido continua dependendo de alguem chamar a rota. A
  lacuna operacional so fecha no ciclo da interface.
