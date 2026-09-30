# Especificacao

- `GET /laudos` informa `atendimento_domiciliar` a partir de `Agendamento.origem_atendimento`.
- Em laudo domiciliar finalizado, a lista mostra a acao de enviar PDF ao tutor. A confirmacao explica o destinatario e pede que o operador confirme a autorizacao de contato.
- `POST /laudos/{id}/whatsapp-tutor` aceita `idempotency_key`; o servidor nunca aceita um destinatario arbitrario. O numero e obtido de `Tutor.whatsapp` vinculado ao `Paciente` e conferido com o tutor do agendamento quando este existe.
- PDF externo usa o anexo original. Os demais tipos usam `render_laudo_pdf`. PDF invalido ou acima de 8 MiB e recusado antes de chamar a Meta.
- O servico WhatsApp exige token interno, conversa preexistente e ultima mensagem recebida ha menos de 24 horas. Fora dessa janela, retorna conflito e nao envia. Nao existe modelo de documento de laudo aprovado para envio fora da janela.
- A tabela `report_pdf_messages` reserva cada chave uma vez. Repeticao concluida para o mesmo laudo, numero e nome do arquivo retorna o mesmo identificador; falha definitiva permite tentar novamente com a mesma chave. Tentativa pendente ou incerta bloqueia novo envio. O operador deve verificar a conversa antes de tentar novamente com nova chave.
- A resposta de sucesso indica aceite pela API da Meta, nao leitura pelo tutor. A auditoria armazena somente os ultimos quatro digitos do destinatario.
