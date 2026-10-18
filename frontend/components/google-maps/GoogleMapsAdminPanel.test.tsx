import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleMapsAdminPanel from "./GoogleMapsAdminPanel";

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/axios", () => ({ default: mocks }));

const existing = {
  configured: true, enabled: true, revision: 7,
  config: {
    enabled: true,
    limits: { action: { calls: 10, estimated_brl: "1" }, day: { calls: 100, estimated_brl: "10" }, month: { calls: 500, estimated_brl: "50" } },
    prices_usd: { routes_essentials: "0.005", routes_pro: "0.01", distance_matrix_essentials: "0.005", distance_matrix_pro: "0.01", geocoding: "0.005" },
    fx_brl_per_usd_upper: "6", price_multiplier: "1.2", pricing_valid_until: "2026-11-01T03:00:00Z",
    action_call_caps: { clinic_geocode: 1 }, automatic_policies: {},
    opening_usage: { day: { calls: 3, estimated_brl: "0.5" }, month: { calls: 20, estimated_brl: "4" } },
    opening_usage_as_of: "2026-10-18", opening_usage_basis: "synthetic_stage",
  },
  history: [{ id: 1, action: "agenda_search", kind: "blocked", created_at: "2026-10-18T15:00:00Z", reason: "day_limit", message: "Limite diário atingido.", calls: 0, estimated_brl: 0 }],
};

describe("administração de custos Google Maps", () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.put.mockReset(); });

  it("começa com limites vazios e chamadas suspensas; não presume um teto", async () => {
    mocks.get.mockResolvedValue({ data: { configured: false, revision: 0, config: null } });
    render(<GoogleMapsAdminPanel />);
    await screen.findByText(/Chamadas pagas suspensas/);
    expect(screen.getByRole("checkbox", { name: /Habilitar chamadas/ })).not.toBeChecked();
    expect(screen.getByLabelText("Máximo estimado em R$ — por mês")).toHaveValue(null);
    expect(screen.getByLabelText("Máximo de chamadas — por mês")).toHaveValue(null);
    fireEvent.submit(screen.getByRole("button", { name: "Salvar controles" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum teto será presumido");
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("preserva a revisão e o consumo inicial e salva apenas valores explícitos", async () => {
    mocks.get.mockResolvedValue({ data: existing });
    mocks.put.mockResolvedValue({ data: existing });
    render(<GoogleMapsAdminPanel />);
    await screen.findByText(/Chamadas habilitadas/);
    expect(screen.getByText(/Limite diário atingido/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Máximo estimado em R$ — por mês"), { target: { value: "42" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar controles" }).closest("form")!);
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/google-maps-control/config", expect.objectContaining({
      expected_revision: 7, enabled: true, action_call_caps: { clinic_geocode: 1 }, automatic_policies: {},
      opening_usage: existing.config.opening_usage,
      limits: expect.objectContaining({ month: { calls: 500, estimated_brl: 42 } }),
    })));
  });

  it("opt-in automático exige limites próprios e não copia os globais", async () => {
    mocks.get.mockResolvedValue({ data: existing });
    render(<GoogleMapsAdminPanel />);
    await screen.findByText(/Chamadas habilitadas/);
    fireEvent.click(screen.getByRole("checkbox", { name: /Autorizar consultas automáticas/ }));
    expect(screen.getByLabelText("Chamadas automáticas — por mês")).toHaveValue(null);
    fireEvent.submit(screen.getByRole("button", { name: "Salvar controles" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum teto será presumido");
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
