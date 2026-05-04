# Plan - laudo-phrase-library

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (contrato JSON): estender normalizacao de frases com patologias, ordem e soft delete.
- Fase 2 (backend/API): adicionar endpoints de duplicar, desativar/restaurar e sincronizacao de presets.
- Fase 3 (frontend): criar aba Biblioteca e cliente API compartilhado.
- Fase 4 (validacao): executar testes backend, TypeScript e guardrail SDD.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Adicionar `patologias` e `ordem` na normalizacao de frases.
- [x] T1.2 Preservar compatibilidade com frases antigas.
- Criterio de conclusao: payload carrega sem migracao manual.
- Risco: normalizacao tocar o JSON runtime.
- Rollback: reverter commit e restaurar backup runtime.

### Fase 2

- [x] T2.1 Implementar CRUD ampliado de frases e presets.
- [x] T2.2 Sincronizar presets em renomeio/movimentacao de frase.
- Criterio de conclusao: testes unitarios cobrem renomeio, movimento, duplicacao e restauracao.
- Risco: preset ficar com referencia inconsistente.
- Rollback: reverter endpoints/servico e usar snapshot JSON anterior.

### Fase 3

- [x] T3.1 Adicionar aba Biblioteca em novo/editar laudo.
- [x] T3.2 Criar componente de gestao de frases/presets com filtros e formularios.
- Criterio de conclusao: TypeScript compila.
- Risco: tela grande demais para fluxo de laudo.
- Rollback: remover aba e componente, mantendo API se necessario.

### Fase 4

- [x] T4.1 Executar testes backend.
- [x] T4.2 Executar `npx tsc --noEmit`.
- [x] T4.3 Registrar SDD e validar guardrail.
- Criterio de conclusao: stage pode rodar deploy apos guardrail.
- Risco: lint global falhar por erro preexistente.
- Rollback: documentar erro preexistente e usar verificacao direcionada.

## 3) Plano de testes

- Testes unitarios: `python3 -m unittest backend/tests/test_frases_ecocardiograma_estruturado_teste_service.py`.
- Testes de integracao: `python3 -m py_compile` nos endpoints/servico alterados.
- Testes frontend: `cd frontend && npx tsc --noEmit`.
- Testes manuais: abrir stage, acessar novo/editar laudo, usar aba Biblioteca, editar frase e aplicar preset na Qualitativa.

## 4) Dependencias e bloqueios

- Dependencia 1: deploy stage concluir para validacao visual.
- Dependencia 2: banco JSON de frases ser preservado pelo deploy.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: stage.
