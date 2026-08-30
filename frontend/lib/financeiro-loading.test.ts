import { describe, expect, it, vi } from "vitest";
import {
  appendUniqueLoadFailure,
  getFinanceiroLoadingPlan,
  loadFinanceiroSection,
} from "./financeiro-loading";

describe("getFinanceiroLoadingPlan", () => {
  it("carrega somente transacoes na aba inicial", () => {
    expect(getFinanceiroLoadingPlan("transacoes")).toEqual({
      transacoes: true,
      ordens: false,
      catalogosOrdens: false,
    });
  });

  it.each(["cobrancas", "ordens"] as const)(
    "carrega ordens e catalogos sob demanda na aba %s",
    (activeTab) => {
      expect(getFinanceiroLoadingPlan(activeTab)).toEqual({
        transacoes: false,
        ordens: true,
        catalogosOrdens: true,
      });
    }
  );
});

describe("loadFinanceiroSection", () => {
  it("publica o resultado de uma secao bem-sucedida", async () => {
    const controller = new AbortController();
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    const result = await loadFinanceiroSection({
      section: "Transacoes",
      request: Promise.resolve([1, 2]),
      signal: controller.signal,
      onSuccess,
      onSettled,
    });

    expect(result).toEqual({ section: "Transacoes", status: "success" });
    expect(onSuccess).toHaveBeenCalledWith([1, 2]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("isola a falha sem executar o callback de sucesso", async () => {
    const controller = new AbortController();
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    const error = new Error("timeout");

    const result = await loadFinanceiroSection({
      section: "Ordens de servico",
      request: Promise.reject(error),
      signal: controller.signal,
      onSuccess,
      onSettled,
    });

    expect(result).toEqual({ section: "Ordens de servico", status: "failed", error });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("suprime callbacks quando a resposta chega depois do cancelamento", async () => {
    const controller = new AbortController();
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    let resolveRequest: ((value: { saldo: number }) => void) | undefined;
    const request = new Promise<{ saldo: number }>((resolve) => {
      resolveRequest = resolve;
    });

    const pendingResult = loadFinanceiroSection({
      section: "Resumo",
      request,
      signal: controller.signal,
      onSuccess,
      onSettled,
    });
    controller.abort();
    resolveRequest?.({ saldo: 10 });
    const result = await pendingResult;

    expect(result).toEqual({ section: "Resumo", status: "cancelled" });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});

describe("appendUniqueLoadFailure", () => {
  it("mantem cada secao apenas uma vez", () => {
    expect(appendUniqueLoadFailure(["Resumo"], "Resumo")).toEqual(["Resumo"]);
    expect(appendUniqueLoadFailure(["Resumo"], "Clinicas")).toEqual(["Resumo", "Clinicas"]);
  });
});
