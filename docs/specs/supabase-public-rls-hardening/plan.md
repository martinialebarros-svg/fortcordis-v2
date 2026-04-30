# Plan - supabase-public-rls-hardening

Data: 2026-04-29  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1: confirmar arquitetura de acesso ao banco.
- Fase 2: criar migracao de hardening.
- Fase 3: validar sintaxe e SDD.
- Fase 4: aplicar em ambiente com `DATABASE_URL` Supabase.

## 2) Tarefas por fase

### Fase 1

- [x] Verificar ausencia de `supabase-js`/chaves Supabase no frontend.
- [x] Confirmar uso de `/api/v1` e FastAPI como camada de acesso.
- Criterio de conclusao: risco da Data API classificado.
- Rollback: nao aplicavel.

### Fase 2

- [x] Criar migracao PostgreSQL-only.
- [x] Habilitar RLS nas tabelas `public`.
- [x] Revogar grants de `anon` e `authenticated`.
- Criterio de conclusao: migracao versionada no padrao do repo.
- Rollback: reverter migracao ou restaurar grants necessarios.

### Fase 3

- [x] Compilar migracao.
- [x] Registrar spec e verify.
- Criterio de conclusao: artefatos prontos para deploy.
- Rollback: remover arquivos adicionados.

### Fase 4

- [ ] Aplicar em stage/producao.
- [ ] Validar login, agenda, pacientes, financeiro e laudos.
- Criterio de conclusao: app operacional e alertas Supabase reduzidos.
- Rollback: reabilitar grants/policies se alguma integracao Data API quebrar.

## 3) Plano de testes

- Testes unitarios: `python3 -m py_compile` da migracao.
- Testes de integracao: rodar migration runner com `DATABASE_URL` Supabase.
- Testes manuais: login e principais fluxos operacionais.

## 4) Dependencias e bloqueios

- Dependencia 1: acesso a `DATABASE_URL` Supabase ou deploy VPS/GitHub Actions.
- Dependencia 2: confirmar se existe algum consumidor externo da Data API.

## 5) Checklist para iniciar execucao

- [x] `intent.md` criado.
- [x] `spec.md` criado.
- [x] Fases e rollback revisados.
- [ ] Ambiente Supabase acessivel para aplicacao.
