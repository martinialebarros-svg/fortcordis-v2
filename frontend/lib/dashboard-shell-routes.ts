const dashboardShellRoutePrefixes = [
  "/agenda",
  "/assistente-ia",
  "/atendimento",
  "/clinicas",
  "/configuracoes",
  "/dashboard",
  "/financeiro",
  "/fiscal",
  "/laudos",
  "/logistica",
  "/pacientes",
  "/referencias-eco",
  "/relatorios",
  "/servicos",
  "/ultrassonografia-abdominal",
  "/visualizador-vivid-iq",
  "/whatsapp-stage",
] as const;

export function usesDashboardShell(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Convite publico de formalizacao: usa seu proprio token, sem login da equipe.
  if (pathname === "/agenda/formalizar" || pathname.startsWith("/agenda/formalizar/")) return false;

  return dashboardShellRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
