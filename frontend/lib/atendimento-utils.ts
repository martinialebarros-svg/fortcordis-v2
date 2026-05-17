export const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const isoToLocalInput = (value?: string | null) => {
  if (!value) return nowLocalInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLocalInput();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const isoToOptionalLocalInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
};

export const formatBytes = (value?: number | null) => {
  if (!value || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const parseDownloadFilename = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    const raw = utf8Match[1].trim().replace(/^"(.*)"$/, "$1");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw || fallback;
    }
  }
  const plainMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return fallback;
};

export const normalizePeso = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric);
};

export const parseDecimalInput = (value?: string | number | null): number | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const parseStringListInput = (value: string): string[] =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
