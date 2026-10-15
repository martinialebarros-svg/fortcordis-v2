import { describe, expect, it } from "vitest";
import { assinaturaRotina, dataHoraFiscal, proximaEtapaFiscal, sextaFeiraFiscal } from "./fiscal-rotina";

describe("rotina fiscal", () => {
  it("corte aceita apenas datas válidas em uma sexta-feira", () => {
    expect(sextaFeiraFiscal("2026-10-16")).toBe(true);
    for (const data of ["2026-10-15", "2026-02-30", "16/10/2026", ""]) expect(sextaFeiraFiscal(data)).toBe(false);
  });
  it("idempotência diferencia modo, corte, clínica e competência sem depender da ordem das OS", () => {
    const base = { competencia: "2026-10", modo: "semanal" as const, data_corte: "2026-10-16", clinica_id: null };
    const key = assinaturaRotina(base, [1, 2]);
    expect(assinaturaRotina(base, [2, 1])).toBe(key);
    expect(assinaturaRotina({ ...base, modo: "por_servico" }, [1, 2])).not.toBe(key);
    expect(assinaturaRotina({ ...base, data_corte: "2026-10-23" }, [1, 2])).not.toBe(key);
    expect(assinaturaRotina({ ...base, clinica_id: 10 }, [1, 2])).not.toBe(key);
    expect(assinaturaRotina({ ...base, competencia: "2026-11" }, [1, 2])).not.toBe(key);
  });
  it("andamento avança uma ação por vez até encaminhamento", () => {
    expect(proximaEtapaFiscal("preparado")).toBe("enviado_contador");
    expect(proximaEtapaFiscal("enviado_contador")).toBe("nota_recebida");
    expect(proximaEtapaFiscal("nota_recebida")).toBe("nota_encaminhada");
    expect(proximaEtapaFiscal("nota_encaminhada")).toBeNull();
  });
  it("horário UTC do corte é mostrado no fuso de Fortaleza", () => {
    expect(dataHoraFiscal("2026-10-16T21:00:00Z")).toContain("18:00");
    expect(dataHoraFiscal(null)).toBe("—");
  });
});
