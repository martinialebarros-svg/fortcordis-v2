# Intent - agenda-lista-status-atual-acoes

Data: 2026-10-06
Status: implementado e verificado localmente

## 1) Problema

Em 2026-10-06, a secretaria olhou rapidamente um agendamento e entendeu que
estava cancelado, embora o status atual fosse `Agendado`. Na captura enviada,
`Agendado` aparece como um selo ao lado da clinica, enquanto `Cancelado` aparece
como botao entre varias acoes no mesmo card. Ambos usam icone, cor de status,
borda e formato arredondado. A causa exata da leitura equivocada nao foi
medida, mas a apresentacao permite confundir um estado ja aplicado com uma
transicao disponivel, especialmente quando o card quebra em linhas menores.

## 2) Objetivo

Na Agenda em modo lista, permitir identificar de imediato o **status atual**
do agendamento e, separadamente, as **acoes para alterar o status**. A
diferenca deve continuar clara em desktop, tablet e celular, inclusive sem
depender apenas de cor ou icone.

## 3) Escopo e restricoes

- Alterar somente a apresentacao do card em `frontend/app/agenda/page.tsx` e
  estilos diretamente associados, se necessarios.
- Preservar `ag.status` como fonte do estado exibido e preservar as
  transicoes permitidas por `frontend/lib/agenda-shared-actions.ts`.
- Usar rotulos verbais das acoes compartilhadas, mantendo os textos especiais
  de `Desfazer realizado` e `Agendar apos confirmacao tardia`.
- Manter o fluxo atual de clique, desabilitacao durante atualizacao, mensagens
  de erro e confirmacoes existentes.

## 4) Fora de escopo

- Alterar valores de status, regras de transicao, autorizacao, API, banco de
  dados ou historico de auditoria.
- Redesenhar a Agenda FullCalendar, que ja apresenta um controle
  `Alterar Status` e o texto `Status atual` no detalhe do evento.
- Mudar outras acoes do card, como `Editar`, `Atender`, `Laudar` e navegacao.

## 5) Sinal de sucesso

Ao ver um card `Agendado` com a acao de cancelar disponivel, uma pessoa
consegue apontar qual e o estado presente e qual botao mudaria esse estado.
O mesmo permanece legivel e operavel em 375 px, 768 px e 1440 px, com
navegacao por teclado e sem sobreposicao ou rolagem horizontal indevida.

## 6) Resultado local

Com API mock e agendamentos sinteticos, a lista exibiu os estados `Agendado`,
`Reservado`, `Confirmado`, `Realizado` e `Expirado` em navegador local. O
estado atual apareceu antes do grupo de acoes; os rotulos verbais e o
agrupamento distinguem estado presente de transicao futura. A verificacao
local nao mede se a confusao relatada deixara de ocorrer no uso cotidiano.
