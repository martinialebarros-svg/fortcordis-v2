# Plan - atendimento-upload-progress

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (spec/contrato): fechar regra de progresso e fallback indeterminado.
- Fase 2 (frontend core): implementar captura de progresso no upload e estado por contexto.
- Fase 3 (frontend UX): aplicar exibicao percentual nos botoes/cards de upload.
- Fase 4 (qualidade): validar em local/stage e registrar evidencias.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Definir RF/CA para progresso em upload geral e por exame.
- [x] T1.2 Definir fallback quando `total` nao vier no evento de progresso.
- Criterio de conclusao: `intent.md` e `spec.md` revisados.
- Risco: ambiguidade de comportamento em rede lenta.
- Rollback: manter estado atual "Enviando..." sem percentual.

### Fase 2

- [x] T2.1 Adicionar estado de progresso por `uploadKey`.
- [x] T2.2 Integrar `onUploadProgress` na chamada `api.post`.
- [x] T2.3 Garantir reset de progresso no `finally` (sucesso/erro).
- Criterio de conclusao: progresso atualizado corretamente durante upload.
- Risco: updates excessivos de estado em uploads longos.
- Rollback: remover estado de progresso e manter apenas spinner.

### Fase 3

- [x] T3.1 Exibir `Enviando X%` no upload geral.
- [x] T3.2 Exibir `Enviando X%` no upload por exame.
- [x] T3.3 Manter fallback indeterminado quando percentual indisponivel.
- Criterio de conclusao: UX consistente entre os dois pontos de upload.
- Risco: quebra de layout em mobile com texto de progresso.
- Rollback: reduzir exibicao para spinner + texto curto.

### Fase 4

- [x] T4.1 Rodar lint focado na tela de atendimento.
- [x] T4.2 Executar checklist manual local (upload pequeno, medio, erro).
- [x] T4.3 Repetir checklist em stage e atualizar `verify.md`.
- Criterio de conclusao: CA-001..CA-005 marcados como `ok`.
- Risco: variacao de comportamento entre localhost e stage.
- Rollback: segurar promocao para main ate estabilizar.

## 3) Plano de testes

- Testes unitarios: nao obrigatorios nesta iteracao (estado de UI local).
- Testes de integracao: nao aplicavel.
- Testes manuais:
- upload geral com arquivo pequeno e medio.
- upload de exame com arquivo pequeno e medio.
- simulacao de erro de rede/api e validacao de reset de progresso.

## 4) Dependencias e bloqueios

- Dependencia 1: suporte de `onUploadProgress` no cliente axios/browser do ambiente atual.
- Dependencia 2: estabilidade da tela `frontend/app/atendimento/page.tsx`.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
