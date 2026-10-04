import { describe, expect, it } from "vitest";
import { buildEchoReportGroups, prepareEchoReportMeasurements, splitReportObservations } from "./echo-report-presentation";
import type { ReferenciaEco } from "@/app/laudos/types/referencia-eco";

describe("prévia de ecocardiograma", () => {
  it("recalcula DIVEd normalizado com o peso atual e expõe divergência sem alterar o registro", () => {
    const stored = { DIVEd: "47.19", DIVEd_normalizado: "1.964", VE_tecnica_relatorio: "modo_m" };
    const { measurements, alerts } = prepareEchoReportMeasurements(stored, 13.9, "Canina");
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
      VE_vista_2D: "eixo_curto",
    };
    const selected2D = prepareEchoReportMeasurements(stored, 10, "Canina");
    expect(selected2D.measurements).toMatchObject({
      DIVEd_normalizado: "1.52",
      DIVEd_normalizado_2D: "1.55",
    });
    expect(selected2D.alerts).toEqual([{
      key: "DIVEd_normalizado_2D", recorded: 8, calculated: 1.55,
    }]);

    const selectedM = prepareEchoReportMeasurements({ ...stored, VE_tecnica_relatorio: "modo_m" }, 10, "Canina");
    expect(selectedM.alerts).toEqual([{
      key: "DIVEd_normalizado", recorded: 9, calculated: 1.52,
    }]);
  });

  it("mostra índice de Visser 2D e sua faixa somente com espécie, vista e peso aplicáveis", () => {
    const raw = { VE_tecnica_relatorio: "2d", VE_vista_2D: "eixo_curto", DIVEd_2D: "33.53", DIVEd_normalizado_2D: "1.56" };
    const { measurements, alerts, ambiguousKeys } = prepareEchoReportMeasurements(raw, 13.6, "Canina");
    expect(measurements.DIVEd_normalizado_2D).toBe("1.47");
    expect(alerts).toEqual([{ key: "DIVEd_normalizado_2D", recorded: 1.56, calculated: 1.47 }]);
    const reference = { especie: "Canina", peso_kg: 15 } as ReferenciaEco;
    expect(buildEchoReportGroups(measurements, reference, ambiguousKeys, 13.6)[0].rows
      .find((row) => row.key === "DIVEd_normalizado_2D")?.reference).toBe("1.14–1.61");
    expect(prepareEchoReportMeasurements(raw, 13.6, "Felina").measurements.DIVEd_normalizado_2D).toBeUndefined();
    expect(prepareEchoReportMeasurements({ ...raw, VE_vista_2D: "" }, 13.6, "Canina").measurements.DIVEd_normalizado_2D).toBeUndefined();
  });

  it("omite Cornell da prévia felina, mesmo se o índice antigo estiver salvo", () => {
    const raw = { VE_tecnica_relatorio: "modo_m", DIVEd: "11.46", DIVEd_normalizado: "0.90" };
    const { measurements, alerts } = prepareEchoReportMeasurements(raw, 2.3, "Felina");
    expect(raw.DIVEd_normalizado).toBe("0.90");
    expect(measurements.DIVEd_normalizado).toBeUndefined();
    expect(alerts).toEqual([]);
    expect(buildEchoReportGroups(measurements, null)[0].rows.map((row) => row.key)).not.toContain("DIVEd_normalizado");
  });

  it("deriva função atrial e gradiente da VSVE na prévia sem alterar o registro", () => {
    const raw = { AE_diametro_max: "18", AE_diametro_min: "13.5", Vmax_VSVE: "2.5" };
    const { measurements } = prepareEchoReportMeasurements(raw, 4, "Felina");
    expect(measurements.Fracao_encurtamento_AE).toBe("25");
    expect(measurements.Grad_VSVE).toBe("25");
    expect(raw).not.toHaveProperty("Fracao_encurtamento_AE");
    const groups = buildEchoReportGroups(measurements, null);
    expect(groups.find((group) => group.title === "Átrio esquerdo / aorta")?.rows
      .find((row) => row.key === "Fracao_encurtamento_AE")?.reference).toBe("—");
    expect(prepareEchoReportMeasurements({ ...raw, AE_diametro_min: "19" }, 4, "Felina")
      .measurements.Fracao_encurtamento_AE).toBeUndefined();
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
    const { measurements, ambiguousKeys } = prepareEchoReportMeasurements(raw, 10, "Canina");
    const groups = buildEchoReportGroups(measurements, null, ambiguousKeys);
    expect(measurements.SIVd).toBe("3.0");
    expect(measurements.DIVEd_normalizado).toBeUndefined();
    expect(groups[0].rows.find((row) => row.key === "SIVd")).toMatchObject({
      value: "3.00 (unidade a confirmar)", reference: "—",
    });
  });

  it("aplica somente as unidades confirmadas e mantém o restante sem comparação", () => {
    const raw = {
      DIVEd: "2.5", DIVES: "1.5", Atrio_esquerdo: "2.0", SIVd: "3.0",
      unidade_confirmada_DIVEd: "cm", unidade_confirmada_SIVd: "mm",
    };
    const reference = { id: 1, especie: "Canina", peso_kg: 10, lvid_d_min: 20, lvid_d_max: 40, ivs_d_min: 4, ivs_d_max: 10 } as ReferenciaEco;
    const { measurements, ambiguousKeys } = prepareEchoReportMeasurements(raw, 10, "Canina");
    expect(raw.DIVEd).toBe("2.5");
    expect(measurements).toMatchObject({ DIVEd: "25", SIVd: "3.0", DIVEd_normalizado: "1.27" });
    expect(ambiguousKeys).toEqual(new Set(["DIVES", "Atrio_esquerdo"]));
    const groups = buildEchoReportGroups(measurements, reference, ambiguousKeys);
    expect(groups[0].rows.find((row) => row.key === "DIVEd")).toMatchObject({ value: "25.00 mm", reference: "20.00–40.00 mm" });
    expect(groups[0].rows.find((row) => row.key === "SIVd")).toMatchObject({ value: "3.00 mm", reference: "4.00–10.00 mm" });
    expect(groups[0].rows.find((row) => row.key === "DIVES")).toMatchObject({ value: "1.50 (unidade a confirmar)", reference: "—" });
    expect(groups.some((group) => group.title === "Outras medidas registradas")).toBe(false);
  });

  it("usa apenas o modo selecionado sem atribuir a faixa Modo M à medida 2D", () => {
    const reference = { id: 1, especie: "Canina", peso_kg: 10, lvid_d_min: 20, lvid_d_max: 40 } as ReferenciaEco;
    const groups = buildEchoReportGroups({ VE_tecnica_relatorio: "2d", DIVEd: "30", DIVEd_2D: "32", FE_Teicholz_2D: "57" }, reference);
    expect(groups[0].title).toContain("2D");
    expect(groups[0].rows.map((row) => row.key)).toEqual(["DIVEd_2D", "FE_Teicholz_2D"]);
    expect(groups[0].rows[0]).toMatchObject({ value: "32.00 mm", reference: "—" });
    expect(groups[0].rows[1].reference).toBe("—");
  });

  it("repete na prévia as faixas 2D publicadas somente com vista persistida", () => {
    const reference = { id: 1, especie: "Canina", peso_kg: 15 } as ReferenciaEco;
    const measures = {
      VE_tecnica_relatorio: "2d", VE_vista_2D: "eixo_curto",
      DIVEd_2D: "33.53", DIVES_2D: "22.87", DeltaD_FS_2D: "31.8",
      SIVd_2D: "8.36", FE_Teicholz_2D: "61",
    };
    const rows = buildEchoReportGroups(measures, reference, new Set(), 13.6)[0].rows;
    expect(rows.find((row) => row.key === "DIVEd_2D")?.reference).toBe("26.01–36.73 mm");
    expect(rows.find((row) => row.key === "DIVES_2D")?.reference).toBe("15.58–25.87 mm");
    expect(rows.find((row) => row.key === "DeltaD_FS_2D")?.reference).toBe("21.90–49.30 %");
    expect(rows.find((row) => row.key === "SIVd_2D")?.reference).toBe("—");
    expect(rows.find((row) => row.key === "FE_Teicholz_2D")?.reference).toBe("—");
    expect(buildEchoReportGroups({ ...measures, VE_vista_2D: "" }, reference, new Set(), 13.6)[0].rows[0].reference).toBe("—");
  });

  it("mostra FS de modo M com fonte e FE Teichholz sem faixa", () => {
    const reference = {
      id: 1, especie: "Canina", peso_kg: 10,
      fs_min: 20.7, fs_max: 51.9, fs_source: "Visser et al. 2019",
      ef_min: 50, ef_max: 85,
    } as ReferenciaEco;
    const rows = buildEchoReportGroups({ DeltaD_FS: "30", FE_Teicholz: "70" }, reference)[0].rows;
    expect(rows.find((row) => row.key === "DeltaD_FS")?.reference).toBe("20.70–51.90 %");
    expect(rows.find((row) => row.key === "FE_Teicholz")?.reference).toBe("—");
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
