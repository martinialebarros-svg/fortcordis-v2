# Plano

1. Identificar a origem domiciliar pelo agendamento vinculado ao laudo.
2. Mostrar a acao apenas para laudo finalizado ou liberado.
3. Validar no backend paciente, tutor, numero cadastrado e PDF original/gerado.
4. Enviar o documento pela integracao interna do WhatsApp. Dentro da janela de 24 horas, usar o envio existente; fora dela, usar modelo de utilidade com cabecalho PDF quando estiver aprovado pela Meta. Preservar chave de idempotencia.
5. Registrar auditoria e validar os caminhos de recusa e sucesso sem envio real.
6. Submeter o modelo `laudo_domiciliar_pdf_tutor` (pt_BR, Utilidade, cabecalho DOCUMENT) a aprovacao da Meta antes de habilitar o envio fora da janela. O texto tem duas variaveis: nome do tutor e nome do pet.
