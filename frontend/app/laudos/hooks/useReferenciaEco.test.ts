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
  fs_source: "Visser et al. 2019; modo M",
};

describe("compararMedidasComReferencia", () => {
  it("descreve a posição numérica sem chamar a faixa cadastrada de normalidade clínica", () => {
    const abaixo = compararMedidasComReferencia({ DeltaD_FS: "25" }, referenciaCanina).DeltaD_FS;
    const dentro = compararMedidasComReferencia({ DeltaD_FS: "35" }, referenciaCanina).DeltaD_FS;
    const acima = compararMedidasComReferencia({ DeltaD_FS: "50" }, referenciaCanina).DeltaD_FS;
    const semFaixa = compararMedidasComReferencia({ SIVd: "8" }, referenciaCanina).SIVd;

    expect(abaixo).toMatchObject({ status: "diminuido", interpretacao: "Abaixo da faixa cadastrada (< 28)" });
    expect(dentro).toMatchObject({ status: "normal", interpretacao: "Dentro da faixa cadastrada" });
    expect(acima).toMatchObject({ status: "aumentado", interpretacao: "Acima da faixa cadastrada (> 42)" });
    expect(semFaixa).toMatchObject({ status: "nao_avaliado", interpretacao: "Faixa não cadastrada" });
  });

  it("não classifica FE Teichholz nem FS sem fonte compatível", () => {
    const comparison = compararMedidasComReferencia(
      { FE_Teicholz: "40", DeltaD_FS: "20" },
      { ...referenciaCanina, fs_source: undefined },
    );
    expect(comparison.FE_Teicholz.status).toBe("nao_avaliado");
    expect(comparison.DeltaD_FS.status).toBe("nao_avaliado");
  });

  it("mantém FE, encurtamento e dimensões 2D visíveis sem aplicar faixas de Modo M", () => {
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

    for (const key of ["DIVEd_2D", "DIVES_2D", "VDF_2D", "VSF_2D", "FE_Teicholz_2D", "DeltaD_FS_2D"]) {
      expect(comparacoes[key]).toMatchObject({
        referencia_min: null,
        referencia_max: null,
        status: "nao_avaliado",
      });
    }
    expect(comparacoes.DIVEd_2D.interpretacao).toBe("Confirme cão adulto e vista 2D para comparar");
    expect(comparacoes.FE_Teicholz_2D.interpretacao).toBe("Teichholz: intervalos 2D de Simpson não são aplicáveis");
  });

  it("usa faixas 2D publicadas apenas para diâmetros e FEC caninos com vista confirmada", () => {
    const medidas = {
      DIVEd_2D: "33.53",
      DIVES_2D: "22.87",
      SIVd_2D: "8.36",
      PLVEd_2D: "10.29",
      FE_Teicholz_2D: "60",
      DeltaD_FS_2D: "31.8",
    };
    const referencia = {
      ...referenciaCanina,
      peso_kg: 15,
      lvid_d_min: 21,
      lvid_d_max: 30,
      lvid_s_min: 12,
      lvid_s_max: 20,
      ivs_d_min: 5,
      ivs_d_max: 8,
    };
    const result = compararMedidasComReferencia(medidas, referencia, "eixo_curto", 13.6);

    for (const key of ["DIVEd_2D", "DIVES_2D", "DeltaD_FS_2D"]) {
      expect(result[key]).toMatchObject({ status: "normal", interpretacao: "Dentro da faixa 2D publicada" });
      expect(result[key].fonte).toContain("Visser et al. 2019; 2D, eixo curto");
    }
    expect([result.DIVEd_2D.referencia_min, result.DIVEd_2D.referencia_max]).toEqual([26.01, 36.73]);
    expect([result.DIVES_2D.referencia_min, result.DIVES_2D.referencia_max]).toEqual([15.58, 25.87]);
    expect([result.DeltaD_FS_2D.referencia_min, result.DeltaD_FS_2D.referencia_max]).toEqual([21.9, 49.3]);
    for (const key of ["SIVd_2D", "PLVEd_2D", "FE_Teicholz_2D"]) {
      expect(result[key]).toMatchObject({ status: "nao_avaliado", referencia_min: null, referencia_max: null });
    }
    expect(result.SIVd_2D.interpretacao).toBe("Sem intervalo 2D por peso para esta espessura nas fontes adotadas");
    expect(result.PLVEd_2D.interpretacao).toBe("Sem intervalo 2D por peso para esta espessura nas fontes adotadas");
    expect(result.FE_Teicholz_2D.interpretacao).toBe("Teichholz: intervalos 2D de Simpson não são aplicáveis");
    expect(result.FE_Teicholz_2D.nome).toBe("FE 2D (Teichholz)");
    expect(compararMedidasComReferencia(
      { ...medidas, DeltaD_FS_2D: "45" }, referencia, "eixo_curto", 13.6,
    ).DeltaD_FS_2D.status).toBe("nao_avaliado");
  });

  it("não transfere faixas 2D entre planos, espécies ou pesos fora da amostra", () => {
    const medidas = { DIVEd_2D: "47.27", DIVES_2D: "26", DeltaD_FS_2D: "45" };
    const curto = compararMedidasComReferencia(medidas, referenciaCanina, "eixo_curto", 13.6);
    const longo = compararMedidasComReferencia(medidas, referenciaCanina, "eixo_longo", 13.6);
    expect(curto.DIVES_2D.referencia_max).not.toBe(longo.DIVES_2D.referencia_max);
    expect(curto.DeltaD_FS_2D.status).toBe("normal");
    expect(longo.DeltaD_FS_2D.status).toBe("aumentado");

    for (const [referencia, peso] of [
      [{ ...referenciaCanina, especie: "Felina" as const }, 13.6],
      [referenciaCanina, 2.5],
      [referenciaCanina, 67.9],
    ] as const) {
      expect(compararMedidasComReferencia(medidas, referencia, "eixo_curto", peso).DIVES_2D.status).toBe("nao_avaliado");
    }
    expect(compararMedidasComReferencia(medidas, referenciaCanina, "eixo_curto", 2.5).DIVEd_2D.interpretacao)
      .toBe("Peso fora da população estudada (2,6 a 67,8 kg)");
    expect(compararMedidasComReferencia({ ...medidas, DeltaD_FS_2D: "20" }, referenciaCanina, "eixo_curto", 13.6).DeltaD_FS_2D.interpretacao)
      .toBe("Encurtamento exige DIVEd e DIVEs 2D compatíveis");
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
