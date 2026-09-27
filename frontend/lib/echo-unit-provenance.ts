export const ECHO_LENGTH_KEYS = [
  "DIVEd", "SIVd", "PLVEd", "DIVES", "SIVs", "PLVES",
  "DIVEd_2D", "SIVd_2D", "PLVEd_2D", "DIVES_2D", "SIVs_2D", "PLVES_2D",
  "Aorta", "Atrio_esquerdo", "Ao_nivel_AP", "AP",
] as const;

const lengthKeys = new Set<string>(ECHO_LENGTH_KEYS);
const UNIT_PREFIX = "unidade_confirmada_";

export function confirmedUnitKey(key: string): string {
  return `${UNIT_PREFIX}${key}`;
}

export function isEchoLengthKey(key: string): boolean {
  return lengthKeys.has(key);
}

export function confirmedEchoUnit(measurements: Record<string, string>, key: string): "cm" | "mm" | null {
  if (!isEchoLengthKey(key)) return null;
  const unit = measurements[confirmedUnitKey(key)]?.trim().toLowerCase();
  return unit === "cm" || unit === "mm" ? unit : null;
}

export function echoLengthInputLabel(label: string, measurements: Record<string, string>, key: string): string {
  if (confirmedEchoUnit(measurements, key) === "cm") return label.replace("(mm", "(cm de origem");
  if (ambiguousEchoLengthKeys(measurements).has(key)) return label.replace("(mm", "(unidade a confirmar");
  return label;
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function echoUnitReviewCandidates(measurements: Record<string, string>): string[] {
  const values = ECHO_LENGTH_KEYS.map((key) => [key, positiveNumber(measurements[key])] as const)
    .filter((entry): entry is readonly [typeof ECHO_LENGTH_KEYS[number], number] => entry[1] !== null);
  const candidates = values.filter(([, value]) => value >= 0.3 && value <= 3.5);
  const millimeters = values.filter(([, value]) => value >= 5).length;
  if (values.length < 3 || candidates.length < 3 || candidates.length < millimeters * 2) return [];
  return candidates.map(([key]) => key);
}

export function ambiguousEchoLengthKeys(measurements: Record<string, string>): Set<string> {
  return new Set(echoUnitReviewCandidates(measurements).filter((key) => !confirmedEchoUnit(measurements, key)));
}

export function echoLengthInMm(measurements: Record<string, string>, key: string): number | null {
  const value = positiveNumber(measurements[key]);
  if (value === null || ambiguousEchoLengthKeys(measurements).has(key)) return null;
  return confirmedEchoUnit(measurements, key) === "cm" ? value * 10 : value;
}

export function updateEchoMeasurement(
  measurements: Record<string, string>, key: string, value: string
): Record<string, string> {
  const next = { ...measurements, [key]: value };
  if (key.startsWith(UNIT_PREFIX) && value === "") delete next[key];
  if (isEchoLengthKey(key) && value !== measurements[key]) {
    delete next[confirmedUnitKey(key)];
  }
  return next;
}

export function mergeImportedEchoMeasurements(
  measurements: Record<string, string>, imported: Record<string, string>
): Record<string, string> {
  const next = { ...measurements, ...imported };
  for (const key of Object.keys(imported)) {
    if (isEchoLengthKey(key)) delete next[confirmedUnitKey(key)];
  }
  return next;
}
