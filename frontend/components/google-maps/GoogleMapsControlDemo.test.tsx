import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/axios";
import { mapsConfirmationStore } from "@/lib/google-maps-control";
import GoogleMapsActionGuard from "./GoogleMapsActionGuard";
import GoogleMapsControlDemo from "./GoogleMapsControlDemo";
vi.mock("next/navigation", () => ({ usePathname: () => "/configuracoes" }));
afterEach(() => { act(() => mapsConfirmationStore.cancelAll()); vi.restoreAllMocks(); });
describe("demonstração segura do controle Maps", () => {
  it("mostra cache e permite Agenda acima da referência sem chamar API", async () => {
    const request = vi.spyOn(api, "request"); const post = vi.spyOn(api, "post");
    render(<><GoogleMapsControlDemo /><GoogleMapsActionGuard /></>);
    fireEvent.click(screen.getByRole("button", { name: "Rota já armazenada" }));
    expect(screen.getByRole("status")).toHaveTextContent("sem popup, token ou nova consulta paga");
    expect(screen.getByRole("table")).toHaveTextContent("13.000 chamadas ou R$ 500 estimados");
    expect(document.body).not.toHaveTextContent("R$ 90,12");
    expect(document.body).not.toHaveTextContent("R$ 372,45");
    fireEvent.click(screen.getByRole("button", { name: "Lote bloqueado — Agenda liberada" }));
    expect(screen.getByRole("status")).toHaveTextContent("não autoriza recalcular a matriz nem tarefas automáticas pagas");
    fireEvent.click(screen.getByRole("button", { name: "Referência atingida — Agenda liberada" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Agenda liberada com alertas");
    expect(screen.getByRole("dialog")).toHaveTextContent("Referência atingida: a Agenda continua liberada");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar esta ação" }));
    expect(await screen.findByRole("status")).toHaveTextContent("inclusive acima da referência diária/mensal");
    expect(request).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  });
  it.each(["Cancelar", "Confirmar esta ação"])("%s no popup é apenas simulação", async (button) => {
    const request = vi.spyOn(api, "request"); const post = vi.spyOn(api, "post");
    render(<><GoogleMapsControlDemo /><GoogleMapsActionGuard /></>);
    fireEvent.click(screen.getByRole("button", { name: "Nova consulta de rota" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("SIMULAÇÃO");
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(await screen.findByRole("status")).toHaveTextContent(button === "Cancelar" ? "0 consultas pagas" : "0 consultas e 0 agendamentos");
    expect(request).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  });
});
