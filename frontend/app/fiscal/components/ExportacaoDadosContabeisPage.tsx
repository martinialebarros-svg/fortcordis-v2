"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  AlertCircle,
  ArrowLeft,
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
  valor_final: number;
  status_os: string;
  paciente_nome: string;
  tutor_nome: string;
  servico_nome: string;
  clinica_nome: string | null;
}
interface DadosTomador {
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
type Modo = "single" | "multi";
const FISCAL_PAGE_SIZE = 500;
const OS_PAGE_SIZE = 500;

const DEFAULT_TOMADOR: DadosTomador = {
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

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "-";
}
function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
function fmtCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function fmtDoc(v: string, t: "PF" | "PJ") {
  return t === "PJ" ? fmtCnpj(v) : fmtCpf(v);
}
function monthPeriod() {
  const n = new Date();
  const i = new Date(n.getFullYear(), n.getMonth(), 1);
  const f = new Date(n.getFullYear(), n.getMonth() + 1, 0);
  const s = (d: Date) => `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
  return { inicio: s(i), fim: s(f) };
}

function normalizeApiError(err: any, fallback: string) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first?.msg === "string" && first.msg.trim()) return first.msg;
    return fallback;
  }
  if (detail && typeof detail === "object" && typeof detail.message === "string" && detail.message.trim()) {
    return detail.message;
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

function parseJsonSafe(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function extractApiErrorDetail(err: any) {
  const data = err?.response?.data;
  if (!data) return null;

  if (data instanceof Blob) {
    const text = (await data.text()).trim();
    if (!text) return null;
    const parsed = parseJsonSafe(text);
    if (parsed && typeof parsed === "object") {
      return "detail" in parsed ? (parsed as any).detail : parsed;
    }
    return text;
  }

  if (typeof data === "string") {
    const text = data.trim();
    if (!text) return null;
    const parsed = parseJsonSafe(text);
    if (parsed && typeof parsed === "object") {
      return "detail" in parsed ? (parsed as any).detail : parsed;
    }
    return text;
  }

  if (typeof data === "object") {
    return "detail" in data ? data.detail : data;
  }

  return null;
}

export default function ExportacaoDadosContabeisPage() {
  const router = useRouter();
  const period = monthPeriod();

  const [modo, setModo] = useState<Modo>("single");
  const [clinicas, setClinicas] = useState<ClinicaItem[]>([]);
  const [loadingClinicas, setLoadingClinicas] = useState(true);
  const [clinicaId, setClinicaId] = useState("");
  const [clinicasSel, setClinicasSel] = useState<Set<number>>(new Set());
  const [dataInicio, setDataInicio] = useState(period.inicio);
  const [dataFim, setDataFim] = useState(period.fim);
  const [search, setSearch] = useState("");
  const [tomador, setTomador] = useState<DadosTomador>(DEFAULT_TOMADOR);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [results, setResults] = useState<OSItem[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingClinicas(true);
      try {
        const r = await api.get<ClinicaListResponse>("/clinicas?limit=500");
        setClinicas(Array.isArray(r.data?.items) ? r.data.items : []);
      } finally {
        setLoadingClinicas(false);
      }
    })();
  }, []);

  function onChangeClinica(v: string) {
    setClinicaId(v);
    const c = clinicas.find((x) => String(x.id) === v);
    if (!c) return setTomador(DEFAULT_TOMADOR);
    const endereco = [c.endereco, c.numero].filter(Boolean).join(", ");
    setTomador((p) => ({
      ...p,
      tipo_cliente: "PJ",
      cliente_nome: c.nome || "",
      cliente_documento: c.cnpj ? fmtCnpj(c.cnpj) : "",
      cliente_endereco: endereco,
      cliente_bairro: c.bairro || "",
      cliente_cidade: c.cidade || "",
      cliente_estado: c.estado || "",
      cliente_cep: c.cep || "",
      cliente_telefone: c.telefone || "",
      cliente_email: c.email || "",
    }));
  }

  async function buscarCnpj() {
    if (tomador.tipo_cliente !== "PJ") return;
    const cnpj = tomador.cliente_documento.replace(/\D/g, "");
    if (cnpj.length < 14) return alert("Informe um CNPJ valido para consulta.");
    setLoadingCnpj(true);
    try {
      const r = await api.get<CNPJData>(`/fiscal/consulta-cnpj/${cnpj}`);
      const d = r.data;
      if (d.error) return alert(d.error);
      const e = `${d.logradouro || ""}${d.numero ? `, ${d.numero}` : ""}${d.complemento ? ` - ${d.complemento}` : ""}`.trim();
      setTomador((p) => ({
        ...p,
        cliente_nome: d.razao_social || p.cliente_nome,
        cliente_documento: d.cnpj ? fmtCnpj(d.cnpj) : p.cliente_documento,
        cliente_endereco: e,
        cliente_bairro: d.bairro || "",
        cliente_cidade: d.municipio || "",
        cliente_estado: d.uf || "",
        cliente_cep: d.cep || "",
        cliente_telefone: d.telefone || "",
        cliente_email: d.email || "",
        atividade_cnae: d.cnae_principal || p.atividade_cnae,
      }));
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function buscarOsPorClinica(clinicaIdNumber: number): Promise<OSItem[]> {
    const searchTerm = search.trim().toLowerCase();
    const filtrosBase = new URLSearchParams({
      data_inicio: dataInicio,
      data_fim: dataFim,
      clinica_id: String(clinicaIdNumber),
    });

    const buscarPaginadoFiscal = async () => {
      const acc: OSItem[] = [];
      let skip = 0;
      while (true) {
        const params = new URLSearchParams(filtrosBase);
        params.set("limit", String(FISCAL_PAGE_SIZE));
        params.set("skip", String(skip));
        if (searchTerm) params.set("search", searchTerm);
        const resp = await api.get(`/fiscal/os-para-fiscal?${params.toString()}`);
        const rows = Array.isArray(resp.data?.items) ? (resp.data.items as OSItem[]) : [];
        const total = Number(resp.data?.total || 0);
        if (!rows.length) break;
        acc.push(...rows);
        if (rows.length < FISCAL_PAGE_SIZE) break;
        if (total > 0 && acc.length >= total) break;
        skip += FISCAL_PAGE_SIZE;
      }
      return acc;
    };

    const buscarPaginadoOrdens = async () => {
      const acc: OSItem[] = [];
      let skip = 0;
      while (true) {
        const params = new URLSearchParams(filtrosBase);
        params.set("limit", String(OS_PAGE_SIZE));
        params.set("skip", String(skip));
        const resp = await api.get(`/ordens-servico?${params.toString()}`);
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (!rows.length) break;
        acc.push(...rows.map((item: any) => ({
          os_id: Number(item.id),
          numero_os: String(item.numero_os || ""),
          data_atendimento: item.data_atendimento || null,
          valor_final: Number(item.valor_final || 0),
          status_os: String(item.status || ""),
          paciente_nome: String(item.paciente || ""),
          tutor_nome: String(item.tutor || ""),
          servico_nome: String(item.servico || ""),
          clinica_nome: String(item.clinica || ""),
        })));
        const total = Number(resp.data?.total || 0);
        if (rows.length < OS_PAGE_SIZE) break;
        if (total > 0 && acc.length >= total) break;
        skip += OS_PAGE_SIZE;
      }
      return searchTerm
        ? acc.filter((row) => (
          row.numero_os?.toLowerCase().includes(searchTerm)
          || row.paciente_nome?.toLowerCase().includes(searchTerm)
          || row.tutor_nome?.toLowerCase().includes(searchTerm)
          || row.servico_nome?.toLowerCase().includes(searchTerm)
          || row.clinica_nome?.toLowerCase().includes(searchTerm)
        ))
        : acc;
    };

    try {
      const fiscalItems = await buscarPaginadoFiscal();
      if (fiscalItems.length > 0) return fiscalItems;
    } catch (_err) {
      // Continua para fallback da mesma fonte usada no financeiro.
    }

    return buscarPaginadoOrdens();
  }

  async function buscarOs() {
    const ids = modo === "single" ? (clinicaId ? [Number(clinicaId)] : []) : Array.from(clinicasSel);
    if (!ids.length) return alert("Selecione pelo menos uma clinica.");
    if (!dataInicio || !dataFim || dataInicio > dataFim) return alert("Periodo invalido.");
    setLoadingResults(true);
    setSearchDone(true);
    try {
      let items: OSItem[] = [];
      if (modo === "single") {
        items = await buscarOsPorClinica(ids[0]);
      } else {
        const responses = await Promise.all(
          ids.map((id) => buscarOsPorClinica(id))
        );
        const byId = new Map<number, OSItem>();
        for (const rows of responses) {
          for (const row of rows) byId.set(Number(row.os_id), row);
        }
        items = Array.from(byId.values()).sort((a, b) => {
          const da = a.data_atendimento ? new Date(a.data_atendimento).getTime() : 0;
          const db = b.data_atendimento ? new Date(b.data_atendimento).getTime() : 0;
          return db - da;
        });
      }

      setResults(items);
      setSelected(new Set());
    } catch (err: any) {
      alert(normalizeApiError(err, "Nao foi possivel carregar as ordens de servico para os filtros selecionados."));
      setResults([]);
      setSelected(new Set());
    } finally {
      setLoadingResults(false);
    }
  }

  async function exportar() {
    if (!selected.size) return alert("Selecione pelo menos uma OS.");
    if (modo === "single" && (!tomador.cliente_nome.trim() || !tomador.cliente_documento.trim())) {
      return alert("Preencha nome e documento do tomador.");
    }
    setExporting(true);
    try {
      const dadosTomador =
        modo === "single"
          ? { ...tomador, aliquota_iss: Number(tomador.aliquota_iss) }
          : {
              atividade_cnae: tomador.atividade_cnae,
              descricao_servico: tomador.descricao_servico,
              natureza_operacao: tomador.natureza_operacao,
              aliquota_iss: Number(tomador.aliquota_iss),
            };
      const payload = { os_ids: Array.from(selected), formato: format, dados_tomador: dadosTomador, modo_multiclinica: modo === "multi" };
      const r = await api.post("/fiscal/os/exportar-lote", payload, { responseType: "blob" });
      const type = format === "pdf" ? "application/pdf" : format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([r.data], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados_contabeis_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const detail = await extractApiErrorDetail(err);
      if (detail && typeof detail === "object" && Array.isArray((detail as any).clinicas) && (detail as any).clinicas.length) {
        const message = String((detail as any).message || "Existem clinicas com dados incompletos para exportacao.");
        const list = (detail as any).clinicas
          .map((c: any) => `- ${c.clinica_nome || "Clinica sem nome"}: ${Array.isArray(c.faltando) ? c.faltando.join(", ") : "dados faltando"}`)
          .join("\n");
        alert(`${message}\n\nCampos faltando por clinica:\n${list}`);
      } else if (typeof detail === "string" && detail.trim()) {
        alert(detail);
      } else if (detail && typeof detail === "object" && typeof (detail as any).message === "string" && (detail as any).message.trim()) {
        alert((detail as any).message);
      } else {
        alert(normalizeApiError(err, "Erro ao exportar dados."));
      }
    } finally {
      setExporting(false);
    }
  }

  const rowsSel = useMemo(() => results.filter((x) => selected.has(x.os_id)), [results, selected]);
  const totalSel = useMemo(() => rowsSel.reduce((a, b) => a + Number(b.valor_final || 0), 0), [rowsSel]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div><h1 className="text-2xl font-bold text-gray-900">Preparar Dados Fiscais para Contabilidade</h1></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => setModo("single")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "single" ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-50 text-gray-600 border border-gray-200"}`}>Uma clinica</button>
            <button type="button" onClick={() => { if (clinicaId) setClinicasSel((s) => new Set([...s, Number(clinicaId)])); setModo("multi"); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${modo === "multi" ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-50 text-gray-600 border border-gray-200"}`}>Varias clinicas</button>
          </div>
          {modo === "single" ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><label className="block text-sm mb-1">Clinica *</label><select value={clinicaId} onChange={(e) => onChangeClinica(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" disabled={loadingClinicas}><option value="">{loadingClinicas ? "Carregando..." : "Selecione"}</option>{clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div><label className="block text-sm mb-1">Data inicio *</label><input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm mb-1">Data fim *</label><input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Clinicas *</label>
                <div className="max-h-40 overflow-auto border rounded-lg p-2 space-y-1">{clinicas.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clinicasSel.has(c.id)} onChange={() => setClinicasSel((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />{c.nome}</label>)}</div>
                <p className="text-xs text-gray-500 mt-1">{clinicasSel.size} selecionada(s)</p>
              </div>
              <div className="space-y-3"><div><label className="block text-sm mb-1">Data inicio *</label><input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div><div><label className="block text-sm mb-1">Data fim *</label><input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div></div>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarOs()} placeholder="Buscar por OS, paciente, tutor ou servico" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <button onClick={buscarOs} disabled={loadingResults} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2">{loadingResults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Buscar OS</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="font-semibold mb-3">{modo === "single" ? "Dados do Tomador" : "Parametros fiscais do lote"}</h3>
          {modo === "multi" && <p className="text-sm text-blue-700 bg-blue-50 rounded p-3 mb-3">No modo de varias clinicas, os dados cadastrais vem de cada clinica. Se faltar algo, o sistema solicita correcao antes de gerar.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modo === "single" && (
              <>
                <div><label className="block text-sm mb-1">Tipo cliente</label><div className="flex gap-2"><button type="button" onClick={() => setTomador((p) => ({ ...p, tipo_cliente: "PJ", cliente_documento: fmtCnpj(p.cliente_documento) }))} className={`px-3 py-1.5 rounded-lg text-sm ${tomador.tipo_cliente === "PJ" ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-50 border border-gray-200"}`}>PJ</button><button type="button" onClick={() => setTomador((p) => ({ ...p, tipo_cliente: "PF", cliente_documento: fmtCpf(p.cliente_documento) }))} className={`px-3 py-1.5 rounded-lg text-sm ${tomador.tipo_cliente === "PF" ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 border border-gray-200"}`}>PF</button></div></div>
                <div><label className="block text-sm mb-1">{tomador.tipo_cliente === "PJ" ? "Razao social *" : "Nome *"}</label><input value={tomador.cliente_nome} onChange={(e) => setTomador((p) => ({ ...p, cliente_nome: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm mb-1">{tomador.tipo_cliente === "PJ" ? "CNPJ *" : "CPF *"}</label><div className="flex gap-2"><input value={tomador.cliente_documento} onChange={(e) => setTomador((p) => ({ ...p, cliente_documento: fmtDoc(e.target.value, p.tipo_cliente) }))} className="flex-1 px-3 py-2 border rounded-lg text-sm" />{tomador.tipo_cliente === "PJ" && <button onClick={buscarCnpj} disabled={loadingCnpj} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm">{loadingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}</button>}</div></div>
                <div className="md:col-span-2"><label className="block text-sm mb-1">Endereco</label><input value={tomador.cliente_endereco} onChange={(e) => setTomador((p) => ({ ...p, cliente_endereco: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm mb-1">Bairro</label><input value={tomador.cliente_bairro} onChange={(e) => setTomador((p) => ({ ...p, cliente_bairro: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div className="grid grid-cols-3 gap-2"><input placeholder="Cidade" value={tomador.cliente_cidade} onChange={(e) => setTomador((p) => ({ ...p, cliente_cidade: e.target.value }))} className="col-span-2 px-3 py-2 border rounded-lg text-sm" /><input placeholder="UF" value={tomador.cliente_estado} onChange={(e) => setTomador((p) => ({ ...p, cliente_estado: e.target.value.toUpperCase() }))} className="px-3 py-2 border rounded-lg text-sm uppercase" maxLength={2} /></div>
                <div><label className="block text-sm mb-1">CEP</label><input value={tomador.cliente_cep} onChange={(e) => setTomador((p) => ({ ...p, cliente_cep: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm mb-1">Telefone</label><input value={tomador.cliente_telefone} onChange={(e) => setTomador((p) => ({ ...p, cliente_telefone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm mb-1">Email</label><input value={tomador.cliente_email} onChange={(e) => setTomador((p) => ({ ...p, cliente_email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              </>
            )}
            <div><label className="block text-sm mb-1">Atividade</label><input value={tomador.atividade_cnae} onChange={(e) => setTomador((p) => ({ ...p, atividade_cnae: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm mb-1">Aliquota ISS (%)</label><input type="number" min="0" step="0.01" value={tomador.aliquota_iss} onChange={(e) => setTomador((p) => ({ ...p, aliquota_iss: Number(e.target.value || 0) }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="md:col-span-2"><label className="block text-sm mb-1">Descricao do servico</label><input value={tomador.descricao_servico} onChange={(e) => setTomador((p) => ({ ...p, descricao_servico: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="md:col-span-2"><label className="block text-sm mb-1">Natureza da operacao</label><select value={tomador.natureza_operacao} onChange={(e) => setTomador((p) => ({ ...p, natureza_operacao: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm"><option>Tributacao no municipio</option><option>Tributacao fora do municipio</option><option>Isenta</option><option>Imune</option><option>Nao tributavel</option></select></div>
          </div>
        </div>

        {results.length > 0 && (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <button onClick={() => setSelected(selected.size === results.length ? new Set() : new Set(results.map((r) => r.os_id)))} className="flex items-center gap-2 text-sm text-blue-600">{selected.size === results.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}{selected.size === results.length ? "Desmarcar" : "Selecionar"} todas ({results.length})</button>
                <p className="text-sm">{selected.size} selecionada(s) | Total {fmtMoney(totalSel)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2" /><th className="px-3 py-2 text-left">Clinica</th><th className="px-3 py-2 text-left">OS</th><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Paciente</th><th className="px-3 py-2 text-left">Tutor</th><th className="px-3 py-2 text-left">Servico</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Valor</th></tr></thead>
                  <tbody className="divide-y">{results.map((r) => <tr key={r.os_id} onClick={() => setSelected((s) => { const n = new Set(s); n.has(r.os_id) ? n.delete(r.os_id) : n.add(r.os_id); return n; })} className={`cursor-pointer hover:bg-blue-50 ${selected.has(r.os_id) ? "bg-blue-50" : ""}`}><td className="px-3 py-2">{selected.has(r.os_id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}</td><td className="px-3 py-2">{r.clinica_nome || "-"}</td><td className="px-3 py-2 font-mono text-xs">{r.numero_os}</td><td className="px-3 py-2">{fmtDate(r.data_atendimento)}</td><td className="px-3 py-2">{r.paciente_nome || "-"}</td><td className="px-3 py-2">{r.tutor_nome || "-"}</td><td className="px-3 py-2">{r.servico_nome || "-"}</td><td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${r.status_os === "Pago" ? "bg-green-100 text-green-700" : r.status_os === "Cancelado" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.status_os}</span></td><td className="px-3 py-2 text-right font-medium">{fmtMoney(r.valor_final)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Download className="w-4 h-4 text-green-600" />Exportar lote</h3>
              <div className="flex gap-3 mb-4">{[{ id: "csv", label: "CSV", icon: File }, { id: "xlsx", label: "Excel", icon: FileSpreadsheet }, { id: "pdf", label: "PDF", icon: FileText }].map((f) => <button key={f.id} onClick={() => setFormat(f.id as ExportFormat)} className={`flex items-center gap-2 p-3 rounded-lg border-2 ${format === f.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}><f.icon className="w-4 h-4" />{f.label}</button>)}</div>
              <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2 mb-4"><AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" /><p className="text-sm text-blue-700">No modo de varias clinicas, o PDF e separado por clinica. Se alguma clinica estiver incompleta, o sistema informa os campos faltantes.</p></div>
              <button onClick={exportar} disabled={!selected.size || exporting} className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">{exporting ? <><Loader2 className="w-5 h-5 animate-spin" />Exportando...</> : <><Download className="w-5 h-5" />Exportar {selected.size} OS em {format.toUpperCase()}</>}</button>
            </div>
          </>
        )}
        {!loadingResults && searchDone && results.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500">
            Nenhuma ordem de servico encontrada para os filtros selecionados.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
