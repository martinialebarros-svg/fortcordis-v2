# Plan - atendimento-upload-duplicate-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (spec/contrato): fechar assinatura de duplicidade e feedback.
- Fase 2 (frontend core): implementar guarda de assinatura em memoria.
- Fase 3 (frontend UX): exibir aviso neutro para tentativa duplicada.
- Fase 4 (qualidade): lint e checklist manual local/stage.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Definir assinatura de deduplicacao.
- [x] T1.2 Definir tratamento de feedback para bloqueio.
- Criterio de conclusao: `intent.md` e `spec.md` aprovados.
- Risco: assinatura ampla demais bloquear caso legitimo.
- Rollback: ajustar assinatura antes de codificar.

### Fase 2

- [x] T2.1 Criar `Set` de uploads ativos por assinatura.
- [x] T2.2 Bloquear chamada API quando assinatura ja ativa.
- [x] T2.3 Limpar assinatura no `finally`.
- Criterio de conclusao: tentativa duplicada nao dispara novo POST.
- Risco: cleanup incompleto prender assinatura.
- Rollback: remover guarda e manter fluxo atual.

### Fase 3

- [x] T3.1 Exibir aviso neutro ao bloquear duplicado.
- [x] T3.2 Garantir coexistencia com toasts de sucesso/erro/cancelamento.
- Criterio de conclusao: feedback claro sem ruido visual.
- Risco: sobreposicao/confusao de mensagens.
- Rollback: limitar aviso a mensagem discreta sem toast.

### Fase 4

- [x] T4.1 Rodar lint focado na tela.
- [ ] T4.2 Executar checklist manual local.
- [ ] T4.3 Executar checklist manual stage e atualizar `verify.md`.
- Criterio de conclusao: CA-001..CA-005 em `ok`.
- Risco: dificil comprovar ausencia de segundo POST sem instrumentacao.
- Rollback: segurar promocao para main.

## 3) Plano de testes

- Testes unitarios: nao obrigatorios nesta iteracao.
- Testes de integracao: nao aplicavel.
- Testes manuais:
- clique duplo no envio geral;
- clique duplo no envio de exame;
- cancelar e reenviar imediatamente.

## 4) Dependencias e bloqueios

- Dependencia 1: estabilidade do fluxo atual de progresso/cancelamento.
- Dependencia 2: consistencia de metadados do `File` no navegador (`name`, `size`, `lastModified`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
