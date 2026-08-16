# Spec - whatsapp-financeiro-cobranca-recibo-pdf

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: ready-for-release-user-confirmed-meta-approved

## 1) Requisitos funcionais

- RF-001: a cobranca individual informa destinatario, OS, servico, data do atendimento, tutor, pet e valor.
- RF-002: o Financeiro envia uma unica cobranca oficial para duas ou mais OS pendentes do mesmo destinatario.
- RF-003: a cobranca consolidada informa quantidade, total e uma lista resumida com OS, data, servico, tutor, pet e valor.
- RF-004: OS de destinatarios diferentes nao podem ser combinadas no mesmo envio.
- RF-005: o modal de recebimento individual oferece a opcao de enviar o recibo PDF pelo WhatsApp oficial apos a baixa.
- RF-006: o modal de recebimento em lote oferece um unico recibo PDF consolidado quando todas as OS pertencem ao mesmo destinatario.
- RF-007: o recibo PDF individual e consolidado reutiliza o gerador oficial do Financeiro.
- RF-008: o PDF contem numero da OS, data do atendimento, servico, tutor e pet, alem dos dados financeiros ja existentes.
- RF-009: o servico WhatsApp faz upload do PDF na Cloud API e usa o ID de midia no cabecalho de documento do modelo aprovado.
- RF-010: mensagens e documentos enviados sao persistidos na caixa de entrada com referencia das OS.
- RF-011: cada envio exige chave de idempotencia e nao repete uma entrega ja concluida.
- RF-012: falha no envio do recibo posterior a baixa nao desfaz o recebimento; a interface informa separadamente o resultado financeiro e o resultado do WhatsApp.
- RF-013: o recibo exibe a logomarca oficial e prioriza a assinatura/carimbo padrao da empresa; a assinatura pessoal do operador e usada apenas se o carimbo institucional nao estiver configurado.

## 2) Modelos Meta

| Chave | Nome Meta | Cabecalho | Variaveis de corpo | Situacao |
| --- | --- | --- | ---: | --- |
| `pendingPaymentReminder` | `lembrete_pagamento_pendente_detalhado` | nenhum | 7 | aprovado conforme confirmacao operacional - ID `1265598002271332` |
| `pendingPaymentReminderBulk` | `lembrete_pagamento_pendente_multiplas_os` | nenhum | 4 | aprovado conforme confirmacao operacional - ID `1574210064240409` |
| `receiptPdf` | `recibo_pagamento_pdf` | documento | 7 | aprovado conforme confirmacao operacional - ID `1025876410335393` |
| `receiptPdfBulk` | `recibo_pagamento_pdf_multiplas_os` | documento | 3 | aprovado conforme confirmacao operacional - ID `940165775772306` |

### 2.1 Cobranca individual

`Ola, {{1}}. A OS {{2}}, referente ao servico {{3}}, realizado em {{4}}, para o tutor {{5}} e o pet {{6}}, continua pendente no valor de {{7}}. Se o pagamento ja foi realizado, desconsidere esta mensagem.`

Botoes: `Ja paguei`; `Falar com financeiro`.

### 2.2 Cobranca consolidada

`Ola, {{1}}. Identificamos {{2}} ordens de servico pendentes, no total de {{3}}. Detalhamento: {{4}}. Se o pagamento ja foi realizado, desconsidere esta mensagem.`

Botoes: `Ja paguei`; `Falar com financeiro`.

### 2.3 Recibo PDF individual

Cabecalho: documento PDF.

`Ola, {{1}}. Confirmamos o recebimento da OS {{2}}, referente ao servico {{3}}, realizado em {{4}}, para o tutor {{5}} e o pet {{6}}, no valor de {{7}}. O recibo detalhado esta anexado em PDF.`

Botao: `Falar com financeiro`.

### 2.4 Recibo PDF consolidado

Cabecalho: documento PDF.

`Ola, {{1}}. Confirmamos o recebimento de {{2}} ordens de servico, no total de {{3}}. O recibo consolidado com OS, datas, servicos, tutores e pets esta anexado em PDF.`

Botao: `Falar com financeiro`.

## 3) Requisitos nao funcionais

- NFR-001 (privacidade): o envio usa somente contatos cadastrados da clinica ou tutor vinculados as OS.
- NFR-002 (integridade): apenas OS `Pendente` entram em cobranca e apenas OS `Pago` entram em recibos.
- NFR-003 (arquivo): aceitar somente PDF com assinatura `%PDF`, nome seguro e limite de 8 MiB.
- NFR-004 (idempotencia): hash inclui template, destino, OS, parametros e conteudo do PDF.
- NFR-005 (observabilidade): persistir ID da midia, ID da mensagem, hash do arquivo e referencias das OS sem gravar o binario.
- NFR-006 (falha fechada): divergencia de destinatario, variaveis, botoes ou cabecalho falha antes do envio da mensagem.
- NFR-007 (janela): recibos usam template com documento, permitindo envio iniciado pela empresa sem depender da janela de texto livre.
- NFR-008 (governanca): nenhuma publicacao acontece antes da aprovacao e identificacao dos modelos na WABA correta.
- NFR-009 (cutover): o modelo ativo `lembrete_pagamento_pendente` de quatro variaveis permanece
  disponivel ate a publicacao do novo modelo detalhado, evitando indisponibilidade durante a aprovacao.

## 4) Criterios de aceitacao

- CA-001: testes validam os 11 modelos, as novas quantidades e cabecalhos.
- CA-002: payload de cobranca individual leva os sete campos na ordem aprovada.
- CA-003: cobranca consolidada rejeita menos de duas OS, estados invalidos e destinatarios divergentes.
- CA-004: upload do PDF ocorre antes do envio do template e o ID da midia compoe o cabecalho.
- CA-005: PDF invalido ou acima do limite nao chega a Cloud API.
- CA-006: recebimento individual e em lote exibem a opcao de envio do PDF e preservam a baixa em falha posterior.
- CA-007: PDF individual e consolidado contem OS, data, servico, tutor e pet.
- CA-008: suites Python e Node, TypeScript, lint, build e guardrail SDD passam.
- CA-009: o PDF de recibo inclui a logomarca e a assinatura/carimbo configurados, com o carimbo institucional prevalecendo sobre a assinatura pessoal.
