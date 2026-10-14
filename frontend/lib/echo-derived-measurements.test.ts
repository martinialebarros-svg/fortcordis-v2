import { describe, expect, it } from "vitest";
import { deriveAutomaticEchoMeasurements, parseStoredEchoMeasurements } from "./echo-derived-measurements";
import { mergeImportedEchoMeasurements, updateEchoMeasurement } from "./echo-unit-provenance";

describe("deriveAutomaticEchoMeasurements", () => {
  it("exige separação felina confirmada após editar ou reimportar origens de um contexto fundido", () => {
    const historical = { Onda_E: "1.08", Onda_A: "0.95", TRIV: "40", e_doppler: "0.16", E_A: "1.13", E_TRIV: "2.66", E_E_linha: "6.95", Diastolica_metodo: "felino_adulto_nao_sedado_pw_clique_aortico", Diastolica_ondas: "fundidas", TDI_ondas: "separadas" };
    const contexts = [
      updateEchoMeasurement(historical, "Onda_E", "1.1"),
      mergeImportedEchoMeasurements(historical, { Onda_E: "1.08", Onda_A: "0.95" }),
      { ...historical, Diastolica_ondas: "" },
    ];
    for (const context of contexts) {
      const calculated = deriveAutomaticEchoMeasurements(context, 5.6, "Felina");
      for (const key of ["E_A", "E_TRIV", "E_E_linha"]) expect(calculated).not.toHaveProperty(key);
      const kept = { ...context, ...calculated };
      expect(kept).toMatchObject({ E_A: "1.13", E_TRIV: "2.66", E_E_linha: "6.95" });
    }
    const separate = { ...historical, Diastolica_ondas: "separadas" };
    expect(deriveAutomaticEchoMeasurements(separate, 5.6, "Felina")).toMatchObject({ E_A: "1.14", E_TRIV: "2.7", E_E_linha: "6.75" });
    const editedTissue = updateEchoMeasurement(separate, "e_doppler", "0.15");
    expect(deriveAutomaticEchoMeasurements(editedTissue, 5.6, "Felina")).not.toHaveProperty("E_E_linha");
    expect(deriveAutomaticEchoMeasurements({ ...historical, Diastolica_ondas: "", TDI_ondas: "" }, 5.6, "Canina"))
      .toMatchObject({ E_A: "1.14", E_TRIV: "2.7", E_E_linha: "6.75" });
  });
  it("persiste os controles diastólicos e teciduais sem inferi-los das medidas", () => {
    const metadata = { Diastolica_metodo: "felino_adulto_nao_sedado_pw_clique_aortico", Diastolica_ondas: "fundidas",
      TDI_metodo: "felino_pw_anel_lateral", TDI_ondas: "separadas" };
    expect(parseStoredEchoMeasurements(metadata)).toEqual(metadata);
    const description = "## Medidas Ecocardiograficas\n" + Object.entries(metadata).map(([key, value]) => `- ${key}: ${value}`).join("\n") + "\n\n## Avaliacao Qualitativa";
    expect(parseStoredEchoMeasurements(null, description)).toEqual(metadata);
    expect(parseStoredEchoMeasurements({ TDI_metodo: "inferido", Diastolica_ondas: "provavelmente_separadas" })).toEqual({});
  });

  it("não recalcula relações com ondas felinas explicitamente fundidas e conserva o histórico", () => {
    const raw = { Onda_E: "1.08", Onda_A: "0.95", e_doppler: "0.16", a_doppler: "0.08", TRIV: "40", E_A: "1.13", E_E_linha: "6.95", doppler_tecidual_relacao: "1.8", Diastolica_ondas: "fundidas", TDI_ondas: "separadas" };
    const derived = deriveAutomaticEchoMeasurements(raw, 5.6, "Felina");
    expect(derived).not.toHaveProperty("E_A");
    expect(derived).not.toHaveProperty("E_E_linha");
    expect(derived).not.toHaveProperty("E_TRIV");
    expect(derived.doppler_tecidual_relacao).toBe("2");
    expect(raw.E_E_linha).toBe("6.95");
    expect(deriveAutomaticEchoMeasurements({ ...raw, TDI_ondas: "fundidas" }, 5.6, "Felina")).not.toHaveProperty("doppler_tecidual_relacao");
    expect(deriveAutomaticEchoMeasurements({ ...raw, TDI_ondas: "" }, 5.6, "Felina")).not.toHaveProperty("doppler_tecidual_relacao");
    expect(deriveAutomaticEchoMeasurements(raw, 5.6, "Canina")).toMatchObject({ E_A: "1.14", E_E_linha: "6.75" });
  });
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
    expect(deriveAutomaticEchoMeasurements(parsed, 10, "Canina").DIVEd_normalizado).toBe("1.27");
    expect(deriveAutomaticEchoMeasurements({ DIVEd: "2.5", SIVd: "3.0", PLVEd: "0.8" }, 10, "Canina").DIVEd_normalizado).toBe("");
    expect(parseStoredEchoMeasurements(null, description.replace("cm", "metros"))).not.toHaveProperty("unidade_confirmada_DIVEd");
  });

  it("preserva somente vistas 2D explicitamente confirmadas", () => {
    const description = "## Medidas Ecocardiograficas\n- DIVEd_2D: 33.53\n- VE_vista_2D: eixo_curto\n\n## Avaliacao Qualitativa";
    expect(parseStoredEchoMeasurements(null, description).VE_vista_2D).toBe("eixo_curto");
    expect(parseStoredEchoMeasurements(null, description.replace("eixo_curto", "desconhecida"))).not.toHaveProperty("VE_vista_2D");
    expect(deriveAutomaticEchoMeasurements({ DIVEd_2D: "33.53", VE_vista_2D: "eixo_curto" }, 13.6, "Canina").DIVEd_normalizado_2D).toBe("1.47");
    expect(deriveAutomaticEchoMeasurements({ DIVEd_2D: "33.53", VE_vista_2D: "eixo_curto" }, 13.6, "Felina")).not.toHaveProperty("DIVEd_normalizado_2D");
  });

  it("persiste apenas métodos de TAPSE e AE/Ao explicitamente selecionados", () => {
    const saved = { TAPSE: "10", TAPSE_metodo: "modo_m_apical", AE_Ao: "1.42", AE_Ao_metodo: "2d_eixo_curto_diastole_inicial" };
    expect(parseStoredEchoMeasurements(saved)).toMatchObject(saved);
    const text = "## Medidas Ecocardiograficas\n- TAPSE: 10\n- TAPSE_metodo: 2d\n- AE_Ao_metodo: outro\n\n## Avaliacao Qualitativa";
    expect(parseStoredEchoMeasurements(null, text)).toMatchObject({ TAPSE_metodo: "2d", AE_Ao_metodo: "outro" });
    expect(parseStoredEchoMeasurements({ TAPSE_metodo: "modo_m", AE_Ao_metodo: "desconhecido" })).toEqual({});
    expect(parseStoredEchoMeasurements({ TAPSE: "10", AE_Ao: "1.42" })).not.toHaveProperty("TAPSE_metodo");
  });

  it("não calcula o índice de Cornell em felinos; deriva função atrial e gradiente da VSVE", () => {
    const raw = { DIVEd: "15", AE_diametro_max: "18", AE_diametro_min: "13.5", Vmax_VSVE: "2.5" };
    const derived = deriveAutomaticEchoMeasurements(raw, 4, "Felina");
    expect(derived).not.toHaveProperty("DIVEd_normalizado");
    expect(derived.Fracao_encurtamento_AE).toBe("25");
    expect(derived.Grad_VSVE).toBe("25");
    expect(deriveAutomaticEchoMeasurements({ ...raw, AE_diametro_min: "19" }, 4, "Felina"))
      .not.toHaveProperty("Fracao_encurtamento_AE");
  });
});
