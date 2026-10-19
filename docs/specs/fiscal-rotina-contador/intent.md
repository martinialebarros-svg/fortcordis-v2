# Intenção — rotina de preparação para o contador

O usuário confirmou que os relatórios de agosto e setembro já foram enviados ao contador. O próximo ciclo é outubro, com preparação semanal às sextas-feiras no fim do dia e exceções por serviço para clínicas que condicionam o pagamento ao recebimento da nota, começando pela Vet Fauna.

Implementar e publicar somente em stage uma fila de preparação e acompanhamento manual. O sistema reúne informações, conserva a competência e evita reutilizar OS em pacotes; o contador continua responsável pela emissão e o usuário pelos encaminhamentos. Não emitir notas, enviar mensagens, executar remessas ou criar rotinas automáticas de envio.

Sexta-feira às 18h em America/Fortaleza é a referência adotada para o fim do dia. O horário organiza o corte e a fila: não cria um cron, disparo ou pacote sem conferência humana.

## Revisão de 18/10/2026

O usuário alterou a referência para domingo às 17h de Fortaleza, incluindo o sábado no fechamento. Mantêm-se preparação e encaminhamento manuais, Vet Fauna por serviço e preservação dos pacotes existentes. Esta revisão substitui o horário original descrito acima.
