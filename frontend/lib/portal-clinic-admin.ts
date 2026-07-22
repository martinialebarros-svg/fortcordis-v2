import { formatPortalDateTime } from "@/lib/portal-datetime";

export function getPortalAdminAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function buildClinicInviteMessage({
  clinicaNome,
  activationUrl,
  expiresAt,
  accountEmailMasked,
}: {
  clinicaNome: string;
  activationUrl: string;
  expiresAt?: string | null;
  accountEmailMasked?: string | null;
}): string {
  const expirationText = expiresAt ? formatPortalDateTime(expiresAt) : "no prazo informado no portal";
  const emailLine = accountEmailMasked
    ? `O email institucional definido para este acesso e ${accountEmailMasked}.`
    : "A clinica usara o email institucional cadastrado no portal.";

  return [
    `Ola, equipe ${clinicaNome}.`,
    "",
    "A Fort Cordis liberou um acesso seguro para a sua clinica acompanhar exames e laudos dos pets atendidos na unidade.",
    "Use o link abaixo para ativar o portal da unidade, criar a senha e comecar a consultar os resultados:",
    activationUrl,
    "",
    emailLine,
    `Este link e individual, expira em ${expirationText} e nao deve ser compartilhado fora da equipe autorizada.`,
    "Depois da ativacao, o acesso passa a ser feito pelo portal com email, senha e confirmacao adicional apenas quando necessario.",
  ].join("\n");
}

export function buildClinicWhatsappLink(target: string, message: string): string {
  const normalizedTarget = String(target || "").replace(/\D+/g, "");
  const baseUrl = normalizedTarget ? `https://wa.me/${normalizedTarget}` : "https://wa.me/";
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}
