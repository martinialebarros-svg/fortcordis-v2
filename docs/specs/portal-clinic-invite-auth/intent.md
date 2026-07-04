# Intent - portal-clinic-invite-auth

Data: 2026-07-03
Responsavel: Equipe FortCordis
Status: approved

## 1) Problema atual

O portal da clinica parceira hoje depende de codigo temporario por email a cada nova sessao. Esse modelo protege bem o acesso, mas cria atrito operacional para unidades que consultam exames ao longo do dia inteiro. Ao mesmo tempo, um link enviado por WhatsApp nao pode virar login automatico, porque isso enfraqueceria a seguranca de dados sensiveis e o controle de escopo por unidade.

## 2) Objetivo

Criar um fluxo mais confortavel e mais maduro para clinicas parceiras, com:
- convite seguro enviado por WhatsApp;
- email institucional definido pela operacao no convite;
- ativacao da conta com responsavel e senha, sem codigo no primeiro cadastro;
- login recorrente com email + senha;
- MFA apenas quando houver evento de risco ou acao sensivel;
- sessao estendida opcional no computador da unidade;
- manutencao do escopo atual por clinica/unidade para consulta e download de exames.

## 3) Nao objetivos

- Trocar o fluxo do tutor para login com senha nesta iteracao.
- Criar SSO corporativo externo para clinicas.
- Permitir acesso automatico por clique no link do WhatsApp.
- Enviar laudos/PDF sensiveis por email ou WhatsApp.
- Criar, nesta fase, multiplos perfis nominais por unidade com permissoes diferentes.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - reaproveitar os endpoints atuais de exames/download do portal sempre que possivel;
  - manter o login administrativo interno totalmente separado do login da clinica;
  - preservar o escopo de autorizacao por `clinica_id`;
  - usar sessao curta + refresh seguro para evitar token longo exposto no frontend.
- Restricoes de prazo:
  - a entrega deve nascer compatível com rollout progressivo e conviver com o login legado por codigo.
- Restricoes regulatorio/operacional:
  - notificacoes devem apenas avisar disponibilidade no portal;
  - o email usado pela clinica deve ser institucional da unidade e definido pela operacao;
  - o link de convite pode ser enviado por WhatsApp, mas nao concede acesso sozinho: a confianca principal combina convite unico, senha criada pela unidade e escopo por clinica.

## 5) Impacto esperado

- Usuarios impactados:
  - clinicas parceiras e equipe operacional/comercial que faz onboarding dessas unidades.
- Modulos impactados:
  - backend de autenticacao do portal;
  - tabela/modelagem de sessoes e convites;
  - tela administrativa de clinicas;
  - pagina publica `/clinica-parceira` e novas rotas de ativacao/login/reset.
- Risco de regressao:
  - baixo para tutor e app administrativo se o fluxo novo permanecer isolado por feature flag;
  - moderado para autenticacao do portal da clinica se a coexistencia entre login legado e novo login nao for tratada com clareza.

## 6) Riscos iniciais

- Risco 1: usar o link do WhatsApp como login direto criaria um atalho perigoso para dados sensiveis.
- Risco 2: login persistente da clinica pode deixar sessao longa demais em computador compartilhado se o refresh token nao for bem protegido.
- Risco 3: rollout sem convivio entre fluxo legado e novo pode travar clinicas ja acostumadas com o acesso atual.
- Risco 4: reset de senha e MFA mal desenhados podem reabrir enumeracao de contas ou bypass de verificacao em eventos sensiveis.

## 7) Perguntas abertas

- Pergunta 1: a conta da unidade sera unica por clinica no primeiro rollout ou ja deve aceitar mais de um email responsavel?
- Pergunta 2: a politica operacional vai exigir dominio corporativo da clinica ou apenas email institucional validado manualmente?
- Pergunta 3: a revogacao administrativa precisa ser feita apenas pela Fort Cordis ou a propria clinica deve poder encerrar todas as sessoes pela interface?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes tecnicas e operacionais estao registradas.
- [x] Riscos iniciais estao mapeados.
- [x] Caminho de rollout progressivo foi definido conceitualmente.
