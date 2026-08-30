export type FinanceiroSectionLoadStatus = "success" | "failed" | "cancelled";

export type FinanceiroActiveTab = "transacoes" | "cobrancas" | "ordens";

export interface FinanceiroLoadingPlan {
  transacoes: boolean;
  ordens: boolean;
  catalogosOrdens: boolean;
}

export interface FinanceiroSectionLoadResult {
  section: string;
  status: FinanceiroSectionLoadStatus;
  error?: unknown;
}

interface LoadFinanceiroSectionOptions<T> {
  section: string;
  request: Promise<T>;
  signal: AbortSignal;
  onSuccess: (value: T) => void;
  onSettled?: () => void;
}

export function getFinanceiroLoadingPlan(activeTab: FinanceiroActiveTab): FinanceiroLoadingPlan {
  const shouldLoadOrders = activeTab === "cobrancas" || activeTab === "ordens";

  return {
    transacoes: activeTab === "transacoes",
    ordens: shouldLoadOrders,
    catalogosOrdens: shouldLoadOrders,
  };
}

export async function loadFinanceiroSection<T>({
  section,
  request,
  signal,
  onSuccess,
  onSettled,
}: LoadFinanceiroSectionOptions<T>): Promise<FinanceiroSectionLoadResult> {
  try {
    const value = await request;
    if (signal.aborted) {
      return { section, status: "cancelled" };
    }

    onSuccess(value);
    return { section, status: "success" };
  } catch (error) {
    if (signal.aborted) {
      return { section, status: "cancelled" };
    }

    return { section, status: "failed", error };
  } finally {
    if (!signal.aborted) {
      onSettled?.();
    }
  }
}

export function appendUniqueLoadFailure(current: string[], section: string): string[] {
  return current.includes(section) ? current : [...current, section];
}
