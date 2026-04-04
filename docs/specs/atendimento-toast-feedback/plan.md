# Plan - atendimento-toast-feedback

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (spec/contrato): fechar regra de exibicao e tempos de popup.
- Fase 2 (frontend core): implementar popup de sucesso e unificar controle de timers.
- Fase 3 (frontend polish): remover banner de sucesso e ajustar UX de fechamento manual.
- Fase 4 (qualidade): validar localmente e registrar evidencias no `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Definir escopo e requisitos no SDD.
- [x] T1.2 Definir criterios de aceitacao para sucesso/erro em popup.
- Criterio de conclusao: `intent.md` e `spec.md` aprovados.
- Risco: ambiguidade sobre timeout ideal.
- Rollback: revisar spec antes de codificar.

### Fase 2

- [x] T2.1 Criar estado/timer para popup de sucesso.
- [x] T2.2 Reaproveitar padrao de limpeza de timer ja usado no erro.
- [x] T2.3 Garantir override da mensagem anterior ao chegar nova mensagem.
- Criterio de conclusao: sucesso e erro renderizados em popup com comportamento previsivel.
- Risco: conflitos de estado entre `sucesso`, `erro` e popups.
- Rollback: retornar ao bloco de sucesso anterior e manter erro popup atual.

### Fase 3

- [x] T3.1 Remover banner estatico de sucesso do topo.
- [x] T3.2 Aplicar estilo visual consistente entre toast de erro e sucesso.
- [x] T3.3 Revisar acessibilidade minima (aria-label no botao fechar).
- Criterio de conclusao: UX de notificacao consistente na tela.
- Risco: toast sobrepor elementos em viewport pequeno.
- Rollback: ajuste de posicionamento ou retorno temporario do banner.

### Fase 4

- [x] T4.1 Rodar lint focado na tela de atendimento.
- [ ] T4.2 Executar checklist manual (sucesso, erro, sequencia rapida).
- [x] T4.3 Atualizar `verify.md` com evidencias.
- Criterio de conclusao: CA-001..CA-005 com status `ok`.
- Risco: validacao incompleta em mobile/resolucao pequena.
- Rollback: segurar promocao ate completar homologacao.

## 3) Plano de testes

- Testes unitarios: nao obrigatorios nesta iteracao (UI state local).
- Testes de integracao: nao aplicavel.
- Testes manuais:
- salvar atendimento com sucesso.
- forcar erro de validacao/upload.
- disparar sucesso e erro em sequencia.
- fechar popup manualmente antes do timeout.

## 4) Dependencias e bloqueios

- Dependencia 1: estabilidade da tela `frontend/app/atendimento/page.tsx`.
- Dependencia 2: alinhamento de timeout com preferencia operacional (visibilidade sem poluicao).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
