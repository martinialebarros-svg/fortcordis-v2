# Intent - portal-clinica-convite-senha-temporaria

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Problema atual

O convite de clinica hoje (`POST /portal/admin/clinicas/{id}/convites`,
`ClinicaPortalAccessCard.tsx`) manda um link de ativacao
(`/clinica-parceira/ativar/{token}`) onde a propria clinica precisa
**criar sua senha** (`ativar_conta_clinica`,
`PortalClinicActivationRequest`). Na pratica, algumas recepcionistas
nao sao muito familiarizadas com computadores/sites/sistemas e se
atrapalham nesse passo - errar a confirmacao de senha, esquecer o que
digitaram, nao entender o formulario.

Confirmado no codigo: o login por senha (`/auth/login`) **nao exige
MFA por padrao** - `maybe_require_mfa` so retorna `True` quando
`account.force_mfa_on_next_login` esta ligado, o que hoje so acontece
logo apos um "esqueci minha senha" (`redefinir_senha_clinica`). Uma
suposicao inicial (MFA sempre ativo) estava errada e foi corrigida
antes deste spec - isso importa porque uma senha temporaria gerada
pelo sistema e, por natureza, menos confidencial que uma escolhida pela
propria clinica (pode ficar registrada em WhatsApp/papel por mais
tempo), entao precisa de uma camada de protecao equivalente.

## 2) Objetivo

Dar ao admin (Martiniano ou operacao) a opcao de, ao convidar um
gestor de clinica, gerar uma **senha temporaria facil de ler/digitar**
junto com o link - a clinica so precisa abrir o link e digitar a
senha que recebeu, sem escolher/confirmar nada. Ao entrar, MFA por
e-mail e exigido em todo login enquanto a senha continuar sendo a
temporaria, e um menu de configuracao permite trocar a senha quando
quiserem.

## 3) Nao objetivos

- Nao substitui o fluxo de ativacao tradicional (a clinica cria a
  propria senha) - vira uma **opcao alternativa** escolhida pelo admin
  no momento do convite, caso a caso. Continua existindo os dois
  modos.
- Nao mexe no fluxo do veterinario parceiro individual
  (`portal_partner_auth.py`, `buildPartnerInviteMessage`) - mesmo
  padrao de convite existe la, mas fica fora de escopo agora (paridade
  futura se fizer sentido, nao um compromisso deste spec).
- Nao muda o fluxo existente de "esqueci minha senha"
  (`/auth/esqueci-senha`/`/auth/redefinir-senha`) - continua igual.
- Nao adiciona requisitos de complexidade de senha alem do que ja
  existe (minimo 8 caracteres) - a senha temporaria gerada ja segue
  esse minimo por construcao.
- Nao envia a senha temporaria por nenhum canal alem dos que o convite
  ja usa hoje (WhatsApp manual-copy ou copia direta pelo admin) - nao
  adiciona um canal de entrega novo.

## 4) Contexto e restricoes

- Stack: FastAPI + SQLAlchemy (backend), Next.js/Tailwind (frontend).
- `PortalClinicAccount` (`backend/app/models/portal_clinic_auth.py`) ja
  tem `force_mfa_on_next_login`; este spec adiciona um campo novo
  (`must_change_password`) em vez de sobrecarregar o significado do
  campo existente, para nao confundir com o fluxo de reset de senha ja
  existente.
- Hoje nao existe endpoint autenticado de "trocar minha senha" (so
  "esqueci minha senha", que exige e-mail e sair da sessao) - precisa
  ser criado.
- `PortalClinicaWorkspace.tsx` acabou de ganhar navegacao por abas
  (`portal-clinica-parceira-navegacao-abas`) - o cabecalho (fora das
  abas, sempre visivel) e o lugar natural para o atalho de
  configuracoes, sem competir com o conteudo das abas.
- Guardrail de SDD: mudanca de codigo exige `spec.md`/`verify.md`
  atualizados no mesmo diff.

## 5) Impacto esperado

- Usuarios impactados: admin/operacao Fortcordis (ao convidar), gestor
  de clinica que recebe o convite.
- Modulos impactados: `backend/app/models/portal_clinic_auth.py`
  (campo novo + migration), `backend/app/api/v1/endpoints/portal_clinic_auth.py`
  (convite + novo endpoint de troca de senha), `backend/app/services/portal_clinic_auth_service.py`
  (geracao de senha temporaria, `maybe_require_mfa`),
  `frontend/components/portal/ClinicaPortalAccessCard.tsx` (toggle de
  senha temporaria), `frontend/components/portal/PortalClinicaWorkspace.tsx`
  (banner + atalho de configuracoes + modal de troca de senha),
  `frontend/lib/portal-clinic-admin.ts` (mensagem de convite).
- Risco de regressao: baixo - aditivo (campo novo, endpoint novo,
  opcao nova no formulario existente); o unico ponto sensivel e a
  mudanca em `maybe_require_mfa`, que precisa continuar exigindo MFA
  exatamente como hoje para o caso ja existente (pos-reset de senha).

## 6) Riscos iniciais

- Risco 1: senha temporaria gerada de forma fraca/previsivel demais -
  mitigar com gerador baseado em palavras curtas + digitos, entropia
  suficiente para nao ser adivinhavel por tentativa, mas legivel.
- Risco 2: MFA por e-mail pode ser uma barreira se a clinica nao tiver
  acesso facil ao e-mail cadastrado (o codigo de login MFA hoje so vai
  por e-mail, nao WhatsApp) - aceito como trade-off deliberado (mesmo
  canal ja usado por `send_login_mfa_code` hoje), documentado aqui para
  quem for revisar depois.
- Risco 3: esquecer de zerar `must_change_password` ao trocar a senha
  faria a clinica ficar presa exigindo MFA pra sempre - coberto por
  teste automatizado do endpoint novo.
- Risco 4: reaproveitar `create_or_replace_pending_account` errado
  pode quebrar o fluxo de ativacao tradicional que ja funciona hoje -
  mitigar reaproveitando a funcao sem alterar sua assinatura/logica
  existente, so chamando-a de um novo ponto de entrada.
