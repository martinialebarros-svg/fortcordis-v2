"use client";

import { useState, useCallback } from "react";
import api from "@/lib/axios";
import { ComparacaoMedida, ReferenciaEco } from "../types/referencia-eco";

// Mapeamento de parâmetros das medidas para os campos da referência
const MAPEAMENTO_PARAMETROS: Record<string, { campo: string; nome: string; categoria: string }> = {
  // Estrutural
  LVIDd: { campo: "lvidd", nome: "LVIDd (cm)", categoria: "estrutural" },
  LVIDs: { campo: "lvids", nome: "LVIDs (cm)", categoria: "estrutural" },
  IVSd: { campo: "ivsd", nome: "IVSd (cm)", categoria: "estrutural" },
  IVSs: { campo: "ivss", nome: "IVSs (cm)", categoria: "estrutural" },
  LVPWd: { campo: "lvpwd", nome: "LVPWd (cm)", categoria: "estrutural" },
  LVPWs: { campo: "lvpws", nome: "LVPWs (cm)", categoria: "estrutural" },
  
  // Função
  FS: { campo: "fs", nome: "FS (%)", categoria: "funcao" },
  EF: { campo: "ef", nome: "EF (%)", categoria: "funcao" },
  
  // Vasos
  Ao: { campo: "ao", nome: "Ao (cm)", categoria: "vasos" },
  "Ao (d)": { campo: "ao", nome: "Ao (cm)", categoria: "vasos" },
  LA: { campo: "la", nome: "LA (cm)", categoria: "vasos" },
  "LA/Ao": { campo: "la_ao", nome: "LA/Ao", categoria: "vasos" },
  "LA/Ao (d)": { campo: "la_ao", nome: "LA/Ao", categoria: "vasos" },
  
  // Doppler
  "Vmax Ao": { campo: "vmax_ao", nome: "Vmax Ao (m/s)", categoria: "doppler" },
  "Vmax Pulm": { campo: "vmax_pulm", nome: "Vmax Pulm (m/s)", categoria: "doppler" },
  "MV E": { campo: "mv_e", nome: "MV E (m/s)", categoria: "doppler" },
  "MV A": { campo: "mv_a", nome: "MV A (m/s)", categoria: "doppler" },
  "MV E/A": { campo: "mv_ea", nome: "MV E/A", categoria: "doppler" },
  
  // Volumes
  EDV: { campo: "edv", nome: "EDV (ml)", categoria: "estrutural" },
  ESV: { campo: "esv", nome: "ESV (ml)", categoria: "estrutural" },
  SV: { campo: "sv", nome: "SV (ml)", categoria: "estrutural" },
};

export function useReferenciaEco() {
  const [loading, setLoading] = useState(false);

  const buscarReferencia = useCallback(async (especie: string, peso: number): Promise<ReferenciaEco | null> => {
    try {
      setLoading(true);
      const response = await api.get(`/referencias-eco/buscar/${especie.toLowerCase()}/${peso}`);
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar referência:", error);
      return null;
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
      
      const refMin = referencia[minKey] as number | undefined;
      const refMax = referencia[maxKey] as number | undefined;

      if (refMin === undefined || refMax === undefined) return;

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
export const mapeamentoParametros: Record<string, string> = {
  "LVIDd": "lvidd",
  "LVIDs": "lvids",
  "IVSd": "ivsd",
  "IVSs": "ivss",
  "LVPWd": "lvpwd",
  "LVPWs": "lvpws",
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
