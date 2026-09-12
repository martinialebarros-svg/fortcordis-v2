# Plan - atendimento-status-apos-finalizar

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: concluido; verificacao em stage pendente

## 1) Tarefas

- [x] T1 criar `mergeAtendimentoFinalizado` em
      `frontend/lib/atendimento-form-merge.ts`: aplica
      `mergeAutoSavedFormState` e sobrepoe o `status` com o do servidor.
- [x] T2 usar a funcao nova no caminho do `POST /finalizar` em
      `frontend/app/atendimento/page.tsx`.
- [x] T3 fazer a saida silenciosa da geracao de PDF informar o motivo,
      compondo com a mensagem que o save ja publicou.
- [x] T4 testes em `frontend/lib/atendimento-form-merge.test.ts`, incluindo
      teste negativo.
- [ ] T5 verificacao manual em stage: finalizar e emitir sem recarregar.

## 2) Ordem e dependencias

T1 antes de T2. T3 e independente das outras: vale mesmo que o save falhe por
outro motivo, e e o que transforma um beco sem saida em um erro legivel.

## 3) Risco

O unico risco e enfraquecer a garantia do merge, que existe para nao apagar
digitacao durante o round-trip. Mitigado por CA-002, que fixa esse
comportamento junto com o status novo, no mesmo teste.

## 4) Entrega

Defeito vivo em producao, com workaround manual. A escolha entre promocao
stage-first e `hotfix/` mirando `main` fica com o responsavel - ver
`docs/RUNBOOK-STAGE-PROD.md`. Se for hotfix, o backport para `stage` e
imediato.
