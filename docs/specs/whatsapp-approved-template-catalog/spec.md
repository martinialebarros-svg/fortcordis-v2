# Spec - whatsapp-approved-template-catalog

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: local-implemented

## 1) Requisitos funcionais

- RF-001: o servico mantem um catalogo dos oito modelos de utilidade aprovados na WABA Fort Cordis.
- RF-002: cada entrada registra chave interna, nome Meta, ID operacional, corpo e ordem dos botoes.
- RF-003: o idioma de todos os modelos catalogados e `pt_BR`.
- RF-004: o gerador de payload rejeita quantidade divergente de variaveis de corpo.
- RF-005: o gerador de payload rejeita quantidade divergente de payloads de resposta rapida.
- RF-006: modelos sem botao, como `laudo_disponivel_portal`, geram somente o componente de corpo.
- RF-007: a mensagem persistida da reserva usa o mesmo texto aprovado na Meta.
- RF-008: o backend principal envia modelos aprovados ao servico WhatsApp por uma rota interna autenticada.
- RF-009: todo envio novo exige chave de idempotencia e persiste o resultado antes de permitir repeticao.
- RF-010: a Agenda oferece envio explicito de lembrete, alteracao, cancelamento e dados pendentes somente para estados compativeis.
- RF-011: o aviso de laudo so pode ser enviado depois da liberacao no Portal e para um WhatsApp cadastrado da clinica vinculada.
- RF-012: o aviso de recibo so pode ser enviado para uma OS `Pago`.
- RF-013: o lembrete de pagamento so pode ser enviado para uma unica OS `Pendente`.
- RF-014: em atendimento domiciliar, recibo e cobranca usam os contatos cadastrados do tutor; em clinica parceira, usam os contatos da clinica.
- RF-015: a interface preserva o compartilhamento manual de cobrancas agrupadas, pois o modelo aprovado representa somente uma OS.
- RF-016: todo envio explicito registra auditoria sem persistir o numero completo nos detalhes.

## 2) Catalogo aprovado

| Chave interna | Nome Meta | ID Meta | Variaveis | Respostas rapidas |
| --- | --- | --- | ---: | ---: |
| `reservation` | `reserva_de_agendamento` | `1850190569695780` | 5 | 2 |
| `appointmentReminder` | `lembrete_de_agendamento` | `2196951517539589` | 4 | 2 |
| `appointmentChange` | `alteracao_de_agendamento` | `1325207582741137` | 4 | 2 |
| `appointmentCancellation` | `cancelamento_de_agendamento` | `1072585772303343` | 4 | 2 |
| `appointmentMissingData` | `dados_pendentes_agendamento` | `2094851784715594` | 4 | 2 |
| `portalReportAvailable` | `laudo_disponivel_portal` | `1682393009502350` | 3 | 0 |
| `receiptAvailable` | `recibo_disponivel` | `934407008986859` | 4 | 1 |
| `pendingPaymentReminder` | `lembrete_pagamento_pendente` | `1727741245180854` | 4 | 2 |

## 3) Requisitos nao funcionais

- NFR-001 (fail closed): inconsistencias de variaveis ou botoes falham antes da requisicao externa.
- NFR-002 (privacidade): o catalogo contem apenas textos e IDs publicos; nao contem token, App Secret ou dados reais de clientes.
- NFR-003 (governanca): a aprovacao do modelo nao habilita automaticamente gatilhos de envio.
- NFR-004 (custo): novos envios iniciados pela empresa dependem de acao explicita ou automacao aprovada separadamente.
- NFR-005 (compatibilidade): o fluxo atual de reserva e sua configuracao por ambiente permanecem validos.
- NFR-006 (idempotencia): reutilizar uma chave com o mesmo conteudo retorna o envio anterior; conteudo divergente ou entrega ambigua exige revisao operacional.
- NFR-007 (destino): o usuario nao pode informar um telefone que nao esteja cadastrado no destinatario vinculado ao registro.
- NFR-008 (observabilidade): mensagens enviadas sao persistidas na conversa e associadas ao tipo e ID do objeto de dominio.

## 4) Fora de escopo

- agendamento automatico de lembretes;
- envio automatico ao liberar laudo, emitir recibo ou detectar pendencia;
- alteracao automatica de Agenda, Portal ou Financeiro pelas respostas dos sete novos modelos; as respostas continuam visiveis na caixa de entrada;
- modelo de autenticacao, que continua indisponivel para esta WABA;
- publicacao em producao.

## 5) Criterios de aceitacao

- CA-001: TypeScript compila em modo estrito.
- CA-002: teste cobre os oito modelos e o idioma `pt_BR`.
- CA-003: teste prova payload sem botao e payload com dois botoes.
- CA-004: teste prova falha local para quantidade incorreta de variaveis.
- CA-005: teste existente de `reserva_de_agendamento` continua passando.
- CA-006: quality gate de stage executa o novo teste de catalogo.
- CA-007: o contrato interno generico exige autenticacao, tipo de objeto compativel, quantidade exata de variaveis e idempotencia.
- CA-008: Agenda, Portal e Financeiro exibem apenas acoes explicitas e respeitam os estados exigidos.
- CA-009: cobranca agrupada nao usa indevidamente o modelo de uma unica OS.
- CA-010: validacoes Python, TypeScript, lint, build e SDD passam localmente.
