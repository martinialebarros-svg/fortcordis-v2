import { describe, expect, it } from "vitest";
import { deriveAutomaticEchoMeasurements, parseStoredEchoMeasurements } from "./echo-derived-measurements";

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

  it("lê unidade confirmada e calcula DIVEd normalizado somente com unidade conhecida", () => {
    const description = "## Medidas Ecocardiograficas\n- DIVEd: 2.5\n- SIVd: 3.0\n- PLVEd: 0.8\n- unidade_confirmada_DIVEd: cm\n- unidade_confirmada_SIVd: mm\n\n## Avaliacao Qualitativa";
    const parsed = parseStoredEchoMeasurements(null, description);
    expect(parsed.unidade_confirmada_DIVEd).toBe("cm");
    expect(parsed.unidade_confirmada_SIVd).toBe("mm");
    expect(deriveAutomaticEchoMeasurements(parsed, 10).DIVEd_normalizado).toBe("1.27");
    expect(deriveAutomaticEchoMeasurements({ DIVEd: "2.5", SIVd: "3.0", PLVEd: "0.8" }, 10).DIVEd_normalizado).toBe("");
    expect(parseStoredEchoMeasurements(null, description.replace("cm", "metros"))).not.toHaveProperty("unidade_confirmada_DIVEd");
  });

  it("preserva somente vistas 2D explicitamente confirmadas", () => {
    const description = "## Medidas Ecocardiograficas\n- DIVEd_2D: 33.53\n- VE_vista_2D: eixo_curto\n\n## Avaliacao Qualitativa";
    expect(parseStoredEchoMeasurements(null, description).VE_vista_2D).toBe("eixo_curto");
    expect(parseStoredEchoMeasurements(null, description.replace("eixo_curto", "desconhecida"))).not.toHaveProperty("VE_vista_2D");
    expect(deriveAutomaticEchoMeasurements({ DIVEd_2D: "33.53", VE_vista_2D: "eixo_curto" }, 13.6, "Canina").DIVEd_normalizado_2D).toBe("1.47");
    expect(deriveAutomaticEchoMeasurements({ DIVEd_2D: "33.53", VE_vista_2D: "eixo_curto" }, 13.6, "Felina")).not.toHaveProperty("DIVEd_normalizado_2D");
  });
});
