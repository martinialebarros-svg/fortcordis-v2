export type ReservaManualDestinatario = "clinica" | "tutor";

export interface MensagemReservaManualInput {
  destinatarioTipo: ReservaManualDestinatario;
  destinatarioNome?: string | null;
  data: string;
  hora: string;
  prazoConfirmacao: string;
}

const formatarParteDataHora = (value: number): string => String(value).padStart(2, "0");

export const formatarDateTimeLocalInput = (date: Date): string => {
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    "-",
    formatarParteDataHora(date.getMonth() + 1),
    "-",
    formatarParteDataHora(date.getDate()),
    "T",
    formatarParteDataHora(date.getHours()),
    ":",
    formatarParteDataHora(date.getMinutes()),
  ].join("");
};

export const criarPrazoPadraoReserva = (agora = new Date()): string => {
  const prazo = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
  prazo.setSeconds(0, 0);
  return formatarDateTimeLocalInput(prazo);
};

export const formatarDataReserva = (isoDate: string): string => {
  const match = String(isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || "").trim();
  const [, ano, mes, dia] = match;
  return `${dia}/${mes}/${ano}`;
};

export const formatarPrazoReserva = (dateTimeLocal: string): string => {
  const match = String(dateTimeLocal || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return String(dateTimeLocal || "").trim();
  const [, ano, mes, dia, hora, minuto] = match;
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
};

export const normalizarTelefoneWhatsApp = (telefone?: string | null): string => {
  let digitos = String(telefone || "").replace(/\D/g, "");
  while (digitos.startsWith("0")) {
    digitos = digitos.slice(1);
  }
  if (!digitos) return "";
  if (digitos.startsWith("55")) return digitos;
  if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
  return digitos;
};

export const montarMensagemReservaManual = ({
  destinatarioTipo,
  destinatarioNome,
  data,
  hora,
  prazoConfirmacao,
}: MensagemReservaManualInput): string => {
  const nome = String(destinatarioNome || "").trim();
  const saudacao = destinatarioTipo === "clinica"
    ? `Olá, equipe ${nome || "da clínica"}.`
    : nome
      ? `Olá, ${nome}.`
      : "Olá.";

  return [
    saudacao,
    "",
    `A Fort Cordis reservou provisoriamente o horário de ${formatarDataReserva(data)} às ${String(hora || "").slice(0, 5)}.`,
    `Pedimos que confirme esta reserva até ${formatarPrazoReserva(prazoConfirmacao)}.`,
    "",
    "Sem confirmação até esse prazo, o horário poderá ser liberado para outros clientes, evitando bloqueios que prejudiquem a organização da agenda.",
    "",
    "Por favor, responda confirmando a reserva ou informando que não utilizará o horário.",
  ].join("\n");
};

export const montarLinkWhatsAppReserva = (
  telefone: string | null | undefined,
  mensagem: string,
): string => {
  const numero = normalizarTelefoneWhatsApp(telefone);
  const destino = numero ? `https://wa.me/${numero}` : "https://wa.me/";
  return `${destino}?text=${encodeURIComponent(mensagem)}`;
};
