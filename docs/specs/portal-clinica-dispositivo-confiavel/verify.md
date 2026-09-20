# Verify - portal-clinica-dispositivo-confiavel

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Coberto por `portal-escopo-sessao-clinica` (CA-001 a CA-003 de la), entregue no PR #173 | ok |
| CA-002 | aceitacao | `test_portal_escopo_sessao.py::test_escopo_so_laudos_continua_lendo_exames_liberados` (inclui painel operacional) | ok |
| CA-003 | aceitacao | Coberto por `portal-escopo-sessao-clinica` (CA-004 de la, 4 subtests), entregue no PR #173 | ok |
| CA-004 | aceitacao | `test_portal_clinic_device_trust.py::test_conectar_cria_confianca_com_escopo_so_de_laudos` - escopo do token decodificado, sem `clinic:read` | ok |
| CA-005 | aceitacao | `test_portal_clinic_device_trust.py::test_conectar_com_link_invalido_nao_cria_nada` - mesmo 404 e mesmo `detail` da abertura do laudo | ok |
| CA-006 | aceitacao | `test_portal_clinic_device_trust.py::test_sessao_rotaciona_o_cookie_e_renova_o_prazo` - cookie anterior devolve 401 | ok |
| CA-007 | aceitacao | `test_portal_clinic_device_trust.py::test_confianca_sem_uso_alem_do_prazo_expira` - status vira `expired` | ok |
| CA-008 | aceitacao | `test_portal_clinic_device_trust.py::test_navegador_diferente_encerra_a_confianca` - revoga, nao so recusa | ok |
| CA-009 | aceitacao | `test_portal_clinic_device_trust.py::test_revogar_o_link_de_origem_derruba_a_confianca` | ok |
| CA-010 | aceitacao | `test_portal_clinic_device_trust.py::test_encerrar_revoga_e_e_idempotente` | ok |
| CA-011 | aceitacao | `test_portal_clinic_device_trust.py::test_falha_no_aviso_ao_gestor_nao_impede_a_conexao` | ok |
| CA-012 | aceitacao | `test_portal_clinic_device_trust.py::test_admin_revoga_por_dispositivo_e_por_clinica` (inclui 422 sem alvo) | ok |
| CA-013 | aceitacao | `test_portal_clinic_device_trust.py::test_sessao_de_rotina_nao_gera_auditoria` | ok |
| CA-014 | aceitacao | `PortalClinicaPageShell.test.tsx::ainda tenta o computador confiavel quando nao ha nada guardado` (teste proprio, criado em 20/09/2026) + cenario 1 em stage | ok |
| CA-015 | aceitacao | `PortalClinicaWorkspaceModoLaudos.test.tsx` - 8 casos (abas escondidas, abas presentes com senha, cabecalho, sair do computador, e os tres do login por senha do RF-019) | ok |
| CB-001 | borda | **Confirmado em stage em 20/09/2026** (cenario 3, secao 3): com o gestor logado, a tela roda em `password` com `clinic:read` e o cookie do dispositivo continua valido no mesmo navegador (`dispositivo/sessao` 200, escopo so de exames). Testes: `PortalClinicaPageShell.test.tsx::nao reconfere sessao com senha`, `::leva ao formulario de senha sem encerrar a confianca do computador` e `PortalClinicaWorkspaceModoLaudos.test.tsx::oferece entrar com senha sem passar por sair do computador` | ok |
| CB-002 | borda | `PortalExamLinkWorkspace.test.tsx::falha ao conectar sem tirar o laudo da tela` (pedido recusado) e `::nao diz que conectou quando o navegador nao guarda o cookie` (pedido aceito, cookie descartado - RF-023, 20/09/2026). Download sem cookie conferido em stage: 200, `application/pdf`, 899.570 bytes | ok |
| CA-016 | aceitacao | `PortalClinicaPageShell.test.tsx::derruba o computador revogado mesmo com token guardado ainda no prazo` e `::nao reconfere sessao com senha`; confirmado em stage em 20/09/2026 (secao 3) | ok |
| CA-017 | aceitacao | `PortalClinicaPageShell.test.tsx::volta para o modo laudos quando a sessao com senha termina` e `::nao retoma o dispositivo quando foi o gestor que pediu o formulario` | ok |
| CB-005 | borda | `test_portal_clinic_device_trust.py::test_sessao_rotaciona_o_cookie_e_renova_o_prazo` (sessao com a flag desligada) e `test_flag_desligada_impede_conectar` | ok |
| CB-007 | borda | `PortalClinicaPageShell.test.tsx::mantem a recepcao conectada quando o servidor nao responde` - erro que nao e `PortalRequestError` nao desconecta | ok |
| CB-008 | borda | `PortalClinicaPageShell.test.tsx::cai na pagina publica se a confianca tambem tiver acabado` | ok |
| RF-014 | funcional | `test_portal_clinic_device_trust.py::test_clinica_inativa_invalida_a_confianca` | ok |
| NFR-001 | nao funcional | CA-004 (escopo do token) + CA-003 (403 na gestao) + `_resolver_link_laudo` compartilhado entre abrir laudo e conectar | ok |
| NFR-002 | nao funcional | Coberto por `portal-escopo-sessao-clinica` | ok |
| NFR-003 | nao funcional | Cookie proprio `PORTAL_CLINIC_DEVICE_TRUST_COOKIE_NAME`, `httponly=True`, mesmo `samesite`/`secure` do refresh; testes leem o `set-cookie` da resposta | ok |
| NFR-004 | nao funcional | Token opaco `generate_opaque_token` guardado por `hash_secret`; rotacionado a cada uso (CA-006) | ok |
| NFR-005 | nao funcional | CA-013 | ok |
| NFR-006 | nao funcional | Todas as recusas de `dispositivo/sessao` devolvem 401 com o mesmo `detail` e limpam o cookie (CA-006 a CA-009, RF-014) | ok |
| NFR-007 | nao funcional | Modo laudos usa os mesmos endpoints de exame do portal com senha; nenhum dado novo exposto | ok |
| Migracao | banco | `20260918_88` aplicada em banco limpo pela suite; aplicada em stage (conferido em 20/09/2026: `current_version=20260918_88`, `pending_count=0`); **falta producao** | pendente |
| Stage | manual | **Os 7 cenarios** rodados em 20/09/2026, mais RF-021 e RF-022 confirmados em stage (secao 3). Falta rever o 7 em stage depois do RF-023 | pendente |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && python -m pytest tests/ -q
```

```bash
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

```bash
cd whatsapp-stage-backend && npm run build && npm run test:approved-templates && npm run test:inbox-ui
```

Resumo dos resultados:

- Backend: **1397 passaram, 7 pulados, 297 subtests** (54s). Inclui os 12 testes
  novos de `test_portal_clinic_device_trust.py`.
- Frontend: `tsc` limpo, `eslint --max-warnings=0` limpo,
  **49 arquivos / 376 testes** no vitest e 9 no `node --test`.
- whatsapp-stage-backend: `tsc` limpo, catalogo e contratos da caixa de entrada
  passando (nao foi tocado nesta entrega; rodado por garantia).
- `test_portal_clinic_device_trust.py` entrou na lista do `migrations-ci.yml`, ao
  lado de `test_portal_escopo_sessao.py`: os dois cobrem autorizacao e sao o unico
  Python que roda em `pull_request`. Conferido rodando por `unittest` como o CI
  invoca (21 testes, OK).

Regressao corrigida no caminho: sete suites que montam schema SQLite a mao
passaram a depender de `portal_clinic_trusted_devices`, porque revogar a liberacao
do exame agora revoga as confiancas. As sete receberam a tabela na lista.

### Incremento de 20/09/2026 - RF-021 (reconferencia no bootstrap)

Mudanca so de frontend; o backend nao foi tocado e a suite dele nao foi rodada de
novo nesta rodada.

```bash
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

- `tsc` limpo, `eslint --max-warnings=0` limpo,
  **50 arquivos / 383 testes** no vitest e 9 no `node --test`.
- Arquivo novo `PortalClinicaPageShell.test.tsx`, 5 casos: reconfere antes de
  renderizar, derruba o computador revogado, sobrevive a rede fora, nao toca em
  sessao com senha, e ainda tenta o dispositivo quando nao ha nada guardado.
- `portalFetchJson` passou a lancar `PortalRequestError`, que carrega o status HTTP.
  Sem isso nao da para separar "o servidor recusou" de "nao falei com o servidor", e
  uma oscilacao de rede desconectaria quem continua autorizado (CB-007).

### Incremento de 20/09/2026 - RF-019 (porta para o login por senha)

Tambem so de frontend.

- `tsc` limpo, `eslint --max-warnings=0` limpo,
  **50 arquivos / 388 testes** no vitest e 9 no `node --test`.
- 5 casos novos: tres em `PortalClinicaWorkspaceModoLaudos.test.tsx` (a acao aparece
  em modo laudos, nao aparece sem callback, nao aparece em sessao com senha) e dois em
  `PortalClinicaPageShell.test.tsx` (leva ao formulario e volta para os laudos; a
  volta nao aparece para quem chegou deslogado).
- O ponto coberto que mais importa: clicar em "Entrar com senha" **nao** encerra a
  confianca. O shell limpa so a sessao guardada, e por isso a volta funciona.

### Incremento de 20/09/2026 - RF-022 (retomada no logout)

Tambem so de frontend.

- `tsc` limpo, `eslint --max-warnings=0` limpo,
  **50 arquivos / 391 testes** no vitest e 9 no `node --test`.
- 3 casos novos em `PortalClinicaPageShell.test.tsx`: volta ao modo laudos no logout,
  cai na pagina publica quando a confianca tambem acabou (CB-008), e nao reage ao
  formulario que o proprio gestor pediu.
- `handleSessionChange` le `session` e `pedindoSenha` por `useRef` de proposito: o
  workspace guarda esse callback nas dependencias de um efeito, e trocar a identidade
  da funcao a cada render o faria reemitir a sessao sem necessidade.

### Incremento de 20/09/2026 - RF-023 (confirmar que o cookie colou)

Tambem so de frontend.

- `tsc` limpo, `eslint --max-warnings=0` limpo,
  **50 arquivos / 392 testes** no vitest e 9 no `node --test`.
- `PortalExamLinkWorkspace.test.tsx::nao diz que conectou quando o navegador nao
  guarda o cookie` cobre o caso novo; o teste de sucesso passou a exigir que a
  confirmacao tenha acontecido antes do "Pronto".
- A mensagem separa recusa do servidor de falha de rede: so a primeira acusa o
  navegador de nao ter guardado o acesso.

## 3) Testes manuais

Rodados em 20/09/2026 em `app.stage.fortcordis.com.br`, clinica Animal Care (id 8),
laudo 48 / exame 17, com `PORTAL_CLINIC_DEVICE_TRUST_ENABLED=true`.

O modelo `laudo_disponivel_portal_link` continua em analise na Meta e a WABA de teste
so entrega para numeros na lista de autorizados, entao **a mensagem nao chegou**. Nao
foi impedimento: `issue_exam_link` roda e da commit **antes** do envio, entao o link
nasceu mesmo com a entrega falhando, e a URL foi reconstruida de `SECRET_KEY` +
`token_nonce` (conferida contra o `token_hash` guardado).

- Cenario 1 - **ok**. Link abriu o laudo sem sessao; "manter esta unidade conectada"
  devolveu 200; `/clinica-parceira` passou a abrir direto na lista, com
  "Conectado neste computador", a fila de aguardando liberacao (4) e o acervo.
  Prazo exibido: 30 dias (20/10), e `last_seen_at` avanca a cada sessao.
- Cenario 2 - **ok**. Sessao nasceu com `scope: ["exam:read","exam:download"]` e
  `auth_method: device_trust`. `/clinicas/financeiro` e `/clinicas/agendamentos`
  devolveram **403** com `"Sessao do portal sem permissao para esta operacao."`;
  `/clinicas/exames` devolveu 200. Abas de agenda e financeiro ausentes da tela.
- Cenario 3 (CB-001) - **ok**, rodado depois que a acao do RF-019 criou o caminho.
  Com o gestor logado pela propria tela do modo laudos, medido no mesmo instante e no
  mesmo navegador: sessao da tela em `password` com
  `["clinic:read","exam:read","exam:download"]` e `account_id: 1`; cookie do
  dispositivo **ainda valido** (`dispositivo/sessao` -> 200, `device_trust`,
  `["exam:read","exam:download"]`); `/clinicas/financeiro` com o token de senha ->
  200. Abas de agenda e financeiro de volta, cabecalho trocando "Conectado neste
  computador" por "Sessao ativa". Os dois cookies convivem, com a senha na frente.
  Ver tambem o achado do logout, no fim desta secao.
- Cenario 4 - **ok**. "Sair deste computador" devolveu a tela publica e limpou a
  sessao guardada no navegador. Dispositivo ficou `revoked`, motivo
  `encerrado-pela-unidade`.
- Cenario 5 - **ok**. Revogar a liberacao do exame devolveu
  `links_revogados: 1, dispositivos_revogados: 1`; `dispositivo/sessao` passou a 401
  e a pagina do link passou a exibir "Este link nao esta mais disponivel.".
  Religar o exame e reemitir gerou **token diferente** - link revogado nao volta.
- Cenario 6 - **ok, com o achado abaixo**. Revogacao pelo admin fez
  `dispositivo/sessao` devolver 401 com o cookie limpo.
- Cenario 7 (CB-002) - **rodado, e reprovou na primeira tentativa**. Emulando um
  navegador que bloqueia cookies (pedido sai, `Set-Cookie` descartado), a tela
  respondeu **"Pronto. Este computador agora abre os laudos da unidade direto, sem
  senha."** e `/clinica-parceira` em seguida mostrou a pagina publica de login. Ou
  seja: falhou em silencio, com confirmacao verde por cima. Corrigido no mesmo dia
  por RF-023 - falta rever em stage depois do deploy.
  A outra metade passou: **o download do laudo continua funcionando** sem cookie
  nenhum (200, `application/pdf`, 899.570 bytes).

Verificacoes extras que o roteiro nao pedia:

- O token de download e preso ao par exame/anexo tambem em stage: o token do laudo da
  gamora devolveu **403** no anexo 24, que e **da mesma clinica**. Link encaminhado
  nao vira chave do acervo.
- A degradacao do modelo com link roda de verdade: a Meta recusou `portalReportLink`
  e o backend tentou `portalReportAvailable` com a chave `-nolink`, na ordem prevista
  por CA-003 do spec do link.

### Achado do cenario 6: revogar nao cortava na hora

Revogado o dispositivo pelo admin, `dispositivo/sessao` devolvia 401 corretamente -
mas recarregar `/clinica-parceira` **mantinha a recepcao dentro**, lendo os laudos. O
access token fica em `localStorage` (`fortcordis_portal_session:clinica`) e o
bootstrap o reusava sem reconferir. Medido no momento da revogacao: token ainda valia
**1583 s** (~26 min) e `/clinicas/exames` com ele devolvia **200**.

Isso contrariava o risco residual 3, que trata revogacao como o remedio para maquina
trocada ou roubada. Corrigido no mesmo dia por RF-021 (reconferencia no bootstrap,
com CB-007 para nao derrubar ninguem por oscilacao de rede).

**Reconferencia confirmada em stage em 20/09/2026**, depois do deploy do PR #183:
computador conectado pelo link, `/clinica-parceira` abrindo em modo laudos com
`dispositivo/sessao` 200 na carga; revogacao pelo admin (`revogados: 1`); recarga da
mesma pagina com a sessao guardada ainda dentro do proprio prazo -> **caiu na tela
publica de login** e o `localStorage` foi limpo. Sob o codigo anterior a recepcao
continuava dentro.

### Achado ao preparar o cenario 3: nao ha porta para o login por senha

Com o computador conectado, o cabecalho do modo laudos diz "Financeiro e agenda
exigem login" - mas a unica acao na tela e **"Sair deste computador"**, que revoga a
confianca. O RF-019 previa tambem "Entrar com senha para ver financeiro e agenda";
isso nao foi implementado.

Consequencia pratica: para o gestor entrar com senha na maquina da recepcao, ele
precisa primeiro desconectar a maquina - e depois a recepcao so volta pelo link
seguinte. Os dois cookies **conseguem** coexistir (tem nomes diferentes e o bootstrap
da precedencia a sessao com senha), mas nao ha caminho de interface que leve a isso.
E por isso que o **cenario 3 (CB-001) segue sem rodar**: do jeito que a tela esta, ele
nao descreve um caminho que exista.

**Resolvido no mesmo dia**: a acao do RF-019 foi implementada. "Entrar com senha para
ver financeiro e agenda" abre o formulario **sem revogar a confianca** - o shell so
limpa a sessao guardada, o cookie do dispositivo fica de pe, e "Voltar para os laudos
da unidade" (ou uma recarga) traz a recepcao de volta. "Sair deste computador"
continua na tela, abaixo, porque encerrar de verdade tambem precisa existir.

Com isso o cenario 3 deixou de estar bloqueado, e rodou no mesmo dia.

### Achado do cenario 7: a tela dizia "Pronto" sem ter conectado

O `confiar-dispositivo` responde **200** mesmo quando o navegador descarta o cookie -
o servidor cria a confianca e nao tem como saber que ela nao chegou. A tela tratava o
200 como sucesso.

O teste que cobria CB-002 exercitava o outro jeito de falhar (pedido **recusado**
pelo servidor), entao a lacuna passou batida ate a verificacao em stage.

Quem vive isso e a recepcao: clica, le "Pronto", volta ao trabalho, e no dia seguinte
o portal pede senha. A suspeita cai no link, nao no navegador.

Corrigido por RF-023: a tela so confirma depois de `dispositivo/sessao` provar que o
cookie colou. Sobra um efeito colateral aceito - a confianca criada nesse caso fica
orfa no banco, sem ninguem que saiba o segredo, ate expirar por inatividade.

### Achado do cenario 3: o logout largava a recepcao na porta

Rodando o cenario 3 ate o fim: depois do "Sair" do gestor, a tela foi para a **pagina
publica de login**. A confianca do computador continuava de pe - recarregar devolvia o
modo laudos, com os 30 dias intactos - mas o bootstrap do shell so roda na montagem,
entao nada reconsultava o dispositivo.

O efeito pratico e o problema que esta entrega existe para evitar: o gestor sai, vai
embora, e a secretaria senta numa maquina pedindo **uma senha que ela nao tem**. Um F5
resolveria; ela nao tem como saber disso, e liga para a Fort Cordis.

Corrigido no mesmo dia por RF-022: terminada a sessao com senha, o shell reconsulta o
dispositivo antes de mostrar a pagina publica. Com duas guardas - nao reage ao `null`
que o cartao de login emite ao terminar o proprio bootstrap, nem ao formulario que o
gestor pediu por RF-019 (CB-008 cobre o caso em que a confianca tambem acabou).
**Ainda nao confirmado em stage**, so por teste.

## 4) Regressao e riscos residuais

- Risco residual 1: **um link encaminhado permite criar confianca** e, com ela,
  acesso continuado ao acervo de laudos da clinica. Contido por escopo travado em
  `exam:*`, expiracao por inatividade, rotacao de cookie, amarracao ao navegador,
  revogacao e aviso ao gestor - nao eliminado. Aceito em 2026-09-18.
- Risco residual 2: maquina compartilhada na recepcao expoe os laudos da unidade a
  quem sentar nela.
- Risco residual 3: computador trocado ou roubado segue confiavel ate expirar por
  inatividade ou ser revogado. Desde 20/09/2026 a revogacao vale na recarga seguinte
  (RF-021); antes disso o token guardado ainda abria laudos por ate meia hora - ver o
  achado do cenario 6 na secao 3. O que sobra: uma aba **ja aberta** so sente a
  revogacao quando recarregar ou quando o token expirar.
- Risco residual 4: **30 dias de inatividade** (decidido em 18/09/2026) e uma
  escolha de operacao, nao uma medicao. Clinica que so manda exame a cada dois
  meses vai perder a confianca da maquina entre um envio e outro e precisara
  reconectar pelo link seguinte - o que funciona, mas e um passo a mais. O numero
  continua configuravel por `PORTAL_CLINIC_DEVICE_TRUST_INACTIVITY_DAYS`; vale
  revisitar depois de ver os dados de `last_seen_at` das primeiras unidades.
- Risco residual 7 (20/09/2026): navegador que descarta o cookie deixa uma confianca
  orfa no banco - criada, mas sem ninguem que saiba o segredo. Nao da acesso a
  ninguem; so aparece na lista do admin ate expirar por inatividade. `confiar-
  dispositivo` nao tem como saber, na hora, que o cookie nao chegou.
- Risco residual 5: nao ha limite de dispositivos confiaveis por clinica, nem tela
  para a propria unidade listar os seus (so "sair deste computador" no navegador
  atual). Uma unidade com varias maquinas acumula confiancas que so a Fort Cordis
  enxerga.
- Risco residual 6 (**fechado em 20/09/2026**): CA-014 ganhou teste proprio em
  `PortalClinicaPageShell.test.tsx`, junto com CA-016, CA-017, CB-007 e CB-008; e o
  CB-001 foi confirmado em stage no cenario 3, com os dois cookies medidos vivos no
  mesmo instante.
- Regressao: suites de backend, frontend e do servico Node verdes.

## 5) Itens fora de escopo entregues

- `migrations-ci.yml` ganhou mais um arquivo de teste (o de confianca de
  dispositivo), seguindo a decisao tomada em `portal-escopo-sessao-clinica`.
- `PortalExamLinkResponse` ganhou `dispositivo_confiavel_disponivel`, para a tela
  nao duplicar a flag do backend. Nao estava na spec; e a alternativa a expor a
  mesma decisao em dois lugares.

## 6) Decisao de release

- [x] Aprovado para stage (com `PORTAL_CLINIC_DEVICE_TRUST_ENABLED=false` no
      primeiro deploy; ligar so depois de conferir que o portal com senha segue
      normal).
- [ ] Aprovado para producao - **bloqueado** ate: (a) ~~`portal-escopo-sessao-clinica`
      estar em producao~~ **resolvido em 20/09/2026** (`_assert_portal_scope` esta em
      `main`); (b) os 7 cenarios manuais rodarem em stage - **6 rodaram em 20/09/2026**,
      falta so a metade visual do 7 (mensagem na tela com cookies bloqueados), mais a
      confirmacao em stage do RF-022;
      (c) a migracao `20260918_88` - **ja aplicada em stage**, falta producao. O prazo
      de inatividade ficou decidido em **30 dias** (18/09/2026).
- [ ] Nao aprovado.
