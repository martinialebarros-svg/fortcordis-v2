/** Visser et al. 2019, JVIM 33:1909-1920, Tables 1 and 2 (DOI 10.1111/jvim.15562). */
export type Echo2DView = "eixo_curto" | "eixo_longo";

type Echo2DKey = "DIVEd_2D" | "DIVES_2D" | "DeltaD_FS_2D";

type Range = {
  min: number;
  max: number;
  source: string;
};

const LIMITS: Record<Echo2DView, Record<Echo2DKey, { min: number; max: number; exponent?: number }>> = {
  eixo_curto: {
    DIVEd_2D: { min: 1.14, max: 1.61, exponent: 0.316 },
    DIVES_2D: { min: 0.56, max: 0.93, exponent: 0.392 },
    DeltaD_FS_2D: { min: 21.9, max: 49.3 },
  },
  eixo_longo: {
    DIVEd_2D: { min: 1.15, max: 1.55, exponent: 0.316 },
    DIVES_2D: { min: 0.68, max: 1.09, exponent: 0.351 },
    DeltaD_FS_2D: { min: 19.1, max: 41.7 },
  },
};

export function getCanine2DReference(
  key: string,
  weightKg: number | undefined,
  view: Echo2DView | "",
): Range | null {
  if (!view || !Number.isFinite(weightKg) || weightKg === undefined || weightKg < 2.6 || weightKg > 67.8) {
    return null;
  }
  if (key !== "DIVEd_2D" && key !== "DIVES_2D" && key !== "DeltaD_FS_2D") return null;

  const limit = LIMITS[view][key];
  const factor = limit.exponent === undefined ? 1 : 10 * weightKg ** limit.exponent;
  return {
    min: Number((limit.min * factor).toFixed(2)),
    max: Number((limit.max * factor).toFixed(2)),
    source: `Visser et al. 2019; 2D, ${view === "eixo_curto" ? "eixo curto" : "eixo longo"}; cães adultos saudáveis`,
  };
}
