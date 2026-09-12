# Spec - atendimento-status-apos-finalizar

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

Frontend do modulo de atendimento. Duas correcoes: o status devolvido pelo
`POST /finalizar` passa a valer no formulario, e a emissao de documento deixa
de falhar em silencio.

## 2) Requisitos funcionais

- RF-001: apos finalizar, o `status` do formulario e o devolvido pelo servidor
  ("Concluido").
- RF-002: o merge continua preservando o que o vet digitou durante o
  round-trip do `POST /finalizar` - a correcao vale para o `status`, nao para
  os campos de texto.
- RF-003: se o servidor nao devolver status, o valor local e mantido.
- RF-004: quando o save previo a geracao do PDF falha, a tela informa que o
  documento nao foi gerado por causa disso, sem descartar a mensagem de erro
  que veio do servidor.

## 3) Requisitos tecnicos

- RT-001: a regra de merge do finalizar sai de `page.tsx` para
  `frontend/lib/atendimento-form-merge.ts`, onde pode ser testada.
- RT-002: `mergeAutoSavedFormState` segue com o comportamento atual - a
  diferenca fica na funcao nova, usada so no caminho do finalizar.
- RT-003: nenhuma mudanca no backend. O guard de reabertura continua como esta.

## 4) Criterios de aceitacao

- CA-001: `mergeAtendimentoFinalizado` com `current.status = "Em atendimento"` e
  `persisted.status = "Concluido"` resulta em "Concluido".
- CA-002: no mesmo merge, texto digitado em `current` sobrevive.
- CA-003: `persisted.status` vazio mantem o status local.
- CA-004: depois de finalizar em stage, o autosave segue "Sincronizado" e a
  receita e emitida sem recarregar.
- CA-005: com o save falhando, clicar em emitir produz mensagem visivel
  ligando a falha ao documento.

## 5) Fora de escopo

- Guard de reabertura no backend.
- Demais campos servidos pelo merge.
- Fuso de `emitida_em` (spec `receita-emitida-em-fuso-operacional`).
