"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save } from "lucide-react";
import api from "@/lib/axios";

interface Frase {
  id?: number;
  chave: string;
  patologia: string;
  grau: string;
  valvas: string;
  camaras: string;
  funcao: string;
  pericardio: string;
  vasos: string;
  ad_vd: string;
  conclusao: string;
  layout?: string;
}

interface FraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  frase: Frase | null;
  onSuccess: () => void;
}

const CAMPOS_QUALITATIVA = [
  { key: "valvas", label: "Válvulas", placeholder: "Descreva o estado das válvulas cardíacas..." },
  { key: "camaras", label: "Câmaras", placeholder: "Descreva as cavidades cardíacas..." },
  { key: "funcao", label: "Função", placeholder: "Descreva a função cardíaca..." },
  { key: "pericardio", label: "Pericárdio", placeholder: "Descreva o pericárdio..." },
  { key: "vasos", label: "Vasos", placeholder: "Descreva os grandes vasos..." },
  { key: "ad_vd", label: "AD/VD", placeholder: "Descreva as câmaras direitas..." },
];

const GRAUS_PADRAO = ["Normal", "Leve", "Moderada", "Importante", "Grave", "Pequena", "Moderado", "Grande"];

export default function FraseModal({ isOpen, onClose, frase, onSuccess }: FraseModalProps) {
  const [formData, setFormData] = useState<Frase>({
    chave: "",
    patologia: "",
    grau: "Normal",
    valvas: "",
    camaras: "",
    funcao: "",
    pericardio: "",
    vasos: "",
    ad_vd: "",
    conclusao: "",
    layout: "detalhado",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (frase) {
      setFormData({
        chave: frase.chave || "",
        patologia: frase.patologia || "",
        grau: frase.grau || "Normal",
        valvas: frase.valvas || "",
        camaras: frase.camaras || "",
        funcao: frase.funcao || "",
        pericardio: frase.pericardio || "",
        vasos: frase.vasos || "",
        ad_vd: frase.ad_vd || "",
        conclusao: frase.conclusao || "",
        layout: frase.layout || "detalhado",
      });
    } else {
      // Reset para nova frase
      setFormData({
        chave: "",
        patologia: "",
        grau: "Normal",
        valvas: "",
        camaras: "",
        funcao: "",
        pericardio: "",
        vasos: "",
        ad_vd: "",
        conclusao: "",
        layout: "detalhado",
      });
    }
  }, [frase, isOpen]);

  const gerarChave = (patologia: string, grau: string) => {
    if (patologia === "Normal") {
      return "Normal (Normal)";
    }
    return `${patologia} (${grau})`;
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-gerar chave quando patologia ou grau mudam
      if (field === "patologia" || field === "grau") {
        const patologia = field === "patologia" ? value : prev.patologia;
        const grau = field === "grau" ? value : prev.grau;
        if (patologia && grau) {
          updated.chave = gerarChave(patologia, grau);
        }
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!formData.patologia || !formData.grau) {
        throw new Error("Patologia e Grau são obrigatórios");
      }

      // Garantir que a chave está gerada
      const dataToSend = {
        ...formData,
        chave: formData.chave || gerarChave(formData.patologia, formData.grau),
      };

      if (frase?.id) {
        // Atualizar frase existente
        await api.put(`/frases/${frase.id}`, dataToSend);
      } else {
        // Criar nova frase
        await api.post("/frases", dataToSend);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar frase:", err);
      setError(err.response?.data?.detail || err.message || "Erro ao salvar frase");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEditing = !!frase?.id;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" role="dialog" aria-modal="true" aria-labelledby="modal-frase-title">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 id="modal-frase-title" className="text-lg font-semibold text-gray-900">
            {isEditing ? "Editar Frase" : "Nova Frase"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Chave (somente leitura) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chave
              </label>
              <input
                type="text"
                value={formData.chave}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 border rounded text-gray-500 text-sm"
                placeholder="Gerada automaticamente"
              />
              <p className="text-xs text-gray-500 mt-1">
                A chave é gerada automaticamente com base na patologia e grau
              </p>
            </div>

            {/* Patologia e Grau */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patologia *
                </label>
                <input
                  type="text"
                  value={formData.patologia}
                  onChange={(e) => handleChange("patologia", e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Ex: Endocardiose Mitral"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grau *
                </label>
                <select
                  value={formData.grau}
                  onChange={(e) => handleChange("grau", e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                >
                  {GRAUS_PADRAO.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campos da qualitativa */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Textos Qualitativos
              </h3>
              <div className="space-y-3">
                {CAMPOS_QUALITATIVA.map((campo) => (
                  <div key={campo.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {campo.label}
                    </label>
                    <textarea
                      value={(formData as any)[campo.key]}
                      onChange={(e) => handleChange(campo.key, e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                      placeholder={campo.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Conclusão */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conclusão
              </label>
              <textarea
                value={formData.conclusao}
                onChange={(e) => handleChange("conclusao", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                placeholder="Texto da conclusão do laudo..."
              />
            </div>

            {/* Layout */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Layout
              </label>
              <select
                value={formData.layout}
                onChange={(e) => handleChange("layout", e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="detalhado">Detalhado</option>
                <option value="enxuto">Enxuto</option>
              </select>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? "Atualizar" : "Salvar"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
