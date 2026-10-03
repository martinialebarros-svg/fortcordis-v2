import { describe, expect, it } from "vitest";
import { findEchoNarrativeDiscrepancies } from "./echo-narrative-consistency";

describe("conferência numérica da narrativa ecocardiográfica", () => {
  it("sinaliza as três afirmações divergentes do padrão observado em PDF real, sem editar o texto", () => {
    const measurements = {
      VE_tecnica_relatorio: "modo_m", FE_Teicholz: "95", DeltaD_FS: "67", Vmax_aorta: "0.69",
    };
    const qualitative = {
      funcao: "Fração de ejeção estimada em 97% e fração de encurtamento de 71%.",
      vasos: "Velocidade aórtica superior a 3 m/s na via de saída do ventrículo esquerdo.",
    };
    expect(findEchoNarrativeDiscrepancies(measurements, qualitative, "").map((issue) => issue.key))
      .toEqual(["FE", "FEC", "Vmax_aorta"]);
    expect(qualitative.funcao).toContain("97%");
  });

  it("não bloqueia frases coerentes, pequenas diferenças de arredondamento ou métodos não selecionados", () => {
    const measurements = {
      VE_tecnica_relatorio: "2d", FE_Teicholz: "95", DeltaD_FS: "67",
      FE_Teicholz_2D: "61", DeltaD_FS_2D: "32", Vmax_aorta: "3.4",
    };
    expect(findEchoNarrativeDiscrepancies(
      measurements,
      { funcao: "Fração de ejeção de 61% e fração de encurtamento de 32%." },
      "Velocidade aórtica superior a 3 m/s.",
    )).toEqual([]);
    expect(findEchoNarrativeDiscrepancies(
      { FE_Teicholz: "95", DeltaD_FS: "67", FE_Teicholz_2D: "61" },
      { funcao: "Fração de ejeção de 97%." }, "",
    )).toEqual([]);
  });

  it("não equipara texto de via de saída a Vmax aórtica sem linguagem explícita", () => {
    expect(findEchoNarrativeDiscrepancies(
      { Vmax_aorta: "0.69" },
      { vasos: "Gradiente na via de saída acima de 3 m/s." }, "",
    )).toEqual([]);
  });
});
