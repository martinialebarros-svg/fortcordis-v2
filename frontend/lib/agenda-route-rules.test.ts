import { describe, expect, it } from "vitest";

import { DEFAULT_AGENDA_ROTA_REGRAS, normalizarAgendaRotaRegras } from "./agenda-route-rules";

describe("horarios minimos do primeiro atendimento", () => {
  it("nao publica endereco residencial em valores padrao", () => {
    const base = normalizarAgendaRotaRegras(null).base;
    expect(base.address).toBe("");
    expect(base.zip_code).toBe("");
  });

  it("inclui os horarios regionais em configuracoes antigas sem alterar os demais ajustes", () => {
    const regras = normalizarAgendaRotaRegras({
      route_policy: { end_of_route_window_start: "15:30" },
    });

    expect(regras.route_policy.end_of_route_window_start).toBe("15:30");
    expect(regras.route_policy.first_appointment_city_floors).toEqual(
      DEFAULT_AGENDA_ROTA_REGRAS.route_policy.first_appointment_city_floors
    );
  });

  it("aceita horario regional configurado e rejeita horario invalido", () => {
    const regras = normalizarAgendaRotaRegras({
      route_policy: {
        first_appointment_city_floors: { maracanau: "09:30", itaitinga: "25:00" },
      },
    });

    expect(regras.route_policy.first_appointment_city_floors.maracanau).toBe("09:30");
    expect(regras.route_policy.first_appointment_city_floors.itaitinga).toBe("09:00");
  });
});
