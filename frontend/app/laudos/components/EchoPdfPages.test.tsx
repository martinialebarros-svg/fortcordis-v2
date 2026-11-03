import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EchoPdfPages from "./EchoPdfPages";

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), GlobalWorkerOptions: { workerSrc: "" } }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => mocks);
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const page = () => ({
  getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale })),
  render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })), cleanup: vi.fn(),
});
const document = () => {
  const pages = [page(), page(), page()];
  return { numPages: 3, getPage: vi.fn(async (number: number) => pages[number - 1]), pages };
};
const task = (pdf = document()) => ({ promise: Promise.resolve(pdf), destroy: vi.fn(async () => {}) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDocument.mockImplementation(() => task());
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("páginas PDF renderizadas sem plug-in nativo", () => {
  it("carrega sob demanda biblioteca/worker locais e desenha somente a primeira página", async () => {
    const pdf = document(); mocks.getDocument.mockReturnValue(task(pdf));
    render(<EchoPdfPages url="blob:qa-first" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 1 do PDF de rascunho" })).not.toHaveClass("invisible"));
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(pdf.getPage).toHaveBeenCalledTimes(1); expect(pdf.getPage).toHaveBeenCalledWith(1);
    expect(pdf.pages[0].render).toHaveBeenCalledWith(expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) }));
    expect(pdf.pages[1].render).not.toHaveBeenCalled();
    expect(mocks.getDocument).toHaveBeenCalledWith({ url: "blob:qa-first", useWorkerFetch: false, isEvalSupported: false });
    expect(mocks.GlobalWorkerOptions.workerSrc).toContain("pdf.worker.min.mjs");
    expect(mocks.GlobalWorkerOptions.workerSrc).not.toMatch(/cdn|unpkg|jsdelivr/);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByTitle("Prévia do laudo em PDF — rascunho")).toHaveAttribute("aria-label", "Prévia do laudo em PDF — rascunho");
  });
  it("navega páginas com limite e limpa renderização anterior", async () => {
    const pdf = document(); mocks.getDocument.mockReturnValue(task(pdf));
    render(<EchoPdfPages url="blob:qa-pages" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 1 do PDF de rascunho" })).not.toHaveClass("invisible"));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 2 do PDF de rascunho" })).not.toHaveClass("invisible"));
    expect(pdf.pages[0].cleanup).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(screen.getByText("Página 3 de 3")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    await waitFor(() => expect(screen.getByText("Página 2 de 3")).toBeInTheDocument());
    expect(pdf.getPage.mock.calls.map(([number]) => number)).toEqual([1, 2, 3, 2]);
  });
  it("URL nova destrói o carregamento/documento anterior e ignora resultado tardio", async () => {
    const pending = deferred<ReturnType<typeof document>>();
    const oldTask = { promise: pending.promise, destroy: vi.fn(async () => {}) };
    const next = document(); mocks.getDocument.mockReturnValueOnce(oldTask).mockReturnValueOnce(task(next));
    const { rerender } = render(<EchoPdfPages url="blob:old" />);
    await waitFor(() => expect(mocks.getDocument).toHaveBeenCalledOnce());
    rerender(<EchoPdfPages url="blob:current" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 1 do PDF de rascunho" })).not.toHaveClass("invisible"));
    expect(oldTask.destroy).toHaveBeenCalledOnce();
    const old = document(); await act(async () => pending.resolve(old));
    expect(old.getPage).not.toHaveBeenCalled(); expect(next.getPage).toHaveBeenCalledOnce();
  });
  it("desmontar cancela a página ainda em renderização e destrói o documento", async () => {
    const pending = deferred<void>(); const cancel = vi.fn();
    const pdf = document(); pdf.pages[0].render.mockReturnValue({ promise: pending.promise, cancel });
    const loading = task(pdf); mocks.getDocument.mockReturnValue(loading);
    const { unmount } = render(<EchoPdfPages url="blob:cancel" />);
    await waitFor(() => expect(pdf.pages[0].render).toHaveBeenCalled());
    unmount(); expect(cancel).toHaveBeenCalledOnce(); expect(loading.destroy).toHaveBeenCalledOnce();
    await act(async () => pending.resolve()); expect(pdf.pages[0].cleanup).toHaveBeenCalled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("trocar página cancela render anterior mesmo que ele termine tarde", async () => {
    const pending = deferred<void>(); const cancel = vi.fn();
    const pdf = document(); pdf.pages[0].render.mockReturnValue({ promise: pending.promise, cancel });
    mocks.getDocument.mockReturnValue(task(pdf)); render(<EchoPdfPages url="blob:pages-cancel" />);
    await waitFor(() => expect(pdf.pages[0].render).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 2 do PDF de rascunho" })).not.toHaveClass("invisible"));
    expect(cancel).toHaveBeenCalledOnce(); await act(async () => pending.resolve());
    expect(screen.queryByRole("img", { name: "Página 1 do PDF de rascunho" })).not.toBeInTheDocument();
  });
  it("falha de carregamento fica local e permite tentar visualizar novamente", async () => {
    const bad = { promise: Promise.reject(new Error("private reader detail")), destroy: vi.fn(async () => {}) };
    mocks.getDocument.mockReturnValueOnce(bad).mockReturnValueOnce(task());
    render(<EchoPdfPages url="blob:retry" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível visualizar o PDF"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("private reader detail");
    fireEvent.click(screen.getByRole("button", { name: "Tentar visualizar novamente" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 1 do PDF de rascunho" })).not.toHaveClass("invisible"));
    expect(bad.destroy).toHaveBeenCalledOnce();
  });
  it("falha ao renderizar uma página não afeta a próxima nem o PDF original", async () => {
    const pdf = document(); pdf.pages[0].render.mockImplementation(() => ({ promise: Promise.reject(new Error("render failure")), cancel: vi.fn() }));
    mocks.getDocument.mockReturnValue(task(pdf)); render(<EchoPdfPages url="blob:bad-page" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível visualizar esta página"));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 2 do PDF de rascunho" })).not.toHaveClass("invisible"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("mantém largura do canvas limitada ao contêiner e refaz apenas página atual ao redimensionar", async () => {
    let observed: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { observed = callback; } observe() {} disconnect = disconnect; });
    let width = 280; vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    const pdf = document(); mocks.getDocument.mockReturnValue(task(pdf));
    const { unmount } = render(<EchoPdfPages url="blob:responsive" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 1 do PDF de rascunho" })).not.toHaveClass("invisible"));
    const canvas = screen.getByRole("img", { name: "Página 1 do PDF de rascunho" }); expect(canvas).toHaveStyle({ width: "280px" });
    width = 2000; act(() => observed?.());
    await waitFor(() => expect(screen.getByRole("img", { name: "Página 1 do PDF de rascunho" })).toHaveStyle({ width: "900px" }));
    expect(pdf.getPage.mock.calls.every(([number]) => number === 1)).toBe(true);
    unmount(); expect(disconnect).toHaveBeenCalledOnce();
  });
});
