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
| CA-004 | aceitacao | Fluxo de liberacao com combinacao clinica/veterinario/tutor | parcial |
| CA-005 | aceitacao | Fluxo de telemedicina/upload com selecao ou cadastro rapido do parceiro | concluido |
| CA-008 | aceitacao | Edicao de laudo pronto permitindo vincular ou trocar veterinario parceiro sem recriacao | concluido |
| CA-006 | aceitacao | Painel administrativo com filtros por tipo, ultimo acesso e ultimo download | parcial |
| CA-007 | aceitacao | Timeline auditavel com convite, ativacao, login, revogacao e download | pendente |
| API-F2-001 | tecnico | CRUD administrativo inicial de parceiros externos (`GET/POST/PATCH /api/v1/portal/parceiros`) | concluido |
| API-F5-001 | tecnico | Endpoints operacionais para listar/cadastrar veterinario parceiro no fluxo de telemedicina | concluido |
| UI-F3-001 | tecnico | Tela administrativa `/clinicas/portal/parceiros` integrada aos endpoints de parceiros externos | concluido |
| API-F4-001 | tecnico | Fluxo de convite/autenticacao do veterinario parceiro (`/api/v1/portal/parceiros/...`) | concluido |
| UI-F4-001 | tecnico | Portal publico `/veterinario-parceiro` com ativacao, login, reset e listagem escopada | concluido |
| UI-F5-001 | tecnico | Tela de upload de eletrocardiograma com clinica ou veterinario parceiro + cadastro rapido no fluxo | concluido |
| UI-F5-002 | tecnico | Tela de edicao do laudo com seletor de veterinario parceiro para laudos prontos | concluido |
| DB-F5-001 | tecnico | Persistencia de `laudos.veterinario_parceiro_id` para vinculo do encaminhamento | concluido |
| API-F6-001 | tecnico | Endpoint generico `POST /api/v1/laudos/{id}/portal/liberar` com facade legada clinic-centric | concluido |
| API-F6-002 | tecnico | Criacao/reativacao de `portal_partner_release_targets` + notificacao por email para o veterinario parceiro | concluido |
| UI-F6-001 | tecnico | A listagem e a tela do laudo mantem a acao de liberacao disponivel enquanto houver destino externo pendente | concluido |
| NFR-002 | nao funcional | Logs e consultas mostrando escopo por `partner_id` sem vazamento entre parceiros | parcial |
| NFR-004 | nao funcional | Migracao/compatibilidade preservando espelho das clinicas ja ativas e dos exames legados liberados | parcial |

## 2) Testes automatizados executados

Comandos:

```bash
DATABASE_URL='sqlite:///./test.db' backend/venv/bin/python -m unittest backend.tests.test_laudo_portal_release backend.tests.test_portal_partner_auth backend.tests.test_portal_partners_api backend.tests.test_laudos_referring_partner_migration
backend/venv/bin/python -m py_compile \
  backend/app/api/v1/endpoints/laudos.py \
  backend/app/services/portal_partner_notification_service.py \
  backend/tests/test_laudo_portal_release.py
npx eslint app/laudos/page.tsx app/laudos/[id]/page.tsx
npx eslint app/laudos/[id]/editar/page.tsx
npx tsc --noEmit
npm run build
```

Resumo dos resultados:
- Backend:
  - `test_laudo_portal_release` + `test_portal_partner_auth` + `test_portal_partners_api` + `test_laudos_referring_partner_migration`: passaram (`17 tests` no total)
  - `test_laudo_portal_release`: agora cobre tambem:
    - liberacao simultanea para clinica e veterinario parceiro
    - sinalizacao de destino pendente quando a clinica ja foi liberada, mas o veterinario parceiro ainda nao
  - `py_compile`: passou nos arquivos tocados do backend
- Frontend:
  - `npx eslint` nas telas de listagem e detalhe de laudos: passou
  - `npx eslint` na tela de edicao de laudo: passou
  - `npx tsc --noEmit`: passou
  - `npm run build`: passou

Observacao:
- A fase atual conclui a liberacao direta para clinica e/ou veterinario parceiro a partir dos vinculos ja salvos no laudo. A selecao explicita de tutor e a timeline administrativa completa seguem pendentes.

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
  - salvar o laudo apenas com veterinario parceiro quando nao houver clinica fixa

- Cenario 6:
  - usar um laudo ja liberado para a clinica
  - vincular um veterinario parceiro ao caso
  - confirmar que a UI ainda permite nova liberacao apenas para o destino faltante

- Cenario 7:
  - abrir um laudo pronto em edicao
  - selecionar, trocar ou limpar `Veterinario parceiro`
  - salvar o laudo
  - confirmar no detalhe do laudo e no fluxo de liberacao do portal que o vinculo atualizado foi preservado

## 4) Regressao e riscos residuais

- Risco residual 1:
  - coexistencia temporaria entre contratos legados clinic-centric e nova camada generica de parceiro externo
- Risco residual 2:
  - necessidade de saneamento se emails historicos de clinicas coincidirem com emails desejados para veterinarios parceiros
- Risco residual 3:
  - a fase atual fecha clinica + veterinario parceiro via vinculos ja salvos, mas ainda nao conclui a selecao explicita de tutor no mesmo comando
- Risco residual 4:
  - o painel administrativo ja emite convite do veterinario parceiro, mas ainda nao mostra historico persistente de convites/login/download por parceiro
- Risco residual 5:
  - a notificacao do veterinario parceiro depende de um email ativo valido no perfil/conta para o envio automatico acontecer

## 5) Itens fora de escopo entregues

- Nenhum nesta fase.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- pacote pronto para stage com validacao local completa; a promocao para producao depende do smoke em stage e da checagem final dos workflows.
