"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  Receipt,
  Plus,
  Search,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Eye,
  Trash2,
  Filter,
  Calendar,
  Edit,
  X,
  CheckCircle,
  Clock,
  Ban,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NotaFiscal {
  id: number;
  numero: string | null;
  serie: string;
  os_id: number | null;
  tipo_cliente: string;
  cliente_nome: string;
  cliente_documento: string;
  cliente_endereco: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_cep: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  valor_servico: number;
  valor_desconto: number;
  valor_final: number;
  aliquota_iss: number;
  valor_iss: number;
  atividade_cnae: string | null;
  descricao_servico: string | null;
  observacoes: string | null;
  natureza_operacao: string;
  codigo_municipio: string | null;
  regime_tributario: number | null;
  formato_exportado: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

interface ListResponse {
  total: number;
  items: NotaFiscal[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-700", icon: Clock },
  exportado: { label: "Exportado", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: Ban },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function FiscalPage() {
  const router = useRouter();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [selectedNota, setSelectedNota] = useState<NotaFiscal | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);

  useEffect(() => {
    loadNotas();
  }, [page, filterStatus, filterTipo]);

  function loadNotas() {
    setLoading(true);
    const params = new URLSearchParams({
      skip: String(page * pageSize),
      limit: String(pageSize),
    });
    if (filterStatus) params.set("status", filterStatus);
    if (filterTipo) params.set("tipo_cliente", filterTipo);

    api.get(`/fiscal/notas-fiscais?${params}`).then((res) => {
      const data = res.data as ListResponse;
      setNotas(data.items);
      setTotal(data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    // Busca pelo search é feita via endpoint de OS na criação de NF
    loadNotas();
  }

  async function handleExportar(id: number, formato: "pdf" | "csv" | "xlsx") {
    setExportingId(id);
    try {
      const response = await api.get(`/fiscal/notas-fiscais/${id}/exportar/${formato}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: formato === "pdf"
          ? "application/pdf"
          : formato === "csv"
          ? "text/csv;charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nota_fiscal_${id}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
      loadNotas(); // Refresh para ver status atualizado
    } catch (err) {
      console.error("Erro ao exportar:", err);
      alert("Erro ao exportar nota fiscal.");
    } finally {
      setExportingId(null);
    }
  }

  async function handleExcluir(id: number) {
    if (!confirm("Cancelar esta nota fiscal?")) return;
    await api.delete(`/fiscal/notas-fiscais/${id}`);
    loadNotas();
  }

  const totalPages = Math.ceil(total / pageSize);
  const totalValor = notas.reduce((acc, n) => acc + n.valor_final, 0);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Módulo Fiscal</h1>
              <p className="text-sm text-gray-500">
                Notas fiscais de serviços — {total} registro{total !== 1 ? "s" : ""} | Total: {formatCurrency(totalValor)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/fiscal/exportar")}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar em Lote
            </button>
            <button
              onClick={() => router.push("/fiscal/nova")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nova Nota Fiscal
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-4 items-center">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome do cliente..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              Buscar
            </button>
          </form>

          <div className="flex gap-2 items-center">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos status</option>
              <option value="rascunho">Rascunho</option>
              <option value="exportado">Exportado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select
              value={filterTipo}
              onChange={(e) => { setFilterTipo(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos tipos</option>
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Numero NF</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Documento</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Valor Servico</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Valor Final</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">ISS</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Criado em</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                      Nenhuma nota fiscal encontrada.
                      <br />
                      <button
                        onClick={() => router.push("/fiscal/nova")}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Criar a primeira nota fiscal
                      </button>
                    </td>
                  </tr>
                ) : (
                  notas.map((nota) => {
                    const statusCfg = STATUS_CONFIG[nota.status] || STATUS_CONFIG.rascunho;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <tr key={nota.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {nota.numero || `ID#${nota.id}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                          {nota.cliente_nome}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            nota.tipo_cliente === "PF"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {nota.tipo_cliente === "PF" ? "PF" : "PJ"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {nota.cliente_documento}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatCurrency(nota.valor_servico)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(nota.valor_final)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatCurrency(nota.valor_iss)}
                          <span className="text-xs text-gray-400 ml-1">({nota.aliquota_iss}%)</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusCfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {formatDate(nota.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedNota(nota)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {exportingId === nota.id ? (
                              <span className="p-1.5 text-gray-400 animate-spin">⟳</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleExportar(nota.id, "pdf")}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Exportar PDF"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleExportar(nota.id, "csv")}
                                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                  title="Exportar CSV"
                                >
                                  <File className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleExportar(nota.id, "xlsx")}
                                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                  title="Exportar Excel"
                                >
                                  <FileSpreadsheet className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleExcluir(nota.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Cancelar nota"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`px-3 py-1 rounded text-sm ${
                      page === i
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selectedNota && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  Nota Fiscal {selectedNota.numero || `#${selectedNota.id}`}
                </h2>
                <button
                  onClick={() => setSelectedNota(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Status</p>
                    <p className="font-medium">{STATUS_CONFIG[selectedNota.status]?.label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Serie</p>
                    <p className="font-medium">{selectedNota.serie}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Tipo Cliente</p>
                    <p className="font-medium">{selectedNota.tipo_cliente === "PF" ? "Pessoa Fisica" : "Pessoa Juridica"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Data</p>
                    <p className="font-medium">{formatDate(selectedNota.created_at)}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Tomador</p>
                  <p className="font-medium text-gray-900">{selectedNota.cliente_nome}</p>
                  <p className="text-sm text-gray-600">{selectedNota.cliente_documento}</p>
                  <p className="text-sm text-gray-500">
                    {[selectedNota.cliente_endereco, selectedNota.cliente_bairro, selectedNota.cliente_cidade]
                      .filter(Boolean)
                      .join(", ")}
                    {" "}{selectedNota.cliente_estado} | CEP: {selectedNota.cliente_cep}
                  </p>
                  {selectedNota.cliente_telefone && (
                    <p className="text-sm text-gray-500">{selectedNota.cliente_telefone} | {selectedNota.cliente_email}</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Servico</p>
                  <p className="text-sm text-gray-700">{selectedNota.descricao_servico || "Sem descricao"}</p>
                  {selectedNota.atividade_cnae && (
                    <p className="text-sm text-gray-500">CNAE: {selectedNota.atividade_cnae}</p>
                  )}
                </div>

                <div className="border-t pt-4 grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Valor Servico</p>
                    <p className="font-medium">{formatCurrency(selectedNota.valor_servico)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Desconto</p>
                    <p className="font-medium">{formatCurrency(selectedNota.valor_desconto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valor Final</p>
                    <p className="font-bold text-gray-900">{formatCurrency(selectedNota.valor_final)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ISS ({selectedNota.aliquota_iss}%)</p>
                    <p className="font-medium">{formatCurrency(selectedNota.valor_iss)}</p>
                  </div>
                </div>

                {selectedNota.observacoes && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500 uppercase mb-1">Observacoes</p>
                    <p className="text-sm text-gray-700">{selectedNota.observacoes}</p>
                  </div>
                )}

                <div className="border-t pt-4 flex gap-2">
                  <button
                    onClick={() => { setSelectedNota(null); router.push(`/fiscal/nova?editar=${selectedNota.id}`); }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleExportar(selectedNota.id, "pdf")}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    PDF
                  </button>
                  <button
                    onClick={() => handleExportar(selectedNota.id, "csv")}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm"
                  >
                    <File className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportar(selectedNota.id, "xlsx")}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
