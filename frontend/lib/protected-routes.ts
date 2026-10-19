import { usesDashboardShell } from "./dashboard-shell-routes";

export function safeLoginDestination(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) {
    return "/dashboard";
  }
  try {
    const url = new URL(value, "https://fortcordis.invalid");
    return url.origin === "https://fortcordis.invalid" && usesDashboardShell(url.pathname)
      ? `${url.pathname}${url.search}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
