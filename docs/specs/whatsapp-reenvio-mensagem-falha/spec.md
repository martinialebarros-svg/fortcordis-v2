# Spec - whatsapp-reenvio-mensagem-falha

## Requisitos funcionais

- RF-001: mensagem `from_me: true` com `status: "failed"` mostra um
  botão "Reenviar" no rodapé, ao lado do indicador de status.
- RF-002: mensagens que não são `from_me` ou cujo status não é `failed`
  nunca mostram esse botão. Atualização (`whatsapp-envio-anexo-
  documento`): mensagens `type !== "text"` (ex.: `document`) também não
  mostram o botão, porque o reenvio só reconstrói a requisição a partir
  do `body`/`type` salvos — não temos o binário original de um anexo
  para reenviar.
- RF-003: clicar em "Reenviar" chama `POST
  /conversations/:id/messages` com `{body: <body original>, type: <type
  original>}` — mesmo endpoint e mesma validação do composer normal.
- RF-004: sucesso mostra "Mensagem reenviada." e recarrega a lista de
  mensagens (a nova mensagem aparece; a original continua marcada como
  `failed`).
- RF-005: falha por janela de atendimento encerrada (`409
  CUSTOMER_SERVICE_WINDOW_CLOSED`) mostra a mesma mensagem de erro já
  usada pelo composer normal; qualquer outra falha mostra o erro HTTP.
- RF-006: o botão fica desabilitado (com ícone girando) enquanto o
  reenvio está em andamento, para evitar duplo clique.

## Critérios de aceitação

- CA-001: mensagem `from_me` com `status: "failed"` mostra o botão
  "Reenviar"; mensagens com outros status não mostram.
- CA-002: clique em "Reenviar" faz `POST` com o `body`/`type` exatos da
  mensagem original.
- CA-003: sucesso exibe "Mensagem reenviada." e recarrega as mensagens.
- CA-004: mensagem `from_me` com `status: "failed"` e `type: "document"`
  não mostra o botão "Reenviar" (ver `whatsapp-envio-anexo-documento`).
