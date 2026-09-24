# Contrato
- Exibir aviso na conversa selecionada somente se needs_reply e (last_agent_id ou pausado) forem verdadeiros.
- Exibir responsável quando atribuído; ausência de nome usa identificação genérica. Não inferir atribuição a partir de rótulo de status de pedido.
- Reusar tempo de espera da fila. Prazo válido de pausa é formatado explicitamente em America/Fortaleza; data inválida é omitida.
- Informar que remover a pausa não libera automação enquanto a conversa estiver atribuída. Sem promessa de retomada automática ao expirar prazo.
- Exibir motivos conhecidos como último encaminhamento registrado, sem afirmar que são a causa de uma pausa manual posterior. Motivos desconhecidos não geram instruções inventadas.
- Janela fechada orienta usar modelos no fluxo correspondente; nenhuma nova ação de envio ou retomada.
- Atualização e troca de conversa reutilizam proteções existentes; aviso some quando pendência encerra ou quando não há pausa nem atribuição.
- Não há alteração de API, banco, configuração, piloto ou pausas existentes. Este é um aviso na central aberta, não uma notificação push nem um monitor em segundo plano.
