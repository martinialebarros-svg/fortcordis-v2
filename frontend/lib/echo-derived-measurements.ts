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
  "VDF",
  "VSF",
  "FE_Teicholz",
  "DeltaD_FS",
] as const;

export const LV_2D_KEYS = [
  "DIVEd_2D",
  "DIVEd_normalizado_2D",
  "SIVd_2D",
  "PLVEd_2D",
  "DIVES_2D",
  "SIVs_2D",
  "PLVES_2D",
  "VDF_2D",
  "VSF_2D",
  "FE_Teicholz_2D",
  "DeltaD_FS_2D",
] as const;

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatDerivedValue(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function formatDerivedPercentage(value: number): string {
  return String(Math.round(value));
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

function normalizeStoredMeasurement(
  key: string,
  value: unknown
): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (key === "VE_tecnica_relatorio") {
    const normalized = text.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
    return normalized === "modo_m" || normalized === "2d" ? normalized : null;
  }
  if (key === "Remodelamento_AD") {
    const normalized = text.toLowerCase();
    return ["ausente", "leve", "moderado", "importante"].includes(normalized)
      ? normalized
      : null;
  }

  const normalized = text.replace(",", ".");
  return normalized !== "" && Number.isFinite(Number(normalized))
    ? normalized
    : null;
}

export function parseStoredEchoMeasurements(
  rawMeasurements: unknown,
  description = ""
): Record<string, string> {
  const parsed: Record<string, string> = {};

  if (
    rawMeasurements &&
    typeof rawMeasurements === "object" &&
    !Array.isArray(rawMeasurements)
  ) {
    Object.entries(rawMeasurements as Record<string, unknown>).forEach(
      ([key, value]) => {
        const normalized = normalizeStoredMeasurement(key, value);
        if (normalized !== null) parsed[key] = normalized;
      }
    );
  }

  if (Object.keys(parsed).length === 0 && description) {
    const section =
      description.match(
        /##\s*Medidas\s+Ecocardiogr(?:a|á)ficas\s*([\s\S]*?)(?=\n##\s*|$)/i
      )?.[1] || "";
    const linePattern = /^\s*-\s*([A-Za-z0-9_]+):\s*(.*?)\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = linePattern.exec(section)) !== null) {
      const normalized = normalizeStoredMeasurement(match[1], match[2]);
      if (normalized !== null) parsed[match[1]] = normalized;
    }
  }

  if (!parsed.VE_tecnica_relatorio) {
    const hasMMode = hasAnyMeasurement(parsed, LV_M_MODE_KEYS);
    const has2D = hasAnyMeasurement(parsed, LV_2D_KEYS);
    if (hasMMode && !has2D) parsed.VE_tecnica_relatorio = "modo_m";
    if (has2D && !hasMMode) parsed.VE_tecnica_relatorio = "2d";
  }

  return parsed;
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

/**
 * Completa apenas a visualizacao das referencias com a funcao ventricular que
 * pode ser obtida das medidas ja preenchidas. Nao altera o formulario nem o
 * payload do laudo: se a FE ou o FS informado pelo equipamento existir, ele
 * sempre tem precedencia sobre o valor calculado aqui.
 */
export function deriveLeftVentricularFunctionForReference(
  measurements: Record<string, string>
): Record<string, string> {
  const derived: Record<string, string> = {};

  for (const fields of Object.values({
    modo_m: {
      edv: "VDF",
      esv: "VSF",
      ef: "FE_Teicholz",
      lvidD: "DIVEd",
      lvidS: "DIVES",
      fs: "DeltaD_FS",
    },
    modo_2d: {
      edv: "VDF_2D",
      esv: "VSF_2D",
      ef: "FE_Teicholz_2D",
      lvidD: "DIVEd_2D",
      lvidS: "DIVES_2D",
      fs: "DeltaD_FS_2D",
    },
  })) {
    const edv = parsePositiveNumber(measurements[fields.edv]);
    const esv = parsePositiveNumber(measurements[fields.esv]);
    if (!String(measurements[fields.ef] ?? "").trim() && edv !== null && esv !== null && esv <= edv) {
      derived[fields.ef] = formatDerivedPercentage(((edv - esv) / edv) * 100);
    }

    const lvidD = parsePositiveNumber(measurements[fields.lvidD]);
    const lvidS = parsePositiveNumber(measurements[fields.lvidS]);
    if (
      !String(measurements[fields.fs] ?? "").trim() &&
      lvidD !== null &&
      lvidS !== null &&
      lvidS <= lvidD
    ) {
      derived[fields.fs] = formatDerivedPercentage(((lvidD - lvidS) / lvidD) * 100);
    }
  }

  return derived;
}
