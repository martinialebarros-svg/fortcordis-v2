# Intent - financeiro-baixa-lote-os-pendentes

Data: 2026-10-10
Responsavel: Martiniano + Codex
Status: implementado e validado localmente

## 1) Contexto

A baixa em lote existente chamava o recebimento individual para cada OS e continuava depois de uma falha. Um pagamento ou cancelamento concorrente podia produzir baixas e recibo parciais, mesmo com a protecao individual contra OS ja paga.

## 2) Objetivo

Permitir baixa em lote de OS pendentes a partir das telas de cobranca e ordens de servico, com uma unica confirmacao operacional de data e forma de pagamento e persistencia integral: todas as baixas sao gravadas ou nenhuma.

## 3) Resultado esperado

- Usuario seleciona varias OS pendentes visiveis ou todas as pendentes de uma clinica.
- Sistema exibe total consolidado e lista das OS que serao recebidas.
- Usuario informa uma ou mais formas de pagamento e a data de recebimento.
- Sistema registra a baixa de cada OS usando o fluxo ja existente de recebimento, preservando auditoria, transacoes vinculadas, taxas e cancelamento de lembretes.

## 4) Fora de escopo

- Criar um novo modelo contabil de transacao unica vinculada a varias OS.
- Aplicar credito de cliente em baixa em lote.
- Envio real de mensagens de teste sem destinatario autorizado.
- Publicacao em producao; esta entrega visa homologacao.
