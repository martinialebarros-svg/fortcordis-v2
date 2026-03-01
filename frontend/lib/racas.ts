const RACAS_POR_ESPECIE: Record<string, string[]> = {
  Canina: [
    "SRD",
    "Akita",
    "American Pitbull",
    "Australian Shepherd",
    "Beagle",
    "Bernese Mountain Dog",
    "Bichon Frise",
    "Border Collie",
    "Boston Terrier",
    "Boxer",
    "Bull Terrier",
    "Cairn Terrier",
    "Cane Corso",
    "Cavalier King Charles Spaniel",
    "Chihuahua",
    "Chow Chow",
    "Cocker Spaniel",
    "Dachshund",
    "Doberman",
    "Dogue Alemao",
    "Fox Terrier",
    "Galgo",
    "Golden Retriever",
    "Great Dane",
    "Husky Siberiano",
    "Jack Russell Terrier",
    "Labrador Retriever",
    "Lhasa Apso",
    "Maltes",
    "Mastiff",
    "Newfoundland",
    "Pastor Alemao",
    "Pastor Belga",
    "Pinscher",
    "Poodle",
    "Pug",
    "Rottweiler",
    "Saint Bernard",
    "Samoieda",
    "Scottish Terrier",
    "Shetland Sheepdog",
    "Shih Tzu",
    "Shar Pei",
    "Spitz Alemao",
    "Springer Spaniel",
    "Staffordshire Bull Terrier",
    "Weimaraner",
    "West Highland White Terrier",
    "Whippet",
    "Yorkshire Terrier",
  ],
  Felina: [
    "SRD",
    "Abissinio",
    "American Shorthair",
    "Angora",
    "Balinese",
    "Bengal",
    "Birmanes",
    "British Shorthair",
    "Burmese",
    "Chartreux",
    "Cornish Rex",
    "Devon Rex",
    "European Shorthair",
    "Exotico Shorthair",
    "Havana Brown",
    "Korat",
    "Maine Coon",
    "Norwegian Forest",
    "Oriental Shorthair",
    "Persa",
    "Pixie Bob",
    "Ragdoll",
    "Russo Azul",
    "Savannah",
    "Scottish Fold",
    "Siamese",
    "Somali",
    "Sphynx",
    "Tonquines",
  ],
  Equina: [
    "SRD",
    "Quarto de Milha",
    "Mangalarga Marchador",
    "Crioulo",
    "Puro Sangue Ingles",
    "Appaloosa",
  ],
  Outra: ["SRD"],
};

const DEFAULT_RACAS = ["SRD"];
const STORAGE_KEY = "fortcordis:racas-custom-por-especie";

function pushUniqueCaseInsensitive(list: string[], value: string) {
  const normalized = value.toLowerCase();
  if (!list.some((item) => item.toLowerCase() === normalized)) {
    list.push(value);
  }
}

export function getRacaOptions(especie?: string, racaAtual?: string, racasExtras: string[] = []): string[] {
  const base = RACAS_POR_ESPECIE[especie || ""] || DEFAULT_RACAS;
  const opcoes = [...base];

  for (const extra of racasExtras) {
    const raca = (extra || "").trim();
    if (!raca) continue;
    pushUniqueCaseInsensitive(opcoes, raca);
  }

  const atual = (racaAtual || "").trim();
  if (atual) {
    pushUniqueCaseInsensitive(opcoes, atual);
  }

  return opcoes;
}

export function addRacaCustomPorEspecie(
  mapaAtual: Record<string, string[]>,
  especie: string,
  novaRaca: string,
): Record<string, string[]> {
  const especieAtual = (especie || "").trim();
  const raca = (novaRaca || "").trim();
  if (!especieAtual || !raca) return mapaAtual;

  const listaAtual = mapaAtual[especieAtual] || [];
  if (listaAtual.some((item) => item.toLowerCase() === raca.toLowerCase())) {
    return mapaAtual;
  }

  return {
    ...mapaAtual,
    [especieAtual]: [...listaAtual, raca],
  };
}

export function loadRacasCustomPorEspecie(): Record<string, string[]> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const resultado: Record<string, string[]> = {};
    for (const [especie, racas] of Object.entries(parsed)) {
      if (!Array.isArray(racas)) continue;
      resultado[especie] = racas
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }

    return resultado;
  } catch {
    return {};
  }
}

export function saveRacasCustomPorEspecie(mapaAtual: Record<string, string[]>) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapaAtual));
  } catch {
    // Ignora falhas de armazenamento (quota/permissão)
  }
}
