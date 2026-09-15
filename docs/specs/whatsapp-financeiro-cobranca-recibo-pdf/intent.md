# Intent - whatsapp-financeiro-cobranca-recibo-pdf

Data: 2026-08-16
Responsavel: Martiniano + Codex

## Problema

O lembrete oficial de cobranca de uma OS nao informa claramente servico, data do atendimento e tutor. Quando existem varias OS pendentes para o mesmo destinatario, a interface abandona o canal oficial e abre o WhatsApp manualmente. Depois de registrar um recebimento, o fluxo oficial envia somente texto e nao oferece o recibo PDF ja gerado pelo Financeiro.

## Objetivo

Permitir cobrancas individuais e consolidadas com contexto operacional suficiente e oferecer, no proprio registro do recebimento, o envio oficial de recibo PDF individual ou consolidado.

## Resultado esperado

- cobranca individual identifica OS, servico, data, tutor, pet e valor;
- varias OS do mesmo destinatario sao enviadas em um unico modelo oficial;
- o recebimento pode enviar imediatamente um PDF com OS, datas, servicos, tutores e pets;
- documentos usam upload de midia da Cloud API e template de utilidade com cabecalho de documento;
- destinatario, estado da OS, idempotencia, tamanho e tipo do arquivo sao validados antes do envio;
- a baixa financeira permanece concluida mesmo se o envio posterior do recibo falhar, com aviso explicito ao usuario.

## Dependencia externa

Os quatro modelos novos foram confirmados pelo responsavel como aprovados na WABA Fort Cordis e
estao registrados no catalogo pelos respectivos IDs Meta. A publicacao foi autorizada em
2026-08-16. O modelo anterior de cobranca permanece preservado no historico para permitir rollback
do snapshot sem editar o contrato aprovado em producao.
