# Spec - financeiro-baixa-lote-os-pendentes

Data: 2026-06-13
Responsavel: Martiniano + Codex
Status: ready-for-release-user-confirmed-meta-approved

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
- RF-010: o modal de baixa individual oferece o envio opcional do recibo PDF oficial depois do
  recebimento.
- RF-011: a baixa em lote oferece um unico recibo PDF consolidado quando todas as OS pertencem ao
  mesmo destinatario e possuem um WhatsApp cadastrado em comum.
- RF-012: falha no envio posterior do recibo nao desfaz OS ja recebidas e deve ser comunicada
  separadamente do resultado financeiro.

## 3) Requisitos nao funcionais

- NFR-001: baixa em lote deve reaproveitar o endpoint individual `/ordens-servico/{id}/receber` para preservar regras existentes.
- NFR-002: fluxo deve manter os controles existentes de recibo para OS recebidas sem misturar selecoes.
- NFR-003: UI deve informar claramente total selecionado e diferencas entre total das OS e total informado.
- NFR-004: o PDF enviado deve reutilizar o gerador oficial de recibos, sem gerar documento divergente
  no frontend.
- NFR-005: o envio oficial depende de modelo Meta aprovado com cabecalho de documento.

## 4) Contratos tecnicos

### Frontend

- Tela afetada: `frontend/app/financeiro/page.tsx`
- Estados novos:
  - `osSelecionadasBaixa`
  - `modalReceberLoteOSIds`
  - `recebendoLoteOS`
  - `enviarReciboPdfWhatsAppAposRecebimento`
- Acoes:
  - `Selecionar pendentes`
  - `Receber selecionadas`
  - `Receber pendentes` por clinica

### Backend

- Sem endpoint novo neste ciclo.
- O frontend chama `/ordens-servico/{id}/receber` para cada OS selecionada, com pagamentos rateados.
- Depois das baixas concluidas, o frontend pode chamar `/{id}/whatsapp/recibo-pdf` ou
  `/whatsapp/recibos-pdf` para enviar o documento individual ou consolidado.

## 5) Criterios de aceitacao

- CA-001: usuario consegue selecionar 2+ OS pendentes e abrir o modal de baixa em lote.
- CA-002: modal inicia com total das OS preenchido na forma de pagamento padrao.
- CA-003: ao confirmar com valor igual ao total, todas as OS selecionadas passam para `Pago`.
- CA-004: ao informar valor menor ou maior que o total, confirmacao fica bloqueada e mostra a diferenca.
- CA-005: OS pagas continuam usando selecao de recibo, e OS pendentes usam selecao de baixa.
- CA-006: baixa por card de clinica recebe apenas as OS pendentes daquele grupo.
- CA-007: recebimento individual oferece recibo PDF oficial com OS, data, servico, tutor e pet.
- CA-008: recebimento de varias OS do mesmo destinatario oferece um unico PDF consolidado.
- CA-009: falha no WhatsApp posterior a baixa mantem o recebimento e mostra aviso separado.
