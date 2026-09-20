import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FinanceiroPage from "./page";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), router: { push: vi.fn() } }));
vi.mock("../layout-dashboard", () => ({ default: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/axios", () => ({ default: { get: mocks.get, patch: mocks.patch, post: mocks.post } }));
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

const osItem = (id: number) => ({ id, numero_os: `OS-${id}`, status: "Pendente", valor_final: 10,
  data_atendimento: "2026-09-15", paciente: "Paciente sintetico", tutor: "Tutor sintetico", clinica: "Clinica sintetica", servico: "Servico sintetico" });

describe("Cobrancas remote groups", () => {
  const group = { chave: "clinica:1", nome_destinatario: "Clinica sintetica", tipo_destinatario: "clinica", quantidade_total: 101, quantidade_os: 101, total_pendente: 1010 };
  beforeEach(() => {
    mocks.get.mockReset(); mocks.patch.mockReset(); mocks.post.mockReset();
    localStorage.setItem("token", "synthetic-test");
    window.history.replaceState({}, "", "/financeiro?aba=cobrancas");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/ordens-servico/cobrancas?")) return { data: { total: 51, total_os: 151, pendentes: 151, total_pendente: 1510, items: [group] } };
      if (url.startsWith("/ordens-servico?")) {
        const skip = Number(new URL(url, "http://test").searchParams.get("skip"));
        return { data: { total: 101, resumo: { pendentes: 101, valor_pendente: 1010 }, items: Array.from({ length: skip ? 1 : 100 }, (_, i) => ({ ...osItem(skip + i + 1), clinica_id: 1 })) } };
      }
      return { data: { items: [] } };
    });
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, "", "/"); });
  it("initially loads only recipient summaries and pages remotely", async () => {
    render(<FinanceiroPage />);
    await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" });
    expect(mocks.get.mock.calls.some(([url]) => url.startsWith("/ordens-servico?"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Receber pendentes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await waitFor(() => expect(mocks.get.mock.calls.some(([url]) => url.includes("cobrancas?") && url.includes("skip=50"))).toBe(true));
  });
  it("refreshes only recipient summaries without restarting independent reads", async () => {
    render(<FinanceiroPage />);
    await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" });
    const refresh = screen.getByRole("button", { name: "Atualizar destinatarios" });
    await waitFor(() => expect(refresh).toBeEnabled());

    const count = (prefix: string) => mocks.get.mock.calls.filter(([url]) => String(url).startsWith(prefix)).length;
    const before = {
      cobrancas: count("/ordens-servico/cobrancas?"),
      resumo: count("/financeiro/resumo"),
      clinicas: count("/clinicas?"),
      servicos: count("/servicos?"),
      formas: count("/financeiro/formas-pagamento"),
      bandeiras: count("/financeiro/bandeiras-cartao"),
    };

    fireEvent.click(refresh);
    await waitFor(() => expect(count("/ordens-servico/cobrancas?")).toBe(before.cobrancas + 1));
    expect(count("/financeiro/resumo")).toBe(before.resumo);
    expect(count("/clinicas?")).toBe(before.clinicas);
    expect(count("/servicos?")).toBe(before.servicos);
    expect(count("/financeiro/formas-pagamento")).toBe(before.formas);
    expect(count("/financeiro/bandeiras-cartao")).toBe(before.bandeiras);
  });
  it("unlocks actions only after all recipient rows are loaded", async () => {
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" }));
    await screen.findByRole("button", { name: "Receber pendentes" });
    expect(mocks.get.mock.calls.some(([url]) => url.includes("destinatario_chave=clinica%3A1") && url.includes("skip=100"))).toBe(true);
    expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it("keeps actions unavailable when a later batch fails", async () => {
    const read = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((url, options) => url.startsWith("/ordens-servico?") && url.includes("skip=100") ? Promise.reject(new Error("lote indisponivel")) : read(url, options));
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" }));
    await screen.findByText("lote indisponivel");
    expect(screen.queryByRole("button", { name: "Receber pendentes" })).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it("discards late detail results after changing the search", async () => {
    const read = mocks.get.getMockImplementation()!;
    let finish!: (value: unknown) => void;
    const late = new Promise((resolve) => { finish = resolve; });
    mocks.get.mockImplementation((url, options) => url.startsWith("/ordens-servico?") && url.includes("skip=100") ? late : read(url, options));
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" }));
    await waitFor(() => expect(mocks.get.mock.calls.some(([url]) => url.startsWith("/ordens-servico?") && url.includes("skip=100"))).toBe(true));
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "outra" } });
    await waitFor(() => expect(mocks.get.mock.calls.some(([url]) => url.includes("cobrancas?") && url.includes("search=outra"))).toBe(true));
    await act(async () => { finish({ data: { total: 101, resumo: { pendentes: 101, valor_pendente: 1010 }, items: [{ ...osItem(101), clinica_id: 1 }] } }); });
    expect(screen.queryByRole("button", { name: "Receber pendentes" })).not.toBeInTheDocument();
  });
});

describe("Ordens pagination", () => {
  beforeEach(() => {
    mocks.get.mockReset(); mocks.patch.mockReset(); mocks.post.mockReset();
    localStorage.setItem("token", "synthetic-test");
    window.history.replaceState({}, "", "/financeiro?aba=ordens");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/ordens-servico?")) return { data: { total: 201, items: [osItem(url.includes("skip=100") ? 101 : 1)], resumo: { pendentes: 201, valor_pendente: 2010 } } };
      if (/^\/ordens-servico\/\d+$/.test(url)) return { data: osItem(Number(url.split("/").pop())) };
      return { data: { items: [] } };
    });
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, "", "/"); });

  it("retains selection across pages and validates every selected id", async () => {
    render(<FinanceiroPage />);
    await screen.findByText("OS #OS-1");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar pendentes" }));
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await screen.findByText("OS #OS-101");
    expect(screen.queryByText("OS #OS-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar pendentes" }));
    expect(screen.getByText(/2 selecionada\(s\) para baixa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Receber selecionadas" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/ordens-servico/101"));
    expect(mocks.get).toHaveBeenCalledWith("/ordens-servico/1");
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("blocks changed selection without submitting a payment", async () => {
    const read = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (url, options) => url === "/ordens-servico/1" ? { data: { ...osItem(1), valor_final: 20 } } : read(url, options));
    render(<FinanceiroPage />);
    await screen.findByText("OS #OS-1");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar pendentes" }));
    fireEvent.click(screen.getByRole("button", { name: "Receber selecionadas" }));
    expect(await screen.findByText(/Uma OS mudou desde a selecao/)).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("searches remotely and clears selection when filters change", async () => {
    render(<FinanceiroPage />);
    await screen.findByText("OS #OS-1");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar pendentes" }));
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await screen.findByText("OS #OS-101");
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "antiga" } });
    await waitFor(() => expect(mocks.get.mock.calls.some(([url]) => url.includes("skip=0") && url.includes("search=antiga"))).toBe(true));
    expect(await screen.findByText(/0 selecionada\(s\) para baixa/)).toBeInTheDocument();
  });

  it("requests a deep-linked OS by id instead of depending on the first page", async () => {
    window.history.replaceState({}, "", "/financeiro?os_id=900");
    render(<FinanceiroPage />);
    await waitFor(() => expect(mocks.get.mock.calls.some(([url]) => url.includes("os_id=900"))).toBe(true));
  });

  it("keeps failed page distinct from empty and retries without exposing stale rows", async () => {
    let fail = true;
    const read = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (url, options) => {
      if (url.includes("skip=100") && fail) throw new Error("offline");
      return read(url, options);
    });
    render(<FinanceiroPage />);
    await screen.findByText("OS #OS-1");
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await screen.findByText("Nao foi possivel carregar as ordens.");
    expect(screen.queryByText("OS #OS-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma ordem de servico encontrada")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Recarregar ordens" }));
    await screen.findByText("OS #OS-101");
  });

  it("discards a late page response after remote search", async () => {
    let resolvePage!: (value: unknown) => void;
    const read = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((url, options) => url.includes("skip=100") ? new Promise((resolve) => { resolvePage = resolve; }) : read(url, options));
    render(<FinanceiroPage />);
    await screen.findByText("OS #OS-1");
    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));
    await waitFor(() => expect(resolvePage).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "antiga" } });
    await screen.findByText("OS #OS-1");
    await act(async () => resolvePage({ data: { total: 201, items: [osItem(101)], resumo: { pendentes: 201, valor_pendente: 2010 } } }));
    expect(screen.queryByText("OS #OS-101")).not.toBeInTheDocument();
  });
});

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
