import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FinanceiroPage from "./page";

const mocks = vi.hoisted(() => ({ get: vi.fn(), router: { push: vi.fn() } }));
vi.mock("../layout-dashboard", () => ({ default: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/axios", () => ({ default: { get: mocks.get } }));
vi.mock("./TransacaoModal", () => ({ default: () => null }));

function result(description: string, total = 205) {
  return { data: { total, items: [{ id: 1, descricao: description, categoria: "consulta", tipo: "entrada", status: "Pago", valor_final: 10, data_transacao: "2026-09-13", forma_pagamento: "pix" }] } };
}
function setupReads(transactions: (url: string) => unknown) {
  mocks.get.mockImplementation((url: string) => {
    if (url.startsWith("/financeiro/transacoes?")) return transactions(url);
    if (url.startsWith("/financeiro/resumo")) return Promise.resolve({ data: { entradas: 999, saidas: 0, saldo: 999 } });
    return Promise.resolve({ data: { items: [] } });
  });
}
const searchInput = () => screen.getByRole("textbox");

describe("Financeiro transaction pagination", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    window.localStorage.setItem("token", "synthetic-test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it("uses server totals, pages, and resets remote search to the first page", async () => {
    setupReads((url) => Promise.resolve(url.includes("search=rex") ? result("Rex remoto", 1) : result(url.includes("skip=100") ? "Segunda pagina" : "Primeira pagina")));
    render(<FinanceiroPage />);
    expect(await screen.findByText("Primeira pagina")).toBeInTheDocument();
    expect(screen.getByText(/Pagina 1 de 3/)).toBeInTheDocument();
    expect(screen.getAllByText(/999,00/).length).toBeGreaterThan(0);
    expect(mocks.get).toHaveBeenCalledWith("/financeiro/transacoes?limit=100&skip=0", expect.anything());
    expect(mocks.get.mock.calls.some(([url]) => url.startsWith("/ordens-servico"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    expect(await screen.findByText("Segunda pagina")).toBeInTheDocument();
    fireEvent.change(searchInput(), { target: { value: "rex" } });
    expect(screen.queryByText("Segunda pagina")).not.toBeInTheDocument();
    expect(await screen.findByText("Rex remoto")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("/financeiro/transacoes?limit=100&skip=0&search=rex", expect.anything());
    expect(screen.getByRole("button", { name: "Proxima" })).toBeDisabled();
  });

  it("shows a retryable failure instead of stale rows or a false empty result", async () => {
    let fail = true;
    setupReads(() => fail ? Promise.reject(new Error("timeout")) : Promise.resolve(result("Recuperada", 1)));
    render(<FinanceiroPage />);
    expect(await screen.findByText("Nao foi possivel carregar as transacoes.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma transacao encontrada")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Recarregar transacoes" }));
    expect(await screen.findByText("Recuperada")).toBeInTheDocument();
  });

  it("discards a delayed response superseded by a new search", async () => {
    let resolveOld!: (value: ReturnType<typeof result>) => void;
    setupReads((url) => url.includes("search=rex") ? Promise.resolve(result("Atual", 1)) : new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<FinanceiroPage />);
    await waitFor(() => expect(resolveOld).toBeDefined());
    const oldSignal = mocks.get.mock.calls.find(([url]) => url.startsWith("/financeiro/transacoes"))?.[1].signal;
    fireEvent.change(searchInput(), { target: { value: "rex" } });
    expect(await screen.findByText("Atual")).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld(result("Obsoleta")));
    expect(screen.queryByText("Obsoleta")).not.toBeInTheDocument();
    view.unmount();
  });

  it("returns to a valid page when the last page disappears", async () => {
    setupReads((url) => Promise.resolve(url.includes("skip=100") ? { data: { total: 100, items: [] } } : result("Pagina valida", 101)));
    render(<FinanceiroPage />);
    await screen.findByText("Pagina valida");
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await waitFor(() => expect(mocks.get.mock.calls.filter(([url]) => url === "/financeiro/transacoes?limit=100&skip=0")).toHaveLength(2));
    expect(await screen.findByText("Pagina valida")).toBeInTheDocument();
  });

  it("resets date filters before requesting and shows a confirmed empty result", async () => {
    setupReads((url) => Promise.resolve(url.includes("data_inicio=") ? { data: { total: 0, items: [] } } : result("Sem filtro")));
    const view = render(<FinanceiroPage />);
    await screen.findByText("Sem filtro");
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await waitFor(() => expect(screen.getByText(/Pagina 2 de 3/)).toBeInTheDocument());
    fireEvent.change(view.container.querySelector('input[type="date"]')!, { target: { value: "2026-09-01" } });
    expect(await screen.findByText("Nenhuma transacao encontrada")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("/financeiro/transacoes?limit=100&skip=0&data_inicio=2026-09-01", expect.anything());
    expect(screen.getByText(/Pagina 1 de 1/)).toBeInTheDocument();
  });

  it("keeps successful transactions available when an independent section fails", async () => {
    setupReads(() => Promise.resolve(result("Disponivel", 1)));
    const original = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((url, options) => url.startsWith("/financeiro/resumo") ? Promise.reject(new Error("summary timeout")) : original(url, options));
    render(<FinanceiroPage />);
    expect(await screen.findByText("Disponivel")).toBeInTheDocument();
    expect(screen.getByText(/Secoes indisponiveis: Resumo financeiro/)).toBeInTheDocument();
  });
});
