# Plan - laudo-ecocardiograma-save-alert

Data: 2026-07-30
Responsavel: Martiniano + Codex
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): confirmar ausencia de mudanca.
- Fase 2 (backend/API): confirmar ausencia de mudanca.
- Fase 3 (frontend): criar regra compartilhada e integrar os dois salvamentos.
- Fase 4 (integracao/observabilidade): validar tipos, lint, build e diff.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que nenhum dado novo precisa ser persistido.
- Criterio de conclusao: banco inalterado.
- Risco: nenhum.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 Preservar contratos existentes de laudos e imagens.
- Criterio de conclusao: nenhum endpoint ou schema alterado.
- Risco: nenhum.
- Rollback: nao aplicavel.

### Fase 3

- [x] T3.1 Criar gerador unico das mensagens de pendencia.
- [x] T3.2 Integrar o alerta em `Novo laudo`.
- [x] T3.3 Integrar o alerta na edicao de ecocardiograma.
- [x] T3.4 Direcionar o cancelamento para a aba pendente.
- Criterio de conclusao: ambos os fluxos verificam as mesmas condicoes antes da
  persistencia.
- Risco: falso positivo por tipo ou estado de upload.
- Rollback: retirar as integracoes e o helper.

### Fase 4

- [x] T4.1 Executar validacao da funcao pura para as quatro combinacoes.
- [x] T4.2 Executar TypeScript/lint/build.
- [x] T4.3 Revisar diff sem misturar alteracoes locais alheias.
- Criterio de conclusao: comandos aprovados ou riscos residuais documentados.
- Risco: base remota avancar durante o ciclo de release.
- Rollback: interromper a promocao, atualizar a base e revalidar em worktree
  isolado.

## 3) Plano de testes

- Testes unitarios: exercitar as quatro combinacoes da funcao de mensagem.
- Testes de integracao: TypeScript e build do frontend.
- Testes manuais: confirmar texto e destino da aba para cada pendencia.

## 4) Dependencias e bloqueios

- Dependencia 1: estado `usar_no_laudo` do editor estruturado.
- Dependencia 2: estado `uploaded` do componente de imagens.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (worktree limpo de release).
