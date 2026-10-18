import { isFelineEchoSpecies } from "./echo-species";

export type FelineNarrativeDiscrepancy = {
  key: "feline_transmitral_fusion" | "feline_tissue_fusion";
  message: string;
  section: string;
  excerpt: string;
  suggestion: string;
};

function normalized(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[′’‘´`]/g, "'").toLowerCase();
}

const SECTION_LABELS: Record<string, string> = {
  valvas: "Valvas", camaras: "Câmaras", funcao: "Função",
  funcao_diastolica: "Função diastólica", funcao_sistolica: "Função sistólica",
  pericardio: "Pericárdio", vasos: "Vasos", ad_vd: "Câmaras direitas",
};

/** Only explicit, current assertions are candidates. Ambiguous/qualified prose
 * is left to the clinician; this is deliberately not a general text classifier. */
function isQualified(text: string): boolean {
  return /\b(?:nao|impossivel|limitad[oa]s?|indeterminad[oa]s?|inconclusiv[oa]s?|fundid[oa]s?|fusionad[oa]s?|sobreposicao|descartad[oa]s?|desconsiderad[oa]s?|invalid[oa]s?|incorret[oa]s?|artefato)\b/.test(text)
    || /\bsem\s+(?:(?:possibilidade|condicoes)\s+de\s+)?(?:mensuracao|interpretacao|separacao|individualizacao|avaliacao)\b/.test(text)
    || /\b(?:historia|historico|historica|historicos|historicas|previamente|anteriormente|importad[oa]s?)\b/.test(text)
    || /\b(?:exame|estudo|avaliacao|laudo)\s+(?:anterior|previo|previa|passado)\b/.test(text)
    || /\b(?:exame|estudo|avaliacao|laudo)\s+(?:de|em)\s+(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4})\b/.test(text)
    || /\b(?:caso|quando|poderia|poderiam|possivel|possivelmente|hipotese|suspeita)\b/.test(text)
    || /(?:^|[\s(,;:])se\s+/.test(text)
    || /\?\s*$/.test(text)
    || /^(?:[-•]\s*)?(?:avaliar|verificar|confirmar|revisar)\b/.test(text);
}

const E_A = String.raw`(?<![\w'])e\s*\/\s*a(?![\w'])`;
const E_E = String.raw`(?<![\w'])e\s*\/\s*e\s*'(?!\w)`;
const E_TRIV = String.raw`(?<![\w'])e\s*\/\s*(?:triv|ivrt)\b`;
const TDI_RATIO = String.raw`\be\s*'\s*\/\s*a\s*'(?!\w)`;
const NUMERIC = String.raw`(?:\s*(?:de|em|igual\s+a|foi|e|=|:)\s*)?\s*\d+(?:[.,]\d+)?`;
const PREDICATE = String.raw`\s*(?:(?:e|esta|mostra|encontra-se)\s+)?(?:(?:aparentemente|acentuadamente|discretamente|marcadamente)\s+)?(?:normal|invertida|aumentada|elevada|reduzida|preservada)\b`;
const E_A_PAIR = String.raw`(?:e\s*(?:e|\/)\s*a)(?![\w'])`;
const TDI_PAIR = String.raw`(?:e\s*'\s*(?:e|\/)\s*a\s*')`;

function ratioClaim(text: string, ratio: string): boolean {
  return new RegExp(`${ratio}${NUMERIC}`).test(text)
    || new RegExp(`\\brelacao\\s+${ratio}${PREDICATE}`).test(text)
    || new RegExp(`\\b(?:inversao|elevacao|reducao)\\s+da\\s+relacao\\s+${ratio}`).test(text);
}

function separatedClaim(text: string, pair: string): boolean {
  return new RegExp(`\\b(?:ondas|picos)\\s+${pair}\\s+(?:(?:estao|sao|bem)\\s+)?(?:separad[oa]s|individualizad[oa]s|mensuraveis)\\b`).test(text);
}

function transmitralClaim(text: string): boolean {
  return separatedClaim(text, E_A_PAIR)
    || ratioClaim(text, E_A) || ratioClaim(text, E_E) || ratioClaim(text, E_TRIV)
    || /\bpadrao\s+(?:de\s+enchimento\s+)?[^\n]{0,110}\b(?:normal|adequado|restritivo|pseudonormal)\b[^\n]{0,80}\b(?:doppler|fluxo)\s+transmitral\b/.test(text)
    || /\b(?:doppler|fluxo)\s+transmitral\b[^\n]{0,60}\bpadrao\s+(?:de\s+enchimento\s+)?(?:normal|adequado|restritivo|pseudonormal)\b/.test(text);
}

function tissueClaim(text: string): boolean {
  return separatedClaim(text, TDI_PAIR) || ratioClaim(text, TDI_RATIO) || ratioClaim(text, E_E)
    || /\b[ea]\s*'\s*(?:(?:lateral|septal)\s*)?(?:de|=|:)?\s*\d+(?:[.,]\d+)?\s*(?:m\/s|cm\/s)\b/.test(text);
}

export function findFelineNarrativeDiscrepancies(
  measurements: Record<string, string>, qualitative: object, conclusion: string, species?: string,
): FelineNarrativeDiscrepancy[] {
  if (!isFelineEchoSpecies(species)) return [];
  const sources = [
    ...Object.entries(qualitative).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, text]) => ({ section: SECTION_LABELS[key] || key, text })),
    { section: "Conclusão", text: conclusion },
  ];
  const families = [
    { key: "feline_transmitral_fusion" as const, active: measurements.Diastolica_ondas === "fundidas", claim: transmitralClaim,
      message: "Ondas E/A registradas como fundidas: revise a afirmação de picos, relações ou padrão transmitral neste trecho.",
      suggestion: "Ondas E e A fundidas, sem mensuração independente dos picos transmitrais e das relações dependentes. A interpretação diastólica deve considerar os demais parâmetros disponíveis." },
    { key: "feline_tissue_fusion" as const, active: measurements.TDI_ondas === "fundidas", claim: tissueClaim,
      message: "Ondas e′/a′ registradas como fundidas: revise a afirmação de picos ou relações teciduais individuais neste trecho.",
      suggestion: "Ondas e′ e a′ fundidas; picos e relações teciduais dependentes não mensuráveis individualmente. A interpretação diastólica deve considerar os demais parâmetros disponíveis." },
  ];
  const results: FelineNarrativeDiscrepancy[] = [];
  for (const family of families) {
    if (!family.active) continue;
    let found = false;
    for (const source of sources) {
      // Decimal points inside values do not split a sentence. Retain the
      // original text for review rather than printing a normalized paraphrase.
      for (const fragment of source.text.split(/[\r\n]+|(?<=[.!?])\s+/)) {
        const excerpt = fragment.trim();
        const text = normalized(excerpt);
        if (!text || isQualified(text) || !family.claim(text)) continue;
        results.push({ key: family.key, section: source.section, excerpt,
          message: `${source.section}: ${family.message}`, suggestion: family.suggestion });
        found = true;
        break;
      }
      if (found) break; // At most one review item per family; avoid repeated warnings.
    }
  }
  return results;
}
