"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useReferenciaEco } from "../hooks/useReferenciaEco";
import { ComparacaoMedida } from "../types/referencia-eco";

interface ReferenciaComparisonProps {
  especie?: "Canina" | "Felina" | string;
  peso?: number;
  medidas: Record<string, string>;
}

const CATEGORIAS = {
  estrutural: { label: "Medidas Estruturais", icon: "📏" },
  funcao: { label: "Função", icon: "💓" },
  vasos: { label: "Vasos", icon: "🩸" },
  doppler: { label: "Doppler", icon: "〰️" },
};

export function ReferenciaComparison({ especie, peso, medidas }: ReferenciaComparisonProps) {
  const { buscarReferencia, compararMedidas, loading } = useReferenciaEco();
  const [referencia, setReferencia] = useState<any>(null);
  const [comparacoes, setComparacoes] = useState<Record<string, ComparacaoMedida>>({});

  useEffect(() => {
    const pesoValido = typeof peso === "number" && Number.isFinite(peso) && peso > 0;

    async function carregarReferencia() {
      if (especie && pesoValido) {
        const ref = await buscarReferencia(especie, peso);
        setReferencia(ref);
        return;
      }

      setReferencia(null);
    }

    carregarReferencia();
  }, [especie, peso, buscarReferencia]);

  useEffect(() => {
    if (referencia) {
      const comps = compararMedidas(medidas, referencia);
      setComparacoes(comps);
    }
  }, [medidas, referencia]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!referencia) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-lg font-medium mb-1">Nenhuma referência encontrada</p>
        <p className="text-sm">
          {!especie || !(typeof peso === "number" && Number.isFinite(peso) && peso > 0)
            ? "Preencha os dados do paciente (espécie e peso) para visualizar as referências."
            : `Não há referência cadastrada para ${especie} com ${peso}kg.`}
        </p>
      </div>
    );
  }

  // Agrupar comparações por categoria
  const porCategoria: Record<string, Array<{key: string} & ComparacaoMedida>> = {};
  Object.entries(comparacoes).forEach(([key, comp]) => {
    const categoria = comp.categoria || "outros";
    if (!porCategoria[categoria]) {
      porCategoria[categoria] = [];
    }
    porCategoria[categoria].push({ key, ...comp });
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "normal":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "aumentado":
        return <ArrowUp className="w-4 h-4 text-red-500" />;
      case "diminuido":
        return <ArrowDown className="w-4 h-4 text-blue-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-green-50 border-green-200";
      case "aumentado":
        return "bg-red-50 border-red-200";
      case "diminuido":
        return "bg-blue-50 border-blue-200";
      case "nao_avaliado":
        return "bg-white border-gray-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  const getStatusTextClass = (status: string) => {
    switch (status) {
      case "normal":
        return "text-green-700";
      case "aumentado":
        return "text-red-700";
      case "diminuido":
        return "text-blue-700";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-lg">
        <span className="text-lg">📊</span>
        <div>
          <p className="font-medium text-teal-900">
            Referência: {especie?.toLowerCase() === "canina" ? "Canino" : "Felino"} - {peso}kg
          </p>
          <p className="text-sm text-teal-700">
            Valores de referência aplicados às medidas do paciente
          </p>
        </div>
      </div>

      {Object.keys(porCategoria).length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
          <p>Nenhuma medida preenchida para comparação.</p>
          <p className="text-sm mt-1">Vá para a aba "Medidas" e preencha os valores.</p>
        </div>
      ) : (
        Object.entries(porCategoria).map(([categoria, items]) => (
          <div key={categoria}>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <span>{CATEGORIAS[categoria as keyof typeof CATEGORIAS]?.icon || "📋"}</span>
              {CATEGORIAS[categoria as keyof typeof CATEGORIAS]?.label || categoria}
            </h4>
            <div className="space-y-2">
              {items.map((item) => (
                (() => {
                  const semReferenciaDefinida =
                    item.status === "nao_avaliado" ||
                    item.referencia_min === null ||
                    item.referencia_max === null ||
                    (item.referencia_min === 0 && item.referencia_max === 0);
                  const faixaRef = semReferenciaDefinida
                    ? "-"
                    : `${item.referencia_min} - ${item.referencia_max}`;

                  return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getStatusClass(
                    item.status
                  )}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <p className="font-medium text-sm">{item.nome}</p>
                      <p className="text-xs text-gray-500">
                        Ref: {faixaRef}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{item.valor_medido || "-"}</p>
                    <p className={`text-xs ${getStatusTextClass(item.status)}`}>
                      {item.interpretacao}
                    </p>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </div>
        ))
      )}

      <div className="flex gap-4 text-sm mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUp className="w-4 h-4 text-red-500" />
          <span>Aumentado</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowDown className="w-4 h-4 text-blue-500" />
          <span>Diminuído</span>
        </div>
      </div>
    </div>
  );
}
