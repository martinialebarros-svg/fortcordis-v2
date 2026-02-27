"use client";

import { useState, useCallback } from "react";
import api from "@/lib/axios";
import { ComparacaoMedida, ReferenciaEco } from "../types/referencia-eco";

// Mapeamento de parâmetros das medidas para os campos da referência
// As chaves devem corresponder aos 'key' definidos na nova aba Medidas
// e aos nomes retornados pelo XML parser atualizado
const MAPEAMENTO_PARAMETROS: Record<string, { campo: string; nome: string; categoria: string }> = {
  // === VE - MODO M (DIÁSTOLE) ===
  DIVEd: { campo: "lvid_d", nome: "DIVEd (Diâmetro interno VE diástole)", categoria: "estrutural" },
  SIVd: { campo: "ivs_d", nome: "SIVd (Septo interventricular diástole)", categoria: "estrutural" },
  PLVEd: { campo: "lvpw_d", nome: "PLVEd (Parede livre VE diástole)", categoria: "estrutural" },
  
  // === VE - MODO M (SÍSTOLE) ===
  DIVES: { campo: "lvid_s", nome: "DIVÉs (Diâmetro interno VE sístole)", categoria: "estrutural" },
  SIVs: { campo: "ivs_s", nome: "SIVs (Septo interventricular sístole)", categoria: "estrutural" },
  PLVES: { campo: "lvpw_s", nome: "PLVÉs (Parede livre VE sístole)", categoria: "estrutural" },
  
  // === VOLUMES E FUNÇÃO ===
  VDF: { campo: "edv", nome: "VDF (Volume diastólico final)", categoria: "funcao" },
  VSF: { campo: "esv", nome: "VSF (Volume sistólico final)", categoria: "funcao" },
  FE_Teicholz: { campo: "ef", nome: "FE (Fração de ejeção - Teicholz)", categoria: "funcao" },
  DeltaD_FS: { campo: "fs", nome: "Delta D / %FS (Encurtamento)", categoria: "funcao" },
  TAPSE: { campo: "tapse", nome: "TAPSE", categoria: "funcao" },
  MAPSE: { campo: "mapse", nome: "MAPSE", categoria: "funcao" },
  
  // === ÁTRIO ESQUERDO / AORTA ===
  Aorta: { campo: "ao", nome: "Aorta", categoria: "vasos" },
  Atrio_esquerdo: { campo: "la", nome: "Átrio Esquerdo", categoria: "vasos" },
  AE_Ao: { campo: "la_ao", nome: "AE/Ao", categoria: "vasos" },
  
  // === ARTÉRIA PULMONAR ===
  AP: { campo: "ap", nome: "AP (Artéria pulmonar)", categoria: "vasos" },
  AP_Ao: { campo: "ap_ao", nome: "AP/Ao", categoria: "vasos" },
  
  // === DIASTÓLICA ===
  Onda_E: { campo: "mv_e", nome: "Onda E", categoria: "doppler" },
  Onda_A: { campo: "mv_a", nome: "Onda A", categoria: "doppler" },
  E_A: { campo: "mv_ea", nome: "E/A", categoria: "doppler" },
  TD: { campo: "mv_dt", nome: "TD (Tempo desaceleração)", categoria: "doppler" },
  TRIV: { campo: "ivrt", nome: "TRIV", categoria: "doppler" },
  e_doppler: { campo: "tdi_e", nome: "e' (Doppler tecidual)", categoria: "doppler" },
  a_doppler: { campo: "tdi_a", nome: "a' (Doppler tecidual)", categoria: "doppler" },
  E_E_linha: { campo: "e_e_linha", nome: "E/E'", categoria: "doppler" },
  
  // === DOPPLER - SAÍDAS ===
  Vmax_aorta: { campo: "vmax_ao", nome: "Vmax Aorta", categoria: "doppler" },
  Vmax_pulmonar: { campo: "vmax_pulm", nome: "Vmax Pulmonar", categoria: "doppler" },
  
  // === NOMES ANTIGOS (para compatibilidade com XMLs antigos e banco) ===
  LVIDd: { campo: "lvid_d", nome: "DIVEd (Diâmetro interno VE diástole)", categoria: "estrutural" },
  LVIDs: { campo: "lvid_s", nome: "DIVÉs (Diâmetro interno VE sístole)", categoria: "estrutural" },
  IVSd: { campo: "ivs_d", nome: "SIVd (Septo interventricular diástole)", categoria: "estrutural" },
  IVSs: { campo: "ivs_s", nome: "SIVs (Septo interventricular sístole)", categoria: "estrutural" },
  LVPWd: { campo: "lvpw_d", nome: "PLVEd (Parede livre VE diástole)", categoria: "estrutural" },
  LVPWs: { campo: "lvpw_s", nome: "PLVÉs (Parede livre VE sístole)", categoria: "estrutural" },
  FS: { campo: "fs", nome: "Delta D / %FS (Encurtamento)", categoria: "funcao" },
  EF: { campo: "ef", nome: "FE (Fração de ejeção)", categoria: "funcao" },
  EDV: { campo: "edv", nome: "VDF (Volume diastólico final)", categoria: "funcao" },
  ESV: { campo: "esv", nome: "VSF (Volume sistólico final)", categoria: "funcao" },
  SV: { campo: "sv", nome: "SV (Volume sistólico)", categoria: "funcao" },
  Ao: { campo: "ao", nome: "Aorta", categoria: "vasos" },
  LA: { campo: "la", nome: "Átrio Esquerdo", categoria: "vasos" },
  LA_Ao: { campo: "la_ao", nome: "AE/Ao", categoria: "vasos" },
  MV_E: { campo: "mv_e", nome: "Onda E", categoria: "doppler" },
  MV_A: { campo: "mv_a", nome: "Onda A", categoria: "doppler" },
  MV_E_A: { campo: "mv_ea", nome: "E/A", categoria: "doppler" },
  MV_DT: { campo: "mv_dt", nome: "TD (Tempo desaceleração)", categoria: "doppler" },
  IVRT: { campo: "ivrt", nome: "TRIV", categoria: "doppler" },
  Vmax_Ao: { campo: "vmax_ao", nome: "Vmax Aorta", categoria: "doppler" },
  Vmax_Pulm: { campo: "vmax_pulm", nome: "Vmax Pulmonar", categoria: "doppler" },
};

function normalizarEspecie(especie: string): string {
  const valor = (especie || "").trim().toLowerCase();
  if (valor.startsWith("fel") || valor.includes("gato") || valor.includes("cat")) return "Felina";
  if (valor.startsWith("can") || valor.includes("cao") || valor.includes("dog")) return "Canina";
  return especie || "Canina";
}

export function useReferenciaEco() {
  const [loading, setLoading] = useState(false);

  const buscarReferencia = useCallback(async (especie: string, peso: number): Promise<ReferenciaEco | null> => {
    const especieNormalizada = normalizarEspecie(especie);
    const pesoNormalizado = Number(peso);
    if (!Number.isFinite(pesoNormalizado) || pesoNormalizado <= 0) {
      return null;
    }

    try {
      setLoading(true);
      const response = await api.get(
        `/referencias-eco/buscar/${encodeURIComponent(especieNormalizada)}/${pesoNormalizado}`
      );
      return response.data;
    } catch (error) {
      console.warn("Falha na busca direta de referencia; tentando fallback por listagem.", error);
      try {
        const response = await api.get(
          `/referencias-eco?especie=${encodeURIComponent(especieNormalizada)}`
        );
        const items = Array.isArray(response.data?.items) ? (response.data.items as ReferenciaEco[]) : [];
        if (items.length === 0) {
          return null;
        }

        const maisProxima = items.reduce((melhor, atual) => {
          const melhorDiff = Math.abs((melhor.peso_kg ?? pesoNormalizado) - pesoNormalizado);
          const atualDiff = Math.abs((atual.peso_kg ?? pesoNormalizado) - pesoNormalizado);
          return atualDiff < melhorDiff ? atual : melhor;
        }, items[0]);

        return maisProxima;
      } catch (fallbackError) {
        console.error("Erro ao buscar referencia:", fallbackError);
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const compararMedidas = useCallback((
    medidas: Record<string, string>,
    referencia: ReferenciaEco
  ): Record<string, ComparacaoMedida> => {
    const comparacoes: Record<string, ComparacaoMedida> = {};

    Object.entries(medidas).forEach(([key, valor]) => {
      if (!valor || valor.trim() === "") return;

      const mapeamento = MAPEAMENTO_PARAMETROS[key];
      if (!mapeamento) return;

      const valorNumerico = parseFloat(valor.replace(",", "."));
      if (isNaN(valorNumerico)) return;

      const minKey = `${mapeamento.campo}_min` as keyof ReferenciaEco;
      const maxKey = `${mapeamento.campo}_max` as keyof ReferenciaEco;

      const refMinRaw = referencia[minKey] as number | null | undefined;
      const refMaxRaw = referencia[maxKey] as number | null | undefined;
      const refMin = typeof refMinRaw === "number" ? refMinRaw : null;
      const refMax = typeof refMaxRaw === "number" ? refMaxRaw : null;

      const semReferenciaDefinida =
        refMin === null ||
        refMax === null ||
        (refMin === 0 && refMax === 0);

      if (semReferenciaDefinida) {
        comparacoes[key] = {
          nome: mapeamento.nome,
          valor_medido: valor,
          referencia_min: refMin,
          referencia_max: refMax,
          status: "nao_avaliado",
          interpretacao: "Sem referencia definida",
          categoria: mapeamento.categoria,
        };
        return;
      }

      let status: ComparacaoMedida["status"];
      let interpretacao: string;

      if (valorNumerico < refMin) {
        status = "diminuido";
        interpretacao = `Abaixo do esperado (< ${refMin})`;
      } else if (valorNumerico > refMax) {
        status = "aumentado";
        interpretacao = `Acima do esperado (> ${refMax})`;
      } else {
        status = "normal";
        interpretacao = "Dentro da faixa normal";
      }

      comparacoes[key] = {
        nome: mapeamento.nome,
        valor_medido: valor,
        referencia_min: refMin,
        referencia_max: refMax,
        status,
        interpretacao,
        categoria: mapeamento.categoria,
      };
    });

    return comparacoes;
  }, []);

  return {
    buscarReferencia,
    compararMedidas,
    loading,
  };
}

// Hook legado para compatibilidade
export function useReferenciaEcoLegacy(especie: string, pesoKg?: number) {
  const [referencia, setReferencia] = useState<ReferenciaEco | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { buscarReferencia } = useReferenciaEco();

  useState(() => {
    if (!pesoKg || !especie) return;
    
    const carregar = async () => {
      setLoading(true);
      const ref = await buscarReferencia(especie, pesoKg);
      setReferencia(ref);
      setError(ref ? null : "Referência não encontrada");
      setLoading(false);
    };
    
    carregar();
  });

  const interpretarMedida = (
    valor: number | undefined,
    parametro: string
  ): { status: "normal" | "alterado" | "nao_avaliado"; mensagem: string } => {
    if (!referencia || valor === undefined || valor === null) {
      return { status: "nao_avaliado", mensagem: "Sem referência" };
    }

    const minKey = `${parametro}_min` as keyof ReferenciaEco;
    const maxKey = `${parametro}_max` as keyof ReferenciaEco;
    
    const min = referencia[minKey] as number | undefined;
    const max = referencia[maxKey] as number | undefined;

    if (min === undefined || max === undefined) {
      return { status: "nao_avaliado", mensagem: "Sem referência" };
    }

    if (valor < min) {
      return { status: "alterado", mensagem: `Abaixo do normal (< ${min})` };
    } else if (valor > max) {
      return { status: "alterado", mensagem: `Acima do normal (> ${max})` };
    } else {
      return { status: "normal", mensagem: "Dentro da normalidade" };
    }
  };

  const getFaixaReferencia = (parametro: string): string => {
    if (!referencia) return "-";
    
    const minKey = `${parametro}_min` as keyof ReferenciaEco;
    const maxKey = `${parametro}_max` as keyof ReferenciaEco;
    
    const min = referencia[minKey] as number | undefined;
    const max = referencia[maxKey] as number | undefined;

    if (min === undefined || max === undefined) return "-";
    return `${min} - ${max}`;
  };

  return {
    referencia,
    loading,
    error,
    interpretarMedida,
    getFaixaReferencia,
  };
}

// Mapeamento de parâmetros do XML para os campos da referência (compatibilidade)
// Inclui novos nomes e nomes antigos para retrocompatibilidade
export const mapeamentoParametros: Record<string, string> = {
  // Novos nomes
  "DIVEd": "lvid_d",
  "DIVES": "lvid_s",
  "SIVd": "ivs_d",
  "SIVs": "ivs_s",
  "PLVEd": "lvpw_d",
  "PLVES": "lvpw_s",
  "VDF": "edv",
  "VSF": "esv",
  "FE_Teicholz": "ef",
  "DeltaD_FS": "fs",
  "Aorta": "ao",
  "Atrio_esquerdo": "la",
  "AE_Ao": "la_ao",
  "Onda_E": "mv_e",
  "Onda_A": "mv_a",
  "E_A": "mv_ea",
  "TD": "mv_dt",
  "TRIV": "ivrt",
  "Vmax_aorta": "vmax_ao",
  "Vmax_pulmonar": "vmax_pulm",
  // Nomes antigos (retrocompatibilidade)
  "LVIDd": "lvid_d",
  "LVIDs": "lvid_s",
  "IVSd": "ivs_d",
  "IVSs": "ivs_s",
  "LVPWd": "lvpw_d",
  "LVPWs": "lvpw_s",
  "FS": "fs",
  "EF": "ef",
  "Ao": "ao",
  "LA": "la",
  "LA_Ao": "la_ao",
  "Vmax_Ao": "vmax_ao",
  "Vmax_Pulm": "vmax_pulm",
  "MV_E": "mv_e",
  "MV_A": "mv_a",
  "MV_E_A": "mv_ea",
  "EDV": "edv",
  "ESV": "esv",
  "SV": "sv",
};
