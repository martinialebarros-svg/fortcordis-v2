# Intent - financeiro-baixa-lote-os-pendentes

Data: 2026-06-13
Responsavel: Martiniano + Codex
Status: draft

## 1) Contexto

No modulo Financeiro, a equipe consegue receber uma OS pendente por vez. Na operacao real, uma clinica frequentemente paga varias ordens de servico em uma unica transacao, o que torna a baixa individual repetitiva e sujeita a esquecimento.

## 2) Objetivo

Permitir baixa em lote de OS pendentes a partir das telas de cobranca e ordens de servico, com uma unica confirmacao operacional de data e forma de pagamento.

## 3) Resultado esperado

- Usuario seleciona varias OS pendentes visiveis ou todas as pendentes de uma clinica.
- Sistema exibe total consolidado e lista das OS que serao recebidas.
- Usuario informa uma ou mais formas de pagamento e a data de recebimento.
- Sistema registra a baixa de cada OS usando o fluxo ja existente de recebimento, preservando auditoria, transacoes vinculadas, taxas e cancelamento de lembretes.

## 4) Fora de escopo

- Criar um novo modelo contabil de transacao unica vinculada a varias OS.
- Aplicar credito de cliente em baixa em lote.
- Envio automatico de recibo apos a baixa.
