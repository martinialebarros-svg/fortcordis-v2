import { describe, expect, it } from "vitest";
import {
  ambiguousEchoLengthKeys,
  confirmedUnitKey,
  echoLengthInMm,
  echoLengthInputLabel,
  echoUnitReviewCandidates,
  mergeImportedEchoMeasurements,
  updateEchoMeasurement,
} from "./echo-unit-provenance";

const legacy = { DIVEd: "2.5", DIVES: "1.5", Atrio_esquerdo: "2.0", SIVd: "3.0" };

describe("proveniência de unidade ecocardiográfica", () => {
  it("retira confirmações apenas das origens diastólicas relacionadas, inclusive em reimportação", () => {
    const confirmed = { Onda_E: "1.08", e_doppler: "0.16", TRIV: "40", Diastolica_metodo: "felino_adulto_nao_sedado_pw_clique_aortico", Diastolica_ondas: "fundidas", TDI_metodo: "felino_pw_anel_lateral", TDI_ondas: "separadas" };
    const changedFlow = updateEchoMeasurement(confirmed, "Onda_E", "1.1");
    expect(changedFlow).not.toHaveProperty("Diastolica_metodo");
    expect(changedFlow).not.toHaveProperty("Diastolica_ondas");
    expect(changedFlow.TDI_metodo).toBe(confirmed.TDI_metodo);
    expect(changedFlow.TDI_ondas).toBe("separadas");
    expect(updateEchoMeasurement(confirmed, "e_doppler", "0.15")).toMatchObject({ Diastolica_ondas: "fundidas" });
    expect(updateEchoMeasurement(confirmed, "e_doppler", "0.15")).not.toHaveProperty("TDI_metodo");
    expect(updateEchoMeasurement(confirmed, "TRIV", "40")).toEqual(confirmed);
    expect(updateEchoMeasurement(confirmed, "E_E_linha", "6.75")).toMatchObject({ Diastolica_ondas: "fundidas", TDI_ondas: "separadas", TDI_metodo: "felino_pw_anel_lateral" });
    expect(updateEchoMeasurement(confirmed, "doppler_tecidual_relacao", "1.6")).toMatchObject({ Diastolica_metodo: confirmed.Diastolica_metodo, TDI_metodo: confirmed.TDI_metodo });
    const imported = mergeImportedEchoMeasurements(confirmed, { Onda_E: "1.08", e_doppler: "0.16", TDI_metodo: "felino_pw_anel_lateral" });
    for (const key of ["Diastolica_metodo", "Diastolica_ondas", "TDI_metodo", "TDI_ondas"]) expect(imported).not.toHaveProperty(key);
  });
  it("oferece confirmação somente no conjunto de dimensões potencialmente ambíguo", () => {
    expect(echoUnitReviewCandidates({ DIVEd: "35", SIVd: "8", PLVEd: "9" })).toEqual([]);
    expect(echoUnitReviewCandidates(legacy)).toEqual(expect.arrayContaining(["DIVEd", "SIVd"]));
    expect(ambiguousEchoLengthKeys(legacy).has("SIVd")).toBe(true);
  });

  it("respeita mm e cm individualmente sem alterar os valores registrados", () => {
    const confirmed = { ...legacy, [confirmedUnitKey("DIVEd")]: "cm", [confirmedUnitKey("SIVd")]: "mm" };
    expect(confirmed.DIVEd).toBe("2.5");
    expect(echoLengthInMm(confirmed, "DIVEd")).toBe(25);
    expect(echoLengthInMm(confirmed, "SIVd")).toBe(3);
    expect(echoLengthInMm(confirmed, "DIVES")).toBeNull();
    expect(ambiguousEchoLengthKeys(confirmed)).toEqual(new Set(["DIVES", "Atrio_esquerdo"]));
    expect(echoLengthInputLabel("DIVEd (mm)", confirmed, "DIVEd")).toBe("DIVEd (cm de origem)");
    expect(echoLengthInputLabel("DIVEs (mm)", confirmed, "DIVES")).toBe("DIVEs (unidade a confirmar)");
  });

  it("descarta a confirmação quando a medida é alterada ou substituída por importação", () => {
    const confirmed = { ...legacy, [confirmedUnitKey("SIVd")]: "mm" };
    expect(updateEchoMeasurement(confirmed, "SIVd", "3.1")[confirmedUnitKey("SIVd")]).toBeUndefined();
    expect(mergeImportedEchoMeasurements(confirmed, { SIVd: "2.9" })[confirmedUnitKey("SIVd")]).toBeUndefined();
    expect(mergeImportedEchoMeasurements(confirmed, { SIVd: "3.0" })[confirmedUnitKey("SIVd")]).toBeUndefined();
    expect(updateEchoMeasurement(confirmed, "SIVd", "3.0")[confirmedUnitKey("SIVd")]).toBe("mm");
    expect(updateEchoMeasurement(confirmed, confirmedUnitKey("SIVd"), "")[confirmedUnitKey("SIVd")]).toBeUndefined();
  });

  it("descarta método quando a aquisição é substituída e preserva confirmação de medidas não alteradas", () => {
    const confirmed = { TAPSE: "10", TAPSE_metodo: "modo_m_apical", AE_Ao: "1.42", AE_Ao_metodo: "2d_eixo_curto_diastole_inicial", Aorta: "12" };
    expect(updateEchoMeasurement(confirmed, "TAPSE", "11")).not.toHaveProperty("TAPSE_metodo");
    expect(updateEchoMeasurement(confirmed, "TAPSE", "10").TAPSE_metodo).toBe("modo_m_apical");
    expect(updateEchoMeasurement(confirmed, "Aorta", "13")).not.toHaveProperty("AE_Ao_metodo");
    expect(updateEchoMeasurement(confirmed, "AE_Ao", "1.5")).not.toHaveProperty("AE_Ao_metodo");
    expect(updateEchoMeasurement(confirmed, "TAPSE_metodo", "")).not.toHaveProperty("TAPSE_metodo");
    expect(mergeImportedEchoMeasurements(confirmed, { TAPSE: "10" })).not.toHaveProperty("TAPSE_metodo");
    expect(mergeImportedEchoMeasurements(confirmed, { Aorta: "12" })).not.toHaveProperty("AE_Ao_metodo");
    expect(mergeImportedEchoMeasurements(confirmed, { TAPSE: "10", TAPSE_metodo: "modo_m_apical" })).not.toHaveProperty("TAPSE_metodo");
  });
});
