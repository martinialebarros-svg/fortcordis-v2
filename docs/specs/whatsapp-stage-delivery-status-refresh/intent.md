# Intent - whatsapp-stage-delivery-status-refresh

## Objetivo

Manter o status das mensagens da conversa selecionada sincronizado com os callbacks da Meta sem exigir recarregamento completo da tela.

## Contexto

O backend persistiu corretamente a transicao real de `sent` para `delivered`, mas a interface permaneceu com o estado carregado logo apos o envio. A consulta de mensagens era refeita somente ao trocar de conversa ou enviar uma nova mensagem.
