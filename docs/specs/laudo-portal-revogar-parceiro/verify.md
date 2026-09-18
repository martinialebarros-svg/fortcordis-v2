# Verify - laudo-portal-revogar-parceiro

Data: 2026-09-18 (rota) e 2026-09-19 (tela)
Responsavel: Martiniano
Status: in-progress

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

### Tela - segunda fase

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-010 | aceitacao | `PortalLiberadoPara` renderiza clinica e veterinarios com o selo "Com acesso"/"Sem acesso"; `getVeterinariosDoLaudo` e `getClinicaDoLaudo` testados em `lib/laudo-portal-destinos.test.ts`, inclusive no contrato antigo sem a lista de destinos | ok |
| CA-011 | aceitacao | `getRotuloOrigemVeterinario` testado nas tres saidas ("Encaminhou o caso", "Por vínculo com a clínica", generico) | ok |
| CA-012 | aceitacao | O botao so e renderizado dentro de `veterinario.liberado`; o item da clinica nao tem botao | pendente - conferir em stage |
| CA-013 | aceitacao | `getConfirmacaoRevogarVeterinario` testado: nomeia o veterinario e diz que liberar de novo devolve o acesso | ok |
| CA-014 | aceitacao | O handler atualiza `portal_veterinarios_destinos` e os demais campos com o que a resposta devolve, sem recarregar | pendente - conferir em stage |
| CA-015 | aceitacao | `temDestinosNoPortal` testado (laudo sem clinica e sem veterinario nao renderiza); a secao leva `print:hidden` | pendente - conferir em stage |

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

### Pendente em stage - tela

Com a segunda fase, a conferencia visual passa a ter o que olhar em
`laudos/[id]`: o bloco "Liberado no portal para" com os selos, o botao so em
quem tem acesso, a confirmacao nomeando o veterinario, a lista se atualizando
sozinha depois de revogar (CA-012, CA-014) e o bloco fora da impressao
(CA-015).

## 4) Risco residual

- Revogar vale para o estado atual, nao e trava: um clique em "No portal"
  devolve o acesso, inclusive para quem entra por difusao de clinica. Bloqueio
  permanente por parceiro seria outro conceito, e nao esta escrito em lugar
  nenhum.
- A rota olha so o exame mais recente do laudo. Laudo com mais de um exame
  vinculado — situacao que o fluxo nao produz hoje — teria as liberacoes dos
  exames anteriores fora do alcance dela.
- A tela vive so na visualizacao do laudo (`laudos/[id]`). Quem trabalha pela
  Central de laudos nao ve quem esta com acesso sem abrir o laudo.
- O bloco revoga um veterinario por vez. Tirar varios exige um clique e uma
  confirmacao para cada, o que e lento se um parceiro precisar sair de muitos
  laudos — caso que pediria outra ferramenta, por parceiro e nao por laudo.
