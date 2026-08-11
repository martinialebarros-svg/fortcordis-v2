import { describe, expect, it } from "vitest";
import { compararMedidasComReferencia } from "./useReferenciaEco";
import type { ReferenciaEco } from "../types/referencia-eco";

const referenciaCanina: ReferenciaEco = {
  id: 1,
  especie: "Canina",
  peso_kg: 10,
  ef_min: 55,
  ef_max: 80,
  fs_min: 28,
  fs_max: 42,
};

describe("compararMedidasComReferencia", () => {
  it("aplica a FE e ao encurtamento 2D os mesmos intervalos de referencia do modo M", () => {
    const comparacoes = compararMedidasComReferencia(
      {
        FE_Teicholz_2D: "43",
        DeltaD_FS_2D: "21",
      },
      referenciaCanina
    );

    expect(comparacoes.FE_Teicholz_2D).toMatchObject({
      referencia_min: 55,
      referencia_max: 80,
      status: "diminuido",
      categoria: "funcao",
    });
    expect(comparacoes.DeltaD_FS_2D).toMatchObject({
      referencia_min: 28,
      referencia_max: 42,
      status: "diminuido",
      categoria: "funcao",
    });
  });
});
