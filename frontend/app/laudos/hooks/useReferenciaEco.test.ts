import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compararMedidasComReferencia, useReferenciaEco } from "./useReferenciaEco";
import { deriveLeftVentricularFunctionForReference } from "@/lib/echo-derived-measurements";
import type { ReferenciaEco } from "../types/referencia-eco";

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/axios", () => ({ default: { get: mockGet } }));

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: null });
});

describe("useReferenciaEco", () => {
  it("envia especie sem transforma-la em referencia felina por substring", async () => {
    const { result } = renderHook(() => useReferenciaEco());
    await act(async () => {
      await result.current.buscarReferencia("Cattle", 5);
    });
    expect(mockGet).toHaveBeenCalledWith("/referencias-eco/buscar/Cattle/5");
  });

  it("nao busca referencia sem especie", async () => {
    const { result } = renderHook(() => useReferenciaEco());
    await act(async () => {
      expect(await result.current.buscarReferencia(" ", 5)).toBeNull();
    });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

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
