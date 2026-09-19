import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PortalExamLinkWorkspace from "./PortalExamLinkWorkspace";

const exameLiberado = {
  clinica_nome: "Clinica Pet Sus",
  paciente_nome: "Thor",
  tipo_exame: "Ecocardiograma",
  data_exame: "2026-09-17",
  arquivos: [
    {
      anexo_id: 12,
      nome_original: "laudo-thor.pdf",
      mime_type: "application/pdf",
      download_url: "/api/v1/portal/anexos/12/arquivo",
      download_token: "token-de-download",
      download_token_header: "x-portal-download-token",
      expires_at: "2026-09-18T14:37:00",
    },
  ],
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function montar(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  return render(<PortalExamLinkWorkspace linkToken="token-do-link" />);
}

describe("laudo aberto pelo link do WhatsApp", () => {
  it("mostra o laudo e baixa o arquivo sem pedir login", async () => {
    // Só os dois estáticos que o jsdom não traz: trocar o global `URL` inteiro
    // quebra o `new URL(...)` que o próprio fetch usa para resolver o endereço.
    const criarObjectUrl = vi.fn(() => "blob:laudo");
    Object.defineProperty(window.URL, "createObjectURL", {
      value: criarObjectUrl,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    const fetchMock = vi.fn(async (url: unknown, _init?: RequestInit) =>
      String(url).includes("/laudo-link/") ? json(exameLiberado) : new Response("%PDF-", { status: 200 }),
    );

    montar(fetchMock);

    expect(await screen.findByText("Thor")).toBeInTheDocument();
    expect(screen.getByText("Clinica Pet Sus")).toBeInTheDocument();
    expect(screen.getByText("Ecocardiograma")).toBeInTheDocument();
    expect(screen.getByText("17/09/2026")).toBeInTheDocument();
    // Nenhum campo de credencial na tela: e esse o ponto da feature.
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();

    const [resolveUrl, resolveInit] = fetchMock.mock.calls[0];
    expect(String(resolveUrl)).toBe("/api/v1/portal/laudo-link/token-do-link");
    expect((resolveInit as RequestInit | undefined)?.method).toBe("POST");

    fireEvent.click(screen.getByRole("button", { name: /laudo-thor\.pdf/ }));

    await waitFor(() => expect(criarObjectUrl).toHaveBeenCalledOnce());
    const chamadaDownload = fetchMock.mock.calls.find(([url]) => String(url).includes("/anexos/12/arquivo"));
    expect(chamadaDownload).toBeDefined();
    expect(
      (chamadaDownload?.[1] as RequestInit | undefined)?.headers,
    ).toMatchObject({ "x-portal-download-token": "token-de-download" });
  });

  it("mostra mensagem generica quando o link nao vale mais", async () => {
    const fetchMock = vi.fn(async () => json({ detail: "Link de laudo invalido ou indisponivel." }, 404));

    montar(fetchMock);

    expect(await screen.findByText("Este link não está mais disponível.")).toBeInTheDocument();
    // A tela nao pode revelar se o token existiu, se foi revogado ou se o laudo
    // saiu do ar - o backend devolve o mesmo 404 para os tres casos.
    expect(screen.queryByText(/revogad/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /portal completo/i })).toBeInTheDocument();
  });

  it("avisa quando o laudo esta liberado mas sem arquivo para baixar", async () => {
    const fetchMock = vi.fn(async () => json({ ...exameLiberado, arquivos: [] }));

    montar(fetchMock);

    expect(await screen.findByText(/arquivo ainda não está disponível/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\.pdf/ })).not.toBeInTheDocument();
  });
});
