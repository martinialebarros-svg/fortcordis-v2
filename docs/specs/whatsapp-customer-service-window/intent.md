# Intent - whatsapp-customer-service-window

Data: 2026-08-16
Responsavel: Martiniano + Codex

## Problema

A caixa de entrada permite responder com texto livre sem informar ao usuario se a janela de atendimento de 24 horas do WhatsApp ainda esta aberta. Quando o prazo termina, a Meta pode recusar o envio somente depois da tentativa.

## Resultado esperado

- Mostrar ate quando a conversa aceita resposta livre.
- Atualizar o indicador enquanto a tela permanece aberta.
- Bloquear o texto livre quando nao existe mensagem recebida ou quando o prazo expirou.
- Orientar o usuario a usar um modelo aprovado fora da janela.
- Aplicar a mesma protecao no backend para impedir contorno pela API.

## Fora do objetivo

- Escolher automaticamente qual modelo aprovado deve ser enviado.
- Enviar mensagens sem acao explicita do usuario.
- Alterar as regras de negocio de Agenda, Laudos ou Financeiro.
- Publicar a mudanca em stage ou producao neste ciclo sem autorizacao separada.
