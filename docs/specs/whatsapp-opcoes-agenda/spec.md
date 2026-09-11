# Opções de agenda no WhatsApp

## Fluxo

Somente clínicas identificadas no fluxo real do worker recebem opções após confirmar os dados da solicitação. A coleta deve estar completa e seu resumo previamente enviado. Os modos, teto diário, janela de WhatsApp e controle humano existentes continuam aplicados. Simulação sem conversa real mantém o fluxo anterior.

O serviço precisa ter correspondência única e ativa no catálogo, por nome exato ou composição exata dos procedimentos, com duração válida. Combinações mais amplas não substituem o exame pedido. Usa-se `sugerir_horarios_agenda`, origem clínica parceira, ID da clínica resolvida, duração do catálogo, intervalo de 15 minutos e perfil comercial. Não são utilizados os endpoints de criação, reserva, alteração ou de exceções de agenda.

São consultados até sete dias, com até três opções distintas sem risco adicional (risco operacional zero), futuras e com duração compatível. Somente início e fim saem do retorno interno; nomes de pacientes, destinos de terceiros e detalhes da rota não são expostos. Não há criação de usuário técnico ou nova permissão.

## Preferência e limites

Preferências aceitas deterministicamente: sem preferência, qualquer dia, manhã/tarde; hoje, amanhã, dia da semana ou data explícita DD/MM/AAAA, combináveis com manhã/tarde. Datas relativas usam a data original de recebimento, em Fortaleza. Datas passadas e além de 13 dias, horários exatos, exceções em texto livre ou preferências ambíguas ficam para a equipe. Não se presume que “amanhã” signifique manhã. Turnos limitam o intervalo completo do exame.

A mensagem apresenta os candidatos em Fortaleza, orienta a responder com o número e informa ausência de reserva e confirmação final pela equipe. A auditoria `opcoes_agenda` guarda clínica, serviço/duração, versão do pedido, início/fim e expiração. Não altera o resumo original da coleta.

## Escolha e revalidação

Aceita apenas um número de 1 a 9, opcionalmente precedido de “opção”, “quero a opção” ou “prefiro a opção”; perguntas ou frases com ressalvas não escolhem implicitamente. O índice deve existir na última oferta enviada e íntegra da mesma identidade, clínica e conversa, vinculada ao pedido atual. Rascunho não enviado e oferta editada pelo atendente não autorizam escolha pela numeração original. Expiração de 15 minutos, mudança de versão, serviço inativo/duração alterada, pedido atribuído ou concluído invalidam a escolha.

A opção escolhida passa novamente pela mesma sugestão operacional do dia. Ausência na nova consulta significa indisponibilidade, mesmo que ainda possa existir como alternativa fora da lista retornada: comportamento conservador. A resposta só reconhece a escolha após a reconsulta; ela não garante que o horário continuará livre. A equipe deve revalidar no fluxo normal ao agendar.

A preferência revalidada é persistida pelo worker como complemento do cliente, com alerta interno e versão incrementada, usando a deduplicação por job e lock existentes. O registro preserva o pedido, seu resumo e todos os agendamentos. Se a versão/responsável mudar entre reconsulta e persistência, a escolha fica como observação para revisão, sem destaque de horário aceito, e a resposta informa a mudança. Nova correção invalida a lista e remove o destaque da escolha anterior na interface. Uma escolha não deve ser repetida com base em uma oferta já consumida.

“Ver horários”, “consultar horários”, “quais horários”, “quais horários disponíveis”, “outras opções” e “ver opções” permitem nova consulta enquanto o pedido aguarda equipe e não tem complementos pendentes. Depois de uma correção/escolha registrada, novas mudanças seguem para revisão da equipe.

## Controles e falhas

Resposta determinística passa pelos guardrails com horários ancorados no retorno da agenda. Oferta expirada enquanto aguardava envio não é enviada automaticamente. Se não houver serviço único, preferência interpretável ou opções seguras, o pedido continua com a equipe, sem afirmar que a agenda inteira está indisponível. Falhas de consulta HTTP/timeout seguem o mesmo caminho. Falha de banco continua sendo tratada pelo mecanismo operacional existente.

Nenhuma migração, segredo ou integração externa nova. A oferta não é um bloqueio transacional da agenda; a reserva permanece exclusivamente no fluxo humano existente.
