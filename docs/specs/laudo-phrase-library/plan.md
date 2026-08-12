# Plan - laudo-phrase-library

Data: 2026-08-11
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (contrato JSON): estender normalizacao de frases com patologias, ordem e soft delete.
- Fase 2 (backend/API): adicionar endpoints de duplicar, desativar/restaurar e sincronizacao de presets.
- Fase 3 (frontend): criar aba Biblioteca e cliente API compartilhado.
- Fase 4 (validacao): executar testes backend, TypeScript e guardrail SDD.
- Fase 5 (seletor de conclusao): substituir a lista nativa extensa por seletor pesquisavel e agrupado por patologia na aba Qualitativa.
- Fase 6 (seguranca da API): exigir autenticacao e aplicar a matriz existente do modulo `frases` em todas as rotas.

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

### Fase 5

- [x] T5.1 Criar seletor exclusivo para o aspecto Conclusao com busca, grupos expansivos e contagem.
- [x] T5.2 Reutilizar `patologias` e `tags` do banco, com atalhos clinicos e grupo de fallback.
- [x] T5.3 Preservar o botao `Usar frase`, exibir previa e manter os demais aspectos no seletor simples.
- [x] T5.4 Validar lint, TypeScript e build de producao.
- [ ] T5.5 Validar guardrail, publicar em stage e repetir o fluxo no frontend servido.
- [x] T5.6 Corrigir o recorte vertical com portal, posicionamento adaptativo e altura limitada ao viewport.
- Criterio de conclusao: conclusoes podem ser encontradas por busca ou patologia sem abrir uma lista nativa unica, e selecionar uma opcao nao altera o texto antes de `Usar frase`.
- Risco: painel customizado ultrapassar a viewport ou perder fechamento por teclado/clique externo.
- Rollback: restaurar o `select` nativo apenas para Conclusao, sem alterar o banco ou as frases.

### Fase 6

- [x] T6.1 Aplicar `get_current_user` como dependencia do router estruturado de frases de ecocardiograma.
- [x] T6.2 Preservar os contratos do frontend e a matriz existente: GET usa `visualizar`, POST/PUT usam `editar` e DELETE usa `excluir`.
- [x] T6.3 Cobrir todas as rotas com regressao HTTP de acesso anonimo e provar leitura autenticada.
- [ ] T6.4 Validar em stage que leitura e mutacao anonimas retornam `401` sem alterar o store.
- Criterio de conclusao: nenhuma rota da biblioteca estruturada responde anonimamente e usuarios autorizados continuam usando o cliente existente.
- Risco: papel sem permissao no modulo `frases` passar a receber `403`, conforme a matriz configurada.
- Rollback: reverter a dependencia do router; nenhuma migracao ou alteracao do JSON e necessaria.

## 3) Plano de testes

- Testes unitarios: `python3 -m unittest backend/tests/test_frases_ecocardiograma_estruturado_teste_service.py`.
- Testes de integracao: `python3 -m py_compile` nos endpoints/servico alterados.
- Testes de seguranca: `python -m pytest backend/tests/test_frases_ecocardiograma_estruturado_auth.py` e smoke anonimo de GET/POST em stage.
- Testes frontend: ESLint direcionado dos componentes, `cd frontend && npx tsc --noEmit --incremental false` e `npm run build`.
- Testes manuais: abrir stage, acessar novo/editar laudo, usar aba Biblioteca, editar frase, pesquisar/expandir grupos de Conclusao e aplicar uma frase na Qualitativa.

## 4) Dependencias e bloqueios

- Dependencia 1: deploy stage concluir para validacao visual.
- Dependencia 2: banco JSON de frases ser preservado pelo deploy.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: stage.
