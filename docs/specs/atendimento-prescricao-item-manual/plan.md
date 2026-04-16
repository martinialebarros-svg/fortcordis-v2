# Plan - atendimento-prescricao-item-manual

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel.
- Fase 3 (frontend): ajustar estado auxiliar do editor manual e ancora da secao de itens.
- Fase 4 (integracao/observabilidade): validar lint dos arquivos alterados, registrar evidencias e liberar stage.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que nao ha mudanca de banco.
- [x] T1.2 Confirmar que nao ha migracao necessaria.
- Criterio de conclusao: escopo restrito a frontend.
- Risco: falso positivo sobre necessidade de persistencia.
- Rollback: nenhum necessario.

### Fase 2

- [x] T2.1 Confirmar que nao ha contrato de API afetado.
- [x] T2.2 Manter comportamento isolado no estado de tela.
- Criterio de conclusao: nenhum endpoint alterado.
- Risco: acoplamento involuntario com hidratação do formulario.
- Rollback: reverter alteracoes no estado auxiliar.

### Fase 3

- [x] T3.1 Criar estado auxiliar para manter o editor manual visivel apos clique em `Item manual`.
- [x] T3.2 Resetar esse estado ao carregar/limpar atendimento e adicionar ancora para scroll.
- Criterio de conclusao: clique em `Item manual` deixa de parecer inoperante.
- Risco: regressao no estado vazio da prescricao.
- Rollback: remover `prescricaoEditorManualAberto` e a ancora `prescricao-itens`.

### Fase 4

- [x] T4.1 Executar lint direcionado nos arquivos alterados.
- [x] T4.2 Atualizar `verify.md` e atender o guardrail SDD para deploy de stage.
- Criterio de conclusao: guardrail local aprova e deploy de stage pode prosseguir.
- Risco: pipeline ainda falhar por regra de CI nao relacionada.
- Rollback: novo commit apenas de docs pode ser revertido junto com a correcao se necessario.

## 3) Plano de testes

- Testes unitarios: nao aplicavel nesta rodada.
- Testes de integracao: nao aplicavel nesta rodada.
- Testes manuais: clicar em `Item manual` com receita vazia; remover ultimo item; carregar novo atendimento.

## 4) Dependencias e bloqueios

- Dependencia 1: guardrail SDD exige `spec.md` e `verify.md` no mesmo ciclo do codigo.
- Dependencia 2: validacao funcional manual da tela de atendimento.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
