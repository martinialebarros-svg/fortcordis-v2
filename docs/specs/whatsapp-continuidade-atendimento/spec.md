# Contrato

## Assumir atendimento

- POST `/api/v1/whatsapp/bot/atendimentos/assumir` recebe conversation_id numérico e telefone; exige os papéis já habilitados no módulo.
- Valida conversa por telefone e resolve um único atendente ativo pelo email do usuário autenticado. Sem correspondência, 409; contato incompatível, 404.
- Bloqueia pedidos abertos da conversa com `FOR UPDATE` e recarrega snapshots. Outro responsável em qualquer pedido impede claim, 409. Claim remoto usa `only_if_unassigned=true`, impedindo transferência concorrente.
- Atribui todos os pedidos abertos livres ao usuário e pausa o bot; repetir não duplica histórico. A ação `assumir` de um pedido chama a mesma coordenação.
- Não há transação distribuída: falha remota incerta não altera pedidos; falha do commit local após claim retorna 503 explícito. Repetir reconcilia; nunca desfaz o claim cegamente. O claim remoto continua bloqueando o bot.
- Botão `Assumir atendimento` aparece na conversa e no pedido. Para conversa já atribuída ao próprio usuário, `Sincronizar pedidos` permite recuperação. Transferência a outro atendente e liberação continuam controles explícitos existentes; não transferem pedidos silenciosamente.

## Continuidade

- Encaminhamento de nova coleta notifica a equipe e marca pending, sem iniciar pausa de 12h. Não remove pausas anteriores. Pedido explícito de humano, emergência e falha de envio continuam pausando.
- Worker e entrega revalidam existência de pedido aberto sob responsabilidade humana. A atribuição remota continua protegida pela revisão da conversa no Node.
- Consulta administrativa de andamento mostra último pedido do contato na clínica resolvida. Se vinculado, lê status e horário atual da agenda da mesma clínica, em Fortaleza. Nunca usa preferência como reserva.
- Pedido de alteração/cancelamento vira complemento literal no histórico e alerta interno, sem modificar cadastros, resumo original ou agenda. Lock com refresh preserva concorrência; job_id deduplica. Registro ocorre antes de enviar a resposta e é confirmado no commit do estado durável de envio.
- Novo pedido explícito inicia coleta vazia com fila_anterior_id, sem duplicar o anterior. Confirmações reconhecidas são determinísticas e exigem resumo enviado e dados completos. Pergunta de status não substitui snapshot da coleta.
- Mensagens fragmentadas: até cinco textos anteriores contíguos em dois minutos, máximo 4000 caracteres no conjunto. Para em resposta própria, mídia, timestamp ausente ou fora da janela; reavalia emergência/humano. A expressão “sem respirar” também encaminha para alerta humano, equivalente ao termo já existente “nao esta respirando”; não gera diagnóstico. Chave de envio continua ligada ao último inbound, e atualização de conversa invalida envio obsoleto.

## Limites e operação

Sem migração, credenciais ou alteração de configuração. Rollback por reversão do código preserva histórico já gravado. Atribuições humanas e pausas existentes permanecem. Para devolver um atendimento completo ao bot, equipe deve liberar pedido/conversa e retomar explicitamente o bot. Acompanhamento não envia preços/horários inventados nem orientação clínica. Simulação do gerador permanece sem efeitos colaterais.

## Clareza dos textos após teste real

A confirmação dos dados é breve, mantém a verificação de disponibilidade pela equipe e deixa explícito que não há reserva. O reconhecimento de um complemento informa revisão da mudança solicitada, sem introduzir cancelamento quando o cliente apenas corrige uma preferência. O aviso de silêncio informa que o atendimento automático está pausado, sem afirmar que houve resposta humana quando a origem pode ser uma atribuição ou pausa manual. As regras de transição, revisão humana e persistência permanecem iguais.
