# Especificacao

- `GET /laudos` informa `atendimento_domiciliar` a partir de `Agendamento.origem_atendimento`.
- Em laudo domiciliar finalizado, a lista mostra a acao de enviar PDF ao tutor. A confirmacao explica o destinatario e pede que o operador confirme a autorizacao de contato.
- `POST /laudos/{id}/whatsapp-tutor` aceita `idempotency_key`; o servidor nunca aceita um destinatario arbitrario. O numero e obtido de `Tutor.whatsapp` vinculado ao `Paciente` e conferido com o tutor do agendamento quando este existe.
- PDF externo usa o anexo original. Os demais tipos usam `render_laudo_pdf`. PDF invalido ou acima de 8 MiB e recusado antes de chamar a Meta.
- O servico WhatsApp exige token interno. Na janela de 24 horas, o documento comum usa conversa preexistente. Fora da janela, o backend tenta `homeReportPdf` em `/automation/document-templates`, usando o mesmo PDF e os nomes do tutor e paciente em um modelo de Utilidade com cabecalho DOCUMENT. O modelo tem gate por ambiente: `WHATSAPP_HOME_REPORT_TEMPLATE_ENABLED=true` so deve ser configurado depois de aprovado na respectiva conta Meta. Com o gate fechado, nao faz upload nem envia.
- A chave de idempotencia concluida no envio comum retorna o mesmo resultado mesmo depois de a janela fechar. A verificacao do conteudo inclui hash do PDF. Tentativa pendente ou incerta nao muda para o modelo automaticamente.
- O modelo da clinica, `portalReportLink`, nao e enviado ao tutor porque seu texto e seu link concedem acesso ao destinatario clinica.
- O modelo `laudo_domiciliar_pdf_tutor` esta Ativo nas WABAs de teste e producao desde 2026-10-03. Os workflows de deploy ativam o gate por ambiente somente apos a validacao da identidade Meta do runtime; o catalogo registra o ID de producao, enquanto o envio usa o nome do modelo.
- A tabela `report_pdf_messages` reserva cada chave uma vez. Repeticao concluida para o mesmo laudo, numero e nome do arquivo retorna o mesmo identificador; falha definitiva permite tentar novamente com a mesma chave. Tentativa pendente ou incerta bloqueia novo envio. O operador deve verificar a conversa antes de tentar novamente com nova chave.
- A resposta de sucesso indica aceite pela API da Meta, nao leitura pelo tutor. A auditoria armazena somente os ultimos quatro digitos do destinatario.
