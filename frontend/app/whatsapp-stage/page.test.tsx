import { act, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WhatsAppStagePage from "./page";

vi.mock("../layout-dashboard", () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("WhatsAppStagePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("atualiza silenciosamente o status da mensagem selecionada", async () => {
    let messagesRequestCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith("/whatsapp/conversations?")) {
          return jsonResponse({
            data: [
              {
                id: "3926",
                wa_phone_number: "558500000000",
                wa_psid: "558500000000",
                status: "open",
                subject: "Cliente de teste",
                last_agent_id: null,
                last_activity_at: "2026-08-14T02:26:00.000Z",
                created_at: "2026-08-14T02:26:00.000Z",
                updated_at: "2026-08-14T02:26:00.000Z",
                last_message_body: "Teste recebido com sucesso pela Fort Cordis.",
                last_message_at: "2026-08-14T02:26:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 20, total: 1 },
          });
        }

        if (url === "/whatsapp/agents") {
          return jsonResponse({ data: [] });
        }

        if (url.startsWith("/whatsapp/conversations/3926/messages?")) {
          messagesRequestCount += 1;
          return jsonResponse({
            data: [
              {
                id: "1",
                conversation_id: "3926",
                wa_message_id: "wamid.test",
                from_me: true,
                body: "Teste recebido com sucesso pela Fort Cordis.",
                type: "text",
                status: messagesRequestCount === 1 ? "sent" : "delivered",
                created_at: "2026-08-14T02:26:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 50, total: 1 },
          });
        }

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("sent")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByText("delivered")).toBeInTheDocument();
    expect(screen.queryByText("Carregando mensagens...")).not.toBeInTheDocument();
  });
});
