import { describe, expect, it } from "vitest";
import { compararMedidasComReferencia } from "./useReferenciaEco";
import { deriveLeftVentricularFunctionForReference } from "@/lib/echo-derived-measurements";
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
  it("interpreta FE e encurtamento 2D calculados a partir das medidas do VE", () => {
    const medidas2D = {
      VDF_2D: "82",
      VSF_2D: "47",
      DIVEd_2D: "42.78",
      DIVES_2D: "33.81",
    };
    const comparacoes = compararMedidasComReferencia(
      {
        ...medidas2D,
        ...deriveLeftVentricularFunctionForReference(medidas2D),
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

  it("preserva FE e encurtamento 2D informados pelo equipamento", () => {
    expect(
      deriveLeftVentricularFunctionForReference({
        VDF_2D: "82",
        VSF_2D: "47",
        DIVEd_2D: "42.78",
        DIVES_2D: "33.81",
        FE_Teicholz_2D: "44",
        DeltaD_FS_2D: "22",
      })
    ).toEqual({});
  });
});
