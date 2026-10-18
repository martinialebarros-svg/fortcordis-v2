export type EchoNarrativeDiscrepancy = {
  key: "FE" | "FEC" | "Vmax_aorta";
  message: string;
};

function numeric(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}

function selectedMode(measurements: Record<string, string>): "modo_m" | "2d" | null {
  if (measurements.VE_tecnica_relatorio === "modo_m" || measurements.VE_tecnica_relatorio === "2d") {
    return measurements.VE_tecnica_relatorio;
  }
  const hasM = ["FE_Teicholz", "DeltaD_FS"].some((key) => numeric(measurements[key]) !== null);
  const has2D = ["FE_Teicholz_2D", "DeltaD_FS_2D"].some((key) => numeric(measurements[key]) !== null);
  return hasM === has2D ? null : has2D ? "2d" : "modo_m";
}

/** Avisos de revisão, sem alterar medidas ou interpretação clínica. */
export function findEchoNarrativeDiscrepancies(
  measurements: Record<string, string>,
  qualitative: object,
  conclusion: string,
): EchoNarrativeDiscrepancy[] {
  const mode = selectedMode(measurements);
  const text = [...Object.values(qualitative), conclusion]
    .filter(Boolean)
    .join("\n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const results: EchoNarrativeDiscrepancy[] = [];
  const metrics = [
    { key: "FE" as const, pattern: /\bfracao de ejecao\b[^.%\n]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/g, measure: mode === "2d" ? "FE_Teicholz_2D" : "FE_Teicholz" },
    { key: "FEC" as const, pattern: /\bfracao de encurtamento\b[^.%\n]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/g, measure: mode === "2d" ? "DeltaD_FS_2D" : "DeltaD_FS" },
  ];
  if (mode) {
    for (const metric of metrics) {
      const measured = numeric(measurements[metric.measure]);
      if (measured === null) continue;
      for (const match of text.matchAll(metric.pattern)) {
        const written = numeric(match[1]);
        // Um ponto percentual cobre arredondamento de valores exportados.
        if (written !== null && Math.abs(written - measured) > 1) {
          results.push({
            key: metric.key,
            message: `${metric.key}: o texto cita ${format(written)}%, enquanto a medida selecionada é ${format(measured)}%.`,
          });
          break;
        }
      }
    }
  }

  const aorticVelocity = numeric(measurements.Vmax_aorta);
  const higherClaim = /\bvelocidade aortica\b[^.\n]{0,50}?\b(?:superior|acima)\s+a\s*(\d+(?:[.,]\d+)?)\s*m\/s/.exec(text);
  const threshold = numeric(higherClaim?.[1]);
  if (aorticVelocity !== null && threshold !== null && aorticVelocity <= threshold) {
    results.push({
      key: "Vmax_aorta",
      message: `O texto cita velocidade aórtica acima de ${format(threshold)} m/s; a tabela mostra Vmax aorta de ${format(aorticVelocity)} m/s. Confirme o local da medida e documente-o se for distinto.`,
    });
  }
  return results;
}
