import { describe, expect, it } from "vitest";
import { findFelineNarrativeDiscrepancies } from "./echo-feline-narrative-consistency";

const flow = { Diastolica_ondas: "fundidas", TDI_ondas: "separadas" };
const tissue = { Diastolica_ondas: "separadas", TDI_ondas: "fundidas" };
const check = (text: string, measurements = flow, species = "Felina") =>
  findFelineNarrativeDiscrepancies(measurements, { funcao: text }, "", species);

describe("conferência conservadora da narrativa diastólica felina", () => {
  it.each([
    "Ondas E e A separadas e mensuráveis.",
    "Ondas E/A individualizadas.",
    "Função diastólica preservada, com padrão de enchimento adequado ao Doppler transmitral.",
    "Relação E/A de 1,14.", "E/A = 1.14.", "E/TRIV: 2,7.", "E/e′ de 6,75.",
    "Padrão tipo I com inversão da relação E/A ao Doppler transmitral.",
    "Padrão de enchimento com relação E/A aparentemente normal (pseudonormal).",
    "Relação E/A acentuadamente elevada, tempo de desaceleração encurtado e velocidade de onda E elevada.",
    "Relação E/A encontra-se normal.",
    "Sem sinais congestivos, relação E/A de 1,14.",
  ])("sinaliza a afirmação transmitral atual: %s", (text) => {
    expect(check(text)).toMatchObject([{ key: "feline_transmitral_fusion", section: "Função", excerpt: text }]);
  });

  it.each([
    "Função diastólica preservada pela avaliação multiparamétrica.",
    "Função sistólica aumentada em contexto de estresse, FE 94%, FEC 64%.",
    "Não há separação entre as ondas E e A.",
    "E/A não mensurável por fusão.",
    "Não foi possível avaliar o padrão transmitral.",
    "Em exame anterior, E/A=1,2; neste exame há fusão.",
    "No exame de 2024, E/A = 1,2.",
    "Relação E/A importada de 1,14, sem interpretação independente.",
    "Quando separadas, E e A devem ser mensuradas.",
    "Se ondas E e A separadas, avaliar E/A = 1,2.",
    "Hipótese de padrão restritivo ao Doppler transmitral.",
    "Relação E/A de 1,14 não interpretável por fusão.",
    "Relação E/A de 1,14, desconsiderada por artefato.",
    "Relação E/A de 1,14?",
    "Avaliar padrão de enchimento adequado ao Doppler transmitral.",
    "Doppler tecidual lateral: e′ de 0,16 m/s e a′ de 0,06 m/s.",
    "Relação e′/a′ de 2,67.",
  ])("preserva afirmação integrada, independente ou qualificada: %s", (text) => {
    expect(check(text)).toEqual([]);
  });

  it.each(["Ondas e′ e a′ separadas e mensuráveis.", "Relação e’/a’ de 1,33.", "E/e' = 6.95.", "e′ lateral de 0,16 m/s."])(
    "suspensão tecidual sinaliza somente o grupo correspondente: %s", (text) => {
      expect(check(text, tissue)).toMatchObject([{ key: "feline_tissue_fusion", excerpt: text }]);
    },
  );

  it.each(["Relação E/A de 1,14.", "Ondas E e A separadas.", "E/TRIV = 2,7."])(
    "fusão tecidual não invalida transmitral independente: %s", (text) => expect(check(text, tissue)).toEqual([]),
  );

  it.each(["Felina", "Felino", "Gato", "Cat", " cats "])("aceita somente os aliases exatos conhecidos: %s", (species) => {
    expect(check("Ondas E/A separadas.", flow, species)).toHaveLength(1);
  });
  it.each(["", "Canina", "Cattle", "Catfish", "Gato selvagem"])("não aplica regra felina à espécie %s", (species) => {
    expect(check("Ondas E/A separadas.", flow, species)).toEqual([]);
  });

  it("não infere fusão de números e preserva integralmente os dados", () => {
    const measurements = Object.freeze({ Diastolica_ondas: "", TDI_ondas: "", E_A: "1.14", FE_Teicholz: "94" });
    const qualitative = Object.freeze({ funcao: "Ondas E/A separadas." });
    expect(findFelineNarrativeDiscrepancies(measurements, qualitative, "", "Felina")).toEqual([]);
    expect(measurements).toEqual({ Diastolica_ondas: "", TDI_ondas: "", E_A: "1.14", FE_Teicholz: "94" });
    expect(qualitative.funcao).toBe("Ondas E/A separadas.");
  });

  it("localiza a conclusão e limita cada família a um aviso", () => {
    const measurements = { Diastolica_ondas: "fundidas", TDI_ondas: "fundidas" };
    const issues = findFelineNarrativeDiscrepancies(measurements, {}, "Relação E/A de 1,14. Relação E/A de 1,3. Relação e′/a′ de 2,67.", "Cat");
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ key: "feline_transmitral_fusion", section: "Conclusão", excerpt: "Relação E/A de 1,14." });
    expect(issues[1].key).toBe("feline_tissue_fusion");
  });
});
