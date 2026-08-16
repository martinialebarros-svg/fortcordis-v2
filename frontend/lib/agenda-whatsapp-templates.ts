export type AgendaWhatsAppTemplateKey =
  | "reservation"
  | "appointmentReminder"
  | "appointmentChange"
  | "appointmentCancellation"
  | "appointmentMissingData";

export const AGENDA_WHATSAPP_TEMPLATES: Record<
  AgendaWhatsAppTemplateKey,
  { label: string; body: string }
> = {
  reservation: {
    label: "Reserva de agendamento",
    body:
      "Olá, {{1}}. A Fort Cordis reservou o atendimento de {{2}} para {{3}}, às {{4}}. " +
      "Confirme até {{5}}. Após esse prazo, o horário poderá ser disponibilizado para outros clientes automaticamente.",
  },
  appointmentReminder: {
    label: "Lembrete de agendamento",
    body:
      "Olá, {{1}}. Lembramos que o atendimento de {{2}} está confirmado para {{3}}, às {{4}}. " +
      "Se precisar alterar o horário, use uma das opções abaixo.",
  },
  appointmentChange: {
    label: "Alteração de agendamento",
    body:
      "Olá, {{1}}. O atendimento de {{2}} foi alterado para {{3}}, às {{4}}. " +
      "Confirme se o novo horário funciona para você.",
  },
  appointmentCancellation: {
    label: "Cancelamento de agendamento",
    body:
      "Olá, {{1}}. O atendimento de {{2}}, previsto para {{3}}, às {{4}}, foi cancelado. " +
      "Se desejar, solicite um novo horário.",
  },
  appointmentMissingData: {
    label: "Dados pendentes",
    body:
      "Olá, {{1}}. Para concluir o atendimento de {{2}} em {{3}}, às {{4}}, precisamos confirmar os dados " +
      "do tutor e do paciente. Responda a esta mensagem para continuarmos.",
  },
};

export function renderAgendaWhatsAppTemplate(
  templateKey: AgendaWhatsAppTemplateKey,
  parameters: readonly string[],
): string {
  const body = AGENDA_WHATSAPP_TEMPLATES[templateKey].body;
  const expected = body.match(/\{\{\d+\}\}/g)?.length ?? 0;
  if (parameters.length !== expected) {
    throw new Error(`O modelo ${templateKey} exige ${expected} variáveis.`);
  }
  return body.replace(/\{\{(\d+)\}\}/g, (_placeholder, rawIndex: string) => {
    return parameters[Number(rawIndex) - 1] || "";
  });
}
