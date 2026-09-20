# Intent - portal-clinica-dispositivo-confiavel

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Problema atual

Continuacao direta de `docs/specs/portal-clinica-link-laudo-whatsapp/`, que resolveu
o caso "chegou um laudo agora": o aviso no WhatsApp da clinica passou a carregar um
link que abre aquele laudo em um toque, sem senha.

Sobra o resto do trabalho da secretaria, que o link nao cobre:

- **achar um laudo antigo** sem ter que garimpar a mensagem certa numa conversa de
  WhatsApp com meses de historico;
- **conferir o que ainda nao saiu** - a fila de "aguardando liberacao", que segundo
  o proprio usuario (2026-08-14, `portal-clinica-parceira-redesign/intent.md`) e a
  unica metrica do painel que a clinica de fato usa.

Para as duas coisas ela precisaria do portal, e e ai que trava de novo, pelo motivo
ja mapeado: **quem cria a senha e o gerente; quem precisa do laudo e a secretaria**,
que nao sabe a senha e nao tem acesso ao e-mail do cadastro - entao nem o "esqueci
a senha" resolve. O resultado e a ligacao para a Fort Cordis.

Existe hoje um embriao de confianca de dispositivo: `PortalClinicSession` com
`refresh_token_hash`, `user_agent_hash` e `trusted_until`, alimentado pelo checkbox
"manter acesso neste computador da unidade ate o fim do expediente"
(`PORTAL_CLINIC_TRUSTED_SESSION_HOURS = 8`). Mas ele nasce **preso a uma conta com
senha** (`PortalClinicSession.account_id` e `nullable=False`) e dura 8 horas - ou
seja, so serve a quem ja tem senha, e obriga a reativar todo dia. Para a secretaria
e inutil nas duas pontas.

## 2) Objetivo

Deixar o computador da recepcao conectado ao portal **em modo laudos**, sem senha e
sem depender do gerente, a partir da propria pagina do link que ela ja abre. Uma vez
confiavel, a maquina abre a lista de exames liberados, a busca no historico e a fila
de "aguardando liberacao" direto, e o proximo link do WhatsApp cai na tela sem
nenhuma etapa.

## 3) Nao objetivos

- **Nao dar acesso a financeiro, agenda ou recibos.** Decisao do usuario em
  2026-09-18: o dispositivo confiavel enxerga laudos e mais nada. O portal completo
  continua exigindo e-mail e senha.
- Nao remover nem enfraquecer o login por senha, nem o MFA, nem o fluxo de convite.
- Nao mexer no fluxo do tutor nem no do veterinario parceiro individual.
- Nao alterar o que o link de laudo faz hoje (`portal-clinica-link-laudo-whatsapp`);
  esta entrega **acrescenta** uma acao aquela pagina.
- Nao implementar recuperacao de senha por WhatsApp (a outra metade do problema do
  gerente - fica para spec propria).
- Nao mexer no espelho interno `/clinicas/portal/espelho`, que autentica por usuario
  interno (`getPortalAdminAuthHeaders`) e nao por sessao de portal.

## 4) Contexto e restricoes

- **Depende de `portal-clinica-link-laudo-whatsapp`** (PR #171, base `stage`): a
  acao "manter esta unidade conectada" mora na pagina `/laudo/[token]`. A
  implementacao desta spec deve sair de uma branch que ja contenha aquela.
- **O escopo e gravado no token mas nunca verificado.** `PortalSessionContext.scope`
  existe desde `portal-secure-access-foundation`, e `issue_clinic_session` grava
  `["clinic:read", "exam:read", "exam:download"]` - mas nenhum endpoint consulta
  esse campo. O controle de acesso hoje e por `actor_type` mais as funcoes
  `_assert_*_scope_for_exam`, que so conferem a **posse** do exame, nunca a
  permissao. Uma sessao "so laudos" exige criar essa verificacao de fato.
- `PortalClinicSession.account_id` e `NOT NULL` e todo o fluxo de refresh confere o
  status da conta (`refresh_login_clinica`). Uma confianca nascida de link nao tem
  conta - reaproveitar a tabela obrigaria a espalhar guardas de "conta pode ser
  nula" por todo o servico de autenticacao.
- O cookie de refresh atual se chama `fortcordis_portal_clinic_refresh`. Um segundo
  mecanismo no mesmo navegador precisa de cookie proprio para nao colidir com uma
  sessao de gerente logado na mesma maquina.
- A fila operacional ja vem junto de `GET /portal/clinicas/exames` (montada por
  `_build_clinic_operational_panel`), entao o modo laudos precisa liberar **um**
  endpoint de leitura, nao varios.
- Guardrail de CI: `spec.md` e `verify.md` alterados no mesmo diff.
- Migracoes pelo runner proprio (`backend/migrations/versions/`).

## 5) Impacto esperado

- Usuarios impactados: secretarias (ganham o portal de laudos sem senha), gerentes
  (deixam de ser gargalo e passam a receber aviso de maquina conectada), equipe Fort
  Cordis (para de receber ligacao pedindo laudo antigo).
- Modulos impactados: `portal.py` (escopo e endpoints novos), `portal_clinic_auth.py`
  (visao e revogacao no admin), servico novo de dispositivo confiavel, frontend
  (`/laudo/[token]`, `/clinica-parceira`, `PortalClinicaWorkspace`).
- Risco de regressao: **medio-alto** - introduz verificacao de escopo em endpoints
  que hoje nao verificam nada. Mitigado pelo fato de que toda sessao existente ja
  carrega `clinic:read`, entao a verificacao nasce sem efeito pratico sobre quem ja
  usa o portal.

## 6) Riscos iniciais

- Risco 1 (o principal): **escalonamento do link.** O link de laudo e credencial ao
  portador num canal compartilhado. Se abri-lo permite criar uma sessao duravel, uma
  unica mensagem encaminhada vira acesso continuado a unidade. E uma ampliacao real
  em relacao ao que o PR #171 entregou, e foi aceita conscientemente - por isso o
  escopo fica preso a laudos, com expiracao por inatividade, revogacao e aviso ao
  gerente.
- Risco 2: **maquina compartilhada.** Qualquer pessoa que sentar no computador da
  recepcao ve os laudos da clinica. E o mesmo grau de exposicao de um e-mail da
  clinica logado naquela maquina, mas precisa estar dito.
- Risco 3: computador vendido, trocado ou roubado continua confiavel ate expirar por
  inatividade ou alguem revogar.
- Risco 4: a verificacao de escopo nova pode barrar por engano algum caminho legitimo
  que hoje passa sem conferencia nenhuma.
- Risco 5: auditar toda renovacao de sessao (como faz `PORTAL_CLINIC_SESSION_REFRESHED`)
  inundaria a tabela de auditoria, porque a recepcao renova a cada carregamento de
  pagina por meses.

## 7) Perguntas abertas

Resolvidas com o usuario em 2026-09-18:

- **O que o dispositivo confiavel enxerga?** So laudos da clinica - lista, busca no
  historico, fila de aguardando liberacao e download. Sem financeiro, agenda ou
  recibos.
- **Como a maquina vira confiavel?** Pela propria pagina do link, sem passar pelo
  gerente. O gerente recebe aviso por e-mail e a Fort Cordis pode revogar.
- **Por quanto tempo?** Renova a cada uso e cai por inatividade, com **30 dias**
  sem uso (decidido em 18/09/2026). Uma clinica que encaminha exame com alguma
  regularidade renova sozinha; a que sumiu por um mes inteiro perde o acesso
  daquela maquina, que e o efeito desejado. Continua configuravel por
  `PORTAL_CLINIC_DEVICE_TRUST_INACTIVITY_DAYS`.

Em aberto:

- Limite de dispositivos confiaveis por clinica? Hoje ha `MAX_ACTIVE_CLINIC_MANAGERS
  = 5` para contas; nao ha equivalente para maquinas.
- A secretaria deveria conseguir ver e encerrar os dispositivos da propria unidade,
  ou isso fica so com a Fort Cordis e o gerente?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.

## 9) Sugestoes de novos recursos (para validar e priorizar, nao e compromisso)

- Recuperacao de senha por WhatsApp para a clinica - ataca a outra metade do
  problema do gerente e nao depende desta entrega.
- Painel interno de adesao: dispositivos confiaveis por clinica, ultimo acesso e
  primeiro acesso ao laudo, para medir se a mudanca reduziu as ligacoes de fato.
- Reaproveitar o modo laudos para o veterinario parceiro individual, que hoje tem o
  mesmo problema em escala menor.
