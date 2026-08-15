# Spec - financeiro-baixa-lote-os-pendentes

Data: 2026-06-13
Responsavel: Martiniano + Codex
Status: implemented

## 1) Escopo funcional

Adicionar baixa em lote para ordens de servico pendentes no modulo Financeiro.

## 2) Requisitos funcionais

- RF-001: usuario deve conseguir selecionar OS pendentes para baixa em lote.
- RF-002: usuario deve conseguir selecionar todas as OS pendentes visiveis na aba Ordens de Servico.
- RF-003: usuario deve conseguir receber todas as OS pendentes de uma clinica no card de Cobrancas por Clinica.
- RF-004: modal de baixa em lote deve exibir quantidade, lista resumida e total das OS selecionadas.
- RF-005: modal deve permitir informar data de recebimento e uma ou mais formas de pagamento.
- RF-006: total informado deve bater exatamente com o total das OS selecionadas.
- RF-007: sistema deve ratear os pagamentos informados entre as OS selecionadas preservando o valor final de cada OS.
- RF-008: apenas OS com status `Pendente` podem entrar na baixa em lote.
- RF-009: apos sucesso, a selecao de baixa deve ser limpa e os dados financeiros recarregados.

## 3) Requisitos nao funcionais

- NFR-001: baixa em lote deve reaproveitar o endpoint individual `/ordens-servico/{id}/receber` para preservar regras existentes.
- NFR-002: fluxo deve manter os controles existentes de recibo para OS recebidas sem misturar selecoes.
- NFR-003: UI deve informar claramente total selecionado e diferencas entre total das OS e total informado.

## 4) Contratos tecnicos

### Frontend

- Tela afetada: `frontend/app/financeiro/page.tsx`
- Estados novos:
  - `osSelecionadasBaixa`
  - `modalReceberLoteOSIds`
  - `recebendoLoteOS`
- Acoes:
  - `Selecionar pendentes`
  - `Receber selecionadas`
  - `Receber pendentes` por clinica

### Backend

- Sem endpoint novo neste ciclo.
- O frontend chama `/ordens-servico/{id}/receber` para cada OS selecionada, com pagamentos rateados.

## 5) Criterios de aceitacao

- CA-001: usuario consegue selecionar 2+ OS pendentes e abrir o modal de baixa em lote.
- CA-002: modal inicia com total das OS preenchido na forma de pagamento padrao.
- CA-003: ao confirmar com valor igual ao total, todas as OS selecionadas passam para `Pago`.
- CA-004: ao informar valor menor ou maior que o total, confirmacao fica bloqueada e mostra a diferenca.
- CA-005: OS pagas continuam usando selecao de recibo, e OS pendentes usam selecao de baixa.
- CA-006: baixa por card de clinica recebe apenas as OS pendentes daquele grupo.
