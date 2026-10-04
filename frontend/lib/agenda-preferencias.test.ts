import { describe, expect, it } from "vitest";
import { dataFortaleza, FILTROS_PREFERENCIA_VAZIOS, filtrosDePreferencia, resolverPreferenciaAgenda } from "./agenda-preferencias";
import { normalizarAgendaRotaRegras } from "./agenda-route-rules";

describe("preferências da agenda", () => {
  it("ancora a próxima semana no calendário de Fortaleza mesmo após meia-noite UTC", () => {
    const referencia = dataFortaleza(new Date("2026-10-05T01:00:00Z"));
    expect(referencia).toBe("2026-10-04");
    expect(resolverPreferenciaAgenda({ ...FILTROS_PREFERENCIA_VAZIOS, quando: "proxima_semana", turno: "tarde" }, referencia))
      .toEqual({ preferencia: { data_inicio: "2026-10-05", data_fim: "2026-10-11", turno: "tarde" } });
  });

  it("resolve esta semana de segunda a domingo e atravessa a virada do ano", () => {
    expect(resolverPreferenciaAgenda({ ...FILTROS_PREFERENCIA_VAZIOS, quando: "esta_semana" }, "2026-12-31"))
      .toEqual({ preferencia: { data_inicio: "2026-12-28", data_fim: "2027-01-03", turno: "qualquer" } });
  });

  it("não envia restrição para sem preferência e aceita turno sem data", () => {
    expect(resolverPreferenciaAgenda(FILTROS_PREFERENCIA_VAZIOS, "2026-10-04")).toEqual({});
    expect(resolverPreferenciaAgenda({ ...FILTROS_PREFERENCIA_VAZIOS, turno: "manha" }, "2026-10-04"))
      .toEqual({ preferencia: { turno: "manha" } });
  });

  it("rejeita pares incompletos, datas inválidas e período maior que 31 dias", () => {
    const filtros = { ...FILTROS_PREFERENCIA_VAZIOS, quando: "intervalo" as const, dataInicio: "2026-10-01", dataFim: "" };
    expect(resolverPreferenciaAgenda(filtros, "2026-10-04").erro).toBeTruthy();
    expect(resolverPreferenciaAgenda({ ...filtros, dataFim: "2026-11-01" }, "2026-10-04").erro).toMatch(/31 dias/);
    expect(resolverPreferenciaAgenda({ ...filtros, dataFim: "2026-10-31" }, "2026-10-04").erro).toBeUndefined();
    expect(resolverPreferenciaAgenda({ ...filtros, dataFim: "2026-09-30" }, "2026-10-04").erro).toBeTruthy();
    expect(resolverPreferenciaAgenda({ ...filtros, dataInicio: "2026-02-30", dataFim: "2026-03-02" }, "2026-10-04").erro).toBeTruthy();
  });

  it("preserva a preferência importada sem transformar uma data absoluta em semana relativa", () => {
    const preferencia = { data_inicio: "2026-10-05", data_fim: "2026-10-11", turno: "qualquer" as const, hora_inicio: "13:15", hora_fim: "16:45" };
    const filtros = filtrosDePreferencia(preferencia);
    expect(filtros.quando).toBe("intervalo");
    expect(filtros.turno).toBe("personalizado");
    expect(resolverPreferenciaAgenda(filtros, "2026-10-10")).toEqual({ preferencia });
  });

  it("exige faixa horária completa e crescente", () => {
    const filtros = { ...FILTROS_PREFERENCIA_VAZIOS, turno: "personalizado" as const, horaInicio: "15:00", horaFim: "" };
    expect(resolverPreferenciaAgenda(filtros, "2026-10-04").erro).toBeTruthy();
    expect(resolverPreferenciaAgenda({ ...filtros, horaFim: "14:00" }, "2026-10-04").erro).toBeTruthy();
    expect(resolverPreferenciaAgenda({ ...filtros, horaFim: "24:00" }, "2026-10-04").erro).toBeTruthy();
  });

  it("importa a interseção de turno e faixa sem ampliar a disponibilidade", () => {
    const filtros = filtrosDePreferencia({ turno: "tarde", hora_inicio: "10:00", hora_fim: "17:00" });
    expect(resolverPreferenciaAgenda(filtros, "2026-10-04")).toEqual({
      preferencia: { turno: "qualquer", hora_inicio: "12:00", hora_fim: "17:00" },
    });
    const semIntersecao = filtrosDePreferencia({ turno: "manha", hora_inicio: "13:00", hora_fim: "17:00" });
    expect(resolverPreferenciaAgenda(semIntersecao, "2026-10-04").erro).toBeTruthy();
  });

  it("mantém intervalo da mesma clínica independente da margem de viagem e aceita zero", () => {
    expect(normalizarAgendaRotaRegras({}).thresholds.same_location_transition_min).toBe(5);
    const regras = normalizarAgendaRotaRegras({ thresholds: { same_location_transition_min: 0, safe_margin_min: 12 } });
    expect(regras.thresholds.same_location_transition_min).toBe(0);
    expect(regras.thresholds.safe_margin_min).toBe(12);
  });
});
