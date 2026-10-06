# Intent — OS no upload de eletro sem Agenda

Data: 2026-10-05
Status: implementado localmente; não publicado

O profissional recebe o eletro de uma clínica parceira, emite seu laudo e
envia o PDF pelo módulo Laudos. Hoje esse fluxo funciona sem agendamento,
mas não oferece o registro da cobrança no Financeiro.

Permitir escolher a geração de uma ordem de serviço durante esse upload,
com paciente, clínica, data, serviço e preço rastreáveis, sem criar um
agendamento artificial. A opção deve ser explícita e preservar o upload
simples quando desmarcada.

Publicação em stage/produção e envio de mensagens não fazem parte desta
implementação local.
