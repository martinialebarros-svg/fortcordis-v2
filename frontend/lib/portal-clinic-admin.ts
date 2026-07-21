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
    "A Fort Cordis criou um acesso seguro para a clinica parceira consultar exames e laudos liberados no Portal Fort Cordis.",
    "Use o link abaixo para criar a senha da unidade e entrar no portal:",
    activationUrl,
    "",
    emailLine,
    `Este link e individual, expira em ${expirationText} e nao deve ser compartilhado fora da equipe autorizada.`,
    "Depois da ativacao, o acesso sera feito pelo portal com email, senha e confirmacao adicional quando necessario.",
  ].join("\n");
}

export function buildClinicWhatsappLink(target: string, message: string): string {
  const normalizedTarget = String(target || "").replace(/\D+/g, "");
  const baseUrl = normalizedTarget ? `https://wa.me/${normalizedTarget}` : "https://wa.me/";
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}
