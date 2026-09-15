# Plan - financeiro-baixa-lote-os-pendentes

Data: 2026-06-13
Responsavel: Martiniano + Codex
Status: implemented

## 1) Implementacao

- Localizar fluxo atual de recebimento individual de OS.
- Criar selecao separada para OS pendentes.
- Adicionar acoes de selecao e baixa em lote na aba Ordens de Servico.
- Adicionar acao de receber pendentes no card de Cobrancas por Clinica.
- Criar modal de baixa em lote com resumo, data e formas de pagamento.
- Ratear pagamentos informados por OS selecionada e chamar o endpoint individual existente.
- Recarregar dados e limpar selecao apos a baixa.

## 2) Validacao

- Executar lint do arquivo financeiro.
- Revisar manualmente os estados bloqueados do modal.
- Validar que a selecao de recibos de OS pagas segue independente da selecao de baixa.

## 3) Riscos

- Como o backend nao tem endpoint atomico em lote, falhas parciais podem acontecer se uma OS falhar apos outras terem sido recebidas.
- Rateio de multiplas formas de pagamento pode gerar ajustes de centavos na ultima OS para fechar o total informado.
