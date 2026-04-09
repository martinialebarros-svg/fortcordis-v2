"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  ArrowLeft,
  Search,
  Building2,
  User,
  DollarSign,
  Save,
  Loader2,
  SearchX,
  Info,
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
  clinica_endereco: string | null;
  clinica_numero: string | null;
  clinica_bairro: string | null;
  clinica_cidade: string | null;
  clinica_estado: string | null;
  clinica_cep: string | null;
  clinica_telefone: string | null;
  clinica_email: string | null;
}

interface CNPJData {
  razao_social: string | null;
  nome_fantasia: string | null;
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
  situacao: string | null;
  error: string | null;
}

interface NotaFiscalForm {
  os_id: number | null;
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
  valor_servico: number;
  valor_desconto: number;
  atividade_cnae: string;
  descricao_servico: string;
  observacoes: string;
  natureza_operacao: string;
  aliquota_iss: number;
}

const defaultForm: NotaFiscalForm = {
  os_id: null,
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
  valor_servico: 0,
  valor_desconto: 0,
  atividade_cnae: "",
  descricao_servico: "",
  observacoes: "",
  natureza_operacao: "Tributacao no municipio",
  aliquota_iss: 5.0,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function calcularValorFinal(vs: number, vd: number, ai: number) {
  const vf = Math.max(0, vs - vd);
  const vi = vf * (ai / 100);
  return { valor_final: vf, valor_iss: vi };
}

export default function NovaNotaFiscalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<NotaFiscalForm>(defaultForm);
  const [osSearch, setOsSearch] = useState("");
  const [osResults, setOsResults] = useState<OSItem[]>([]);
  const [loadingOs, setLoadingOs] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"os" | "dados">("os");

  // Quando tipo muda, limpa cliente
  useEffect(() => {
    setForm((f) => ({ ...f, cliente_documento: "" }));
  }, [form.tipo_cliente]);

  async function searchOS() {
    if (!osSearch.trim()) return;
    setLoadingOs(true);
    try {
      const res = await api.get(`/fiscal/os-para-fiscal?search=${encodeURIComponent(osSearch)}&limit=20`);
      setOsResults(res.data.items || []);
    } catch {
      setOsResults([]);
    } finally {
      setLoadingOs(false);
    }
  }

  function selectOS(os: OSItem) {
    const endereco = [
      os.clinica_endereco,
      os.clinica_numero,
    ]
      .filter(Boolean)
      .join(", ");

    setForm((f) => ({
      ...f,
      os_id: os.os_id,
      tipo_cliente: os.tipo_cliente as "PF" | "PJ",
      cliente_nome: os.cliente_nome,
      cliente_documento: os.cliente_documento,
      cliente_endereco: endereco,
      cliente_bairro: os.clinica_bairro || "",
      cliente_cidade: os.clinica_cidade || "",
      cliente_estado: os.clinica_estado || "",
      cliente_cep: os.clinica_cep || "",
      cliente_telefone: os.clinica_telefone || "",
      cliente_email: os.clinica_email || "",
      valor_servico: os.valor_final,
      descricao_servico: `Servico veterinario realizado na clinica ${os.clinica_nome || ""}. OS: ${os.numero_os}.`,
    }));
    setOsResults([]);
    setStep("dados");
  }

  async function handleCnpjSearch() {
    if (!form.cliente_documento || form.cliente_documento.length < 14) return;
    setLoadingCnpj(true);
    try {
      const cnpjLimpo = form.cliente_documento.replace(/\D/g, "");
      const res = await api.get<CNPJData>(`/fiscal/consulta-cnpj/${cnpjLimpo}`);
      const data = res.data;
      if (data.error) {
        alert(data.error);
        return;
      }
      const logradouro = data.logradouro || "";
      const numero = data.numero ? `, ${data.numero}` : "";
      const complemento = data.complemento ? ` - ${data.complemento}` : "";
      setForm((f) => ({
        ...f,
        cliente_nome: data.razao_social || f.cliente_nome,
        cliente_endereco: `${logradouro}${numero}${complemento}`,
        cliente_bairro: data.bairro || "",
        cliente_cidade: data.municipio || "",
        cliente_estado: data.uf || "",
        cliente_cep: data.cep || "",
        cliente_telefone: data.telefone || "",
        cliente_email: data.email || "",
        atividade_cnae: data.cnae_principal || f.atividade_cnae,
      }));
    } catch {
      alert("Erro ao consultar CNPJ. Tente novamente.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_nome.trim()) {
      alert("Informe o nome/razao social do cliente.");
      return;
    }
    if (!form.cliente_documento.trim()) {
      alert("Informe o CPF ou CNPJ do cliente.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        valor_servico: Number(form.valor_servico),
        valor_desconto: Number(form.valor_desconto),
        aliquota_iss: Number(form.aliquota_iss),
      };
      await api.post("/fiscal/notas-fiscais", payload);
      router.push("/fiscal");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erro ao salvar nota fiscal.");
    } finally {
      setSaving(false);
    }
  }

  const { valor_final, valor_iss } = calcularValorFinal(
    Number(form.valor_servico),
    Number(form.valor_desconto),
    Number(form.aliquota_iss)
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nova Nota Fiscal de Servico</h1>
            <p className="text-sm text-gray-500">
              {step === "os"
                ? "Passo 1: Vincular a uma Ordem de Servico"
                : "Passo 2: Revisar e complementar dados"}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === "os" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
          }`}>
            <span>{step === "os" ? "1" : "✓"}</span> Selecionar OS
          </div>
          <div className="h-px flex-1 bg-gray-300" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === "dados" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
          }`}>
            <span>2</span> Dados Fiscais
          </div>
        </div>

        {step === "os" ? (
          /* Step 1: Buscar OS */
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="mb-4 flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                Busque por nome do cliente, numero da OS ou nome da clinica para
                pré-preencher os dados da nota fiscal.
              </p>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, cliente, tutor ou numero da OS..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={osSearch}
                  onChange={(e) => setOsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchOS()}
                />
              </div>
              <button
                onClick={searchOS}
                disabled={loadingOs}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
              >
                {loadingOs && <Loader2 className="w-4 h-4 animate-spin" />}
                Buscar
              </button>
            </div>

            {osResults.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {osResults.map((os) => (
                  <button
                    key={os.os_id}
                    onClick={() => selectOS(os)}
                    className="w-full p-4 text-left hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            os.tipo_cliente === "PF"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {os.tipo_cliente}
                          </span>
                          <span className="font-medium text-gray-900">{os.cliente_nome}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          OS: {os.numero_os} | {os.clinica_nome || "Sem clinica"} |{" "}
                          {os.data_atendimento?.substring(0, 10) || "Sem data"}
                        </p>
                        <p className="text-xs text-gray-400">{os.cliente_documento}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(os.valor_final)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          os.status_os === "Pago"
                            ? "bg-green-100 text-green-700"
                            : os.status_os === "Cancelado"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {os.status_os}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : osSearch && !loadingOs ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <SearchX className="w-8 h-8 mb-2" />
                <p className="text-sm">Nenhuma OS encontrada para "{osSearch}"</p>
              </div>
            ) : null}

            <div className="mt-6 pt-4 border-t">
              <button
                onClick={() => setStep("dados")}
                className="text-sm text-blue-600 hover:underline"
              >
                Cadastrar nota fiscal sem vincular a uma OS
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Dados fiscais */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cliente */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                {form.tipo_cliente === "PJ" ? (
                  <Building2 className="w-4 h-4 text-blue-600" />
                ) : (
                  <User className="w-4 h-4 text-purple-600" />
                )}
                Dados do Tomador de Servicos
              </h3>

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo_cliente: "PJ" }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    form.tipo_cliente === "PJ"
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : "bg-gray-50 text-gray-600 border border-gray-200"
                  }`}
                >
                  Pessoa Juridica
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo_cliente: "PF" }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    form.tipo_cliente === "PF"
                      ? "bg-purple-100 text-purple-700 border border-purple-300"
                      : "bg-gray-50 text-gray-600 border border-gray-200"
                  }`}
                >
                  Pessoa Fisica
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.tipo_cliente === "PJ" ? "Razao Social *" : "Nome Completo *"}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.cliente_nome}
                    onChange={(e) => setForm((f) => ({ ...f, cliente_nome: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.tipo_cliente === "PJ" ? "CNPJ *" : "CPF *"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.cliente_documento}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (form.tipo_cliente === "PJ") {
                          v = v.replace(/\D/g, "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
                        } else {
                          v = v.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                        }
                        setForm((f) => ({ ...f, cliente_documento: v }));
                      }}
                      placeholder={form.tipo_cliente === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"}
                      required
                    />
                    {form.tipo_cliente === "PJ" && (
                      <button
                        type="button"
                        onClick={handleCnpjSearch}
                        disabled={loadingCnpj || form.cliente_documento.replace(/\D/g, "").length < 14}
                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-40 flex items-center gap-1"
                      >
                        {loadingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                      </button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereco</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.cliente_endereco}
                    onChange={(e) => setForm((f) => ({ ...f, cliente_endereco: e.target.value }))}
                    placeholder="Rua, numero, complemento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.cliente_bairro}
                    onChange={(e) => setForm((f) => ({ ...f, cliente_bairro: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.cliente_cidade}
                      onChange={(e) => setForm((f) => ({ ...f, cliente_cidade: e.target.value }))}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      value={form.cliente_estado}
                      onChange={(e) => setForm((f) => ({ ...f, cliente_estado: e.target.value }))}
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.cliente_cep}
                      onChange={(e) => setForm((f) => ({ ...f, cliente_cep: e.target.value }))}
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.cliente_telefone}
                    onChange={(e) => setForm((f) => ({ ...f, cliente_telefone: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.cliente_email}
                    onChange={(e) => setForm((f) => ({ ...f, cliente_email: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Valores */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Valores e Servico
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Servico (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.valor_servico}
                    onChange={(e) => setForm((f) => ({ ...f, valor_servico: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.valor_desconto}
                    onChange={(e) => setForm((f) => ({ ...f, valor_desconto: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aliquota ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.aliquota_iss}
                    onChange={(e) => setForm((f) => ({ ...f, aliquota_iss: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Natureza</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.natureza_operacao}
                    onChange={(e) => setForm((f) => ({ ...f, natureza_operacao: e.target.value }))}
                  >
                    <option>Tributacao no municipio</option>
                    <option>Tributacao fora do municipio</option>
                    <option>Isenta</option>
                    <option>Imune</option>
                    <option>Nao tributavel</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNAE / Codigo Atividade</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.atividade_cnae}
                    onChange={(e) => setForm((f) => ({ ...f, atividade_cnae: e.target.value }))}
                    placeholder="Ex: 8622-1/01 (Clinica veterinaria)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descricao do Servico</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.descricao_servico}
                    onChange={(e) => setForm((f) => ({ ...f, descricao_servico: e.target.value }))}
                    placeholder="Descricao detalhada do servico prestado"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.observacoes}
                    onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Resumo */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Resumo do Calculo</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500">Valor Servico</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(Number(form.valor_servico))}</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500">(-) Desconto</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(Number(form.valor_desconto))}</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500">(=) Valor Final</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(valor_final)}</p>
                </div>
              </div>
              <div className="mt-3 bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600">Valor ISS ({form.aliquota_iss}%)</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(valor_iss)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep("os")}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Voltar
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/fiscal")}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Salvar Nota Fiscal
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
