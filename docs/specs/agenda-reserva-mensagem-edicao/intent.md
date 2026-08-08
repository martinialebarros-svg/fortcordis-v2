# Intent - agenda-reserva-mensagem-edicao

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: approved

## 1) Problema atual

A mensagem padronizada de confirmacao/reserva (spec `agenda-reserva-whatsapp-manual`) so e
construida uma vez, imediatamente apos criar o agendamento (`NovoAgendamentoModal.tsx`, fluxo
`!isEditando`). Quando uma reserva e criada com dados de paciente/tutor pendentes — caso comum
quando a clinica parceira ainda nao informou o animal — a mensagem gerada naquele momento traz
"Pendente" nesses campos. Depois que a clinica informa os dados e a secretaria edita o
agendamento para preencher paciente/tutor, nao existe forma de gerar uma nova mensagem com os
dados atualizados: a secao inteira de destinatario/WhatsApp e a construcao da mensagem ficam
desabilitadas em modo de edicao.

## 2) Objetivo

Permitir que, ao editar um agendamento marcado como reserva, a secretaria gere manualmente (sob
demanda, via botao) uma mensagem de confirmacao atualizada — reaproveitando o mesmo texto
padronizado e os mesmos botoes de copiar/abrir WhatsApp ja existentes no fluxo de criacao — sem
precisar recriar o agendamento.

## 3) Nao objetivos

- Gerar/enviar a mensagem automaticamente ao salvar a edicao (a acao continua manual, via botao).
- Mudar o texto padrao da mensagem ou o fluxo de criacao ja existente.
- Adicionar endpoint/self-service para a clinica parceira preencher os dados do paciente
  diretamente (ideia separada, ainda nao escopada — ver `NEXT_STEPS.md`).
- Expor um botao equivalente fora do modal (ex.: na lista/calendario da agenda).
- Persistir/auditar o clique em "gerar mensagem" (mesmo comportamento do fluxo pos-criacao atual).
- Editar prazo de confirmacao/"marcar como reserva" durante a edicao (permanecem fora de escopo).

## 4) Contexto e restricoes

- Restricoes tecnicas: mudanca 100% frontend; reaproveita `montarMensagemAgendaManual` /
  `montarLinkWhatsAppReserva` (`frontend/lib/agenda-reserva-manual.ts`, inalterado) e a tela de
  mensagem que ja existe em `NovoAgendamentoModal.tsx`.
- Sem WABA oficial ainda (mesma restricao do spec original) — o clique de envio continua manual.
- Nao pode arriscar perda de dados: fechar a tela de mensagem durante a edicao nao pode descartar
  alteracoes nao salvas no formulario.

## 5) Impacto esperado

- Usuarios impactados: secretaria/administradores que usam a agenda.
- Modulos impactados: frontend da agenda (`NovoAgendamentoModal.tsx`).
- Risco de regressao: baixo — mudanca aditiva, isolada ao componente, sem alterar contratos de API.

## 6) Riscos iniciais

- Se o fechamento da tela de mensagem continuasse chamando `onClose()` em modo de edicao, o
  usuario perderia edicoes nao salvas no formulario. Mitigacao aplicada: em modo de edicao, fechar
  a tela de mensagem volta ao formulario em vez de fechar o modal.
- A mensagem pode ser gerada com dados ainda nao salvos (usuario edita paciente/tutor mas nao
  clicou em "Salvar Alteracoes" antes de gerar a mensagem). Mitigacao aplicada: aviso textual na
  tela de mensagem lembrando de salvar.

## 7) Perguntas abertas

- Nenhuma bloqueante. Assumido que o botao fica dentro do modal de edicao do agendamento (nao na
  lista/calendario) — a confirmar com o usuario apos ver o resultado; se for necessario acesso sem
  abrir o modal, entra como item novo no backlog.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
