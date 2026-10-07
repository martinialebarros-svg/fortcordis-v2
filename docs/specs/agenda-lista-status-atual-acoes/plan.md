# Plan - agenda-lista-status-atual-acoes

Data: 2026-10-06
Status: implementado e verificado localmente

## 1) Tarefas

- [x] T1 localizar o selo do status atual, os botoes de transicao, os
      rotulos compartilhados e a quebra responsiva no card da Agenda lista.
- [x] T2 tornar visivel o rotulo `Status atual` junto ao valor de
      `ag.status`, mantendo esse elemento informativo e nao clicavel.
- [x] T3 reunir os botoes de transicao em uma area visual propria, com
      titulo de acao, e aplicar os rotulos verbais compartilhados sem mudar
      destinos nem ordem das transicoes.
- [x] T4 conferir leitura, quebra de linhas, alvos de toque e foco por
      teclado em celular, tablet e desktop.
- [x] T5 executar teste focado, suite frontend, lint, TypeScript e build;
      registrar resultados reais em `verify.md`.
- [x] T6 avaliar localmente o guardrail SDD com `evaluate_guardrail` sobre
      os arquivos alterados, sem apresentar isso como job CI por SHA.

## 2) Dependencias

T3 depende dos rotulos definidos em `frontend/lib/agenda-shared-actions.ts`.
A ordem especial de `Reservado`, documentada em
`docs/specs/agenda-reserva-formalizacao-dados-pendentes/spec.md`, permanece.
T4 deve usar navegador com CSS aplicado: os testes jsdom nao avaliam
posicionamento, recorte ou tamanho dos alvos.

## 3) Riscos e verificacao

- Um botao com o nome do estado de destino pode continuar parecendo um status
  atual. Conferir os textos no card `Agendado` com `Cancelar` disponivel.
- A separacao visual pode ocupar espaco demais em 375 px ou quebrar em tablet.
  Conferir 375x812, 768x1024 e 1440x900, incluindo o rotulo mais longo
  (`Agendar apos confirmacao tardia`).
- A troca de rotulos nao pode mudar `novoStatus` enviado ao fluxo atual.
  Conferir mapeamento entre texto visivel e status de destino nos testes e
  no codigo.
- Foco, estado desabilitado e mensagens de atualizacao devem continuar
  compreensiveis. Conferir por teclado e revisar as classes compartilhadas
  pelos botoes.

Rollback: reverter somente a alteracao de apresentacao. Nao ha migracao nem
estado persistido novo.

## 4) Entrega

Implementacao e validacao local concluidas no worktree isolado. Publicacao
em stage ou producao depende do fluxo de release solicitado separadamente.
