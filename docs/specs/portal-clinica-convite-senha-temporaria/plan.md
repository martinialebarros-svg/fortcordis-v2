# Plan - portal-clinica-convite-senha-temporaria

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Sequencia de fases

- Fase 1 (backend - modelo + migration): campo `must_change_password`
  em `PortalClinicAccount`.
- Fase 2 (backend - geracao de senha temporaria + convite): gerador de
  senha, extensao do endpoint de convite.
- Fase 3 (backend - MFA + troca de senha): `maybe_require_mfa`
  atualizado, endpoint novo de troca de senha autenticada.
- Fase 4 (frontend - admin): toggle no formulario de convite +
  exibicao da senha gerada.
- Fase 5 (frontend - portal da clinica): banner + atalho de
  configuracoes + modal de troca de senha.
- Fase 6 (verificacao): testes automatizados + manual ponta a ponta
  (convite -> login com MFA -> troca de senha -> login sem MFA).

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `must_change_password = Column(Boolean, nullable=False, default=False)`
  em `PortalClinicAccount`.
- [x] T1.2 Migration idempotente (`ALTER TABLE portal_clinic_accounts
  ADD COLUMN IF NOT EXISTS` / checagem de coluna existente, seguindo o
  padrao dos migrations mais recentes do projeto).
- [x] T1.3 Teste de migration (idempotencia, valor default para linhas
  existentes).

### Fase 2

- [x] T2.1 Funcao `gerar_senha_temporaria()` em
  `portal_clinic_auth_service.py` - lista de ~200+ palavras curtas em
  portugues sem acento, formato `palavra-NNNN` (1 palavra + 4 digitos,
  `secrets.choice`).
- [x] T2.2 `PortalAdminClinicInviteCreateRequest.senha_temporaria: bool = False`.
- [x] T2.3 `criar_convite_clinica`: quando `senha_temporaria=True`,
  gera a senha, chama `create_or_replace_pending_account` direto
  (sem passar por `PortalClinicInvite`), marca
  `must_change_password=True`/`force_mfa_on_next_login=True`, retorna
  a senha em `PortalAdminClinicInviteResponse.senha_temporaria`.
- [x] T2.4 Mantém o caminho `senha_temporaria=False` (default) 100%
  inalterado - regressao zero pro fluxo existente.
- [x] T2.5 Testes: geracao de senha (formato, sem caracteres
  ambiguos), convite em modo temporario cria conta ativa
  imediatamente, convite tradicional continua identico.

### Fase 3

- [x] T3.1 `maybe_require_mfa` passa a checar
  `force_mfa_on_next_login OR must_change_password`.
- [x] T3.2 Schema `PortalClinicPasswordChangeRequest`
  (`senha_atual`, `nova_senha`, `nova_senha_confirmacao`).
- [x] T3.3 Endpoint `POST /clinicas/auth/trocar-senha` (dependencia
  `get_current_portal_session`, exige `actor_type == "clinica"`):
  valida senha atual, atualiza hash, zera
  `must_change_password`/`force_mfa_on_next_login`, audita.
- [x] T3.4 Testes: MFA exigido quando `must_change_password=True`;
  troca de senha com senha atual certa/errada; MFA deixa de ser
  exigido apos a troca (a menos que outro gatilho ligue de novo).

### Fase 4

- [x] T4.1 Checkbox "Gerar senha temporaria" em
  `ClinicaPortalAccessCard.tsx`, enviado no payload de
  `handleGenerateInvite`.
- [x] T4.2 Exibicao da senha retornada (fonte monoespacada, botao
  "Copiar senha", aviso de que so aparece uma vez).
- [x] T4.3 `buildClinicInviteMessage` ganha variante para o modo
  temporario (inclui a senha, orientacao de troca).

### Fase 5

- [x] T5.1 `PortalClinicaWorkspace.tsx`: banner persistente quando
  `must_change_password` vier na sessao/resumo, com botao "Trocar
  senha agora" e "Dispensar por agora" (nao desativa permanentemente,
  so evita repetir na mesma visita).
- [x] T5.2 Icone/botao "Configuracoes" no cabecalho (fora das abas),
  ausente em `admin_preview`.
- [x] T5.3 Modal de troca de senha (senha atual, nova senha,
  confirmacao) chamando o endpoint novo; fecha o banner e mostra
  confirmacao em caso de sucesso.

### Fase 6

- [x] T6.1 Suite completa do backend (`pytest tests/ -q`).
- [x] T6.2 `tsc`/`eslint`/`build` do frontend.
- [x] T6.3 Verificacao manual local ponta a ponta: convite com senha
  temporaria -> login com a senha -> MFA por e-mail (capturado via
  servidor SMTP de debug local, removido apos o teste) -> banner de
  troca de senha -> trocar senha pelo modal -> logout -> login de novo
  confirmando que MFA nao e mais exigido. Ver detalhes em `verify.md`.

## 3) Dependencias e bloqueios

- Dependencia 1: nenhuma - sem servico externo novo, reaproveita
  `send_login_mfa_code` (e-mail) ja existente.
- Dependencia 2: lista de palavras para a senha temporaria - escrita
  como parte da Fase 2, sem dependencia externa.

## 4) Checklist para iniciar execucao

- [x] `intent.md` escrito.
- [x] `spec.md` escrito.
- [ ] `intent.md`/`spec.md` aprovados por Martiniano.
- [ ] Fases e rollback revisados.
