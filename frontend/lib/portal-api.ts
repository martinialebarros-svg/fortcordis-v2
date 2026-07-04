"use client";

import { portalDateTimeMillis } from "@/lib/portal-datetime";

export type PortalActorType = "tutor" | "clinica";

export type PortalChallengeResponse = {
  accepted: boolean;
  challenge_id: string;
  message: string;
  expires_in_seconds: number;
  debug_code?: string | null;
};

export type PortalSessionResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  actor_type: PortalActorType;
  actor_id: number;
  paciente_id?: number | null;
  clinica_id?: number | null;
  account_id?: number | null;
  auth_method?: string | null;
  trusted_session_expires_at?: string | null;
  scope: string[];
  message?: string | null;
};

export type PortalClinicAuthResponse = Partial<PortalSessionResponse> & {
  token_type?: string;
  scope?: string[];
  mfa_required?: boolean;
  challenge_id?: string | null;
  message?: string | null;
};

export type PortalClinicInviteStatusResponse = {
  status: "pending" | "used" | "expired" | "revoked";
  clinica_id: number;
  clinica_nome: string;
  unidade_nome: string;
  expires_at: string;
  can_activate: boolean;
  email_hint?: string | null;
};

export type PortalClinicActivationResponse = {
  activation_id: number;
  access_token?: string | null;
  token_type?: string;
  expires_at?: string | null;
  actor_type?: PortalActorType | null;
  actor_id?: number | null;
  clinica_id?: number | null;
  account_id?: number | null;
  auth_method?: string | null;
  trusted_session_expires_at?: string | null;
  scope?: string[];
  message: string;
};

export type PortalSimpleAcceptedResponse = {
  accepted: boolean;
  message: string;
};

export type PortalAdminClinicInviteResponse = {
  invite_id: number;
  status: string;
  expires_at: string;
  activation_url: string;
  delivery_channel: string;
  delivery_target_masked?: string | null;
  account_email_masked?: string | null;
  delivery_status: string;
  delivery_provider?: string | null;
};

export type PortalAdminClinicInviteSnapshot = {
  id: number;
  status: string;
  delivery_channel: string;
  delivery_target_masked?: string | null;
  expires_at: string;
  created_at: string;
  delivered_at?: string | null;
  used_at?: string | null;
  revoked_at?: string | null;
};

export type PortalAdminClinicAccountSnapshot = {
  id: number;
  status: string;
  email_masked?: string | null;
  responsavel_nome: string;
  email_verified_at?: string | null;
  activated_at?: string | null;
  last_login_at?: string | null;
  force_mfa_on_next_login: boolean;
  revoked_at?: string | null;
};

export type PortalAdminClinicSessionSnapshot = {
  id: number;
  status: string;
  trusted_until: string;
  created_at: string;
  last_seen_at?: string | null;
  revoked_at?: string | null;
  device_label?: string | null;
};

export type PortalAdminClinicAccessSummaryResponse = {
  clinica_id: number;
  clinica_nome: string;
  invite?: PortalAdminClinicInviteSnapshot | null;
  account?: PortalAdminClinicAccountSnapshot | null;
  active_session_count: number;
  active_sessions: PortalAdminClinicSessionSnapshot[];
};

export type PortalExamAttachment = {
  anexo_id: number;
  nome_original: string;
  mime_type: string;
  tamanho: number | null;
  download_available: boolean;
};

export type PortalExamItem = {
  id: number;
  paciente_id: number;
  paciente_nome?: string | null;
  tutor_nome?: string | null;
  especie?: string | null;
  atendimento_id: number | null;
  laudo_id: number | null;
  tipo_exame: string;
  categoria_exame: string | null;
  prioridade: string | null;
  status: string | null;
  data_solicitacao: string | null;
  data_resultado: string | null;
  observacoes: string | null;
  anexos: PortalExamAttachment[];
};

export type PortalExamListResponse = {
  total: number;
  clinica_id?: number | null;
  clinica_nome?: string | null;
  items: PortalExamItem[];
};

export type PortalDownloadItem = {
  anexo_id: number;
  nome_original: string;
  mime_type: string;
  download_url: string;
  download_token: string;
  download_token_header: string;
  expires_at: string;
};

export type PortalDownloadUrlResponse = {
  exame_id: number;
  items: PortalDownloadItem[];
};

const PORTAL_SESSION_STORAGE_KEY_PREFIX = "fortcordis_portal_session";

function getPortalSessionStorageKey(actorType: PortalActorType): string {
  return `${PORTAL_SESSION_STORAGE_KEY_PREFIX}:${actorType}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(encodedName)) {
      return decodeURIComponent(trimmed.slice(encodedName.length));
    }
  }
  return null;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text.trim()) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
      if (typeof parsed.detail === "string" && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message.trim();
      }
    } catch {
      return text.trim();
    }

    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function portalFetchJson<T>(
  url: string,
  options: RequestInit = {},
  fallback = "Erro ao comunicar com o portal.",
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();
  if (!headers.has("Content-Type") && method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfToken = getCookie("fortcordis_csrf");
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || "same-origin",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallback));
  }

  return (await response.json()) as T;
}

function removePortalSessionEverywhere(actorType: PortalActorType): void {
  if (typeof window === "undefined") {
    return;
  }
  const key = getPortalSessionStorageKey(actorType);
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

function shouldPersistClinicSession(session: PortalSessionResponse): boolean {
  if (session.actor_type !== "clinica") {
    return false;
  }
  if (!session.trusted_session_expires_at) {
    return false;
  }
  return portalDateTimeMillis(session.trusted_session_expires_at) > Date.now();
}

export async function requestTutorPortalChallenge(payload: {
  tutor_id: number;
  paciente_id: number;
  canal: "email" | "whatsapp";
  contato: string;
}): Promise<PortalChallengeResponse> {
  return portalFetchJson<PortalChallengeResponse>("/api/v1/portal/tutores/sessao-link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestClinicPortalChallenge(payload: {
  clinica_id: number;
  email: string;
  responsavel_nome: string;
}): Promise<PortalChallengeResponse> {
  return portalFetchJson<PortalChallengeResponse>("/api/v1/portal/clinicas/sessao-link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyPortalCode(payload: {
  challenge_id: string;
  codigo: string;
}): Promise<PortalSessionResponse> {
  return portalFetchJson<PortalSessionResponse>(
    "/api/v1/portal/auth/verificar-codigo",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel validar o codigo.",
  );
}

export async function getClinicInviteStatus(inviteToken: string): Promise<PortalClinicInviteStatusResponse> {
  return portalFetchJson<PortalClinicInviteStatusResponse>(
    `/api/v1/portal/clinicas/convites/${encodeURIComponent(inviteToken)}`,
    {},
    "Nao foi possivel consultar o convite da clinica.",
  );
}

export async function activateClinicInvite(payload: {
  invite_token: string;
  email?: string;
  responsavel_nome: string;
  password: string;
  password_confirmation: string;
}): Promise<PortalClinicActivationResponse> {
  return portalFetchJson<PortalClinicActivationResponse>(
    "/api/v1/portal/clinicas/ativacao",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel iniciar a ativacao da clinica.",
  );
}

export async function verifyClinicEmailCode(payload: {
  challenge_id: string;
  codigo: string;
}): Promise<PortalChallengeResponse> {
  return portalFetchJson<PortalChallengeResponse>(
    "/api/v1/portal/auth/email/verificar",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel validar o codigo do email.",
  );
}

export async function loginClinicPortal(payload: {
  email: string;
  password: string;
  remember_device_until_shift_end: boolean;
}): Promise<PortalClinicAuthResponse> {
  return portalFetchJson<PortalClinicAuthResponse>(
    "/api/v1/portal/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel iniciar a sessao da clinica.",
  );
}

export async function verifyClinicPortalMfa(payload: {
  challenge_id: string;
  codigo: string;
  remember_device_until_shift_end: boolean;
}): Promise<PortalClinicAuthResponse> {
  return portalFetchJson<PortalClinicAuthResponse>(
    "/api/v1/portal/auth/mfa/verificar",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel confirmar o acesso da clinica.",
  );
}

export async function refreshClinicPortalSession(): Promise<PortalClinicAuthResponse> {
  return portalFetchJson<PortalClinicAuthResponse>(
    "/api/v1/portal/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    "Nao foi possivel renovar a sessao da clinica.",
  );
}

export async function logoutClinicPortal(token?: string | null): Promise<PortalSimpleAcceptedResponse> {
  return portalFetchJson<PortalSimpleAcceptedResponse>(
    "/api/v1/portal/auth/logout",
    {
      method: "POST",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
      body: JSON.stringify({}),
    },
    "Nao foi possivel encerrar a sessao da clinica.",
  );
}

export async function requestClinicPasswordReset(payload: {
  email: string;
}): Promise<PortalSimpleAcceptedResponse> {
  return portalFetchJson<PortalSimpleAcceptedResponse>(
    "/api/v1/portal/auth/esqueci-senha",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel processar a redefinicao de senha.",
  );
}

export async function resetClinicPassword(payload: {
  reset_token: string;
  password: string;
  password_confirmation: string;
}): Promise<PortalSimpleAcceptedResponse> {
  return portalFetchJson<PortalSimpleAcceptedResponse>(
    "/api/v1/portal/auth/redefinir-senha",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel redefinir a senha da clinica.",
  );
}

export async function getPortalClinicAccessSummary(
  clinicaId: number,
): Promise<PortalAdminClinicAccessSummaryResponse> {
  return portalFetchJson<PortalAdminClinicAccessSummaryResponse>(
    `/api/v1/portal/admin/clinicas/${clinicaId}/acesso`,
    {},
    "Nao foi possivel carregar o resumo de acesso da clinica.",
  );
}

export async function createPortalClinicInvite(
  clinicaId: number,
  payload: {
    delivery_channel: "whatsapp";
    delivery_target: string;
    expires_in_hours: number;
    allow_manual_copy: boolean;
  },
): Promise<PortalAdminClinicInviteResponse> {
  return portalFetchJson<PortalAdminClinicInviteResponse>(
    `/api/v1/portal/admin/clinicas/${clinicaId}/convites`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel gerar o convite da clinica.",
  );
}

export async function revokePortalClinicInvite(
  clinicaId: number,
  inviteId: number,
  reason: string,
): Promise<{ status: string; revoked_at: string }> {
  return portalFetchJson<{ status: string; revoked_at: string }>(
    `/api/v1/portal/admin/clinicas/${clinicaId}/convites/${inviteId}/revogar`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    "Nao foi possivel revogar o convite da clinica.",
  );
}

export async function revokePortalClinicAccount(
  accountId: number,
  payload: { reason: string; revoke_sessions: boolean },
): Promise<{ status: string; revoked_at: string }> {
  return portalFetchJson<{ status: string; revoked_at: string }>(
    `/api/v1/portal/admin/clinica-accounts/${accountId}/revogar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel revogar a conta da clinica.",
  );
}

export async function revokePortalClinicSessions(payload: {
  clinica_id: number;
  session_id?: number;
  reason: string;
}): Promise<{ revoked_count: number }> {
  return portalFetchJson<{ revoked_count: number }>(
    "/api/v1/portal/admin/clinica-sessions/revogar",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Nao foi possivel revogar as sessoes da clinica.",
  );
}

export async function listPortalPetExams(pacienteId: number, token: string): Promise<PortalExamListResponse> {
  return portalFetchJson<PortalExamListResponse>(
    `/api/v1/portal/pets/${pacienteId}/exames`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    "Nao foi possivel carregar os exames.",
  );
}

export type PortalClinicExamFilters = {
  q?: string;
  pet?: string;
  tutor?: string;
  especie?: string;
  tipo_exame?: string;
  status_exame?: string;
  data_inicio?: string;
  data_fim?: string;
  sort_by?: "data" | "tipo_exame" | "especie" | "pet" | "tutor" | "status";
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export async function listPortalClinicExams(
  filters: PortalClinicExamFilters,
  token: string,
): Promise<PortalExamListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  const query = params.toString();
  return portalFetchJson<PortalExamListResponse>(
    `/api/v1/portal/clinicas/exames${query ? `?${query}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    "Nao foi possivel carregar os exames da clinica.",
  );
}

export async function createPortalExamDownloadUrls(
  exameId: number,
  token: string,
): Promise<PortalDownloadUrlResponse> {
  return portalFetchJson<PortalDownloadUrlResponse>(
    `/api/v1/portal/exames/${exameId}/download-url`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    },
    "Nao foi possivel preparar o download.",
  );
}

export async function downloadPortalAttachment(item: PortalDownloadItem): Promise<void> {
  const response = await fetch(item.download_url, {
    headers: {
      [item.download_token_header]: item.download_token,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Nao foi possivel baixar o anexo."));
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = item.nome_original || "anexo";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export function savePortalSession(session: PortalSessionResponse): void {
  if (typeof window === "undefined") {
    return;
  }
  const key = getPortalSessionStorageKey(session.actor_type);
  const serialized = JSON.stringify(session);
  if (shouldPersistClinicSession(session)) {
    window.localStorage.setItem(key, serialized);
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, serialized);
  window.localStorage.removeItem(key);
}

export function loadPortalSession(expectedActorType?: PortalActorType): PortalSessionResponse | null {
  if (typeof window === "undefined" || !expectedActorType) {
    return null;
  }

  const key = getPortalSessionStorageKey(expectedActorType);
  const candidates = [
    { storage: window.sessionStorage, raw: window.sessionStorage.getItem(key) },
    { storage: window.localStorage, raw: window.localStorage.getItem(key) },
  ];

  for (const candidate of candidates) {
    const raw = candidate.raw;
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as PortalSessionResponse;
      if (!parsed?.access_token || !parsed?.expires_at || parsed.actor_type !== expectedActorType) {
        candidate.storage.removeItem(key);
        continue;
      }
      if (portalDateTimeMillis(parsed.expires_at) <= Date.now()) {
        candidate.storage.removeItem(key);
        continue;
      }
      return parsed;
    } catch {
      candidate.storage.removeItem(key);
    }
  }

  return null;
}

export function clearPortalSession(actorType: PortalActorType): void {
  removePortalSessionEverywhere(actorType);
}
