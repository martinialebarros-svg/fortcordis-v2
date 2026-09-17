# Verify - portal-veterinario-multiplas-clinicas

Data: 2026-09-16  
Responsavel: Martiniano  
Status: in-progress

> A matriz usa as colunas `ID | Tipo | Evidencia | Status` do
> `docs/specs/templates/verify.md` de proposito: o gate de promocao
> (`scripts/ci/check_promotion_verify_pending.py`) so le tabela que tenha
> coluna `Status`. Matriz em outro formato passa despercebida pelo gate.

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_cria_veterinario_com_tres_clinicas_vinculadas`: POST com 3 clinicas devolve os 3 vinculos com `clinica_nome` e o interruptor de cada um, e as 3 linhas existem em `portal_partner_clinic_links` | ok |
| CA-002 | aceitacao | `test_clinica_repetida_no_payload_responde_422_e_nao_grava`: 422 com "mais de uma vez" e as duas tabelas seguem vazias | ok |
| CA-003 | aceitacao | `test_clinica_inativa_responde_404_e_nao_grava`: 404 e nenhuma linha gravada | ok |
| CA-004 | aceitacao | `test_vinculos_em_parceiro_do_tipo_clinica_responde_422`: 422 com "somente ao veterinario parceiro" | ok |
| CA-005 | aceitacao | `test_patch_substitui_o_conjunto_e_sem_o_campo_preserva`: o PATCH com 2 dos 3 remove o ausente e troca o interruptor; o PATCH seguinte, so com `telefone`, deixa os vinculos intactos | ok |
| CA-006 | aceitacao | `test_difusao_libera_veterinario_sem_precisar_nomear_no_laudo`: laudo sem nomeado cria `PortalPartnerReleaseTarget` para o vinculado e chama `notify_partner_report_released` uma vez, com o `partner_id` dele | ok |
| CA-007 | aceitacao | `test_nomeado_e_difusao_recebem_os_dois`: dois targets e dois emails, nessa ordem (nomeado primeiro) | ok |
| CA-008 | aceitacao | `test_nomeado_que_tambem_difunde_entra_uma_vez_so`: um target, um email, e `veterinarios_por_vinculo` vazio — ele entrou como nomeado | ok |
| CA-009 | aceitacao | `test_veterinario_inativo_nao_entra_na_difusao`: nenhum target, nenhum email | ok |
| CA-010 | aceitacao | `test_vinculo_com_interruptor_desligado_nao_difunde` e `test_vinculo_em_outra_clinica_nao_alcanca_o_laudo`: os dois sem target e sem email | ok |
| CA-011 | aceitacao | `test_laudo_sem_clinica_libera_somente_o_nomeado`: com `clinic_id = None`, so o nomeado recebe, mesmo havendo vinculo de difusao em outra clinica | ok |
| CA-012 | aceitacao | `test_aviso_vai_para_clinica_nomeado_e_difusao`: 3 chamadas a `send_approved_utility_template`, destinos e `{{1}}` conferidos um a um, chaves `idem-difusao-001`, `-vet` e `-vet5`, todas com `len <= 128` | ok |
| CA-013 | aceitacao | `test_difusao_sem_whatsapp_nao_impede_os_demais`: o de difusao volta `ignorado`/`sem_whatsapp`, os outros dois enviam e o resumo do laudo fica `enviado` | ok |
| CA-014 | aceitacao | `test_falha_na_difusao_mantem_200_e_resume_como_falhou`: 200, o nomeado enviou, `whatsapp_parceiro_status == "falhou"` com o erro persistido, e cada veterinario tem o proprio status na resposta | ok |
| CA-015 | aceitacao | `test_aviso_vai_para_clinica_nomeado_e_difusao`: `whatsapp_parceiro_status == "enviado"`, `_erro` nulo, e `veterinarios_parceiros` com os dois em `enviado` e a `origem` de cada um | ok |
| CA-016 | aceitacao | `test_opcoes_ordena_vinculados_da_clinica_primeiro`: sem `clinica_id` a ordem e alfabetica; com ele, "Dra. Wanda Difusao" (difunde) vem antes de "Dr. Zeca Vinculado" (vinculado), e "Dr. Alberto Sem Vinculo" fica por ultimo sem sair da lista | ok |
| CA-017 | aceitacao | `test_migracao_dos_vinculos_e_idempotente`: `upgrade()` duas vezes na mesma conexao, colunas conferidas, `uq_portal_partner_clinic_link` presente e o segundo INSERT do mesmo par recusado | ok |
| CA-018 | aceitacao | `lib/portal-partner-clinic-links.test.ts` cobre as 11 regras da selecao (marcar, desmarcar, 3 clinicas, interruptor por clinica, ida e volta do formulario, payload por tipo). **O comportamento visual na tela ainda nao foi conferido em stage** | pendente |
| CA-019 | regressao | `pytest tests/` inteiro verde (1334). Nenhuma assercao de comportamento de #151 foi tocada; das suites antigas mudou so a lista de tabelas do fixture e o import, porque a difusao faz JOIN com a tabela nova | ok |
| NFR-002 | seguranca | `test_difusao_nao_liberada_no_portal_nao_recebe_aviso`: o vinculo existe e difunde, mas sem `PortalPartnerReleaseTarget` o aviso volta `ignorado`/`nao_liberado` — a visibilidade continua vindo do target explicito, nao do vinculo | ok |

## 2) Comandos executados

```bash
cd backend
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/test_portal_partner_clinic_links.py -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/test_laudo_difusao_por_vinculo_de_clinica.py -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -k "portal or laudo or whatsapp" -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -q

cd frontend
npx vitest run
npx tsc --noEmit
npx eslint app/clinicas/portal/parceiros/page.tsx "app/laudos/[id]/editar/page.tsx" \
  app/laudos/eletrocardiograma/upload/page.tsx lib/portal-api.ts \
  lib/portal-partner-clinic-links.ts lib/portal-partner-clinic-links.test.ts --max-warnings=0
npx next build
```

### Resultado - 2026-09-16

- `pytest tests/test_portal_partner_clinic_links.py`: 7 testes novos passaram.
- `pytest tests/test_laudo_difusao_por_vinculo_de_clinica.py`: 11 testes novos
  passaram.
- `pytest tests/ -k "portal or laudo or whatsapp"`: 623 passaram, 7 pulados.
- `pytest tests/` (suite inteira): 1334 passaram, 7 pulados, 278 subtests.
- `vitest run`: 44 arquivos, 319 testes (11 novos em
  `lib/portal-partner-clinic-links.test.ts`).
- `tsc --noEmit` e `eslint --max-warnings=0`: sem erros.
- `next build`: passou.

## 3) Verificação manual

### Pendente em stage

Ainda não executado. Roteiro previsto, em `app.stage.fortcordis.com.br`:

1. **Cadastro com 3 clínicas (CA-018).** Em Portal Clínicas → Parceiros
   externos, criar um veterinário parceiro e marcar 3 clínicas, ligando
   "receber todos os laudos" em uma só. Conferir que o card do parceiro na
   listagem mostra as 3, com o selo `· recebe todos` apenas na escolhida.
2. **Edição carrega o que está salvo (CA-018, CA-005).** Editar o mesmo
   parceiro: as 3 clínicas voltam marcadas e o interruptor ligado é o mesmo.
   Desmarcar uma, salvar, reabrir e confirmar que sobraram 2.
3. **Difusão de verdade (CA-006).** Liberar no portal um laudo da clínica com o
   interruptor ligado, **sem** nomear o veterinário no laudo, e confirmar que
   ele passa a enxergar o caso no ambiente do veterinário parceiro.
4. **Seletor ordenado (CA-016).** Abrir a edição de um laudo daquela clínica e
   conferir que os vinculados aparecem no topo da lista de veterinários.
5. **Aviso por WhatsApp (CA-012).** Disparar o aviso e conferir que o resumo
   traz uma linha por veterinário. Em stage o provedor recusa por desenho — o
   que se confere aqui é a interface e o que fica persistido, não a entrega.

Vale o mesmo combinado de
[laudo-aviso-whatsapp-parceiro](../laudo-aviso-whatsapp-parceiro/verify.md):
o modelo aprovado `laudo_disponivel_portal` só existe na conta de produção, então
**stage confere interface e persistência, não entrega.**

### Pendente em produção

Com número próprio como destino, confirmar que o veterinário que entrou **só**
pelo vínculo recebe a mensagem com o próprio nome em `{{1}}` e o email de laudo
liberado.

## 4) Risco residual

- **Privacidade é a decisão, não o bug.** Com o interruptor ligado, o
  veterinário passa a ver e receber todos os laudos daquela clínica, inclusive
  os encaminhados por outro profissional dela. É o efeito pretendido; o risco é
  ligar o interruptor na clínica errada. Mitigação hoje: o interruptor é por
  vínculo, nasce desligado, e a listagem mostra em qual clínica ele está ligado.
  Não há tela que responda "quem mais recebe os laudos desta clínica?" partindo
  da clínica — só partindo do veterinário.
- `laudos.whatsapp_parceiro_status` virou **resumo**: com dois veterinários, um
  enviado e um falho, a coluna guarda `falhou` e o erro do primeiro que falhou.
  O detalhe por veterinário existe na resposta e na auditoria, mas a badge da
  Central de laudos mostra só o resumo.
- Revogar um vínculo não revoga os `PortalPartnerReleaseTarget` já criados: o
  veterinário continua vendo os laudos que já recebeu. É coerente com o resto do
  portal (a liberação é um fato datado), mas quem esperar "desvinculei, ele
  perdeu o acesso" vai se surpreender.
- O status continua sendo "a API aceitou o envio", não "a mensagem chegou" —
  mesma limitação de
  [laudo-whatsapp-liberacao-status](../laudo-whatsapp-liberacao-status/verify.md).
