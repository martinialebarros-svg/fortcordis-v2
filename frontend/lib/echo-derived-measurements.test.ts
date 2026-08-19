import { describe, expect, it } from "vitest";
import { deriveAutomaticEchoMeasurements } from "./echo-derived-measurements";

describe("deriveAutomaticEchoMeasurements", () => {
  it("calcula E/A, E/TRIV e E/e' automaticamente a partir das medidas de origem", () => {
    expect(
      deriveAutomaticEchoMeasurements(
        {
          Onda_E: "1,20",
          Onda_A: "0,60",
          TRIV: "48",
          e_doppler: "0,10",
        },
        "10"
      )
    ).toMatchObject({
      E_A: "2",
      E_TRIV: "2.5",
      E_E_linha: "12",
    });
  });

  it("preserva relações históricas quando não há medidas suficientes para recalculá-las", () => {
    const automaticas = deriveAutomaticEchoMeasurements(
      {
        E_A: "1.35",
        E_TRIV: "2.2",
        E_E_linha: "12.4",
        Onda_E: "1.17",
      },
      "10"
    );

    expect(automaticas).not.toHaveProperty("E_A");
    expect(automaticas).not.toHaveProperty("E_TRIV");
    expect(automaticas).not.toHaveProperty("E_E_linha");
  });
});
