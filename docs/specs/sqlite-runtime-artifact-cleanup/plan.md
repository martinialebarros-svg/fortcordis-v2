# Plan - sqlite-runtime-artifact-cleanup

Data: 2026-04-30  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1: diagnosticar uso e risco do SQLite local.
- Fase 2: ajustar versionamento e ignores.
- Fase 3: validar status Git e SDD.
- Fase 4: publicar em stage.

## 2) Tarefas por fase

### Fase 1

- [x] Confirmar referencias a `backend/fortcordis.db`.
- [x] Comparar contagens locais com expectativa de prod.
- Criterio de conclusao: classificar arquivo como runtime/local.
- Rollback: nao aplicavel.

### Fase 2

- [x] Remover SQLite do indice Git.
- [x] Reforcar `.gitignore`.
- Criterio de conclusao: arquivo local permanece no disco, mas nao no Git.
- Rollback: `git add backend/fortcordis.db` a partir de commit anterior.

### Fase 3

- [x] Validar que o commit planejado contem apenas cleanup.
- [x] Registrar spec e verify.
- Criterio de conclusao: guardrail SDD apta.
- Rollback: remover commit de cleanup antes de promover.

### Fase 4

- [ ] Publicar em stage.
- [ ] Confirmar deploy verde.
- Criterio de conclusao: stage operacional.
- Rollback: reverter commit se deploy revelar dependencia no arquivo versionado.

## 3) Plano de testes

- Testes automatizados: guardrail SDD.
- Testes de integracao: deploy stage.
- Testes manuais: smoke de login/health em stage.

## 4) Dependencias e bloqueios

- Dependencia 1: GitHub Actions de stage.
- Dependencia 2: VPS com `DATABASE_URL` corretamente configurado.

## 5) Checklist para iniciar execucao

- [x] `intent.md` criado.
- [x] `spec.md` criado.
- [x] Fases e rollback revisados.
- [x] Ambiente alvo definido: stage.
