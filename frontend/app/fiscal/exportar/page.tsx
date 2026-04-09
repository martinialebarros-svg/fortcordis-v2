"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  ArrowLeft,
  Download,
  Search,
  CheckSquare,
  Square,
  Calendar,
  Loader2,
  FileText,
  FileSpreadsheet,
  File,
  AlertCircle,
} from "lucide-react";

interface OSItem {
  os_id: number;
  numero_os: string;
  data_atendimento: string | null;
  valor_final: number;
  status_os: string;
  tipo_cliente: string;
  cliente_nome: string;
  cliente_documento: string;
  clinica_nome: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function ExportarFiscalPage() {
  const router = useRouter();

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<OSItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [exporting, setExporting] = useState(false);
  const [gerandoNota, setGerandoNota] = useState(false);

  async function handleSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "100");
      const res = await api.get(`/fiscal/os-para-fiscal?${params}`);
      let items = res.data.items || [];

      // Filtra por data se informado
      if (dataInicio || dataFim) {
        items = items.filter((os: OSItem) => {
          if (!os.data_atendimento) return false;
          const d = new Date(os.data_atendimento);
          if (dataInicio && d < new Date(dataInicio)) return false;
          if (dataFim && d > new Date(dataFim + "T23:59:59")) return false;
          return true;
        });
      }

      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
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

  function selectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.os_id)));
    }
  }

  async function handleGerarNotasEFiltrar() {
    // Primeiro busca
    await handleSearch();
  }

  async function handleExportar() {
    if (selected.size === 0) {
      alert("Selecione pelo menos uma OS para gerar a nota fiscal.");
      return;
    }

    setGerandoNota(true);

    try {
      // Para cada OS selecionada, cria uma nota fiscal e exporta
      // Usa o endpoint de exportação em lote
      const osSelecionadas = results.filter((r) => selected.has(r.os_id));

      // Criar notas fiscais primeiro
      const notaIds: number[] = [];
      for (const os of osSelecionadas) {
        const tipo_cliente = os.tipo_cliente as "PF" | "PJ";
        const valor_final = os.valor_final;

        // Criar nota fiscal via API
        const res = await api.post("/fiscal/notas-fiscais", {
          os_id: os.os_id,
          tipo_cliente,
          cliente_nome: os.cliente_nome,
          cliente_documento: os.cliente_documento,
          valor_servico: valor_final,
          valor_desconto: 0,
          descricao_servico: `Servico veterinario. OS: ${os.numero_os}. Clinica: ${os.clinica_nome || "N/A"}.`,
          natureza_operacao: "Tributacao no municipio",
          aliquota_iss: 5.0,
        });
        notaIds.push(res.data.id);
      }

      // Agora exportar em lote
      setGerandoNota(false);
      setExporting(true);

      const endpoint = exportFormat === "pdf"
        ? "/fiscal/notas-fiscais/exportar-lote"
        : exportFormat === "xlsx"
        ? "/fiscal/notas-fiscais/exportar-lote"
        : "/fiscal/notas-fiscais/exportar-lote";

      const response = await api.post(
        endpoint,
        { nota_ids: notaIds, formato: exportFormat },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type: exportFormat === "pdf"
          ? "application/pdf"
          : exportFormat === "csv"
          ? "text/csv;charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `notas_fiscais_${timestamp}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`${notaIds.length} nota(s) fiscal(is) gerada(s) e exportada(s) com sucesso!`);
      router.push("/fiscal");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erro ao exportar notas fiscais.");
    } finally {
      setGerandoNota(false);
      setExporting(false);
    }
  }

  const totalSelecionado = results
    .filter((r) => selected.has(r.os_id))
    .reduce((acc, r) => acc + r.valor_final, 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exportar Notas Fiscais em Lote</h1>
            <p className="text-sm text-gray-500">
              Selecione OS do período, gere as notas fiscais e exporte no formato desejado.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Selecionar Periodo
          </h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicio</label>
              <input
                type="date"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar por cliente / OS
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do cliente, tutor ou numero da OS..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar OS
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selected.size === results.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selected.size === results.length ? "Desmarcar todas" : "Selecionar todas"} ({results.length})
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{selected.size}</span> selecionada(s) |{" "}
                  Total:{" "}
                  <span className="font-bold text-gray-900">{formatCurrency(totalSelecionado)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left w-10"></th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">OS</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Clinica</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((os) => (
                      <tr
                        key={os.os_id}
                        className={`hover:bg-blue-50 cursor-pointer ${
                          selected.has(os.os_id) ? "bg-blue-50" : ""
                        }`}
                        onClick={() => toggleSelect(os.os_id)}
                      >
                        <td className="px-4 py-3">
                          {selected.has(os.os_id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{os.numero_os}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{os.cliente_nome}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            os.tipo_cliente === "PF"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {os.tipo_cliente}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(os.data_atendimento)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{os.clinica_nome || "-"}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(os.valor_final)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exportação */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Download className="w-4 h-4 text-green-600" />
                Exportar
              </h3>

              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  {
                    id: "csv",
                    label: "CSV",
                    desc: "Planilha para importacao",
                    icon: File,
                  },
                  {
                    id: "xlsx",
                    label: "Excel",
                    desc: "Planilha formatada",
                    icon: FileSpreadsheet,
                  },
                  {
                    id: "pdf",
                    label: "PDF",
                    desc: "Documento formal",
                    icon: FileText,
                  },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id as any)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                      exportFormat === fmt.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <fmt.icon className={`w-5 h-5 ${
                      exportFormat === fmt.id ? "text-blue-600" : "text-gray-400"
                    }`} />
                    <div className="text-left">
                      <p className={`font-medium text-sm ${
                        exportFormat === fmt.id ? "text-blue-700" : "text-gray-700"
                      }`}>
                        {fmt.label}
                      </p>
                      <p className="text-xs text-gray-500">{fmt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  Sera gerada uma nota fiscal para cada OS selecionada e exportada no formato{" "}
                  <strong>{exportFormat.toUpperCase()}</strong>.
                  {selected.size} nota(s) fiscal(is) — Total:{" "}
                  <strong>{formatCurrency(totalSelecionado)}</strong>.
                </p>
              </div>

              <button
                onClick={handleExportar}
                disabled={selected.size === 0 || exporting || gerandoNota}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {(exporting || gerandoNota) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {gerandoNota ? "Gerando notas fiscais..." : "Exportando..."}
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Gerar e Exportar {selected.size} Nota(s) Fiscal(is) em {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {results.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-12 flex flex-col items-center text-gray-400">
            <Search className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium text-gray-600">Busque por OS para comecar</p>
            <p className="text-sm">Informe o periodo ou busque pelo nome do cliente</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
