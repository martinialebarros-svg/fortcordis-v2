import { describe, expect, it } from "vitest";
import { deriveAutomaticEchoMeasurements } from "./echo-derived-measurements";

describe("deriveAutomaticEchoMeasurements", () => {
  it("calcula E/A automaticamente a partir das ondas transmitrais", () => {
    expect(
      deriveAutomaticEchoMeasurements(
        {
          Onda_E: "1,17",
          Onda_A: "1,12",
        },
        "10"
      )
    ).toMatchObject({ E_A: "1.04" });
  });

  it("preserva E/A histórico quando não há ondas suficientes para recalculá-lo", () => {
    expect(
      deriveAutomaticEchoMeasurements(
        {
          E_A: "1.35",
          Onda_E: "1.17",
        },
        "10"
      )
    ).not.toHaveProperty("E_A");
  });
});
