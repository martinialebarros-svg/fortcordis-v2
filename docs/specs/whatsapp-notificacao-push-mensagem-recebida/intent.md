# Intent - whatsapp-notificacao-push-mensagem-recebida

## Problema

A Central de Atendimento WhatsApp não avisava ninguém quando chegava uma
mensagem nova — era preciso deixar a aba aberta e olhar a fila
periodicamente. O sistema já tem infraestrutura de push (Web Push/VAPID)
usada por Agenda e Financeiro, mas o módulo WhatsApp nunca se conectou a
ela.

## Objetivo

Disparar uma notificação push do navegador a cada mensagem nova recebida
no WhatsApp, para todo usuário com acesso ao módulo (broadcast, mesmo
padrão de agenda/financeiro hoje — não é por atendente atribuído).

## Escopo inicial

- novo tipo de push `mensagem_recebida` no catálogo institucional
  (`push_notifications.py`), com título/corpo próprios;
- ponte Node → Python reaproveitando o mesmo mecanismo já usado para
  respostas de botão de agenda via WhatsApp (`X-FortCordis-WhatsApp-Token`,
  `API_BACKEND_URL`) — endpoint novo, não uma integração nova;
- disparo síncrono, direto no webhook, para cada mensagem inbound
  persistida (texto, botão, mídia — qualquer tipo), sem bloquear o
  processamento do webhook em caso de falha;
- categoria "WhatsApp" no painel de preferências de push (Configurações →
  Minha conta), mesmo padrão de Agenda/Financeiro.

## Fora de escopo

- notificar só o atendente atribuído à conversa — decisão explícita do
  usuário foi broadcast; não há hoje vínculo formal entre o `agent` do
  módulo WhatsApp e o `usuario` do FortCordis que teria a subscription
  push, então isso ficaria para uma iteração futura caso a decisão mude;
- lembrete de conversa sem resposta por tempo (like o lembrete de OS
  pendente) — só "mensagem recebida" nesta entrega;
- deep-link para a conversa específica ao clicar na notificação — o link
  vai para `/whatsapp-stage` (inbox geral); como a fila já ordena não
  lidas primeiro (spec `whatsapp-fila-nao-lida-urgencia`), a conversa nova
  já aparece no topo sem precisar de deep-link dedicado.

## Riscos e decisões

- **Bug irmão encontrado e corrigido antes de escrever qualquer coisa
  nova**: em `frontend/app/configuracoes/page.tsx`, `alternarTipoPushAgenda`
  reconstruía `notificacoes_push_tipos` filtrando só contra
  `TIPOS_PUSH_AGENDA_OPCOES` e `TIPOS_PUSH_FINANCEIRO_OPCOES` — sem a nova
  lista de WhatsApp, marcar o checkbox teria efeito visual mas seria
  descartado ao salvar. Corrigido incluindo `TIPOS_PUSH_WHATSAPP_OPCOES`
  na reconstrução.
- **Bug real (não corrigido aqui, flagado como tarefa separada)**: durante
  a investigação, achamos que `whatsapp_reserva_resposta` (confirmação de
  agendamento via botão do WhatsApp) nunca foi adicionado ao catálogo de
  ações — hoje esse push não notifica ninguém, silenciosamente. É um fluxo
  diferente (agenda, não atendimento), então foi registrado como tarefa
  separada em vez de misturado nesta entrega.
- Falha ao notificar (rede, backend principal fora do ar) nunca derruba o
  webhook do WhatsApp — o serviço Node loga um aviso e segue; a mensagem
  em si já foi persistida antes da tentativa de notificação.
- Disparo é "fire-and-forget" no lado Node (não aguarda a resposta do
  Python antes de responder ao webhook da Meta) — reduz latência da
  resposta ao webhook, consistente com a exigência de ack rápido da API do
  WhatsApp.
- Usuários que já tinham uma lista customizada de tipos salva em
  `notificacoes_push_tipos` (não usam mais o default "todos os tipos") não
  passam a receber `mensagem_recebida` automaticamente — precisam marcar o
  checkbox novo em Configurações. Comportamento consistente com como
  `financeiro`/`payment_pending` já se comportou quando foi adicionado ao
  catálogo depois de `agenda`.
