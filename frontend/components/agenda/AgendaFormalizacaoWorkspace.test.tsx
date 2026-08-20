import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgendaFormalizacaoWorkspace from "./AgendaFormalizacaoWorkspace";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AgendaFormalizacaoWorkspace", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("carrega o contexto do agendamento e envia os dados preenchidos", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!init || (init.method || "GET").toUpperCase() === "GET") {
        return jsonResponse({
          clinica_nome: "Pet Sanus Caucaia",
          servico: "Ecocardiograma",
          data: "20/08/2026",
          hora: "14:30",
          expires_at: "2026-08-23T00:00:00.000Z",
        });
      }
      expect(url).toBe("/api/v1/agenda/formalizacao/test-token");
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({
        nome_paciente: "Rex",
        nome_tutor: "João Silva",
        telefone_tutor: "(85) 98888-7777",
      });
      return jsonResponse({ agendamento_id: 42, status: "Agendado" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AgendaFormalizacaoWorkspace token="test-token" />);

    expect(await screen.findByText("Pet Sanus Caucaia")).toBeInTheDocument();
    expect(screen.getByText("Ecocardiograma")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome do animal"), { target: { value: "Rex" } });
    fireEvent.change(screen.getByPlaceholderText("Nome do tutor responsável"), {
      target: { value: "João Silva" },
    });
    fireEvent.change(screen.getByPlaceholderText("(85) 99999-9999"), {
      target: { value: "(85) 98888-7777" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar dados/i }));
    });

    expect(await screen.findByText("Dados enviados com sucesso")).toBeInTheDocument();
  });

  it("mostra erro quando o link e invalido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "Este link expirou." }, 410)),
    );

    render(<AgendaFormalizacaoWorkspace token="expired-token" />);

    expect(await screen.findByText("Este link expirou.")).toBeInTheDocument();
  });
});
