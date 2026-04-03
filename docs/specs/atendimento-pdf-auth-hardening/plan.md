# Plan - atendimento-pdf-auth-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (spec + contrato): fechar regra header-only e matriz de erros.
- Fase 2 (backend): bloquear query token e manter auth bearer existente.
- Fase 3 (qualidade): adicionar testes de regressao de auth PDF.
- Fase 4 (validacao): executar testes locais e registrar evidencias no `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Registrar `intent.md` e `spec.md` para a feature.
- [x] T1.2 Definir codigos de erro esperados (`400`, `401`, `403`).
- Criterio de conclusao: escopo aprovado para execucao.
- Risco: ambiguidade de contrato entre backend e consumidores.
- Rollback: revisar spec antes de alterar codigo.

### Fase 2

- [x] T2.1 Ajustar `_autenticar_usuario_pdf` para bloquear `access_token` em query.
- [x] T2.2 Manter validacao de bearer token e matrix de autorizacao existente.
- Criterio de conclusao: helper de auth reflete contrato definido na spec.
- Risco: quebra de cliente legado com query token.
- Rollback: reverter patch do helper e retornar ao comportamento anterior.

### Fase 3

- [x] T3.1 Criar teste para rejeicao de query token.
- [x] T3.2 Criar testes para ausencia/invalidez de bearer.
- [x] T3.3 Criar teste de sucesso com bearer valido.
- Criterio de conclusao: cobertura minima para CA-001..CA-005.
- Risco: falso positivo por mocks incompletos de request/db.
- Rollback: ajustar mocks e manter testes independentes do banco real.

### Fase 4

- [x] T4.1 Executar testes novos localmente.
- [x] T4.2 Atualizar `verify.md` com evidencias reais.
- [x] T4.3 Preparar checklist rapido para homologacao stage.
- Criterio de conclusao: feature validada para follow-up em stage.
- Risco: falta de evidencias objetivas para decisao de release.
- Rollback: manter status `in-progress` ate completar validacao.

## 3) Plano de testes

- Testes unitarios/backend:
- Novo arquivo em `backend/tests/` para `_autenticar_usuario_pdf`.
- Cobrir query token, sem header, token invalido e token valido.
- Testes de integracao:
- Nao obrigatorios nesta iteracao curta (foco em regressao de contrato de auth).
- Testes manuais:
- Download de PDF de prescricao e exames em ambiente local/stage com sessao autenticada.

## 4) Dependencias e bloqueios

- Dependencia 1: `SECRET_KEY` de teste para gerar JWT local em unit tests.
- Dependencia 2: estabilidade da matrix de autorizacao (`_authorize_request_by_matrix`) durante mocks.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local).
