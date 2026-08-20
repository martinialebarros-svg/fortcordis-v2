# Intent - agenda-reserva-formalizacao-dados-pendentes

## Problema

Usuário reportou três pontos relacionados ao fluxo de reserva de horário:

1. Depois de completar os dados do paciente/tutor numa reserva (que chegam
   depois, via a clínica), gostaria de um botão para avisar a clínica que
   o horário "está agendado", deixando claro que não é mais uma reserva
   sujeita a expiração.
2. A mensagem de reserva enviada hoje não avisa que é necessário
   complementar dados (nome do pet/tutor) para formalizar o agendamento.
3. Investigar por que às vezes não é possível mudar o status de
   "Reservado" para "Agendado" — parece pular direto para "Confirmado".

## Diagnóstico

- **Item 3 não é bug**: quando a clínica clica "Confirmar" no próprio
  WhatsApp, o sistema muda `Reservado → Confirmado` diretamente, por
  desenho documentado (`docs/specs/agenda-whatsapp-cloud-api/spec.md`
  RF-006) — "Confirmado" ali significa "a clínica confirmou a reserva",
  não é o mesmo "Confirmado" do fluxo manual mais tardio. No app, os
  botões "Agendado" e "Confirmado" sempre coexistiram para uma reserva —
  só que "Confirmado" era listado/renderizado primeiro, o que facilita
  clicar nele sem notar que "Agendado" também era uma opção. Fix: apenas
  reordenar (ver Fase 1).
- **Item 2 não precisa de aprovação nova da Meta**: já existe um modelo
  aprovado (`appointmentMissingData` / `dados_pendentes_agendamento`)
  com exatamente esse conteúdo ("precisamos confirmar os dados do tutor
  e do paciente"), mas ele só era oferecido manualmente no seletor de
  modelos do modal — nunca era enviado junto com a reserva. Fix: encadear
  o envio automático desse modelo logo após o envio bem-sucedido da
  reserva (ver Fase 2).
- **Item 1 precisa de aprovação nova da Meta**: não existe hoje nenhum
  modelo aprovado com o conteúdo "seu agendamento foi formalizado, não é
  mais uma reserva". Como o corpo de um modelo aprovado é fixo (só os
  parâmetros são editáveis), é necessário submeter um modelo novo pelo
  WhatsApp Business Manager — passo que só o usuário pode fazer. **Fora
  de escopo desta implementação**; o texto proposto está registrado
  abaixo para quando a aprovação sair.

## Escopo desta implementação

- Reordenar os botões de status: "Agendado" passa a vir antes de
  "Confirmado" na lista de próximos status de uma reserva.
- Ao enviar a reserva pelo botão "Enviar pelo FortCordis", encadear
  automaticamente o envio do modelo já aprovado `appointmentMissingData`
  logo em seguida, para a clínica já saber de cara que precisa
  complementar os dados.

## Fora de escopo (bloqueado por aprovação externa da Meta)

- Novo modelo de "agendamento formalizado" (item 1 do pedido original).
  Texto proposto para submissão (4 parâmetros, mesmo padrão dos modelos
  existentes, categoria Utilidade):

  > Olá, {{1}}. Recebemos os dados do paciente e o atendimento de {{2}}
  > em {{3}}, às {{4}}, está agendado. Você receberá um lembrete
  > próximo à data.

  Nome sugerido: `agendamento_formalizado` (padrão de nomenclatura dos
  modelos já existentes: `reserva_de_agendamento`,
  `dados_pendentes_agendamento`). Evitei a palavra "confirmado" no texto
  de propósito, para não confundir com o status "Confirmado" do sistema
  (que representa uma etapa posterior e distinta). Assim que aprovado
  pela Meta, adicionar a entrada no catálogo
  (`whatsapp-stage-backend/src/templates/approvedTemplates.ts`) e um
  botão equivalente na tela de edição do agendamento existente (não só
  no modal de criação).

## Riscos e decisões

- O envio automático do aviso de dados pendentes é encadeado, mas não
  bloqueante: se falhar, a reserva já enviada com sucesso não é afetada
  — só o feedback ao usuário menciona que o aviso extra não saiu, com
  sugestão de reenviar manualmente pelo seletor de modelos.
- Assume-se que toda reserva enviada pelo fluxo "reservation" está, por
  definição, com dados de paciente/tutor incompletos (é exatamente por
  isso que é uma reserva, não um agendamento direto) — não há checagem
  condicional antes de encadear o aviso.
