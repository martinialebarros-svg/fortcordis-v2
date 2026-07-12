"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { BookOpen, Upload, Edit2, Save, X, Database, Ruler } from "lucide-react";

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

  const pesosDisponiveis = referencias.map((referencia) => Number(referencia.peso_kg)).filter((peso) => Number.isFinite(peso));
  const faixaPeso = pesosDisponiveis.length
    ? `${Math.min(...pesosDisponiveis)} a ${Math.max(...pesosDisponiveis)} kg`
    : "—";

  return (
    <DashboardLayout>
      <div className="fc-eco-page">
        <header className="fc-eco-header">
          <div>
            <span className="fc-eco-kicker"><BookOpen className="h-4 w-4" />Biblioteca diagnóstica</span>
            <h1>Referências Ecocardiográficas</h1>
            <p>Faixas de normalidade organizadas por espécie, peso e medida cardíaca.</p>
          </div>
          <div className="fc-eco-species-tabs" role="tablist" aria-label="Espécie das referências">
            {[
              ["Canina", "Caninos"],
              ["Felina", "Felinos"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={especieFiltro === value}
                onClick={() => setEspecieFiltro(value)}
                className={`fc-eco-species-tab ${especieFiltro === value ? "fc-eco-species-tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <section className="fc-eco-metrics" aria-label="Resumo da base de referências">
          <div className="fc-eco-metric fc-eco-metric-cordis">
            <Database className="h-5 w-5" />
            <strong>{referencias.length}</strong>
            <span>Faixas cadastradas</span>
          </div>
          <div className="fc-eco-metric fc-eco-metric-vital">
            <Ruler className="h-5 w-5" />
            <strong>{faixaPeso}</strong>
            <span>Cobertura de peso</span>
          </div>
          <div className="fc-eco-metric fc-eco-metric-ink">
            <BookOpen className="h-5 w-5" />
            <strong>{CAMPOS_MEDIDAS.length}</strong>
            <span>Medidas avaliadas</span>
          </div>
        </section>

        <section className="fc-eco-import">
          <div className="fc-eco-import-copy">
            <span>Atualização da base</span>
            <h2>Importar referências por CSV</h2>
            <p>O arquivo enviado substitui as referências existentes da respectiva espécie.</p>
          </div>
          <div className="fc-eco-import-controls">
            <div>
              <input
                id="eco-csv-caninos"
                type="file"
                accept=".csv"
                onChange={(e) => setFileCaninos(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <label htmlFor="eco-csv-caninos" className="fc-eco-file-picker">
                <Upload className="h-4 w-4" />
                <span><small>CSV Caninos</small>{fileCaninos?.name || "Selecionar arquivo"}</span>
              </label>
            </div>
            <div>
              <input
                id="eco-csv-felinos"
                type="file"
                accept=".csv"
                onChange={(e) => setFileFelinos(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <label htmlFor="eco-csv-felinos" className="fc-eco-file-picker">
                <Upload className="h-4 w-4" />
                <span><small>CSV Felinos</small>{fileFelinos?.name || "Selecionar arquivo"}</span>
              </label>
            </div>
            <button
              type="button"
              onClick={handleImportar}
              disabled={importando || (!fileCaninos && !fileFelinos)}
              className="fc-eco-import-button"
            >
              <Upload className="h-4 w-4" />
              {importando ? "Importando..." : "Importar CSV"}
            </button>
          </div>
        </section>

        <section className="fc-eco-table-panel">
          <div className="fc-eco-table-heading">
            <div>
              <span>Base ativa</span>
              <h2>{especieFiltro === "Canina" ? "Referências caninas" : "Referências felinas"}</h2>
            </div>
            <strong>{referencias.length} faixa(s)</strong>
          </div>

          {loading ? (
            <div className="fc-eco-loading"><span />Carregando referências...</div>
          ) : referencias.length === 0 ? (
            <div className="fc-eco-empty">
              <BookOpen className="h-6 w-6" />
              <strong>Nenhuma referência cadastrada</strong>
              <span>Importe um arquivo CSV para iniciar esta base.</span>
            </div>
          ) : (
            <div className="fc-eco-table-scroll">
              <table className="fc-eco-table">
                <thead>
                  <tr>
                    <th>Peso <span>kg</span></th>
                    {CAMPOS_MEDIDAS.map((campo) => (
                      <th key={campo.key}>
                        {campo.label}
                        <span>{campo.unidade || "índice"}</span>
                      </th>
                    ))}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {referencias.map((ref) => (
                    <tr key={ref.id} className={editando === ref.id ? "fc-eco-row-editing" : ""}>
                      <td>
                        {editando === ref.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={formData.peso_kg || ""}
                            onChange={(e) => handleChange("peso_kg", e.target.value)}
                            className="fc-eco-weight-input"
                            aria-label="Peso em quilogramas"
                          />
                        ) : (
                          <strong>{ref.peso_kg}</strong>
                        )}
                      </td>

                      {CAMPOS_MEDIDAS.map((campo) => {
                        const minKey = `${campo.key}_min` as keyof Referencia;
                        const maxKey = `${campo.key}_max` as keyof Referencia;
                        const min = editando === ref.id ? formData[minKey] : ref[minKey];
                        const max = editando === ref.id ? formData[maxKey] : ref[maxKey];

                        return (
                          <td key={campo.key}>
                            {editando === ref.id ? (
                              <div className="fc-eco-range-inputs">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={min || ""}
                                  onChange={(e) => handleChange(minKey as string, e.target.value)}
                                  placeholder="Min"
                                  aria-label={`${campo.label} mínimo`}
                                />
                                <input
                                  type="number"
                                  step="0.1"
                                  value={max || ""}
                                  onChange={(e) => handleChange(maxKey as string, e.target.value)}
                                  placeholder="Máx"
                                  aria-label={`${campo.label} máximo`}
                                />
                              </div>
                            ) : (
                              <span className="fc-eco-range-value">
                                {min !== undefined && max !== undefined ? `${min} – ${max}` : "—"}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td>
                        <div className="fc-eco-row-actions">
                          {editando === ref.id ? (
                            <>
                              <button onClick={() => handleSalvar(ref.id)} className="fc-eco-action-save" title="Salvar" aria-label={`Salvar referência de ${ref.peso_kg} kg`}>
                                <Save className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditando(null)} className="fc-eco-action-cancel" title="Cancelar" aria-label="Cancelar edição">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleEditar(ref)} className="fc-eco-action-edit" title="Editar" aria-label={`Editar referência de ${ref.peso_kg} kg`}>
                              <Edit2 className="h-4 w-4" />
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
        </section>
      </div>
    </DashboardLayout>
  );
}
