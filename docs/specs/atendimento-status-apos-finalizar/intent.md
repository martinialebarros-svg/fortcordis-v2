# Intent - atendimento-status-apos-finalizar

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Incidente em producao, 2026-09-11, atendimento #62 (paciente Leleka, tutora
Nadja). O vet finalizou o atendimento e em seguida tentou emitir a receita.
O botao nao produzia nada: nenhum PDF, nenhuma explicacao ligada ao clique.

Cadeia:

1. `finalizar_atendimento` grava `atendimento.status = "Concluido"` e devolve o
   detalhe completo, ja com o status novo.
2. No frontend, `mergeAutoSavedFormState` mescla apenas `id`, `exames` e
   `prescricao_itens`; todo o resto vem de `...current`. O `status` que o
   servidor acabou de mudar e descartado, e o formulario segue com o valor de
   antes da finalizacao.
3. Todo autosave seguinte envia esse status antigo. O backend ve um atendimento
   concluido recebendo status nao-concluido e recusa com 409 "Um atendimento
   vinculado e concluido nao pode ser reaberto isoladamente"
   (`atendimento.py:3868`). O prontuario entra em falha de autosave permanente.
4. O botao de emitir salva antes de gerar o PDF. Com o save falhando, ele caia
   em `if (!atendimentoId) return;` - saida silenciosa. O aviso que aparecia na
   tela era o do autosave, sobre reabertura, sem ligacao aparente com o botao
   apertado.

O item 2 ja era conhecido: esta registrado como observacao fora de escopo na
secao 5 do `verify.md` de `atendimento-continuidade-pos-alta`, descrito pelo
sintoma menor ("o banner de concluido so aparece ao reabrir o atendimento").
A avaliacao de impacto estava errada - o mesmo defeito trava a emissao de
receita depois de finalizar.

## 2) Objetivo

Depois de finalizar, o prontuario continua utilizavel: o autosave segue
funcionando e a receita pode ser emitida sem recarregar a pagina. Quando a
emissao nao for possivel, o vet le o motivo.

## 3) Nao objetivos

- Nao mexer no guard de reabertura do backend. Ele esta certo: prontuario,
  Agenda e OS precisam ser desfeitos em uma operacao unica.
- Nao revisar os demais campos que `mergeAutoSavedFormState` deixa vindo de
  `...current`. O merge preserva edicao do usuario durante o round-trip de
  proposito, e essa regra continua valendo para o resto.

## 4) Contexto e restricoes

- `page.tsx` tem mais de 8.000 linhas e nao e renderizavel em teste com custo
  razoavel (precedente registrado em CA-007). Regra que precisa de teste sai do
  arquivo, no padrao de `frontend/lib/atendimento-receitas.ts`.
- O merge existe para nao apagar o que o vet digitou durante o round-trip do
  `POST /finalizar`. A correcao nao pode enfraquecer isso.
- Workaround usado no incidente: marcar "Estado do atendimento" como
  "Concluido" na tela e salvar. Recarregar a pagina tambem resolve, mas o
  backup local guarda o mesmo status antigo.
