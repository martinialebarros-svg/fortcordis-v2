export interface WazeDestinoClinica {
  latitude?: number | string | null;
  longitude?: number | string | null;
  endereco_normalizado?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface Coordenadas {
  lat: number;
  lng: number;
}

export interface WazeDestinoUrl {
  appUrl: string;
  webUrl: string;
  tipo: "coordenadas" | "endereco";
}

const texto = (valor?: string | number | null) => String(valor ?? "").trim();

const coordenadasValidas = (clinica?: WazeDestinoClinica | null): Coordenadas | null => {
  const lat = Number(clinica?.latitude);
  const lng = Number(clinica?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;

  return { lat, lng };
};

const formatarCoordenada = (valor: number) => valor.toFixed(7);

export const montarEnderecoClinicaWaze = (clinica?: WazeDestinoClinica | null): string => {
  const enderecoNormalizado = texto(clinica?.endereco_normalizado);
  if (enderecoNormalizado) return enderecoNormalizado;

  const endereco = texto(clinica?.endereco);
  const numero = texto(clinica?.numero);
  const linhaEndereco = [endereco, numero].filter(Boolean).join(", ");

  return [
    linhaEndereco,
    texto(clinica?.bairro),
    texto(clinica?.cidade),
    texto(clinica?.estado),
    texto(clinica?.cep),
  ]
    .filter(Boolean)
    .join(", ");
};

export const montarWazeDestinoClinica = (
  clinica?: WazeDestinoClinica | null
): WazeDestinoUrl | null => {
  const coordenadas = coordenadasValidas(clinica);
  if (coordenadas) {
    const ll = `${formatarCoordenada(coordenadas.lat)},${formatarCoordenada(coordenadas.lng)}`;
    return {
      appUrl: `waze://?ll=${ll}&navigate=yes`,
      webUrl: `https://waze.com/ul?ll=${ll}&navigate=yes`,
      tipo: "coordenadas",
    };
  }

  const endereco = montarEnderecoClinicaWaze(clinica);
  if (!endereco) return null;

  const query = encodeURIComponent(endereco);
  return {
    appUrl: `waze://?q=${query}&navigate=yes`,
    webUrl: `https://waze.com/ul?q=${query}&navigate=yes`,
    tipo: "endereco",
  };
};
