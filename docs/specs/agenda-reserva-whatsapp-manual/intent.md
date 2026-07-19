# Intent - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: approved

## 1) Problema atual

A operacao precisa avisar clinicas ou tutores quando um horario e salvo como `Reservado`, mas a conta oficial de WhatsApp Business ainda esta em verificacao pela Meta. Sem um apoio no fluxo da agenda, a secretaria precisa redigir a mensagem fora do sistema e pode omitir horario, prazo ou regra de liberacao.

## 2) Objetivo

Disponibilizar um fluxo manual e controlado no modal de novo agendamento: a secretaria escolhe o destinatario e o prazo, salva a reserva e recebe uma mensagem pronta para copiar ou abrir no WhatsApp.

## 3) Nao objetivos

- Enviar mensagens automaticamente pela Cloud API.
- Confirmar ou liberar a reserva a partir de respostas recebidas no WhatsApp.
- Expirar automaticamente o status `Reservado` nesta iteracao.

## 4) Contexto e restricoes

- Restricao tecnica: a WABA oficial ainda esta em analise/restrita pela Meta.
- Restricao operacional: o envio e a liberacao apos o prazo continuam sendo acoes humanas.
- Restricao de privacidade: a mensagem nao deve incluir diagnostico, exame ou outros dados clinicos.

## 5) Impacto esperado

- Usuarios impactados: secretaria e administradores da agenda.
- Modulos impactados: modal de novo agendamento.
- Risco de regressao: baixo, pois o fluxo adicional aparece apenas para novas reservas.

## 6) Riscos iniciais

- Telefone ausente ou incorreto pode exigir selecao manual do contato no WhatsApp.
- O destinatario pode interpretar a liberacao como automatica; a interface precisa deixar explicito que o processo ainda e manual.

## 7) Perguntas abertas

- Qual prazo padrao definitivo sera adotado quando a expiracao automatica for implementada?
- A mensagem automatica futura sera enviada para clinica, tutor ou ambos por regra configuravel?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
