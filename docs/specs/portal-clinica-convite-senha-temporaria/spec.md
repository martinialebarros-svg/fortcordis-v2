# Spec - portal-clinica-convite-senha-temporaria

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Escopo funcional

Adicionar um modo alternativo de convite de clinica onde o admin gera
uma senha temporaria junto com o link; a conta ja nasce ativa com essa
senha; login exige MFA por e-mail enquanto a senha nao for trocada;
novo endpoint autenticado permite trocar a senha; frontend nudge +
atalho de configuracao no portal da clinica.

## 2) Requisitos funcionais (RF)

### Backend - convite com senha temporaria

- RF-1: `POST /portal/admin/clinicas/{id}/convites` ganha um campo
  opcional `senha_temporaria: bool` (default `false`) no payload
  (`PortalAdminClinicInviteCreateRequest`).
- RF-2: quando `senha_temporaria=true`:
  - gera uma senha no formato `palavra-NNNN` (1 palavra curta em
    minusculas de uma lista fixa sem acentos/ambiguidade + 4 digitos),
    ex.: `gato-4821` (decidido com o usuario, 2026-08-16 - mais curto
    que a opcao inicial de 2 palavras);
  - cria a conta imediatamente via `create_or_replace_pending_account`
    (mesma funcao ja usada pela ativacao tradicional), com
    `status=ACTIVE`, `email_verified_at`/`activated_at` preenchidos;
  - marca `must_change_password=True` (campo novo) e
    `force_mfa_on_next_login=True`;
  - nao cria/usa `PortalClinicInvite` (nao ha token de ativacao
    pendente - a conta ja esta pronta pra logar);
  - retorna a senha em texto puro no corpo da resposta
    (`PortalAdminClinicInviteResponse.senha_temporaria`, campo novo,
    opcional) - unica vez que ela e recuperavel pelo backend.
- RF-3: quando `senha_temporaria=false` (default), comportamento atual
  preservado sem nenhuma mudanca (convite com token de ativacao,
  clinica cria a propria senha).
- RF-4: `account_email` continua obrigatorio nos dois modos (e o
  identificador de login).

### Backend - forcar troca de senha

- RF-5: novo campo `must_change_password: bool, default False,
  nullable=False` em `PortalClinicAccount`
  (`backend/app/models/portal_clinic_auth.py` + migration).
- RF-6: `maybe_require_mfa` passa a retornar
  `bool(account.force_mfa_on_next_login) or bool(account.must_change_password)`
  - MFA por e-mail exigido em todo login enquanto `must_change_password`
    for `True`.
- RF-7: `_map` de conta exposto pro frontend (resumo/sessao) inclui
  `must_change_password`, para a UI decidir quando mostrar o aviso.

### Backend - trocar senha autenticado

- RF-8: novo endpoint `POST /portal/clinicas/auth/trocar-senha`
  (autenticado via sessao de portal ativa, `actor_type == "clinica"`):
  payload `{senha_atual, nova_senha, nova_senha_confirmacao}`.
  - valida `nova_senha == nova_senha_confirmacao` e minimo de 8
    caracteres (mesma regra ja usada em
    `PortalClinicActivationRequest`);
  - valida `senha_atual` contra o hash da conta (401 se errada);
  - atualiza `password_hash`, `password_changed_at`, zera
    `must_change_password` e `force_mfa_on_next_login`;
  - registra auditoria (`PORTAL_CLINIC_PASSWORD_CHANGED_BY_USER`).

### Frontend - convite (admin)

- RF-9: `ClinicaPortalAccessCard.tsx` ganha um checkbox "Gerar senha
  temporaria (recomendado para quem tem menos familiaridade com
  sistemas)" no formulario de convite.
- RF-10: quando a resposta do convite traz `senha_temporaria`, exibe
  a senha em destaque (fonte monoespacada, botao "Copiar senha"),
  junto do link de ativacao, com aviso "essa senha so aparece agora -
  anote ou copie antes de sair desta tela".
- RF-11: mensagem sugerida para WhatsApp (`buildClinicInviteMessage`)
  ganha uma variante para o modo temporario, incluindo a senha e a
  orientacao de troca-la assim que possivel.

### Frontend - portal da clinica

- RF-12: `PortalClinicaWorkspace.tsx` mostra um banner persistente
  (nao bloqueante, com botao "Trocar senha agora" e opcao de
  dispensar so nesta sessao) quando a sessao ativa indica
  `must_change_password=true`.
- RF-13: um icone/botao de "Configuracoes" no cabecalho do portal
  (ao lado de "Atualizar"/"Sair", fora das abas) abre um modal com
  formulario de troca de senha (senha atual, nova senha,
  confirmacao), disponivel a qualquer momento (nao so quando
  `must_change_password`).
- RF-14: apos trocar a senha com sucesso, o banner de aviso some
  (sem precisar recarregar a pagina) e a sessao continua ativa.

## 3) Requisitos nao funcionais (NFR)

- NFR-1 (seguranca): endpoint de troca de senha exige a senha atual -
  uma sessao sequestrada sozinha nao basta para trocar a senha sem
  saber a atual.
- NFR-2 (seguranca): senha temporaria gerada com fonte de aleatoriedade
  criptografica (`secrets`), lista de palavras com pelo menos 200
  entradas combinada com 4 digitos (`0-9`, incluindo repeticao) -
  ~2 milhoes de combinacoes possiveis; MFA obrigatorio (RF-6) cobre a
  entropia menor que uma senha livre digitada pelo proprio usuario.
- NFR-3 (legibilidade): lista de palavras evita acentos e palavras
  ambiguas ao ouvir/ditar por telefone; separador `-` entre palavra e
  digitos para leitura clara.
- NFR-4 (compatibilidade): nenhuma mudanca no fluxo de ativacao
  tradicional nem no de "esqueci minha senha" - ambos continuam
  identicos.
- NFR-5 (auditoria): criacao de conta com senha temporaria e troca de
  senha autenticada geram entradas de auditoria (`registrar_auditoria`),
  mesmo padrao ja usado pelas outras acoes deste modulo.

## 4) Criterios de aceite (CA)

- CA-1: admin marca "Gerar senha temporaria" e clica "Convidar gestor"
  - resposta traz a senha em texto puro, mostrada em destaque na UI.
- CA-2: com essa senha, `POST /auth/login` retorna `mfa_required=true`
  (nunca loga direto) - código chega por e-mail.
- CA-3: apos confirmar o codigo MFA, sessao criada normalmente; portal
  mostra o banner de "troque sua senha".
- CA-4: usar o modal de configuracoes pra trocar a senha com a senha
  atual correta - sucesso, banner some, próximo login não exige MFA
  (a menos que troque de novo/reset).
- CA-5: tentar trocar a senha com a senha atual errada - 401, nada
  muda.
- CA-6: convite SEM marcar a opcao (comportamento hoje) - continua
  identico, clinica ainda cria a propria senha via link de ativacao.
- CA-7: sessao de espelho administrativo (`admin_preview`) nao mostra
  o banner nem o atalho de configuracoes (nao se aplica a uma
  pre-visualizacao, sem conta real por tras).
