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
| CA-018 | aceitacao | `lib/portal-partner-clinic-links.test.ts` (11 regras) mais a verificacao em stage: parceiro #50 criado com 3 clinicas, selo `· recebe todos` so na Animal Care, e a edicao recarregou o conjunto salvo | ok |
| CA-019 | regressao | `pytest tests/` inteiro verde (1334). Nenhuma assercao de comportamento de #151 foi tocada; das suites antigas mudou so a lista de tabelas do fixture e o import, porque a difusao faz JOIN com a tabela nova | ok |
| CA-020 | aceitacao | `test_estado_do_laudo_mostra_o_veterinario_que_entrou_por_vinculo`: laudo liberado so por difusao devolve `disponivel`/`liberado` true e o destino com `origem = "vinculo_clinica"`. Em stage, o laudo 46 reproduziu o bug antes da correcao | ok |
| CA-021 | aceitacao | `lib/laudo-whatsapp-aviso.test.ts`: o laudo sem nomeado, liberado por vinculo, agora devolve `["clinica", "veterinario_parceiro"]` e o dialogo nomeia "Animal Care e Dra. Carla Soares" | ok |
| CA-022 | aceitacao | Mesmo arquivo: com nomeado + difusao, o dialogo nomeia os dois e o botao usa "veterinarios parceiros" | ok |
| CA-023 | aceitacao | `test_vinculo_sem_liberacao_aparece_como_pendente_e_nao_liberado` mais o caso `liberado: false` do teste de front: fica fora do aviso e entra em `portal_destinos_pendentes` | ok |
| CA-024 | performance | `listar_laudos` carrega difusao e targets uma vez por pagina; a consulta de targets nem roda sem destino veterinario na pagina — foi assim que `test_laudo_portal_whatsapp_status.py` voltou a passar sem tocar no fixture dele | ok |
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
- `pytest tests/` (suite inteira): **1338 passaram**, 7 pulados, 278 subtests —
  os 4 ultimos sao os de estado do laudo, da correcao do defeito de stage.
- `vitest run`: 44 arquivos, **325 testes** (11 em
  `lib/portal-partner-clinic-links.test.ts` e 6 novos em
  `lib/laudo-whatsapp-aviso.test.ts`, que travam o defeito do aviso).
- `tsc --noEmit` e `eslint --max-warnings=0`: sem erros.
- `next build`: passou.

## 3) Verificação manual

### Feito em stage - 2026-09-16

Fixtures criadas: veterinário parceiro **#50 "Dra. Teste Multiclinica"**
(`teste.multiclinica@example.com` — domínio reservado, não entrega a ninguém) e
**#51 "Ana Teste Sem Vinculo"**, sem vínculo nenhum. Clínicas: Animal Care (id 8),
Animal Clinic (id 13), Bicho Cheiroso.

1. **Cadastro com 3 clínicas (CA-001, CA-018).** Marquei as 3 no formulário, com
   "receber todos os laudos" ligado só na Animal Care. Cada clínica marcada abre
   o interruptor aninhado, desligado por padrão. O card do parceiro na listagem
   trouxe `Animal Care · recebe todos` em destaque e as outras duas sem o selo.
2. **Edição carrega o salvo, e o PATCH substitui (CA-005, CA-018).** Reabri a
   edição: as 3 voltaram marcadas, com o interruptor no lugar certo. Desmarquei
   Bicho Cheiroso e liguei a difusão da Animal Clinic no mesmo salvamento; o card
   passou a mostrar exatamente `Animal Care · recebe todos` e
   `Animal Clinic · recebe todos`. Remoção e troca de interruptor no mesmo PATCH.
3. **Seletor ordenado (CA-016).** Com só 2 veterinários a ordem não discriminava
   (o de teste já vinha primeiro no alfabeto), então criei o #51 "Ana", que vem
   antes de todos. Resultado: sem filtro → `[Ana, Dra. Teste, Martiniano]`;
   `clinica_id=8` → `[Dra. Teste, Ana, Martiniano]`; `clinica_id=40` (sem
   vínculo) → volta ao alfabético. Total 3 nas três consultas: ninguém sumiu.
4. **Difusão de verdade (CA-006, NFR-004).** Liberei o laudo 46 (paciente hula,
   Animal Care, `Finalizado`, **sem veterinário nomeado**). A resposta veio com
   `veterinarios_por_vinculo: [50]` e `veterinario_parceiro_id: null`, e a
   auditoria registrou `LAUDO_PORTAL_PARTNER_NOTIFICATION_SENT` com
   `origem: "vinculo_clinica"`, `partner_id: 50`, `destination_masked:
   "te***@example.com"`. A difusão funcionou ponta a ponta sem nomear ninguém.

### Defeito encontrado em stage, e corrigido

O passo 4 expôs um defeito **introduzido por esta entrega**. Depois de liberado,
o laudo 46 respondia:

```
portal_veterinario_disponivel: false
portal_veterinario_liberado:   false
veterinario_parceiro_nome:     ""
```

...embora a Dra. Teste Multiclinica **tivesse** o laudo. Esses campos só olhavam
`laudo.veterinario_parceiro_id`, que é nulo quando ninguém foi nomeado.

A consequência não era cosmética. `getDestinosAvisoWhatsApp` exigia
`veterinario_parceiro_id && portal_veterinario_liberado`, então na Central de
laudos o botão diria *"Avisar clínica pelo WhatsApp oficial"* e o diálogo
*"Enviar para Animal Care o aviso de laudo disponível?"* — enquanto o backend
mandaria WhatsApp **também para o celular da veterinária**. O diálogo nomeava um
destinatário e o envio ia para dois.

Correção (RF-018, RF-019): `_serialize_portal_release_state` passou a montar o
conjunto completo de destinatários e a expor `portal_veterinarios_destinos`; o
front passou a decidir por essa lista e a nomear cada um no botão e no diálogo,
com plural quando é mais de um. Coberto por CA-020 a CA-023.

De quebra, CA-024: a consulta de targets da listagem virou preguiçosa — não roda
quando nenhum laudo da página tem destino veterinário. Foi assim que
`test_laudo_portal_whatsapp_status.py` voltou a passar sem tocar no fixture dele.

### Pendente em stage

Refazer o passo 4 sobre o código corrigido e conferir na Central de laudos que o
laudo 46 agora anuncia os dois destinos no botão e nomeia a veterinária no
diálogo. Não exercitado: o portal do próprio veterinário parceiro (exigiria a
senha dele).

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
