# Intent - portal-clinica-link-laudo-whatsapp

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Problema atual

Clinicas parceiras estao abandonando o portal e pedindo o laudo direto pelo WhatsApp.
Uma delas ja avisou que nao vai mais encaminhar exames porque achou "complicado"
acessar um laudo.

O diagnostico, confirmado com o usuario em 2026-09-18, nao e "a tela do portal e
ruim" - e um descasamento entre quem tem a credencial e quem precisa do laudo:

- quem cria a conta e a senha e o **gerente** da clinica, geralmente uma unica vez,
  no ato do convite;
- a senha nao fica anotada em lugar combinado;
- quem recebe o laudo e repassa para o cliente e a **secretaria**, que nao sabe a
  senha e **nao tem acesso a caixa de e-mail** usada no cadastro;
- por isso o "esqueci a senha" (`POST /portal/auth/esqueci-senha`, que envia para o
  e-mail da conta) e inutil para ela: o link de recuperacao cai numa caixa que ela
  nao abre;
- sobra ligar para a Fort Cordis. Na pratica **o Martiniano virou o mecanismo de
  recuperacao de senha das clinicas**.

O aviso de laudo liberado ja chega no canal certo. `POST /laudos/{laudo_id}/portal/whatsapp`
(`backend/app/api/v1/endpoints/laudos.py:3109`) dispara o modelo aprovado
`portalReportAvailable` para o WhatsApp cadastrado da clinica - o numero que a
secretaria opera. Mas o modelo so anuncia ("o laudo do exame X de Y ja esta
disponivel no Portal Fort Cordis") e **nao leva a lugar nenhum**: a secretaria
precisa sair do WhatsApp, abrir `/clinica-parceira`, lembrar e-mail e senha que nao
sao dela. E esse pulo de canal que quebra.

A infra chegou a ser desenhada para isso e ficou pela metade:
`PortalClinicInvite.delivery_channel` ja tem default `"whatsapp"`
(`backend/app/models/portal_clinic_auth.py:12`), mas
`portal_clinic_notification_service.py` so envia e-mail.

## 2) Objetivo

Fazer o aviso de laudo que ja vai pelo WhatsApp carregar um link que abre **aquele
laudo especifico**, em um toque, sem conta, sem senha e sem cadastro - mantendo o
PDF dentro do dominio da Fort Cordis, auditado e revogavel, em vez de virar arquivo
solto no WhatsApp.

## 3) Nao objetivos

- Nao enviar o PDF do laudo como anexo de WhatsApp. O que trafega e um endereco.
- Nao remover nem enfraquecer o login por e-mail e senha
  (`portal_clinic_auth.py`). Ele continua sendo a via para historico, financeiro,
  agenda e recibos - deixa de ser pedagio para ver **um** laudo.
- Nao implementar "manter esta unidade conectada neste computador" (confianca de
  dispositivo na maquina da recepcao) nesta entrega. Decisao do usuario em
  2026-09-18: primeiro PR so o link, para manter pequena a superficie de mudanca em
  codigo de autenticacao. Fica registrado na secao 9 como proxima spec.
- Nao estender o bot de WhatsApp para reenviar link sob demanda.
- Nao mexer no fluxo do tutor nem no do veterinario parceiro individual
  (`portal_partner_auth.py`).
- Nao alterar as regras de liberacao de laudo (`core/portal_release.py`).
- Nao alterar o modelo `portalReportAvailable` ja aprovado pela Meta - qualquer
  mudanca no corpo exigiria reaprovacao e derrubaria o aviso que funciona hoje.

## 4) Contexto e restricoes

- O envio real do modelo acontece no servico Node deste mesmo repo
  (`whatsapp-stage-backend/`), via `POST /automation/templates`. Um modelo novo
  precisa ser declarado em `src/templates/approvedTemplates.ts` **e aprovado pela
  Meta** antes de enviar de verdade.
- Ja existe precedente de link dentro do corpo do modelo, aprovado pela Meta em
  30/08/2026: `portalClinicInviteActivation` carrega a URL na variavel `{{2}}`
  (`whatsapp-stage-backend/src/templates/approvedTemplates.ts:116`). Ou seja, nao e
  preciso botao de URL dinamica - o link vai como parametro de corpo.
- `_reject_query_tokens` (`backend/app/core/portal_security.py:86`) recusa
  `token`/`access_token`/`download_token` em query string, de proposito. O token do
  link tem que ir no **path**, como ja faz `/clinica-parceira/ativar/[token]`.
- O WhatsApp da clinica e numero compartilhado, operado por secretarias e conhecido
  pelos clientes dela. O link tem que ser desenhado assumindo canal semi-publico.
- Guardrail de CI: `spec.md` e `verify.md` alterados no mesmo diff.
- Migracoes usam o runner proprio (`backend/migrations/versions/`), nao Alembic.

## 5) Impacto esperado

- Usuarios impactados: secretarias das clinicas parceiras (ganham acesso direto),
  gerentes (deixam de ser gargalo), equipe Fort Cordis (para de receber ligacao
  pedindo laudo).
- Modulos impactados: `backend/app/api/v1/endpoints/laudos.py` (aviso de WhatsApp),
  `backend/app/api/v1/endpoints/portal.py` (endpoint publico novo),
  `whatsapp-stage-backend/` (modelo novo), frontend (`/laudo/[token]`).
- Risco de regressao: medio - mexe no caminho de aviso de laudo, que funciona hoje.
  Mitigado por flag e por degradacao para o modelo atual.

## 6) Riscos iniciais

- Risco 1: o link e credencial ao portador num canal compartilhado. Encaminhamento
  ou print entrega o laudo a terceiros. Mitigado por escopo de um exame so,
  revogacao e auditoria - mas nao eliminado, e foi aceito explicitamente pelo
  usuario em 2026-09-18.
- Risco 2: o modelo novo pode demorar ou ser rejeitado pela Meta (ja aconteceu com
  `convite_portal_clinica`, rejeitado por categoria e bloqueado por 30 dias). Sem
  degradacao, o aviso de laudo pararia de sair.
- Risco 3: link sem expiracao (decisao do usuario) aumenta a janela de exposicao em
  relacao a um token curto.
- Risco 4: se o laudo for revogado do portal, o link precisa morrer junto - senao
  vira vazamento de conteudo despublicado.

## 7) Perguntas abertas

Resolvidas com o usuario em 2026-09-18:

- **O que o link abre?** So aquele laudo. Nao da acesso ao historico da clinica nem
  a fila de "aguardando liberacao".
- **E laudo antigo (cliente perdeu o PDF)?** O link daquele exame nao expira: a
  secretaria acha a mensagem antiga no WhatsApp e resolve sozinha. Continua
  revogavel pela Fort Cordis, e morre se o laudo sair do ar.
- **Escopo do primeiro PR?** So o link. Confianca de dispositivo fica para depois.

Em aberto:

- Vale mandar o mesmo link tambem para o e-mail do gerente, como trilha secundaria?
- A secretaria precisa reenviar o PDF ao tutor (e o que ela faz hoje). Vale a Fort
  Cordis falar direto com o tutor? Decisao de negocio, nao tratada aqui.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.

## 9) Sugestoes de novos recursos (para validar e priorizar, nao e compromisso)

- **Confianca de dispositivo na recepcao** ("manter esta unidade conectada neste
  computador"), reaproveitando `PortalClinicSession` e
  `PORTAL_CLINIC_TRUSTED_SESSION_HOURS`. E o que transforma o link pontual em
  adesao permanente: a maquina da recepcao fica logada e o link cai direto no
  laudo. Proxima spec natural depois desta.
- Recuperacao de senha por WhatsApp para a clinica, alem do e-mail - ataca a outra
  metade do problema relatado (gerente perdeu a senha, secretaria nao tem o e-mail).
- Painel interno de links emitidos por clinica, com data do primeiro acesso, para
  medir se a adesao subiu de fato.
