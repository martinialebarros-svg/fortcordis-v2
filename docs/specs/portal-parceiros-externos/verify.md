# Verify - portal-parceiros-externos

Data: 2026-07-30  
Responsavel: Codex  
Status: in_progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Cadastro administrativo de veterinario parceiro sem endereco fixo completo + convite emitido | parcial |
| CA-002 | aceitacao | Smoke de clinica parceira migrada acessando portal sem novo cadastro | pendente |
| CA-003 | aceitacao | Login de veterinario parceiro com escopo restrito aos laudos liberados | parcial |
| CA-004 | aceitacao | Fluxo de liberacao com combinacao clinica/veterinario/tutor | pendente |
| CA-005 | aceitacao | Fluxo de telemedicina/upload com selecao ou cadastro rapido do parceiro | pendente |
| CA-006 | aceitacao | Painel administrativo com filtros por tipo, ultimo acesso e ultimo download | parcial |
| CA-007 | aceitacao | Timeline auditavel com convite, ativacao, login, revogacao e download | pendente |
| API-F2-001 | tecnico | CRUD administrativo inicial de parceiros externos (`GET/POST/PATCH /api/v1/portal/parceiros`) | concluido |
| UI-F3-001 | tecnico | Tela administrativa `/clinicas/portal/parceiros` integrada aos endpoints de parceiros externos | concluido |
| API-F4-001 | tecnico | Fluxo de convite/autenticacao do veterinario parceiro (`/api/v1/portal/parceiros/...`) | concluido |
| UI-F4-001 | tecnico | Portal publico `/veterinario-parceiro` com ativacao, login, reset e listagem escopada | concluido |
| NFR-002 | nao funcional | Logs e consultas mostrando escopo por `partner_id` sem vazamento entre parceiros | pendente |
| NFR-004 | nao funcional | Migracao/compatibilidade preservando espelho das clinicas ja ativas e dos exames legados liberados | parcial |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/bin/python -m unittest backend.tests.test_portal_partner_profiles_migration
backend/venv/bin/python -m unittest backend.tests.test_migration_ci_cycle
backend/venv/bin/python -m unittest backend.tests.test_portal_partners_api
backend/venv/bin/python -m unittest backend.tests.test_portal_partner_auth
backend/venv/bin/python -m py_compile \
  backend/app/api/v1/endpoints/portal_partners.py \
  backend/app/api/v1/endpoints/portal_partner_auth.py \
  backend/app/models/portal_partner.py \
  backend/app/models/portal_partner_auth.py \
  backend/app/services/portal_partner_auth_service.py \
  backend/migrations/versions/20260729_57_portal_partner_profiles.py \
  backend/migrations/versions/20260730_58_portal_partner_auth.py \
  backend/app/main.py \
  backend/app/schemas/portal.py \
  backend/app/api/v1/endpoints/portal.py \
  backend/setup_database.py \
  backend/tests/test_portal_partner_auth.py \
  backend/tests/test_portal_partner_profiles_migration.py \
  backend/tests/test_portal_partners_api.py
npx eslint lib/portal-api.ts lib/portal-clinic-admin.ts components/portal/PortalPartnerWorkspace.tsx components/portal/PortalPartnerPageShell.tsx components/portal/PortalPartnerActivationWorkspace.tsx components/portal/PortalPartnerResetPasswordWorkspace.tsx app/veterinario-parceiro/page.tsx app/veterinario-parceiro/ativar/[token]/page.tsx app/veterinario-parceiro/redefinir-senha/page.tsx app/clinicas/portal/parceiros/page.tsx
npx tsc --noEmit
npm run build
```

Resumo dos resultados:
- Backend:
  - `test_portal_partner_profiles_migration`: passou (`1 test`, cobrindo criacao das tabelas novas, backfill de clinicas legadas, prioridade de email e espelho de liberacoes antigas)
  - `test_portal_partners_api`: passou (`2 tests`, cobrindo listagem, criacao e edicao de veterinario parceiro, heranca de defaults da clinica e bloqueios de duplicidade)
  - `test_portal_partner_auth`: passou (`2 tests`, cobrindo emissao de convite, ativacao do parceiro, login com senha e listagem escopada por `partner_id`)
  - `py_compile`: passou nos arquivos tocados do backend
- Frontend:
  - `npx eslint` nos arquivos alterados: passou
  - `npx tsc --noEmit`: passou
  - `npm run build`: passou, incluindo a rota `/clinicas/portal/parceiros`

Observacao:
- A fase atual conclui a base administrativa, o fluxo autenticado do veterinario parceiro e a primeira experiencia publica do parceiro. Timeline dedicada, liberacao multi-destinatario e fluxo completo de telemedicina ainda seguem pendentes.

## 3) Testes manuais

- Cenario 1:
  - cadastrar um veterinario parceiro com email profissional, cidade base e telefone
  - gerar convite
  - concluir ativacao
  - validar cabecalho `Ambiente do veterinario parceiro`

- Cenario 2:
  - usar uma clinica parceira ja ativa
  - validar login sem redefinicao de cadastro
  - confirmar que os laudos anteriores continuam acessiveis dentro do mesmo escopo

- Cenario 3:
  - liberar um laudo apenas para veterinario parceiro
  - validar que a clinica nao enxerga esse item se nao tiver sido incluida como destinataria

- Cenario 4:
  - liberar um laudo para clinica, veterinario parceiro e tutor ao mesmo tempo
  - validar acesso independente e auditoria separada por destinatario

- Cenario 5:
  - iniciar um fluxo de telemedicina/upload sem agendamento
  - buscar parceiro existente
  - testar o caminho alternativo de cadastrar novo veterinario parceiro

## 4) Regressao e riscos residuais

- Risco residual 1:
  - coexistencia temporaria entre contratos legados clinic-centric e nova camada generica de parceiro externo
- Risco residual 2:
  - necessidade de saneamento se emails historicos de clinicas coincidirem com emails desejados para veterinarios parceiros
- Risco residual 3:
  - a fase atual cria o fluxo autenticado do veterinario parceiro, mas ainda nao conclui timeline administrativa e liberacao multi-destinatario no mesmo pacote
- Risco residual 4:
  - o painel administrativo ja emite convite do veterinario parceiro, mas ainda nao mostra historico persistente de convites/login/download por parceiro

## 5) Itens fora de escopo entregues

- Nenhum nesta fase.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado (descrever motivo).

Motivo atual:
- esta fase validou cadastro, convite, ativacao, login e portal publico do `veterinario parceiro`, mas ainda faltam liberacao multi-destinatario, timeline administrativa detalhada e o fluxo completo de telemedicina sem agendamento.
