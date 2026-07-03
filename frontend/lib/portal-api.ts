"use client";

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
  paciente_id: number | null;
  clinica_id: number | null;
  scope: string[];
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

async function portalFetchJson<T>(url: string, options: RequestInit = {}, fallback = "Erro ao comunicar com o portal."): Promise<T> {
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
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallback));
  }

  return (await response.json()) as T;
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
  return portalFetchJson<PortalSessionResponse>("/api/v1/portal/auth/verificar-codigo", {
    method: "POST",
    body: JSON.stringify(payload),
  }, "Nao foi possivel validar o codigo.");
}

export async function listPortalPetExams(pacienteId: number, token: string): Promise<PortalExamListResponse> {
  return portalFetchJson<PortalExamListResponse>(`/api/v1/portal/pets/${pacienteId}/exames`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }, "Nao foi possivel carregar os exames.");
}

export async function createPortalExamDownloadUrls(exameId: number, token: string): Promise<PortalDownloadUrlResponse> {
  return portalFetchJson<PortalDownloadUrlResponse>(`/api/v1/portal/exames/${exameId}/download-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  }, "Nao foi possivel preparar o download.");
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
  window.sessionStorage.setItem(
    getPortalSessionStorageKey(session.actor_type),
    JSON.stringify(session),
  );
}

export function loadPortalSession(expectedActorType?: PortalActorType): PortalSessionResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = expectedActorType
    ? window.sessionStorage.getItem(getPortalSessionStorageKey(expectedActorType))
    : null;
  if (!raw && expectedActorType) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw || "") as PortalSessionResponse;
    if (!parsed?.access_token || !parsed?.expires_at || !parsed?.actor_type) {
      if (expectedActorType) {
        window.sessionStorage.removeItem(getPortalSessionStorageKey(expectedActorType));
      }
      return null;
    }
    if (expectedActorType && parsed.actor_type !== expectedActorType) {
      return null;
    }
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(getPortalSessionStorageKey(parsed.actor_type));
      return null;
    }
    return parsed;
  } catch {
    if (expectedActorType) {
      window.sessionStorage.removeItem(getPortalSessionStorageKey(expectedActorType));
    }
    return null;
  }
}

export function clearPortalSession(actorType: PortalActorType): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(getPortalSessionStorageKey(actorType));
}
