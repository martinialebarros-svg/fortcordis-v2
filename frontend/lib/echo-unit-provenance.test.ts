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
});
