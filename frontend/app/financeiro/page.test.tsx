import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FinanceiroPage from "./page";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), router: { push: vi.fn() } }));
vi.mock("../layout-dashboard", () => ({ default: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/axios", () => ({ default: { get: mocks.get, patch: mocks.patch, post: mocks.post, put: mocks.put, delete: mocks.delete } }));
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
  it("expands pending orders directly below the recipient row and collapses them", async () => {
    const compactGroup = { ...group, quantidade_total: 2, quantidade_os: 1, total_pendente: 10 };
    mocks.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/ordens-servico/cobrancas?")) {
        return { data: { total: 1, total_os: 2, pendentes: 1, total_pendente: 10, items: [compactGroup] } };
      }
      if (url.startsWith("/ordens-servico?")) {
        return {
          data: {
            total: 2,
            resumo: { pendentes: 1, valor_pendente: 10 },
            items: [
              { ...osItem(1), clinica_id: 1 },
              { ...osItem(2), clinica_id: 1, status: "Pago" },
            ],
          },
        };
      }
      return { data: { items: [] } };
    });

    render(<FinanceiroPage />);
    const recipient = await screen.findByRole("region", { name: "Cobrancas de Clinica sintetica" });
    const open = within(recipient).getByRole("button", { name: "Abrir destinatario Clinica sintetica" });
    expect(open).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(open);

    expect(await within(recipient).findByText("OS #OS-1")).toBeInTheDocument();
    expect(within(recipient).queryByText("OS #OS-2")).not.toBeInTheDocument();
    const close = within(recipient).getByRole("button", { name: "Fechar destinatario Clinica sintetica" });
    expect(close).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(close);

    expect(within(recipient).queryByText("OS #OS-1")).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.filter(([url]) => String(url).startsWith("/ordens-servico?")).length).toBe(1);
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

describe("Ordens vinculadas a laudos", () => {
  let ordem: ReturnType<typeof osItem> & { laudo_id?: number; clinica_id: number; servico_id: number };
  beforeEach(() => {
    mocks.get.mockReset(); mocks.put.mockReset(); mocks.delete.mockReset();
    mocks.put.mockResolvedValue({ data: {} }); mocks.delete.mockResolvedValue({ data: {} });
    localStorage.setItem("token", "synthetic-test");
    window.history.replaceState({}, "", "/financeiro?aba=ordens");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    ordem = { ...osItem(1), laudo_id: 20, clinica_id: 1, servico_id: 1 };
    mocks.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/ordens-servico?")) return { data: { total: 1, items: [ordem], resumo: { pendentes: ordem.status === "Pendente" ? 1 : 0, valor_pendente: ordem.status === "Pendente" ? 10 : 0 } } };
      if (url.startsWith("/clinicas?")) return { data: { total: 1, items: [{ id: 1, nome: "Clinica sintetica" }] } };
      if (url.startsWith("/servicos?")) return { data: { items: [{ id: 1, nome: "Servico sintetico" }] } };
      return { data: { items: [] } };
    });
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, "", "/"); });

  it("cancela a pendencia preservando a OS e o laudo", async () => {
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar OS" }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/ordens-servico/1", { status: "Cancelado" }));
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("laudo e o historico"));
  });

  it("exige desfazer recebimento antes de cancelar a OS paga", async () => {
    ordem.status = "Pago";
    render(<FinanceiroPage />);
    expect(await screen.findByRole("button", { name: "Cancelar OS" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeEnabled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("preserva a exclusao das OS sem vinculo com laudo", async () => {
    delete ordem.laudo_id;
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir OS" }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("/ordens-servico/1"));
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("mantem a clinica vinculada ao editar OS ativa de laudo", async () => {
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.getByRole("combobox", { name: "Clinica da OS" })).toBeDisabled();
  });
});

describe("Ajuste de valor de OS pendente", () => {
  let ordemAtual: ReturnType<typeof osItem> & {
    clinica_id: number; servico_id: number; tipo_horario: string;
    valor_servico: number; desconto: number; observacoes: string;
  };

  beforeEach(() => {
    mocks.get.mockReset(); mocks.patch.mockReset(); mocks.put.mockReset(); mocks.post.mockReset();
    window.localStorage.setItem("token", "synthetic-test");
    window.history.replaceState({}, "", "/financeiro?aba=cobrancas");
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    ordemAtual = {
      ...osItem(1), clinica_id: 1, servico_id: 2, tipo_horario: "comercial",
      valor_servico: 110, desconto: 10, valor_final: 100, observacoes: "Original",
    };
    mocks.get.mockImplementation(async (url: string) => {
      if (url.startsWith("/ordens-servico/cobrancas?")) return {
        data: { total: 1, total_os: 1, pendentes: ordemAtual.status === "Pendente" ? 1 : 0,
          total_pendente: ordemAtual.status === "Pendente" ? ordemAtual.valor_final : 0,
          items: [{ chave: "clinica:1", nome_destinatario: "Clinica sintetica", tipo_destinatario: "clinica",
            quantidade_total: 1, quantidade_os: ordemAtual.status === "Pendente" ? 1 : 0,
            total_pendente: ordemAtual.status === "Pendente" ? ordemAtual.valor_final : 0 }] },
      };
      if (url.startsWith("/ordens-servico?")) return {
        data: { total: 1, items: [{ ...ordemAtual }],
          resumo: { pendentes: ordemAtual.status === "Pendente" ? 1 : 0,
            valor_pendente: ordemAtual.status === "Pendente" ? ordemAtual.valor_final : 0 } },
      };
      if (url === "/ordens-servico/1") return { data: { ...ordemAtual } };
      if (url.startsWith("/clinicas?")) return { data: { items: [{ id: 1, nome: "Clinica sintetica" }] } };
      if (url.startsWith("/servicos?")) return { data: { items: [{ id: 2, nome: "Servico sintetico" }] } };
      return { data: { items: [] } };
    });
    mocks.patch.mockImplementation(async (url: string, payload: { novo_valor_final: number }) => {
      if (url === "/ordens-servico/1/ajustar-valor") {
        ordemAtual = { ...ordemAtual, valor_final: payload.novo_valor_final,
          valor_servico: payload.novo_valor_final + ordemAtual.desconto };
      }
      return { data: { ...ordemAtual } };
    });
    mocks.put.mockResolvedValue({ data: {} });
  });
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); window.history.replaceState({}, "", "/"); });

  it("ajusta pela linha de Cobrancas, registra motivo e reabre o grupo com o novo total", async () => {
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" }));
    const grupo = await screen.findByRole("region", { name: "Cobrancas de Clinica sintetica" });
    fireEvent.click(within(grupo).getByTitle("Selecionar para baixa em lote"));
    fireEvent.click(within(grupo).getByRole("button", { name: "Ajustar valor da OS OS-1" }));
    const modal = await screen.findByRole("dialog", { name: "Ajustar valor da OS" });
    await waitFor(() => expect(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" })).toHaveValue("100.00"));
    expect(mocks.get).toHaveBeenCalledWith("/ordens-servico/1");

    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar ajuste" }));
    expect(within(modal).getByRole("alert")).toHaveTextContent("O novo valor deve ser diferente");
    expect(mocks.patch).not.toHaveBeenCalled();
    fireEvent.change(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" }), { target: { value: "95,001" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar ajuste" }));
    expect(within(modal).getByRole("alert")).toHaveTextContent("ate duas casas decimais");
    fireEvent.change(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" }), { target: { value: "99999999,99" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar ajuste" }));
    expect(within(modal).getByRole("alert")).toHaveTextContent("somado ao desconto excede");
    fireEvent.change(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" }), { target: { value: "95,00" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar ajuste" }));
    expect(within(modal).getByRole("alert")).toHaveTextContent("Informe o motivo");
    fireEvent.change(within(modal).getByRole("textbox", { name: "Motivo do ajuste" }), { target: { value: "Correção do preço combinado" } });
    expect(within(modal).getByText(/Valor do serviço resultante/)).toHaveTextContent("R$ 105,00");
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar ajuste" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/ordens-servico/1/ajustar-valor", {
      valor_final_esperado: 100, novo_valor_final: 95, motivo: "Correção do preço combinado",
    }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Cobrancas de Clinica sintetica" }))
      .getByRole("button", { name: "Fechar destinatario Clinica sintetica" })).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Cobrancas de Clinica sintetica" }))
      .getAllByText(/R\$\s*95,00/)).toHaveLength(2));
    expect(within(screen.getByRole("region", { name: "Cobrancas de Clinica sintetica" }))
      .getByTitle("Selecionar para baixa em lote")).not.toBeChecked();
    expect(mocks.get.mock.calls.filter(([url]) => String(url).startsWith("/ordens-servico/cobrancas?"))).toHaveLength(2);
    expect(mocks.get.mock.calls.filter(([url]) => String(url).startsWith("/ordens-servico?"))).toHaveLength(2);
  });

  it("orienta recarregar após conflito e usa o novo valor como base", async () => {
    mocks.patch.mockImplementationOnce(async () => {
      ordemAtual = { ...ordemAtual, valor_final: 110 };
      throw { response: { status: 409 } };
    });
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar valor da OS OS-1" }));
    const modal = await screen.findByRole("dialog", { name: "Ajustar valor da OS" });
    await waitFor(() => expect(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" })).toHaveValue("100.00"));
    fireEvent.change(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" }), { target: { value: "95" } });
    fireEvent.change(within(modal).getByRole("textbox", { name: "Motivo do ajuste" }), { target: { value: "Preço combinado" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar ajuste" }));
    expect(await within(modal).findByRole("button", { name: "Recarregar OS" })).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole("button", { name: "Recarregar OS" }));
    await waitFor(() => expect(within(modal).getByRole("textbox", { name: "Novo valor final (R$)" })).toHaveValue("110.00"));
  });

  it("mantem o preco ajustado ao editar somente observacoes", async () => {
    window.history.replaceState({}, "", "/financeiro?aba=ordens");
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByDisplayValue("Original"), { target: { value: "Nova observação" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteracoes" }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/ordens-servico/1", { observacoes: "Nova observação" }));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty("recalcular_preco");
    expect(ordemAtual.valor_final).toBe(100);
  });

  it("recebe individual com valor esperado da OS mesmo quando o pagamento excede esse valor", async () => {
    window.history.replaceState({}, "", "/financeiro?aba=ordens");
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Receber" }));
    await screen.findByText("Receber Ordem de Servico");
    fireEvent.change(screen.getByDisplayValue("100.00"), { target: { value: "120.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Recebimento" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/ordens-servico/1/receber", expect.objectContaining({
      valor_final_esperado: 100,
      pagamentos: [expect.objectContaining({ valor: 120 })],
      destino_credito_excedente: "cliente",
    })));
  });

  it("recarrega a OS e nao informa baixa individual quando o valor muda antes do PATCH", async () => {
    mocks.patch.mockImplementationOnce(async () => {
      ordemAtual = { ...ordemAtual, valor_final: 95 };
      throw { response: { status: 409, data: { detail: "O valor da OS mudou." } } };
    });
    window.history.replaceState({}, "", "/financeiro?aba=ordens");
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Receber" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Recebimento" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/ordens-servico/1/receber", expect.objectContaining({ valor_final_esperado: 100 })));
    await waitFor(() => expect(screen.queryByText("Receber Ordem de Servico")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText(/R\$\s*95,00/).length).toBeGreaterThanOrEqual(2));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Nenhum recebimento foi registrado"));
    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining("Recebimento registrado com sucesso"));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("envia o valor esperado por OS no lote e para ao receber 409", async () => {
    const segunda = { ...ordemAtual, id: 2, numero_os: "OS-2", paciente: "Outro paciente" };
    const leituraOriginal = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (url: string) => {
      if (url === "/ordens-servico/2") return { data: { ...segunda } };
      const response = await leituraOriginal(url);
      if (url.startsWith("/ordens-servico/cobrancas?")) {
        return { data: { ...response.data, total_os: 2, pendentes: 2,
          total_pendente: ordemAtual.valor_final + segunda.valor_final,
          items: response.data.items.map((grupo: Record<string, unknown>) => ({ ...grupo, quantidade_total: 2,
            quantidade_os: 2, total_pendente: ordemAtual.valor_final + segunda.valor_final })) } };
      }
      if (url.startsWith("/ordens-servico?")) {
        return { data: { ...response.data, total: 2,
          items: [...response.data.items, { ...segunda }],
          resumo: { pendentes: 2, valor_pendente: ordemAtual.valor_final + segunda.valor_final } } };
      }
      return response;
    });
    mocks.patch.mockImplementationOnce(async () => {
      ordemAtual = { ...ordemAtual, valor_final: 95 };
      throw { response: { status: 409, data: { detail: "O valor da OS mudou." } } };
    });
    render(<FinanceiroPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir destinatario Clinica sintetica" }));
    fireEvent.click(await screen.findByRole("button", { name: "Receber pendentes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar baixa em lote" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/ordens-servico/1/receber", expect.objectContaining({ valor_final_esperado: 100 })));
    await waitFor(() => expect(screen.queryByText("Receber OS em lote")).not.toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Cobrancas de Clinica sintetica" }))
      .getAllByText(/R\$\s*195,00/)).toHaveLength(1));
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Nenhuma baixa foi registrada"));
    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining("Baixa em lote registrada com sucesso"));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("nao oferece ajuste de valor para OS recebida", async () => {
    ordemAtual = { ...ordemAtual, status: "Pago" };
    window.history.replaceState({}, "", "/financeiro?aba=ordens");
    render(<FinanceiroPage />);
    await screen.findByText("OS #OS-1");
    expect(screen.queryByRole("button", { name: "Ajustar valor da OS OS-1" })).not.toBeInTheDocument();
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
