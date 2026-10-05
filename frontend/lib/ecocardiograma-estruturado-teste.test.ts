import { describe, expect, it } from "vitest";
import { presetCompativelComEspecie, type PresetEcoEstruturadoTeste } from "./ecocardiograma-estruturado-teste";

const preset = (tags: string[]): PresetEcoEstruturadoTeste => ({
  id: 1, key: "teste", label: "Teste", tags, selecoes: [],
});

describe("compatibilidade de preset por espécie", () => {
  it("mantém opções comuns e separa opções exclusivas de gato e cão", () => {
    expect(presetCompativelComEspecie(preset(["gato"]), "Felina")).toBe(true);
    expect(presetCompativelComEspecie(preset(["gato"]), "Canina")).toBe(false);
    expect(presetCompativelComEspecie(preset(["cao"]), "Felina")).toBe(false);
    expect(presetCompativelComEspecie(preset(["cao", "gato"]), "Felina")).toBe(true);
    expect(presetCompativelComEspecie(preset([]), "Canina")).toBe(true);
  });
});
