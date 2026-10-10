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

  it("preserva municipios adicionais ao carregar e salvar outra configuracao", () => {
    const respostaApi = {
      route_policy: {
        first_appointment_city_floors: {
          caucaia: "08:40",
          fortaleza: "09:15",
          aquiraz: "10:00",
        },
      },
    };
    const carregado = normalizarAgendaRotaRegras(respostaApi);
    const payload = normalizarAgendaRotaRegras({
      ...carregado,
      thresholds: { ...carregado.thresholds, safe_margin_min: 10 },
    });
    const recarregado = normalizarAgendaRotaRegras(JSON.parse(JSON.stringify(payload)));

    expect(recarregado.route_policy.first_appointment_city_floors).toEqual({
      ...DEFAULT_AGENDA_ROTA_REGRAS.route_policy.first_appointment_city_floors,
      caucaia: "08:40",
      fortaleza: "09:15",
      aquiraz: "10:00",
    });
    expect(recarregado.thresholds.safe_margin_min).toBe(10);
    expect(respostaApi.route_policy.first_appointment_city_floors).toEqual({
      caucaia: "08:40",
      fortaleza: "09:15",
      aquiraz: "10:00",
    });
  });

  it("normaliza municipios adicionais e horarios com os mesmos fallbacks do backend", () => {
    const regras = normalizarAgendaRotaRegras({
      route_policy: {
        first_appointment_city_floors: {
          " MARACANAÚ ": "09:15",
          Aquiraz: "08:45",
          " AQUIRAZ ": "25:00",
          "Eusébio": "25:00",
          "São Gonçalo---do Amarante": " 10:30 ",
          "Horizonte": "09:99",
          " -- ": "11:00",
        },
      },
    });

    expect(regras.route_policy.first_appointment_city_floors).toEqual({
      caucaia: "08:30",
      maracanau: "09:15",
      eusebio: "09:00",
      itaitinga: "09:00",
      aquiraz: "08:45",
      "sao goncalo do amarante": "10:30",
      horizonte: "08:00",
    });
  });

  it("preserva os quatro padroes e cinquenta municipios adicionais retornados pela API", () => {
    const pisosApi = {
      ...DEFAULT_AGENDA_ROTA_REGRAS.route_policy.first_appointment_city_floors,
      ...Object.fromEntries(Array.from({ length: 50 }, (_, indice) => [`municipio ${indice}`, "10:00"])),
    };
    const carregado = normalizarAgendaRotaRegras({
      route_policy: { first_appointment_city_floors: pisosApi },
    });
    const payload = normalizarAgendaRotaRegras(carregado);

    expect(Object.keys(payload.route_policy.first_appointment_city_floors)).toHaveLength(54);
    expect(payload.route_policy.first_appointment_city_floors).toEqual(pisosApi);
  });

  it.each([null, [], "aquiraz=10:00"])("mantem os pisos padrao com mapa invalido: %j", (pisos) => {
    const regras = normalizarAgendaRotaRegras({
      route_policy: { first_appointment_city_floors: pisos },
    });

    expect(regras.route_policy.first_appointment_city_floors).toEqual(
      DEFAULT_AGENDA_ROTA_REGRAS.route_policy.first_appointment_city_floors
    );
  });
});
