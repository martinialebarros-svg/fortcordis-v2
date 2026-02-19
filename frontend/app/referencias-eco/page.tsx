"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { BookOpen, Upload, Edit2, Save, X } from "lucide-react";

interface Referencia {
  id: number;
  especie: string;
  peso_kg: number;
  lvid_d_min?: number;
  lvid_d_max?: number;
  ivs_d_min?: number;
  ivs_d_max?: number;
  lvpw_d_min?: number;
  lvpw_d_max?: number;
  lvid_s_min?: number;
  lvid_s_max?: number;
  ivs_s_min?: number;
  ivs_s_max?: number;
  lvpw_s_min?: number;
  lvpw_s_max?: number;
  fs_min?: number;
  fs_max?: number;
  ef_min?: number;
  ef_max?: number;
  ao_min?: number;
  ao_max?: number;
  la_min?: number;
  la_max?: number;
  la_ao_min?: number;
  la_ao_max?: number;
}

const CAMPOS_MEDIDAS = [
  { key: "lvid_d", label: "LVIDd", unidade: "mm" },
  { key: "lvid_s", label: "LVIDs", unidade: "mm" },
  { key: "ivs_d", label: "IVSd", unidade: "mm" },
  { key: "ivs_s", label: "IVSs", unidade: "mm" },
  { key: "lvpw_d", label: "LVPWd", unidade: "mm" },
  { key: "lvpw_s", label: "LVPWs", unidade: "mm" },
  { key: "fs", label: "FS", unidade: "%" },
  { key: "ef", label: "EF", unidade: "%" },
  { key: "ao", label: "Ao", unidade: "mm" },
  { key: "la", label: "LA", unidade: "mm" },
  { key: "la_ao", label: "LA/Ao", unidade: "" },
];

export default function ReferenciasEcoPage() {
  const router = useRouter();
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [especieFiltro, setEspecieFiltro] = useState("Canina");
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Referencia>>({});
  const [importando, setImportando] = useState(false);
  const [fileCaninos, setFileCaninos] = useState<File | null>(null);
  const [fileFelinos, setFileFelinos] = useState<File | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarReferencias();
  }, [router, especieFiltro]);

  const carregarReferencias = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/referencias-eco?especie=${encodeURIComponent(especieFiltro)}`);
      const items = response.data?.items ?? [];
      setReferencias(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error("Erro ao carregar referências:", error);
      setReferencias([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (ref: Referencia) => {
    setEditando(ref.id);
    setFormData({ ...ref });
  };

  const handleSalvar = async (id: number) => {
    try {
      await api.put(`/referencias-eco/${id}`, formData);
      setEditando(null);
      carregarReferencias();
      alert("Referência atualizada com sucesso!");
    } catch (error) {
      alert("Erro ao salvar referência");
    }
  };

  const handleChange = (campo: string, valor: string) => {
    const numValor = valor === "" ? undefined : parseFloat(valor);
    setFormData({ ...formData, [campo]: numValor });
  };

  const handleImportar = async () => {
    if (!fileCaninos && !fileFelinos) {
      alert("Selecione pelo menos um arquivo CSV (caninos e/ou felinos).");
      return;
    }
    try {
      setImportando(true);
      const form = new FormData();
      if (fileCaninos) form.append("caninos", fileCaninos);
      if (fileFelinos) form.append("felinos", fileFelinos);
      const { data } = await api.post<{ caninos: number; felinos: number; erros: string[] }>(
        "/referencias-eco/importar",
        form
      );
      const msg = [
        data.caninos > 0 ? `Caninos: ${data.caninos} referências importadas.` : "",
        data.felinos > 0 ? `Felinos: ${data.felinos} referências importadas.` : "",
        ...(data.erros || []),
      ].filter(Boolean).join(" ");
      alert(data.erros?.length ? `Importação concluída com avisos:\n${msg}` : `Importação concluída!\n${msg}`);
      setFileCaninos(null);
      setFileFelinos(null);
      // Recarrega a lista (evita cache)
      setReferencias([]);
      await carregarReferencias();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert("Erro ao importar: " + (err.response?.data?.detail || String(e)));
    } finally {
      setImportando(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-teal-600" />
              Referências Ecocardiográficas
            </h1>
            <p className="text-gray-500">Valores de referência por espécie e peso</p>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={especieFiltro}
              onChange={(e) => setEspecieFiltro(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="Canina">Caninos</option>
              <option value="Felina">Felinos</option>
            </select>
          </div>
        </div>

        {/* Importar CSV */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Importar referências dos arquivos CSV</h2>
          <p className="text-xs text-gray-500 mb-3">
            Use os arquivos <strong>tabela_referencia_caninos.csv</strong> e <strong>tabela_referencia_felinos.csv</strong>.
            As referências existentes da espécie serão substituídas.
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">CSV Caninos</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFileCaninos(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">CSV Felinos</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFileFelinos(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleImportar}
              disabled={importando || (!fileCaninos && !fileFelinos)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {importando ? "Importando…" : "Importar CSV"}
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700 border-b">Peso (kg)</th>
                    {CAMPOS_MEDIDAS.map((campo) => (
                      <th key={campo.key} className="px-3 py-3 text-center font-semibold text-gray-700 border-b min-w-[100px]">
                        {campo.label}
                        <span className="block text-xs font-normal text-gray-500">({campo.unidade || "-"})</span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-semibold text-gray-700 border-b">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {referencias.map((ref) => (
                    <tr key={ref.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">
                        {editando === ref.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={formData.peso_kg || ""}
                            onChange={(e) => handleChange("peso_kg", e.target.value)}
                            className="w-20 px-2 py-1 border rounded"
                          />
                        ) : (
                          ref.peso_kg
                        )}
                      </td>
                      
                      {CAMPOS_MEDIDAS.map((campo) => {
                        const minKey = `${campo.key}_min` as keyof Referencia;
                        const maxKey = `${campo.key}_max` as keyof Referencia;
                        const min = editando === ref.id ? formData[minKey] : ref[minKey];
                        const max = editando === ref.id ? formData[maxKey] : ref[maxKey];
                        
                        return (
                          <td key={campo.key} className="px-3 py-2">
                            {editando === ref.id ? (
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={min || ""}
                                  onChange={(e) => handleChange(minKey as string, e.target.value)}
                                  className="w-14 px-1 py-1 text-xs border rounded"
                                  placeholder="Min"
                                />
                                <input
                                  type="number"
                                  step="0.1"
                                  value={max || ""}
                                  onChange={(e) => handleChange(maxKey as string, e.target.value)}
                                  className="w-14 px-1 py-1 text-xs border rounded"
                                  placeholder="Max"
                                />
                              </div>
                            ) : (
                              <div className="text-center text-xs">
                                {min !== undefined && max !== undefined 
                                  ? `${min} - ${max}` 
                                  : "-"}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-1">
                          {editando === ref.id ? (
                            <>
                              <button
                                onClick={() => handleSalvar(ref.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Salvar"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditando(null)}
                                className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEditar(ref)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instruções */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
          <p className="font-medium mb-2">Como usar:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>As referências são usadas automaticamente ao preencher a aba "Medidas" do laudo</li>
            <li>Clique no ícone de editar (✏️) para alterar os valores de referência</li>
            <li>Os valores são organizados por espécie (Canina/Felina) e peso</li>
            <li>As interpretações de normalidade/alteração são baseadas nestas referências</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
