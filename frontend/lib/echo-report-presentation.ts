import type { ReferenciaEco } from "@/app/laudos/types/referencia-eco";

type Parameter = { key: string; label: string; unit?: string; reference?: string };
export type EchoReportRow = { key: string; label: string; value: string; reference: string };
export type EchoReportGroup = { title: string; rows: EchoReportRow[] };
export type EchoCalculationAlert = { key: string; recorded: number; calculated: number };

const parameter = (key: string, label: string, unit = "", reference?: string): Parameter => ({ key, label, unit, reference });

const mMode: Parameter[] = [
  parameter("DIVEd", "DIVEd · diâmetro interno do VE em diástole", "mm", "lvid_d"),
  parameter("DIVEd_normalizado", "DIVEd normalizado · DIVEd [cm] / peso^0,294"),
  parameter("SIVd", "SIVd · septo interventricular em diástole", "mm", "ivs_d"),
  parameter("PLVEd", "PLVEd · parede livre do VE em diástole", "mm", "lvpw_d"),
  parameter("DIVES", "DIVEs · diâmetro interno do VE em sístole", "mm", "lvid_s"),
  parameter("SIVs", "SIVs · septo interventricular em sístole", "mm", "ivs_s"),
  parameter("PLVES", "PLVEs · parede livre do VE em sístole", "mm", "lvpw_s"),
  parameter("VDF", "VDF · Teicholz", "ml", "edv"),
  parameter("VSF", "VSF · Teicholz", "ml", "esv"),
  parameter("FE_Teicholz", "FE · Teicholz", "%", "ef"),
  parameter("DeltaD_FS", "Encurtamento fracional · %FS", "%", "fs"),
  parameter("TAPSE", "TAPSE", "mm", "tapse"),
  parameter("MAPSE", "MAPSE", "mm", "mapse"),
];
const mode2D: Parameter[] = mMode.slice(0, 11).map((item) => ({
  ...item,
  key: `${item.key}_2D`,
  label: `${item.label} · 2D`,
}));

const otherGroups: { title: string; parameters: Parameter[] }[] = [
  { title: "Átrio esquerdo / aorta", parameters: [
    parameter("Aorta", "Aorta", "mm", "ao"),
    parameter("Atrio_esquerdo", "Átrio esquerdo", "mm", "la"),
    parameter("AE_Ao", "AE/Ao · átrio esquerdo / aorta", "", "la_ao"),
    parameter("Fracao_encurtamento_AE", "Fração de encurtamento do AE", "%"),
    parameter("Fluxo_auricular", "Fluxo auricular", "m/s"),
  ] },
  { title: "Artéria pulmonar / aorta", parameters: [
    parameter("AP", "Artéria pulmonar", "mm", "ap"),
    parameter("Ao_nivel_AP", "Aorta no nível da AP", "mm", "ao"),
    parameter("AP_Ao", "AP/Ao · artéria pulmonar / aorta", "", "ap_ao"),
  ] },
  { title: "Doppler · saídas", parameters: [
    parameter("Vmax_aorta", "Velocidade máxima aórtica", "m/s", "vmax_ao"),
    parameter("Grad_aorta", "Gradiente aórtico", "mmHg"),
    parameter("Vmax_pulmonar", "Velocidade máxima pulmonar", "m/s", "vmax_pulm"),
    parameter("Grad_pulmonar", "Gradiente pulmonar", "mmHg"),
  ] },
  { title: "Função diastólica", parameters: [
    parameter("Onda_E", "Onda E", "m/s", "mv_e"),
    parameter("Onda_A", "Onda A", "m/s", "mv_a"),
    parameter("E_A", "Relação E/A", "", "mv_ea"),
    parameter("TD", "Tempo de desaceleração", "ms", "mv_dt"),
    parameter("TRIV", "Tempo de relaxamento isovolumétrico", "ms", "ivrt"),
    parameter("E_TRIV", "Relação E/TRIV"),
    parameter("MR_dp_dt", "MR dp/dt", "mmHg/s"),
    parameter("e_doppler", "e' · Doppler tecidual", "m/s", "tdi_e"),
    parameter("a_doppler", "a' · Doppler tecidual", "m/s", "tdi_a"),
    parameter("doppler_tecidual_relacao", "Relação e'/a'"),
    parameter("E_E_linha", "Relação E/e'", "", "e_e_linha"),
  ] },
  { title: "Regurgitações e estimativa de pressão", parameters: [
    parameter("IM_Vmax", "Velocidade máxima da insuficiência mitral", "m/s"),
    parameter("IM_Grad", "Gradiente da insuficiência mitral", "mmHg"),
    parameter("IT_Vmax", "Velocidade máxima da insuficiência tricúspide", "m/s"),
    parameter("IT_Grad", "Gradiente da insuficiência tricúspide", "mmHg"),
    parameter("PAD_estimada", "Pressão atrial direita estimada", "mmHg"),
    parameter("PSAP", "Pressão sistólica da artéria pulmonar estimada", "mmHg"),
    parameter("IA_Vmax", "Velocidade máxima da insuficiência aórtica", "m/s"),
    parameter("IA_Grad", "Gradiente da insuficiência aórtica", "mmHg"),
    parameter("IP_Vmax", "Velocidade máxima da insuficiência pulmonar", "m/s"),
    parameter("IP_Grad", "Gradiente da insuficiência pulmonar", "mmHg"),
  ] },
];

const lengthKeys = new Set([
  ...mMode.filter((item) => item.unit === "mm").map((item) => item.key),
  ...mode2D.filter((item) => item.unit === "mm").map((item) => item.key),
  "Aorta", "Atrio_esquerdo", "Ao_nivel_AP", "AP",
]);

function number(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function referenceRange(reference: ReferenciaEco | null, item: Parameter): string {
  if (!reference || !item.reference) return "—";
  const fields = reference as unknown as Record<string, unknown>;
  let min = number(fields[`${item.reference}_min`]);
  let max = number(fields[`${item.reference}_max`]);
  if (min === null || max === null || (min === 0 && max === 0)) return "—";
  if (item.key === "e_doppler" || item.key === "a_doppler") {
    min /= 100;
    max /= 100;
  }
  return `${min.toFixed(2)}–${max.toFixed(2)}${item.unit ? ` ${item.unit}` : ""}`;
}

export function prepareEchoReportMeasurements(raw: Record<string, string>, weightKg: unknown) {
  const measurements = { ...raw };
  const lengths = [...lengthKeys].map((key) => number(raw[key])).filter((value): value is number => value !== null && value > 0);
  if (lengths.length >= 3) {
    const centimeters = lengths.filter((value) => value >= 0.3 && value <= 3.5).length;
    const millimeters = lengths.filter((value) => value >= 5).length;
    if (centimeters >= 3 && centimeters >= millimeters * 2) {
      for (const key of lengthKeys) {
        const value = number(raw[key]);
        if (value !== null && value > 0) measurements[key] = String(Number((value * 10).toFixed(2)));
      }
    }
  }

  const alerts: EchoCalculationAlert[] = [];
  const weight = number(weightKg);
  if (weight !== null && weight > 0) {
    const selectedNormalizedKey = raw.VE_tecnica_relatorio === "2d"
      ? "DIVEd_normalizado_2D"
      : "DIVEd_normalizado";
    for (const [diameterKey, normalizedKey] of [["DIVEd", "DIVEd_normalizado"], ["DIVEd_2D", "DIVEd_normalizado_2D"]]) {
      const diameter = number(measurements[diameterKey]);
      if (diameter === null || diameter <= 0) continue;
      const calculated = Number(((diameter / 10) / weight ** 0.294).toFixed(2));
      const recorded = number(raw[normalizedKey]);
      if (normalizedKey === selectedNormalizedKey && recorded !== null && Math.abs(recorded - calculated) > 0.05) {
        alerts.push({ key: normalizedKey, recorded, calculated });
      }
      measurements[normalizedKey] = String(calculated);
    }
  }
  return { measurements, alerts };
}

export function buildEchoReportGroups(measurements: Record<string, string>, reference: ReferenciaEco | null): EchoReportGroup[] {
  const selected2D = measurements.VE_tecnica_relatorio === "2d";
  const groups = [
    { title: selected2D ? "Ventrículo esquerdo · modo 2D" : "Ventrículo esquerdo · modo M", parameters: selected2D ? mode2D : mMode },
    ...otherGroups,
  ];
  const known = new Set(["VE_tecnica_relatorio", "Remodelamento_AD", ...mMode.map((item) => item.key), ...mode2D.map((item) => item.key)]);
  for (const group of otherGroups) for (const item of group.parameters) known.add(item.key);
  const unknown: Parameter[] = Object.keys(measurements).filter((key) => !known.has(key)).map((key) => parameter(key, key));
  if (unknown.length) groups.push({ title: "Outras medidas registradas", parameters: unknown });
  return groups.map((group) => ({
    title: group.title,
    rows: group.parameters.filter((item) => {
      const value = number(measurements[item.key]);
      return value !== null && value !== 0;
    }).map((item) => ({
      key: item.key,
      label: item.label,
      value: `${number(measurements[item.key])?.toFixed(2)}${item.unit ? ` ${item.unit}` : ""}`,
      reference: referenceRange(reference, item),
    })),
  })).filter((group) => group.rows.length > 0);
}

export function splitReportObservations(text: string): { clinical: string; operational: string } {
  const clinical: string[] = [];
  const operational: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    (/^\s*\[(?:Assistente agenda|Reserva manual)\]/i.test(line) ? operational : clinical).push(line);
  }
  return { clinical: clinical.join("\n").trim(), operational: operational.join("\n").trim() };
}
