import { describe, expect, it } from "vitest";
import { extrairQualitativaEcoDaDescricao, montarDescricaoEcocardiograma } from "./ecocardiograma-estruturado";

describe("leitura da avaliação qualitativa", () => {
  it("preserva vários itens no mesmo grupo sem confundir bullets com novos campos", () => {
    const descricao = montarDescricaoEcocardiograma({}, {
      valvas: "- Valva mitral: espessamento discreto.\n- Valva tricúspide: refluxo discreto.",
      camaras: "- Átrio esquerdo: sem aumento.",
      funcao: "",
      pericardio: "Sem derrame pericárdico.",
      vasos: "",
      ad_vd: "",
    });
    const parsed = extrairQualitativaEcoDaDescricao(`${descricao}\n## Outra seção\n- vasos: conteúdo externo`);
    expect(parsed.valvas).toBe("- Valva mitral: espessamento discreto.\n- Valva tricúspide: refluxo discreto.");
    expect(parsed.camaras).toBe("- Átrio esquerdo: sem aumento.");
    expect(parsed.pericardio).toBe("Sem derrame pericárdico.");
    expect(parsed.vasos).toBe("");
  });

  it("aceita o título acentuado e não inventa achados quando a seção falta", () => {
    expect(extrairQualitativaEcoDaDescricao("## Avaliação Qualitativa\n- valvas: Sem alteração descrita.").valvas)
      .toBe("Sem alteração descrita.");
    expect(extrairQualitativaEcoDaDescricao("## Medidas Ecocardiograficas\n- valvas: texto fora de seção").valvas)
      .toBe("");
  });
});
