"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckSquare,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Square,
} from "lucide-react";

interface ClinicaItem {
  id: number;
  nome: string;
  cnpj?: string | null;
}

interface ClinicaListResponse {
  items: ClinicaItem[];
  total: number;
}

interface OSItem {
  os_id: number;
  numero_os: string;
  data_atendimento: string | null;
  valor_servico: number;
  valor_desconto: number;
  valor_final: number;
  status_os: string;
  paciente_nome: string;
  tutor_nome: string;
  servico_nome: string;
  clinica_id: number | null;
  clinica_nome: string | null;
}

type ExportFormat = "csv" | "xlsx" | "pdf";

const STATUS_STYLE: Record<string, string> = {
  Pago: "bg-green-100 text-green-700",
  Pendente: "bg-amber-100 text-amber-700",
  Cancelado: "bg-red-100 text-red-700",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getCurrentMonthPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const toIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { inicio: toIsoDate(start), fim: toIsoDate(end) };
}

export default function ExportacaoDadosContabeisPage() {
  const router = useRouter();
  const monthPeriod = getCurrentMonthPeriod();

  const [clinicas, setClinicas] = useState<ClinicaItem[]>([]);
  const [loadingClinicas, setLoadingClinicas] = useState(true);
  const [clinicaId, setClinicaId] = useState("");
  const [dataInicio, setDataInicio] = useState(monthPeriod.inicio);
  const [dataFim, setDataFim] = useState(monthPeriod.fim);
  const [search, setSearch] = useState("");

  const [results, setResults] = useState<OSItem[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadClinicas();
  }, []);

  async function loadClinicas() {
    setLoadingClinicas(true);
    try {
      const res = await api.get<ClinicaListResponse>("/clinicas?limit=500");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setClinicas(items);
    } catch {
      setClinicas([]);
    } finally {
      setLoadingClinicas(false);
    }
  }

  async function handleSearch() {
    if (!clinicaId) {
      alert("Selecione uma clinica para listar as OS.");
      return;
    }
    if (!dataInicio || !dataFim) {
      alert("Informe data de inicio e data de fim.");
      return;
    }
    if (dataInicio > dataFim) {
      alert("Data de inicio nao pode ser maior que a data de fim.");
      return;
    }

    setLoadingResults(true);
    try {
      const params = new URLSearchParams({
        clinica_id: clinicaId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        limit: "500",
      });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const res = await api.get(`/fiscal/os-para-fiscal?${params.toString()}`);
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setResults(items);
      setSelected(new Set());
    } catch {
      setResults([]);
      setSelected(new Set());
    } finally {
      setLoadingResults(false);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(results.map((item) => item.os_id)));
  }

  async function handleExport() {
    if (selected.size === 0) {
      alert("Selecione pelo menos uma OS para exportar.");
      return;
    }

    setExporting(true);
    try {
      const payload = {
        os_ids: Array.from(selected),
        formato: exportFormat,
      };
      const response = await api.post("/fiscal/os/exportar-lote", payload, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type:
          exportFormat === "pdf"
            ? "application/pdf"
            : exportFormat === "csv"
              ? "text/csv;charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      anchor.href = url;
      anchor.download = `dados_contabeis_${timestamp}.${exportFormat}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erro ao exportar dados contabeis.");
    } finally {
      setExporting(false);
    }
  }

  const selectedRows = useMemo(
    () => results.filter((row) => selected.has(row.os_id)),
    [results, selected]
  );

  const totalSelecionado = useMemo(
    () => selectedRows.reduce((total, row) => total + Number(row.valor_final || 0), 0),
    [selectedRows]
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Preparar Dados Fiscais para Contabilidade</h1>
            <p className="text-sm text-gray-500">
              Selecione clinica e periodo para listar OS e exportar os dados sem gerar nota fiscal.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Filtros de exportacao
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinica *</label>
              <select
                value={clinicaId}
                onChange={(e) => setClinicaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingClinicas}
              >
                <option value="">{loadingClinicas ? "Carregando clinicas..." : "Selecione uma clinica"}</option>
                {clinicas.map((clinica) => (
                  <option key={clinica.id} value={String(clinica.id)}>
                    {clinica.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicio *</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data fim *</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <input
              type="text"
              placeholder="Buscar por OS, paciente, tutor ou servico"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loadingResults}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingResults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar OS
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b flex flex-wrap gap-3 items-center justify-between bg-gray-50">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  {selected.size === results.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {selected.size === results.length ? "Desmarcar todas" : "Selecionar todas"} ({results.length})
                </button>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{selected.size}</span> selecionada(s) | Total{" "}
                  <span className="font-bold text-gray-900">{formatCurrency(totalSelecionado)}</span>
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left w-10" />
                      <th className="px-4 py-3 text-left font-medium text-gray-600">OS</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Paciente</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Tutor</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Servico</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Valor Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((item) => (
                      <tr
                        key={item.os_id}
                        onClick={() => toggleSelect(item.os_id)}
                        className={`cursor-pointer hover:bg-blue-50 ${selected.has(item.os_id) ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-4 py-3">
                          {selected.has(item.os_id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{item.numero_os || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(item.data_atendimento)}</td>
                        <td className="px-4 py-3 text-gray-900">{item.paciente_nome || "-"}</td>
                        <td className="px-4 py-3 text-gray-700">{item.tutor_nome || "-"}</td>
                        <td className="px-4 py-3 text-gray-700">{item.servico_nome || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[item.status_os] || "bg-gray-100 text-gray-700"}`}>
                            {item.status_os || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.valor_final)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Download className="w-4 h-4 text-green-600" />
                Exportar lote para contabilidade
              </h3>

              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  { id: "csv", label: "CSV", desc: "Importacao contabil", icon: File },
                  { id: "xlsx", label: "Excel", desc: "Planilha detalhada", icon: FileSpreadsheet },
                  { id: "pdf", label: "PDF", desc: "Relatorio consolidado", icon: FileText },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id as ExportFormat)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                      exportFormat === fmt.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <fmt.icon className={`w-5 h-5 ${exportFormat === fmt.id ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="text-left">
                      <p className={`font-medium text-sm ${exportFormat === fmt.id ? "text-blue-700" : "text-gray-700"}`}>
                        {fmt.label}
                      </p>
                      <p className="text-xs text-gray-500">{fmt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  O arquivo inclui OS pagas, pendentes e canceladas conforme filtros selecionados.
                  Nenhuma nota fiscal e criada nesse processo.
                </p>
              </div>

              <button
                onClick={handleExport}
                disabled={selected.size === 0 || exporting}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Exportando dados...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Exportar {selected.size} OS em {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {results.length === 0 && !loadingResults && (
          <div className="bg-white rounded-xl shadow-sm p-12 flex flex-col items-center text-gray-400">
            <Search className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium text-gray-600">Selecione clinica e periodo para buscar OS</p>
            <p className="text-sm">Depois escolha as OS desejadas para exportacao em lote.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
