# Plan - laudos-global-search-pagination

Data: 2026-04-18  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (backend/API): ampliar filtros do endpoint `GET /laudos`.
- Fase 2 (frontend): trocar filtro local por busca remota com data e paginacao incremental.
- Fase 3 (validacao): compilar backend, lintar frontend e reproduzir guardrail.
- Fase 4 (release): documentar feature SDD e promover novo commit para `stage`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Adicionar parametros `search` e `data` ao endpoint de laudos.
- [x] T1.2 Aplicar `joins` com paciente, tutor e clinica para filtrar e serializar em consulta unica.
- Criterio de conclusao: endpoint retorna `total` e `items` corretos com filtros remotos.
- Risco: diferencas entre bancos no uso de `func.date`.
- Rollback: restaurar implementacao anterior do endpoint.

### Fase 2

- [x] T2.1 Implementar busca remota com debounce na tela de laudos.
- [x] T2.2 Adicionar filtro por data, resumo de total e botao de carregar mais.
- Criterio de conclusao: a tela encontra laudos antigos sem precisar listar tudo de inicio.
- Risco: contagem e estado visual divergirem entre paginas.
- Rollback: voltar para filtro local temporario.

### Fase 3

- [x] T3.1 Validar `backend/app/api/v1/endpoints/laudos.py` com `py_compile`.
- [x] T3.2 Validar `frontend/app/laudos/page.tsx` com `eslint`.
- [x] T3.3 Reproduzir o `scripts/ci/check_sdd_guardrail.py` no diff do commit promovido.
- Criterio de conclusao: validacoes locais reproduzem comportamento esperado.
- Risco: guardrail continuar barrando por ausencia de docs SDD no diff.
- Rollback: gerar commit documental isolado para destravar o workflow.

### Fase 4

- [x] T4.1 Registrar `intent/spec/plan/verify` da feature.
- [x] T4.2 Promover commit documental para `stage`.
- Criterio de conclusao: push final em `stage` contem artefatos SDD obrigatorios.
- Risco: novo push nao incluir apenas docs e o guardrail voltar a analisar codigo.
- Rollback: criar novo commit somente documental.

## 3) Plano de testes

- Testes unitarios: nao aplicados neste ciclo.
- Testes de integracao: reproducao local do endpoint via compilacao e regra de guardrail.
- Testes manuais: busca por animal, tutor, clinica e data na tela de laudos.

## 4) Dependencias e bloqueios

- Dependencia 1: workflow `deploy-stage.yml` exige `sdd-guardrail` antes do deploy.
- Dependencia 2: existencia dos quatro artefatos em `docs/specs/<feature>/`.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
