export type RightAtrialRemodeling =
  | ""
  | "ausente"
  | "leve"
  | "moderado"
  | "importante";

const REGURGITATION_GRADIENTS: Record<string, string> = {
  IM_Vmax: "IM_Grad",
  IT_Vmax: "IT_Grad",
  IA_Vmax: "IA_Grad",
  IP_Vmax: "IP_Grad",
};

export const LV_M_MODE_KEYS = [
  "DIVEd",
  "DIVEd_normalizado",
  "SIVd",
  "PLVEd",
  "DIVES",
  "SIVs",
  "PLVES",
] as const;

export const LV_2D_KEYS = [
  "DIVEd_2D",
  "DIVEd_normalizado_2D",
  "SIVd_2D",
  "PLVEd_2D",
  "DIVES_2D",
  "SIVs_2D",
  "PLVES_2D",
] as const;

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatDerivedValue(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function calculateBernoulliGradient(velocity: unknown): number | null {
  const parsed = parsePositiveNumber(velocity);
  return parsed === null ? null : 4 * parsed ** 2;
}

export function estimateRightAtrialPressure(
  remodeling: unknown
): number | null {
  const normalized = String(remodeling ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "moderado") return 10;
  if (normalized === "importante") return 15;
  if (normalized === "ausente" || normalized === "leve") return 5;
  return null;
}

export function hasAnyMeasurement(
  measurements: Record<string, string>,
  keys: readonly string[]
): boolean {
  return keys.some((key) => Boolean(String(measurements[key] ?? "").trim()));
}

export function deriveAutomaticEchoMeasurements(
  measurements: Record<string, string>,
  weightKg: unknown
): Record<string, string> {
  const derived: Record<string, string> = {};

  for (const [velocityKey, gradientKey] of Object.entries(
    REGURGITATION_GRADIENTS
  )) {
    const gradient = calculateBernoulliGradient(measurements[velocityKey]);
    derived[gradientKey] =
      gradient === null ? "" : formatDerivedValue(gradient);
  }

  const rightAtrialPressure = estimateRightAtrialPressure(
    measurements.Remodelamento_AD
  );
  if (rightAtrialPressure !== null) {
    derived.PAD_estimada = formatDerivedValue(rightAtrialPressure);
    const tricuspidGradient = calculateBernoulliGradient(measurements.IT_Vmax);
    if (tricuspidGradient !== null) {
      derived.PSAP = formatDerivedValue(
        tricuspidGradient + rightAtrialPressure
      );
    } else {
      derived.PSAP = "";
    }
  } else {
    derived.PAD_estimada = "";
    derived.PSAP = "";
  }

  const weight = parsePositiveNumber(weightKg);
  for (const [diameterKey, normalizedKey] of [
    ["DIVEd", "DIVEd_normalizado"],
    ["DIVEd_2D", "DIVEd_normalizado_2D"],
  ] as const) {
    const diameterMm = parsePositiveNumber(measurements[diameterKey]);
    if (diameterMm !== null && weight !== null) {
      derived[normalizedKey] = formatDerivedValue(
        diameterMm / 10 / weight ** 0.294
      );
    } else {
      derived[normalizedKey] = "";
    }
  }

  const hasMMode = hasAnyMeasurement(measurements, LV_M_MODE_KEYS);
  const has2D = hasAnyMeasurement(measurements, LV_2D_KEYS);
  if (hasMMode && !has2D) derived.VE_tecnica_relatorio = "modo_m";
  if (has2D && !hasMMode) derived.VE_tecnica_relatorio = "2d";

  return derived;
}
