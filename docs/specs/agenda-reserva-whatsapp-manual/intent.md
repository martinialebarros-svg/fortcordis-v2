# Intent - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: approved

## 1) Problema atual

A operacao precisa avisar clinicas ou tutores quando um horario e reservado ou agendado, mas a conta oficial de WhatsApp Business ainda esta em verificacao pela Meta. Alem disso, uma clinica pode ter mais de um WhatsApp e reservas vencidas nao podem continuar bloqueando a agenda.

## 2) Objetivo

Disponibilizar um fluxo manual e controlado no modal de novo agendamento que:

- use mensagem padronizada para reserva e agendamento;
- adote tres horas como prazo padrao da reserva;
- identifique tutor e paciente quando cadastrados e use `Pendente` quando ausentes;
- permita escolher entre multiplos WhatsApps cadastrados na clinica;
- libere o slot quando a reserva vencer sem confirmacao.

## 3) Nao objetivos

- Enviar mensagens automaticamente pela Cloud API.
- Processar confirmacoes ou recusas recebidas no WhatsApp.
- Enviar diagnostico, exame ou outros dados clinicos na mensagem.

## 4) Contexto e restricoes

- A WABA oficial ainda esta em analise/restrita pela Meta; o clique final de envio permanece humano.
- O sistema precisa preservar o telefone geral da clinica e adicionar uma lista especifica de WhatsApps.
- A expiracao deve respeitar o guardrail de sobreposicao de slots existente no PostgreSQL.

## 5) Impacto esperado

- Usuarios impactados: secretaria e administradores da agenda.
- Modulos impactados: agenda, cadastro de clinicas e migracoes.
- Risco de regressao: medio, pois a entrega inclui contrato de API, banco e duas visoes da agenda.

## 6) Riscos iniciais

- Telefone ausente ou incorreto pode exigir selecao manual do contato no WhatsApp.
- Uma reserva expirada nao pode ser reativada silenciosamente; deve ser criado novo agendamento.
- O modelo atual identifica `Dr Martiniano` e `Cardiologista`; futura operacao multiprofissional exigira configuracao desses campos.

## 7) Definition of Ready

- [x] Problema e objetivo estao claros.
- [x] Prazo padrao definido em tres horas.
- [x] Compatibilidade de contatos antigos definida.
- [x] Expiracao efetiva incluida no escopo.
