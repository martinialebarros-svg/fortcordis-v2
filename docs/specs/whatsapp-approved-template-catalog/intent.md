# Intent - whatsapp-approved-template-catalog

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: approved

## Problema

A conta WhatsApp Business da Fort Cordis aprovou oito modelos de utilidade em `pt_BR`, mas o
servico mantinha apenas o contrato do modelo `reserva_de_agendamento`. Os demais nomes, quantidades
de variaveis e botoes nao estavam representados no codigo, o que deixava futuras integracoes sujeitas
a payloads divergentes do que a Meta aprovou.

## Resultado esperado

- catalogo unico e tipado dos modelos aprovados;
- validacao local da quantidade de variaveis e respostas rapidas antes de chamar a Graph API;
- corpo renderizado da reserva igual ao texto realmente entregue pela Meta;
- acoes manuais e auditadas para Agenda, aviso de laudo, recibo e cobranca individual;
- nenhum disparo automatico novo sem regra de negocio e opt-in definidos;
- IDs de modelo registrados apenas para rastreabilidade, sem serem enviados como credenciais.
