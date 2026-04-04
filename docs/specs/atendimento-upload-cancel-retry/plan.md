# Plan - atendimento-upload-cancel-retry

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (spec/contrato): fechar regras de cancelamento e reenvio.
- Fase 2 (frontend core): integrar `AbortController` por `uploadKey`.
- Fase 3 (frontend UX): adicionar botoes de cancelar nos dois pontos de upload.
- Fase 4 (qualidade): lint e checklist manual local/stage.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Definir comportamento de cancelamento para upload geral e exame.
- [x] T1.2 Definir estrategia de feedback ao cancelar.
- Criterio de conclusao: `intent.md` e `spec.md` aprovados.
- Risco: ambiguidade sobre manter/remover arquivo selecionado.
- Rollback: alinhar regra antes da implementacao.

### Fase 2

- [x] T2.1 Criar estrutura de `AbortController` por contexto de upload.
- [x] T2.2 Passar `signal` para chamada `api.post` do upload.
- [x] T2.3 Limpar controlador no `finally`.
- Criterio de conclusao: upload pode ser abortado via funcao dedicada.
- Risco: estado preso por cleanup incompleto.
- Rollback: remover controle de cancelamento e manter upload progress atual.

### Fase 3

- [x] T3.1 Exibir botao `Cancelar upload` no bloco de anexos gerais.
- [x] T3.2 Exibir botao `Cancelar upload` no bloco de upload por exame.
- [x] T3.3 Garantir reenvio imediato sem limpar arquivo selecionado.
- Criterio de conclusao: UX de cancelamento funcional em ambos os fluxos.
- Risco: poluicao visual do card.
- Rollback: manter cancelamento apenas via codigo e ocultar botao.

### Fase 4

- [x] T4.1 Rodar lint focado na tela de atendimento.
- [ ] T4.2 Executar checklist manual local.
- [ ] T4.3 Executar checklist manual stage e atualizar `verify.md`.
- Criterio de conclusao: CA-001..CA-005 em `ok`.
- Risco: diferenca de comportamento em rede/local.
- Rollback: segurar promocao ate validar ambiente stage.

## 3) Plano de testes

- Testes unitarios: nao obrigatorios nesta iteracao (estado de UI local).
- Testes de integracao: nao aplicavel.
- Testes manuais:
- iniciar upload e cancelar no bloco geral;
- iniciar upload e cancelar no bloco de exame;
- confirmar reenvio do mesmo arquivo apos cancelamento.

## 4) Dependencias e bloqueios

- Dependencia 1: suporte a `AbortController` no axios/browser alvo.
- Dependencia 2: estabilidade do fluxo atual de upload-progress.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
