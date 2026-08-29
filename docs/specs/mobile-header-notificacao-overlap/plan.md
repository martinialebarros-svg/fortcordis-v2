# Plan - mobile-header-notificacao-overlap

Data: 2026-08-28
Responsavel: Martiniano + Claude
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel.
- Fase 3 (frontend): ajustar `.fc-mobile-header` em
  `frontend/app/globals.css` para criar um stacking context posicionado
  (`relative` + `z-index` explicito).
- Fase 4 (integracao/observabilidade): validacao visual manual em viewport
  mobile.
- Fase 5 (revisao/correcao): revisar o valor de z-index escolhido contra os
  overlays de modal em tela cheia do app, apos review automatizado (Codex)
  apontar regressao potencial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1: Localizar a causa raiz (stacking context implicito via
  `backdrop-blur` sem `position`/`z-index` explicitos em
  `.fc-mobile-header`).
- [x] T3.2: Adicionar `relative z-[70]` a `.fc-mobile-header` em
  `frontend/app/globals.css` (valor inicial).
- Criterio de conclusao: dropdown de alertas visivel acima do banner de
  relatorios no mobile.
- Risco: nenhum elemento com z-index entre 60 e 70 dependia de ficar acima
  do header mobile (verificado: sidebar usa `z-[60]`, abaixo do novo valor).
- Rollback: reverter a linha alterada em `globals.css`.

### Fase 5

- [x] T5.1: Revisar todos os overlays `fixed inset-0` (modais em tela cheia)
  do app e seus z-index (`z-30` a `z-[130]`, menor valor observado em
  `frontend/components/portal/PortalClinicaWorkspace.tsx:1568`).
- [x] T5.2: Reduzir `.fc-mobile-header` de `z-[70]` para `z-20` — abaixo de
  todo modal em tela cheia (menor e `z-30`), mas ainda acima de conteudo
  comum sem z-index (`z-index: auto`, como `.fc-reports-header`).
- Criterio de conclusao: modais em tela cheia voltam a cobrir o header
  mobile e o dropdown de alertas, enquanto o banner de relatorios continua
  atras do dropdown.
- Risco: baixo — nenhum overlay de pagina "comum" (nao-modal) depende de
  ficar entre `z-20` e `z-30`.
- Rollback: reverter para o valor anterior ou remover `z-20`/`relative`.

### Fase 4

- [x] T4.1: Revisar visualmente a mudanca via leitura do CSS resultante e
  comparacao com o screenshot do bug reportado.
- Criterio de conclusao: nenhuma alteracao de layout em `lg+` (header vira
  `display: contents`, ignorando `position`/`z-index`).
- Risco: baixo.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: nao aplicavel (mudanca de CSS puro).
- Testes de integracao: nao aplicavel.
- Testes manuais: abrir `/relatorios` em viewport mobile (`< 1024px`), abrir
  o sino de alertas e confirmar que o painel fica acima do banner
  "Relatorios & Controle"; repetir em viewport desktop para confirmar que o
  comportamento `lg:fixed`/`lg:contents` nao mudou.

## 4) Dependencias e bloqueios

- Nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (leitura de codigo/CSS; sem ambiente de
      preview neste fix pontual).
