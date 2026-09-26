import { describe, expect, it } from "vitest";
import { buildEchoReportGroups, prepareEchoReportMeasurements, splitReportObservations } from "./echo-report-presentation";
import type { ReferenciaEco } from "@/app/laudos/types/referencia-eco";

describe("prévia de ecocardiograma", () => {
  it("recalcula DIVEd normalizado com o peso atual e expõe divergência sem alterar o registro", () => {
    const stored = { DIVEd: "47.19", DIVEd_normalizado: "1.964", VE_tecnica_relatorio: "modo_m" };
    const { measurements, alerts } = prepareEchoReportMeasurements(stored, 13.9);
    expect(stored.DIVEd_normalizado).toBe("1.964");
    expect(measurements.DIVEd_normalizado).toBe("2.18");
    expect(alerts).toEqual([{ key: "DIVEd_normalizado", recorded: 1.964, calculated: 2.18 }]);
  });

  it("alerta somente sobre o DIVEd normalizado da técnica selecionada", () => {
    const stored = {
      DIVEd: "30",
      DIVEd_normalizado: "9",
      DIVEd_2D: "32",
      DIVEd_normalizado_2D: "8",
      VE_tecnica_relatorio: "2d",
    };
    const selected2D = prepareEchoReportMeasurements(stored, 10);
    expect(selected2D.measurements).toMatchObject({
      DIVEd_normalizado: "1.52",
      DIVEd_normalizado_2D: "1.63",
    });
    expect(selected2D.alerts).toEqual([{
      key: "DIVEd_normalizado_2D", recorded: 8, calculated: 1.63,
    }]);

    const selectedM = prepareEchoReportMeasurements({ ...stored, VE_tecnica_relatorio: "modo_m" }, 10);
    expect(selectedM.alerts).toEqual([{
      key: "DIVEd_normalizado", recorded: 9, calculated: 1.52,
    }]);
  });

  it("mantém medidas legadas sem unidade como ambíguas e não calcula DIVEd normalizado", () => {
    const { measurements, ambiguousKeys } = prepareEchoReportMeasurements({ DIVEd: "3", SIVd: "0.7", PLVEd: "0.8" }, 10);
    expect(measurements.DIVEd).toBe("3");
    expect(measurements.DIVEd_normalizado).toBeUndefined();
    expect(ambiguousKeys.has("SIVd")).toBe(true);
    expect(prepareEchoReportMeasurements({ DIVEd: "3", SIVd: "0.7", PLVEd: "0.8", DIVEd_normalizado: "1.52" }, null).measurements.DIVEd_normalizado).toBeUndefined();
    expect(prepareEchoReportMeasurements({ DIVEd: "3", SIVd: "7", PLVEd: "8" }, 10).measurements.DIVEd).toBe("3");
  });

  it("preserva TAPSE, MAPSE e aorta já em mm em um conjunto legado misto", () => {
    const raw = {
      DIVEd: "3", SIVd: "0.7", PLVEd: "0.8",
      DIVES: "1.5", SIVs: "1", PLVES: "1.3",
      Aorta: "13.1", TAPSE: "10", MAPSE: "8",
      VE_tecnica_relatorio: "modo_m",
    };
    const { measurements } = prepareEchoReportMeasurements(raw, 10);

    expect(measurements).toMatchObject({
      DIVEd: "3", SIVd: "0.7", PLVEd: "0.8",
      Aorta: "13.1", TAPSE: "10", MAPSE: "8",
    });
    const groups = buildEchoReportGroups(measurements, null);
    const annular = groups.find((group) => group.title === "Excursão do plano anular");
    expect(annular?.rows.find((row) => row.key === "TAPSE")?.value).toBe("10.00 mm");
    expect(annular?.rows.find((row) => row.key === "MAPSE")?.value).toBe("8.00 mm");
    expect(groups.find((group) => group.title === "Átrio esquerdo / aorta")?.rows.find((row) => row.key === "Aorta")?.value).toBe("13.10 mm");
    expect(prepareEchoReportMeasurements({ ...raw, Aorta: "1.3" }, 10).measurements.Aorta).toBe("1.3");
  });

  it("não multiplica SIVd de 3 mm em conjunto legado misto", () => {
    const raw = { DIVEd: "2.5", DIVES: "1.5", Atrio_esquerdo: "2.0", SIVd: "3.0" };
    const { measurements, ambiguousKeys } = prepareEchoReportMeasurements(raw, 10);
    const groups = buildEchoReportGroups(measurements, null, ambiguousKeys);
    expect(measurements.SIVd).toBe("3.0");
    expect(measurements.DIVEd_normalizado).toBeUndefined();
    expect(groups[0].rows.find((row) => row.key === "SIVd")).toMatchObject({
      value: "3.00 (unidade a confirmar)", reference: "—",
    });
  });

  it("usa apenas o modo selecionado e exibe faixa disponível da referência", () => {
    const reference = { id: 1, especie: "Canina", peso_kg: 10, lvid_d_min: 20, lvid_d_max: 40 } as ReferenciaEco;
    const groups = buildEchoReportGroups({ VE_tecnica_relatorio: "2d", DIVEd: "30", DIVEd_2D: "32", FE_Teicholz_2D: "57" }, reference);
    expect(groups[0].title).toContain("2D");
    expect(groups[0].rows.map((row) => row.key)).toEqual(["DIVEd_2D", "FE_Teicholz_2D"]);
    expect(groups[0].rows[0]).toMatchObject({ value: "32.00 mm", reference: "20.00–40.00 mm" });
    expect(groups[0].rows[1].reference).toBe("—");
  });

  it("mantém TAPSE e MAPSE quando o VE é exibido em modo 2D", () => {
    const groups = buildEchoReportGroups({
      VE_tecnica_relatorio: "2d",
      DIVEd_2D: "32",
      TAPSE: "10",
      MAPSE: "8",
    }, null);

    expect(groups[0].rows.map((row) => row.key)).toEqual(["DIVEd_2D"]);
    expect(groups[1]).toMatchObject({
      title: "Excursão do plano anular",
      rows: [
        { key: "TAPSE", value: "10.00 mm" },
        { key: "MAPSE", value: "8.00 mm" },
      ],
    });
  });

  it("separa apenas linhas reconhecidas como administrativas", () => {
    expect(splitReportObservations("Achado clínico.\n[Assistente agenda] Horário reservado\n[Reserva manual] confirmação"))
      .toEqual({ clinical: "Achado clínico.", operational: "[Assistente agenda] Horário reservado\n[Reserva manual] confirmação" });
  });
});
