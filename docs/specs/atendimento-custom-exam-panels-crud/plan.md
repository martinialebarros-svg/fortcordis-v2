# Plan - atendimento-custom-exam-panels-crud

Data: 2026-04-13  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): validar reaproveitamento das tabelas existentes.
- Fase 2 (backend/API): implementar CRUD de paineis customizados no endpoint de atendimento.
- Fase 3 (frontend): manter o modal atual e melhorar a exibicao de erro.
- Fase 4 (integracao/observabilidade): validar teste backend e build frontend.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Verificar tabelas/modelos `painel_exames` e `painel_exames_itens`.
- [x] T1.2 Confirmar que nao e necessaria migracao adicional.
- Criterio de conclusao: modelo atual suporta o CRUD.
- Risco: reutilizar tabela sem ownership mais fino.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 Adicionar schema do payload de painel.
- [x] T2.2 Implementar listagem de customizados.
- [x] T2.3 Implementar criacao, edicao e exclusao logica.
- [x] T2.4 Proteger seedados contra alteracao/exclusao via prefixo custom.
- Criterio de conclusao: CRUD funcional no backend.
- Risco: conflito de `codigo` unico ou itens invalidos.
- Rollback: reverter alteracoes em `atendimento.py` e schemas.

### Fase 3

- [x] T3.1 Ajustar frontend para mostrar detalhe real de erro.
- [x] T3.2 Manter modal e fluxo existente sem redesign.
- Criterio de conclusao: frontend compila e preserva UX atual.
- Risco: regressao na aba exames.
- Rollback: reverter ajuste pontual em `frontend/app/atendimento/page.tsx`.

### Fase 4

- [x] T4.1 Executar teste unitario focado no CRUD dos paineis.
- [x] T4.2 Rodar `npm run build` no frontend.
- [ ] T4.3 Validar manualmente criar/editar/excluir painel no ambiente stage.
- Criterio de conclusao: evidencias registradas e aptas para stage.
- Risco: diferenca entre ambiente local e stage.
- Rollback: reverter commit se houver falha funcional em stage.

## 3) Plano de testes

- Testes unitarios: `backend/tests/test_atendimento_custom_exam_panels.py`
- Testes de integracao: `npm run build`
- Testes manuais: criar, editar e excluir painel customizado na aba exames

## 4) Dependencias e bloqueios

- Dependencia 1: catalogo de exames ativo para vincular itens ao painel.
- Dependencia 2: autenticacao valida no endpoint de atendimento.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
