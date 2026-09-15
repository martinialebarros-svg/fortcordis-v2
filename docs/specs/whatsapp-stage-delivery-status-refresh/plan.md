# Plan - whatsapp-stage-delivery-status-refresh

1. Confirmar que o callback real foi persistido pelo backend.
2. Atualizar silenciosamente a conversa selecionada em intervalo curto.
3. Impedir respostas atrasadas de uma conversa anterior de sobrescrever a conversa atual.
4. Disponibilizar atualizacao manual na interface.
5. Cobrir a transicao `sent` para `delivered` com teste de componente.
6. Validar lint, teste e build antes do deploy em stage.
