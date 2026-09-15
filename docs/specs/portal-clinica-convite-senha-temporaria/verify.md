# Verify - portal-clinica-convite-senha-temporaria

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado, confirmado ao vivo em stage

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-1 | Admin (`admin@fortcordis.com`) chamou `POST /admin/clinicas/11/convites` com `senha_temporaria: true` - resposta trouxe `access_mode: "temporary_password"`, `status: "active"` e `senha_temporaria: "lontra-2760"` (formato `palavra-NNNN` confirmado); UI (`ClinicaPortalAccessCard.tsx`) exibe a senha em destaque com botão "Copiar senha". | ok |
| CA-2 | Login com `recepcao-teste@example.com` / `lontra-2760` via `/auth/login` retornou `mfa_required: true` - nunca logou direto. | ok |
| CA-3 | Código de MFA capturado via SMTP local de teste (`smtpd.DebuggingServer`); `POST /auth/mfa/verificar` com o código confirmou a sessão; portal real (`/clinica-parceira`) mostrou o banner "Esta conta ainda está usando a senha temporária...". | ok |
| CA-4 | Modal "Trocar senha" (atalho "Configurações" no cabeçalho) usado com a senha atual correta - sucesso, banner desapareceu sem reload; novo login com a nova senha não pediu MFA. | ok |
| CA-5 | Mesma troca de senha com senha atual errada - 401 "Senha atual incorreta.", modal permaneceu aberto com o erro, nada foi alterado. | ok |
| CA-6 | Suite existente (`test_invite_activation_autologin_refresh_and_exam_scope`, `test_password_reset_revokes_session_and_forces_mfa_on_next_login`, etc.) continua passando sem alteração - convite tradicional (sem `senha_temporaria`) inalterado. | ok |
| CA-7 | Sessão `admin_preview` não tem `account_id` real (`_build_admin_preview_portal_session`) - banner e atalho de configurações não aparecem (gated por `!isAdminPreview` no frontend); endpoint de troca de senha rejeitaria por falta de `account_id`. | ok |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/test_portal_clinic_invite_auth.py tests/test_portal_clinic_account_must_change_password_migration.py -v
# 17 passed (15 + 2 novos: test_convite_com_senha_temporaria_cria_conta_ativa_e_exige_mfa,
# test_trocar_senha_zera_must_change_password_e_dispensa_mfa_depois)

cd backend && venv/bin/python -m pytest tests/ -q
# 754 passed, sem regressao

cd frontend && npx tsc --noEmit --pretty false
# sem erros

cd frontend && npx eslint components/portal/PortalClinicaWorkspace.tsx \
  app/clinicas/components/ClinicaPortalAccessCard.tsx lib/portal-api.ts \
  lib/portal-clinic-admin.ts app/clinicas/portal/parceiros/page.tsx
# sem erros

cd frontend && npm run build
# build completo, sem erros
```

## 3) Testes manuais

Ambiente: local (backend/frontend dev), clínica "casa do caralho" (id 11).

- Convite real via `curl` autenticado como admin (`POST
  /admin/clinicas/11/convites` com `senha_temporaria: true`,
  `account_email: recepcao-teste@example.com`, `responsavel_nome:
  "Recepcao Teste"`) - senha gerada `lontra-2760`.
- Login real no `/clinica-parceira` com essa senha - tela de código
  de acesso apareceu (MFA), confirmando que o backend pré-existente de
  MFA (não construído nesta feature) já reconhece corretamente a nova
  flag `must_change_password`.
- Como o SMTP local não estava configurado (erro 502 na 1ª tentativa,
  esperado - confirma que sem entrega funcionando o login realmente
  bloqueia, não finge sucesso), subimos um `python -m smtpd -c
  DebuggingServer` local temporário só para capturar o código do
  e-mail de MFA nesta verificação - removido ao final.
- MFA confirmado - portal real mostrou banner + atalho
  "Configurações"; abrir o modal, errar a senha atual (401, mensagem
  clara) e depois acertar (200, banner some na hora, sem reload).
- Logout + login com a senha nova - sem MFA desta vez, confirmando que
  `must_change_password` foi zerado corretamente.
- Conta de teste (`recepcao-teste@example.com`) e configuração SMTP
  temporária removidas do ambiente local ao final.
- Cenário 4 (stage, 2026-08-16): confirmado a nível de código que o
  bundle JS servido por stage para a página de clínica contém a
  implementação (`grep` nos chunks publicados encontrou o texto do
  checkbox "Gerar senha temporaria...", o campo "Nome do responsavel
  na clinica", `senha_temporaria`, "Copiar senha"). Usuário conferiu
  visualmente na ficha de uma clínica real em stage e confirmou que o
  checkbox e os campos aparecem corretamente.

## 4) Regressao e riscos residuais

- Risco residual: verificação de e-mail de MFA usada um servidor SMTP
  de debug local, não o provider real de stage/produção - a integração
  real com o provider de e-mail (`send_portal_email_message`,
  `PORTAL_EMAIL_SMTP_*`) já é código pré-existente, não alterado por
  este spec; nenhum risco novo introduzido nesse ponto.
- Nenhuma regressão encontrada no fluxo de ativação tradicional nem no
  de "esqueci minha senha" - ambos cobertos pela suite existente, que
  segue verde.
- Fluxo do veterinário parceiro individual (`portal_partner_auth.py`)
  não foi tocado - `buildPartnerInviteMessage` só teve o tipo do
  parâmetro `accessMode` alargado (sem nova lógica) para compatibilizar
  com o tipo compartilhado `PortalAdminClinicInviteResponse`.

## 5) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

## 6) Correcao de escopo - segunda tela de convite (2026-08-17)

Usuario reportou ao vivo em stage: "vi aqui que a opcao de gerar o
convite com a senha provisoria so aparece no menu de cadastro das
clinicas. Quando entro no menu portal das clinicas essa opcao nao
aparece" - ver `intent.md` secao 7.

- CA-8 verificado localmente: `frontend/app/clinicas/portal/page.tsx`
  (clinica "vetworld", id 9) - marcado o checkbox "Gerar senha
  temporaria", preenchido "Nome do responsavel na clinica", clicado
  "Gerar convite" - `POST /portal/admin/clinicas/9/convites` retornou
  200; UI exibiu "Conta criada com senha temporaria", a senha
  (`jardim-7548`) em destaque com botao "Copiar senha" (testado,
  mensagem "Senha temporaria copiada." confirmada); campo "Nome do
  responsavel" foi limpo automaticamente apos o sucesso.
- Confirmado no banco local: `PortalClinicAccount` criada com
  `status=active`, `must_change_password=True`,
  `responsavel_nome="Responsavel Teste Verificacao"`,
  `email_normalized="portal-verificacao@vetworld.com"` - mesmo
  resultado que o fluxo ja validado em `ClinicaPortalAccessCard.tsx`.
- `tsc --noEmit` e `eslint app/clinicas/portal/page.tsx` sem erros;
  suite completa do backend (790 testes, inalterada por este fix - so
  frontend) verde.
- Conta de teste removida do banco local ao final da verificacao.
- Risco residual: `handleQuickInvite` (reenvio de um clique) continua
  sem a opcao de senha temporaria, por design (ver `intent.md` secao
  7) - se o usuario preferir ter a opcao ali tambem no futuro, precisa
  de uma decisao de UX separada (ex.: modal rapido pedindo so o nome
  do responsavel).
