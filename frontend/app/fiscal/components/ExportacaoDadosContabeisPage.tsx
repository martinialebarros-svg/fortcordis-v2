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
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
}

interface ClinicaListResponse {
  items: ClinicaItem[];
  total: number;
}

interface CNPJData {
  razao_social: string | null;
  cnpj: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  cnae_principal: string | null;
  error: string | null;
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

interface DadosTomadorExportacao {
  tipo_cliente: "PF" | "PJ";
  cliente_nome: string;
  cliente_documento: string;
  cliente_endereco: string;
  cliente_bairro: string;
  cliente_cidade: string;
  cliente_estado: string;
  cliente_cep: string;
  cliente_telefone: string;
  cliente_email: string;
  atividade_cnae: string;
  descricao_servico: string;
  natureza_operacao: string;
  aliquota_iss: number;
}

type ExportFormat = "csv" | "xlsx" | "pdf";

const STATUS_STYLE: Record<string, string> = {
  Pago: "bg-green-100 text-green-700",
  Pendente: "bg-amber-100 text-amber-700",
  Cancelado: "bg-red-100 text-red-700",
};

const DEFAULT_TOMADOR: DadosTomadorExportacao = {
  tipo_cliente: "PJ",
  cliente_nome: "",
  cliente_documento: "",
  cliente_endereco: "",
  cliente_bairro: "",
  cliente_cidade: "",
  cliente_estado: "",
  cliente_cep: "",
  cliente_telefone: "",
  cliente_email: "",
  atividade_cnae: "",
  descricao_servico: "Servicos veterinarios prestados conforme ordens de servico selecionadas.",
  natureza_operacao: "Tributacao no municipio",
  aliquota_iss: 5,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
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

  const [dadosTomador, setDadosTomador] = useState<DadosTomadorExportacao>(DEFAULT_TOMADOR);
  const [loadingCnpj, setLoadingCnpj] = useState(false);

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

  function handleClinicaChange(value: string) {
    setClinicaId(value);
    const selectedClinica = clinicas.find((c) => String(c.id) === value);
    if (!selectedClinica) {
      setDadosTomador(DEFAULT_TOMADOR);
      return;
    }
    const endereco = [selectedClinica.endereco, selectedClinica.numero].filter(Boolean).join(", ");
    setDadosTomador((prev) => ({
      ...prev,
      tipo_cliente: "PJ",
      cliente_nome: selectedClinica.nome || "",
      cliente_documento: selectedClinica.cnpj ? formatCnpj(selectedClinica.cnpj) : "",
      cliente_endereco: endereco,
      cliente_bairro: selectedClinica.bairro || "",
      cliente_cidade: selectedClinica.cidade || "",
      cliente_estado: selectedClinica.estado || "",
      cliente_cep: selectedClinica.cep || "",
      cliente_telefone: selectedClinica.telefone || "",
      cliente_email: selectedClinica.email || "",
    }));
  }

  async function handleBuscarCnpj() {
    const cnpjLimpo = dadosTomador.cliente_documento.replace(/\D/g, "");
    if (cnpjLimpo.length < 14) {
      alert("Informe um CNPJ valido para consulta.");
      return;
    }

    setLoadingCnpj(true);
    try {
      const res = await api.get<CNPJData>(`/fiscal/consulta-cnpj/${cnpjLimpo}`);
      const data = res.data;
      if (data.error) {
        alert(data.error);
        return;
      }
      const logradouro = data.logradouro || "";
      const numero = data.numero ? `, ${data.numero}` : "";
      const complemento = data.complemento ? ` - ${data.complemento}` : "";
      setDadosTomador((prev) => ({
        ...prev,
        cliente_nome: data.razao_social || prev.cliente_nome,
        cliente_documento: data.cnpj ? formatCnpj(data.cnpj) : prev.cliente_documento,
        cliente_endereco: `${logradouro}${numero}${complemento}`.trim(),
        cliente_bairro: data.bairro || "",
        cliente_cidade: data.municipio || "",
        cliente_estado: data.uf || "",
        cliente_cep: data.cep || "",
        cliente_telefone: data.telefone || "",
        cliente_email: data.email || "",
        atividade_cnae: data.cnae_principal || prev.atividade_cnae,
      }));
    } catch {
      alert("Erro ao consultar CNPJ. Tente novamente.");
    } finally {
      setLoadingCnpj(false);
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
    if (!dadosTomador.cliente_nome.trim()) {
      alert("Informe a razao social do tomador.");
      return;
    }
    if (!dadosTomador.cliente_documento.trim()) {
      alert("Informe o CNPJ/CPF do tomador.");
      return;
    }

    setExporting(true);
    try {
      const payload = {
        os_ids: Array.from(selected),
        formato: exportFormat,
        dados_tomador: {
          ...dadosTomador,
          aliquota_iss: Number(dadosTomador.aliquota_iss),
        },
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
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
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
                onChange={(e) => handleClinicaChange(e.target.value)}
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

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4">Dados do Tomador para Exportacao</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razao social *</label>
              <input
                type="text"
                value={dadosTomador.cliente_nome}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_nome: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dadosTomador.cliente_documento}
                  onChange={(e) =>
                    setDadosTomador((prev) => ({ ...prev, cliente_documento: formatCnpj(e.target.value) }))
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="00.000.000/0001-00"
                />
                <button
                  onClick={handleBuscarCnpj}
                  disabled={loadingCnpj}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50"
                >
                  {loadingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereco</label>
              <input
                type="text"
                value={dadosTomador.cliente_endereco}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_endereco: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input
                type="text"
                value={dadosTomador.cliente_bairro}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_bairro: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={dadosTomador.cliente_cidade}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_cidade: e.target.value }))}
                placeholder="Cidade"
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={dadosTomador.cliente_estado}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_estado: e.target.value.toUpperCase() }))}
                placeholder="UF"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
              <input
                type="text"
                value={dadosTomador.cliente_cep}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_cep: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={dadosTomador.cliente_telefone}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_telefone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={dadosTomador.cliente_email}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, cliente_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNAE</label>
              <input
                type="text"
                value={dadosTomador.atividade_cnae}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, atividade_cnae: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aliquota ISS (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dadosTomador.aliquota_iss}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, aliquota_iss: Number(e.target.value || 0) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descricao do servico</label>
              <input
                type="text"
                value={dadosTomador.descricao_servico}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, descricao_servico: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Natureza da operacao</label>
              <select
                value={dadosTomador.natureza_operacao}
                onChange={(e) => setDadosTomador((prev) => ({ ...prev, natureza_operacao: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Tributacao no municipio</option>
                <option>Tributacao fora do municipio</option>
                <option>Isenta</option>
                <option>Imune</option>
                <option>Nao tributavel</option>
              </select>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b flex flex-wrap gap-3 items-center justify-between bg-gray-50">
                <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                  {selected.size === results.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
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
                          {selected.has(item.os_id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
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
                  { id: "csv", label: "CSV", desc: "Formato legado contabil", icon: File },
                  { id: "xlsx", label: "Excel", desc: "Planilha detalhada", icon: FileSpreadsheet },
                  { id: "pdf", label: "PDF", desc: "Relatorio consolidado", icon: FileText },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id as ExportFormat)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                      exportFormat === fmt.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <fmt.icon className={`w-5 h-5 ${exportFormat === fmt.id ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="text-left">
                      <p className={`font-medium text-sm ${exportFormat === fmt.id ? "text-blue-700" : "text-gray-700"}`}>{fmt.label}</p>
                      <p className="text-xs text-gray-500">{fmt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  Esta exportacao mantem os campos do formato anterior e adiciona o fluxo por clinica/periodo em lote.
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
