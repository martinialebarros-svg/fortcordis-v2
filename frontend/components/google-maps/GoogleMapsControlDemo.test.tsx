import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/axios";
import { mapsConfirmationStore } from "@/lib/google-maps-control";
import GoogleMapsActionGuard from "./GoogleMapsActionGuard";
import GoogleMapsControlDemo from "./GoogleMapsControlDemo";
vi.mock("next/navigation", () => ({ usePathname: () => "/configuracoes" }));
afterEach(() => { act(() => mapsConfirmationStore.cancelAll()); vi.restoreAllMocks(); });
describe("demonstração segura do controle Maps", () => {
  it("mostra cache e teto atingido sem chamar API", () => {
    const request = vi.spyOn(api, "request"); const post = vi.spyOn(api, "post");
    render(<GoogleMapsControlDemo />);
    fireEvent.click(screen.getByRole("button", { name: "Rota já armazenada" }));
    expect(screen.getByRole("status")).toHaveTextContent("sem popup, token ou nova consulta paga");
    fireEvent.click(screen.getByRole("button", { name: "Limite atingido" }));
    expect(screen.getByRole("status")).toHaveTextContent("não é confirmado automaticamente");
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
