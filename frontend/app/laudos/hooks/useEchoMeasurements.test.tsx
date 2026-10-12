import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEchoMeasurements } from "./useEchoMeasurements";
import { confirmedUnitKey, updateEchoMeasurement } from "@/lib/echo-unit-provenance";
import { parseStoredEchoMeasurements } from "@/lib/echo-derived-measurements";

function edit(hook: ReturnType<typeof renderHook<ReturnType<typeof useEchoMeasurements>, unknown>>, key: string, value: string) {
  act(() => hook.result.current.setMeasurements((previous) => updateEchoMeasurement(previous, key, value)));
}

describe("ownership da razão AE/Ao no formulário", () => {
  it("calcula imediatamente e limpa a razão derivada ao apagar qualquer componente", () => {
    const hook = renderHook(() => useEchoMeasurements());
    edit(hook, "Aorta", "10");
    edit(hook, "Atrio_esquerdo", "14,6");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    edit(hook, "AE_Ao_metodo", "2d_eixo_curto_diastole_inicial");
    edit(hook, "Aorta", "");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao_metodo");
    edit(hook, "Aorta", "10");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    edit(hook, "Atrio_esquerdo", "");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
    expect(hook.result.current.measurements.Aorta).toBe("10");
  });

  it.each(["0", "-1", "NaN", "Infinity", "10abc", "   "])("limpa o cálculo anterior se a origem fica inválida (%s)", (invalid) => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.replaceMeasurements({ Aorta: "10", Atrio_esquerdo: "14.6" }));
    edit(hook, "Aorta", invalid);
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
  });

  it("respeita cm/mm confirmados e suspende uma origem ambígua", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.replaceMeasurements({
      Aorta: "1", Atrio_esquerdo: "14.6", [confirmedUnitKey("Aorta")]: "cm",
    }));
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    edit(hook, confirmedUnitKey("Aorta"), "mm");
    expect(hook.result.current.measurements.AE_Ao).toBe("14.60");

    act(() => hook.result.current.replaceMeasurements({
      Aorta: "1", Atrio_esquerdo: "1.46", SIVd: "1.2",
      [confirmedUnitKey("Aorta")]: "cm", [confirmedUnitKey("Atrio_esquerdo")]: "cm",
    }));
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    edit(hook, confirmedUnitKey("Aorta"), "");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
  });

  it("preserva AE/Ao independente importado sem diâmetros no save, edição e reload", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.importMeasurements({ AE_Ao: "1.46" }));
    edit(hook, "Aorta", "");
    edit(hook, "Atrio_esquerdo", "");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    const saved = JSON.parse(JSON.stringify(hook.result.current.measurements));
    expect(Object.keys(saved)).toEqual(["AE_Ao", "Aorta", "Atrio_esquerdo"]);
    act(() => hook.result.current.replaceMeasurements(parseStoredEchoMeasurements(saved)));
    edit(hook, "Aorta", "0");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
  });

  it("reimportação direta coincidente com o último auto não herda ownership", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.replaceMeasurements({ Aorta: "10", Atrio_esquerdo: "14.6" }));
    act(() => hook.result.current.importMeasurements({ AE_Ao: "1.46" }));
    // O effect dos demais índices e a confirmação do método clonam medidas.
    act(() => hook.result.current.setMeasurements((previous) => ({ ...previous, E_A: "1.2", DIVEd_normalizado: "1.5" })));
    edit(hook, "AE_Ao_metodo", "2d_eixo_curto_diastole_inicial");
    edit(hook, "Aorta", "");
    edit(hook, "Atrio_esquerdo", "");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao_metodo");
  });

  it("importação explícita tem precedência sobre o cálculo mesmo com ambos diâmetros", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.importMeasurements({ Aorta: "10", Atrio_esquerdo: "14.6", AE_Ao: "1.4" }));
    expect(hook.result.current.measurements.AE_Ao).toBe("1.4");
    edit(hook, "Aorta", "");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.4");
    edit(hook, "Aorta", "10");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
    edit(hook, "Atrio_esquerdo", "");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
  });

  it("reconstrói derivação após reload com componentes válidos e não herda o exame anterior", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.replaceMeasurements(parseStoredEchoMeasurements({ Aorta: "10", Atrio_esquerdo: "14.6", AE_Ao: "1.46" })));
    act(() => hook.result.current.setMeasurements((previous) => ({ ...previous, TAPSE: "12" })));
    edit(hook, "Aorta", "");
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
    act(() => hook.result.current.replaceMeasurements({ AE_Ao: "1.2" }));
    edit(hook, "Aorta", "");
    expect(hook.result.current.measurements).toEqual({ AE_Ao: "1.2", Aorta: "" });
    act(() => hook.result.current.replaceMeasurements({}));
    expect(hook.result.current.measurements).toEqual({});
  });

  it("não combina diâmetro de nova importação com componente remanescente para derivar a razão", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.replaceMeasurements({ Aorta: "10", Atrio_esquerdo: "14.6" }));
    act(() => hook.result.current.importMeasurements({ Aorta: "12" }));
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
    act(() => hook.result.current.setMeasurements((previous) => ({ ...previous, E_A: "1.2" })));
    expect(hook.result.current.measurements).not.toHaveProperty("AE_Ao");
    act(() => hook.result.current.importMeasurements({ Aorta: "12", Atrio_esquerdo: "18" }));
    expect(hook.result.current.measurements.AE_Ao).toBe("1.50");
  });

  it("normaliza alias de importação e preserva ratio órfão histórico conservadoramente", () => {
    const hook = renderHook(() => useEchoMeasurements());
    act(() => hook.result.current.importMeasurements({ LA_Ao: "1.46" }));
    expect(hook.result.current.measurements).toEqual({ AE_Ao: "1.46" });
    act(() => hook.result.current.replaceMeasurements(parseStoredEchoMeasurements(null,
      "## Medidas Ecocardiográficas\n- AE_Ao: 1,46\n\n## Avaliação Qualitativa")));
    edit(hook, "Aorta", "");
    expect(hook.result.current.measurements.AE_Ao).toBe("1.46");
  });
});
