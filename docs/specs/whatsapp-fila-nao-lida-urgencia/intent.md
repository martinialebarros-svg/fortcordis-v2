# Intent - whatsapp-fila-nao-lida-urgencia

## Problema

Na fila da Central de Atendimento WhatsApp, não havia nenhum sinal de quais
conversas estavam aguardando resposta há mais tempo. Com centenas de
conversas na fila, um contato podia ficar esquecido sem que ninguém
percebesse — a única ordenação era por atividade recente
(`last_activity_at DESC`), que não distingue "conversa nova sem resposta" de
"conversa já respondida, só com atividade recente".

## Objetivo

Sinalizar visualmente conversas não lidas e trazê-las para o topo da fila,
priorizando quem está esperando há mais tempo.

## Escopo inicial

- coluna `last_seen_at` em `conversations`, marcada quando um atendente abre
  a conversa;
- campo calculado `unread` (não lida = há mensagem recebida do cliente mais
  recente que a última vez que alguém abriu a conversa);
- nova ordenação da fila: não lidas primeiro, entre elas as mais antigas
  esperando primeiro;
- indicador visual (ponto) na lista de conversas.

## Fora de escopo

- rastreamento de leitura por atendente individual (é um modelo
  compartilhado/global — reflete o mesmo modelo de fila compartilhada já
  usado em `claim`/`unclaim`, sem sessão por atendente confiável hoje);
- contagem de mensagens não lidas (só um indicador binário lida/não lida por
  conversa, não um contador numérico);
- notificação sonora ou push quando uma conversa fica não lida.

## Riscos e decisões

- "Não lida" é calculado como `last_inbound_at > last_seen_at` (ou
  `last_seen_at IS NULL`) — puramente derivado dos dois timestamps já
  existentes/adicionados, sem estado extra por atendente.
- Marcar como "vista" acontece na carga inicial da conversa (ao selecioná-la)
  e de novo se uma mensagem nova chegar enquanto ela já está aberta (detectado
  comparando o `last_inbound_at` da última vez visto localmente); nunca a
  cada poll silencioso de 5s sem mudança de conteúdo, para não gerar
  escritas desnecessárias no banco.
- Reabrir a mesma conversa depois de outro atendente já tê-la marcada como
  vista não a torna "não lida" de novo — o modelo é intencionalmente
  compartilhado.
