# Intent - portal-clinica-recuperacao-acesso-whatsapp

Data: 2026-09-20
Responsavel: Martiniano Barros
Status: draft

## 1) Problema atual

E a outra metade do problema mapeado em 2026-09-14: **quem cria a senha e o gerente,
e ele nao anota**. A primeira metade - a secretaria precisar do laudo e nao ter a
senha - foi resolvida por `portal-clinica-link-laudo-whatsapp` e
`portal-clinica-dispositivo-confiavel`, os dois em producao desde 20/09/2026.

O que sobra e menor e mais especifico do que era, e vale escrever com precisao antes
de desenhar qualquer coisa:

- **O "esqueci a senha" existe e funciona** (`POST /auth/esqueci-senha`), mas manda o
  link para o e-mail da conta. Quem tem esse e-mail e o gerente.
- **Para a secretaria, o e-mail e inalcancavel.** Ela nao perdeu a senha: ela nunca
  teve.
- **Para o gerente, o e-mail costuma funcionar** - ele criou a conta com ele. O caso
  dele e esquecer a senha, nao perder o e-mail.
- **Ja existe caminho por WhatsApp**, so que operado pela Fort Cordis:
  `POST /admin/clinicas/{id}/convites` envia convite, link de acesso ou **senha
  temporaria** para um numero digitado pelo operador, usando tres modelos ja
  aprovados na Meta. Funciona - e e exatamente o que faz a clinica ligar para ca.

Ou seja: o gargalo que sobrou nao e falta de mecanismo. **E o fato de o mecanismo
depender de uma pessoa da Fort Cordis atender o telefone.**

## 2) Objetivo

Permitir que a unidade recupere acesso ao portal **sem telefonar para a Fort Cordis**,
usando o WhatsApp que ela ja usa conosco, sem baixar o nivel de protecao do que o
portal completo enxerga (financeiro, agenda, recibos).

## 3) Nao objetivos

- Nao substituir o "esqueci a senha" por e-mail, que segue sendo o caminho do gestor.
- Nao remover o caminho administrativo existente (`/admin/clinicas/{id}/convites`),
  que continua util quando a Fort Cordis quer agir por iniciativa propria.
- Nao mexer no login do tutor nem no do veterinario parceiro individual.
- Nao mexer no que o dispositivo confiavel enxerga - laudos e mais nada, decisao de
  2026-09-18.

## 4) Contexto e restricoes

Quatro achados na leitura do codigo em 20/09/2026, e o quarto e o que mais pesa:

- **Restricao 1 - a redefinicao de senha termina no e-mail de qualquer jeito.**
  `redefinir_senha_clinica` grava `force_mfa_on_next_login = True`, e
  `maybe_require_mfa` devolve verdadeiro nesse caso. O login seguinte chama
  `send_login_mfa_code(destination=account.email_normalized, ...)`. Entao **mandar o
  link de redefinicao por WhatsApp nao desbloqueia ninguem que nao tenha o e-mail**:
  a pessoa troca a senha e trava no codigo de MFA. Qualquer desenho que so troque o
  canal do link nasce morto.

- **Restricao 2 - o WhatsApp da clinica e o numero publico dela.** E o mesmo que ela
  da aos tutores, e a caixa de entrada e da equipe toda. O que chega la esta
  disponivel para qualquer pessoa que atenda o WhatsApp da unidade - nao e um canal
  pessoal do gestor.

- **Restricao 3 - a conta do portal carrega `clinic:read`**, que abre financeiro,
  agenda e recibos. Recuperar **a senha** e recuperar isso tudo. Foi precisamente
  para evitar esse alcance que o modo laudos nasceu com escopo `exam:*`.

- **Restricao 4 - o precedente ja existe, mas com humano no meio.** A Fort Cordis ja
  envia senha temporaria por WhatsApp hoje (`send_whatsapp_temporary_password`, com
  `must_change_password = True`). A diferenca do que se pede aqui nao e o canal: e
  tirar o operador do circuito. Self-service muda o modelo de ameaca, nao o meio.

Restricoes de implementacao:

- Modelos aprovados na Meta que ja servem: `convite_portal_clinica_v2`,
  `acesso_portal_clinica` e `senha_temporaria_portal_clinica`. Se o desenho couber em
  um deles, **nao ha nova submissao** - e, pelo que a entrega do link mostrou,
  aprovacao leva ~1 dia e rejeicao trava o nome por 30 dias.
- Guardrail de CI: `spec.md` e `verify.md` alterados no mesmo diff.
- Migracoes pelo runner proprio (`backend/migrations/versions/`).
- Envio por WhatsApp so sai com `WHATSAPP_AGENDA_ENABLED` ligada.

## 5) Impacto esperado

- Usuarios impactados: gestores de clinica (recuperam acesso sozinhos), secretarias
  (dependendo do escopo escolhido, ganham ou nao um caminho proprio), equipe Fort
  Cordis (para de ser o gargalo).
- Modulos impactados: `portal_clinic_auth.py` (endpoint publico novo),
  `portal_clinic_auth_service.py` (emissao e entrega), frontend do portal da clinica,
  possivelmente o catalogo de modelos.
- Risco de regressao: **baixo no codigo, alto no desenho.** O caminho novo nao altera
  o fluxo existente; o que exige cuidado e o que ele concede.

## 6) Riscos iniciais

- **Risco 1 (o principal): self-service para um canal coletivo vira escalonamento
  interno.** Se qualquer pessoa que atenda o WhatsApp da unidade puder disparar uma
  recuperacao que devolve o portal completo, entao a recepcao passa a alcancar
  financeiro, agenda e recibos - exatamente o que a decisao de 18/09 fechou. O risco
  nao e um invasor de fora: e a diferenca entre quem a clinica autorizou a ver o
  faturamento e quem so deveria ver laudos.
- Risco 2: sem limite de disparos, o endpoint publico vira fonte de spam para o
  WhatsApp da clinica, num canal em que a Fort Cordis paga por conversa e a Meta pune
  por qualidade.
- Risco 3: enumerar clinicas. A resposta precisa ser identica para numero cadastrado
  e nao cadastrado, como ja faz `_generic_reset_response()`.
- Risco 4: numero desatualizado no cadastro entrega recuperacao a quem nao e mais a
  clinica. Hoje o numero so muda por dentro do app interno, o que limita, mas nao
  elimina.
- Risco 5: se a recuperacao contornar o MFA para ser util (ver restricao 1), ela vira
  o elo mais fraco da autenticacao - o caminho que nao pede o segundo fator.

## 7) Perguntas abertas

A primeira decide o desenho inteiro; as outras sao ajuste.

- **O que a recuperacao por WhatsApp devolve?** Tres respostas possiveis, com
  consequencias bem diferentes:
  1. **Acesso so a laudos**, sem senha - a mesma sessao de escopo `exam:*` do
     dispositivo confiavel, entregue por um link no WhatsApp da unidade em vez de
     depender de um laudo recem-liberado. Respeita a decisao de 18/09 e nao toca em
     MFA. Nao atende o gestor que quer o financeiro de volta.
  2. **Redefinicao de senha completa**, com o link indo para o WhatsApp da unidade.
     Atende o gestor, mas concede financeiro a quem atende o WhatsApp, e esbarra na
     restricao 1 (o MFA seguinte vai para o e-mail).
  3. **Aviso por WhatsApp, redefinicao por e-mail** - a unidade dispara pelo
     WhatsApp e a Fort Cordis so avisa o gestor de que ha um pedido. Conservador; nao
     resolve quando o e-mail esta realmente inacessivel.
- Se a resposta for 2: o que fazer com o MFA? Mandar o codigo tambem por WhatsApp
  (fecha o circulo, mas junta os dois fatores no mesmo canal coletivo) ou pular o
  `force_mfa_on_next_login` quando a origem for WhatsApp?
- Quantas recuperacoes por unidade por dia, e o que acontece ao estourar?
- A Fort Cordis deve ser avisada de cada recuperacao, ou basta auditoria?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
- [ ] **Escopo e nao escopo estao explicitos** - depende da primeira pergunta aberta.

## 9) Sugestoes de novos recursos (para validar e priorizar, nao e compromisso)

- Numero pessoal do gestor no cadastro da conta, separado do WhatsApp publico da
  unidade. Resolveria a restricao 2 de raiz e abriria a opcao 2 sem o efeito
  colateral - mas exige coletar esse dado de cada gestor.
- Painel interno de "clinicas sem acesso ha X dias", para a Fort Cordis agir antes de
  a clinica ligar.
