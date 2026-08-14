export interface ReservationTemplateParameters {
  recipient_name: string;
  pet_name: string;
  appointment_date: string;
  appointment_time: string;
  confirmation_deadline: string;
}

export function renderReservationTemplateBody(
  parameters: ReservationTemplateParameters
): string {
  return [
    `Olá, ${parameters.recipient_name}. A Fort Cordis reservou o atendimento de`,
    `${parameters.pet_name} para ${parameters.appointment_date}, às`,
    `${parameters.appointment_time}. Confirme até ${parameters.confirmation_deadline}.`,
    "Após esse prazo, o horário poderá ser disponibilizado para outros clientes automaticamente."
  ].join(" ");
}
