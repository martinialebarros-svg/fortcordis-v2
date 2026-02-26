"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { ClipboardPlus, FileText, Pill, Plus, RefreshCw, Save, Search, Stethoscope, Trash2 } from "lucide-react";

type ExameSolicitacao = {
  id?: number;
  tipo_exame: string;
  prioridade: string;
  status: string;
  observacoes: string;
  valor?: number;
  laudo_id?: number | null;
};

type PrescricaoItem = {
  id?: number;
  medicamento_id?: number | null;
  medicamento_nome: string;
  dose: string;
  frequencia: string;
  duracao: string;
  via: string;
  instrucoes: string;
};

type AtendimentoResumo = {
  id: number;
  paciente_id: number;
  clinica_id?: number | null;
  agendamento_id?: number | null;
  data_atendimento?: string | null;
  status: string;
  paciente_nome?: string;
  tutor_nome?: string;
  clinica_nome?: string;
  diagnostico?: string;
  total_exames?: number;
  tem_prescricao?: boolean;
};

type Medicamento = {
  id: number;
  nome: string;
  principio_ativo: string;
  concentracao: string;
  forma_farmaceutica: string;
  categoria: string;
  observacoes: string;
  ativo: number;
};

type PacienteResumo = { id: number; nome: string; tutor?: string; tutor_id?: number | null };
type ClinicaResumo = { id: number; nome: string };

type AtendimentoForm = {
  id?: number;
  paciente_id: string;
  clinica_id: string;
  agendamento_id: string;
  data_atendimento: string;
  status: string;
  queixa_principal: string;
  anamnese: string;
  exame_fisico: string;
  dados_clinicos: string;
  diagnostico: string;
  plano_terapeutico: string;
  retorno_recomendado: string;
  observacoes: string;
  exames: ExameSolicitacao[];
  prescricao_orientacoes: string;
  prescricao_retorno_dias: string;
  prescricao_itens: PrescricaoItem[];
};

const STATUS_ATENDIMENTO = ["Em atendimento", "Aguardando exames", "Retorno agendado", "Concluido"];
const STATUS_EXAME = ["Solicitado", "Em andamento", "Concluido"];
const PRIORIDADE_EXAME = ["Rotina", "Urgente", "Emergencial"];

const emptyExam = (): ExameSolicitacao => ({
  tipo_exame: "",
  prioridade: "Rotina",
  status: "Solicitado",
  observacoes: "",
  valor: 0,
  laudo_id: null,
});

const emptyPrescriptionItem = (): PrescricaoItem => ({
  medicamento_id: null,
  medicamento_nome: "",
  dose: "",
  frequencia: "",
  duracao: "",
  via: "Oral",
  instrucoes: "",
});

const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const isoToLocalInput = (value?: string | null) => {
  if (!value) return nowLocalInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLocalInput();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
};

const emptyForm = (): AtendimentoForm => ({
  paciente_id: "",
  clinica_id: "",
  agendamento_id: "",
  data_atendimento: nowLocalInput(),
  status: "Em atendimento",
  queixa_principal: "",
  anamnese: "",
  exame_fisico: "",
  dados_clinicos: "",
  diagnostico: "",
  plano_terapeutico: "",
  retorno_recomendado: "",
  observacoes: "",
  exames: [emptyExam()],
  prescricao_orientacoes: "",
  prescricao_retorno_dias: "",
  prescricao_itens: [emptyPrescriptionItem()],
});

export default function AtendimentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [contextoAplicado, setContextoAplicado] = useState(false);

  const [lista, setLista] = useState<AtendimentoResumo[]>([]);
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [clinicas, setClinicas] = useState<ClinicaResumo[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [form, setForm] = useState<AtendimentoForm>(emptyForm());

  const [medBusca, setMedBusca] = useState("");
  const [medForm, setMedForm] = useState({ nome: "", principio_ativo: "", concentracao: "", forma_farmaceutica: "", categoria: "", observacoes: "" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarBase();
  }, [router]);

  useEffect(() => {
    const aplicarContexto = async () => {
      if (loading || contextoAplicado) return;

      const params = new URLSearchParams(window.location.search);
      const atendimentoIdParam = params.get("atendimento_id");
      const agendamentoIdParam = params.get("agendamento_id");
      const pacienteIdParam = params.get("paciente_id");
      const clinicaIdParam = params.get("clinica_id");

      const atendimentoId = Number(atendimentoIdParam || 0);
      const agendamentoId = Number(agendamentoIdParam || 0);

      if (Number.isFinite(atendimentoId) && atendimentoId > 0) {
        await abrirAtendimento(atendimentoId);
        setContextoAplicado(true);
        return;
      }

      if (Number.isFinite(agendamentoId) && agendamentoId > 0) {
        try {
          const existentes = await api.get(`/atendimentos?agendamento_id=${agendamentoId}&limit=1`);
          const atendimentoExistente = existentes.data?.items?.[0];
          if (atendimentoExistente?.id) {
            await abrirAtendimento(atendimentoExistente.id);
            setSucesso(`Atendimento #${atendimentoExistente.id} carregado a partir da agenda.`);
            setContextoAplicado(true);
            return;
          }
        } catch {
          // segue para carregar contexto do agendamento
        }

        try {
          const response = await api.get(`/atendimentos/contexto?agendamento_id=${agendamentoId}`);
          const contexto = response.data || {};
          setForm((prev) => ({
            ...prev,
            paciente_id: contexto.paciente_id ? String(contexto.paciente_id) : prev.paciente_id,
            clinica_id: contexto.clinica_id ? String(contexto.clinica_id) : prev.clinica_id,
            agendamento_id: String(agendamentoId),
          }));
        } catch (e: any) {
          setErro(e?.response?.data?.detail || "Erro ao carregar contexto do agendamento.");
        }
        setContextoAplicado(true);
        return;
      }

      if (pacienteIdParam || clinicaIdParam) {
        setForm((prev) => ({
          ...prev,
          paciente_id: pacienteIdParam || prev.paciente_id,
          clinica_id: clinicaIdParam || prev.clinica_id,
        }));
      }

      setContextoAplicado(true);
    };

    aplicarContexto();
  }, [loading, contextoAplicado]);

  const carregarBase = async () => {
    try {
      setLoading(true);
      const [rp, rc, rm] = await Promise.all([
        api.get("/pacientes?limit=1000"),
        api.get("/clinicas?limit=500"),
        api.get("/atendimentos/medicamentos/banco?limit=500"),
      ]);
      setPacientes(rp.data?.items || []);
      setClinicas(rc.data?.items || []);
      setMedicamentos(rm.data?.items || []);
      await carregarLista();
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao carregar dados de atendimento.");
    } finally {
      setLoading(false);
    }
  };

  const carregarLista = async () => {
    try {
      const params = new URLSearchParams();
      params.append("limit", "300");
      if (statusFiltro) params.append("status", statusFiltro);
      if (busca.trim()) params.append("search", busca.trim());
      const response = await api.get(`/atendimentos?${params.toString()}`);
      setLista(response.data?.items || []);
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao listar atendimentos.");
    }
  };

  const filtered = useMemo(() => {
    const term = busca.toLowerCase().trim();
    return lista.filter((item) => {
      if (statusFiltro && item.status !== statusFiltro) return false;
      if (!term) return true;
      return (
        (item.paciente_nome || "").toLowerCase().includes(term) ||
        (item.tutor_nome || "").toLowerCase().includes(term) ||
        (item.clinica_nome || "").toLowerCase().includes(term) ||
        (item.diagnostico || "").toLowerCase().includes(term)
      );
    });
  }, [lista, busca, statusFiltro]);

  const medFiltrados = useMemo(() => {
    const term = medBusca.toLowerCase().trim();
    if (!term) return medicamentos;
    return medicamentos.filter((m) =>
      [m.nome, m.principio_ativo, m.categoria].some((v) => (v || "").toLowerCase().includes(term))
    );
  }, [medicamentos, medBusca]);

  const pacienteSelecionado = useMemo(() => {
    return pacientes.find((p) => String(p.id) === form.paciente_id) || null;
  }, [pacientes, form.paciente_id]);

  const abrirAtendimento = async (id: number) => {
    try {
      const response = await api.get(`/atendimentos/${id}`);
      const d = response.data;
      setSelecionado(id);
      setForm({
        id: d.id,
        paciente_id: String(d.paciente_id),
        clinica_id: d.clinica_id ? String(d.clinica_id) : "",
        agendamento_id: d.agendamento_id ? String(d.agendamento_id) : "",
        data_atendimento: isoToLocalInput(d.data_atendimento),
        status: d.status || "Em atendimento",
        queixa_principal: d.queixa_principal || "",
        anamnese: d.anamnese || "",
        exame_fisico: d.exame_fisico || "",
        dados_clinicos: d.dados_clinicos || "",
        diagnostico: d.diagnostico || "",
        plano_terapeutico: d.plano_terapeutico || "",
        retorno_recomendado: d.retorno_recomendado || "",
        observacoes: d.observacoes || "",
        exames: d.exames?.length ? d.exames : [emptyExam()],
        prescricao_orientacoes: d.prescricao?.orientacoes_gerais || "",
        prescricao_retorno_dias: d.prescricao?.retorno_dias ? String(d.prescricao.retorno_dias) : "",
        prescricao_itens: d.prescricao?.itens?.length ? d.prescricao.itens : [emptyPrescriptionItem()],
      });
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao abrir atendimento.");
    }
  };

  const novoAtendimento = () => {
    setSelecionado(null);
    setForm(emptyForm());
    setErro("");
    setSucesso("");
  };

  const setField = (name: keyof AtendimentoForm, value: any) => setForm((prev) => ({ ...prev, [name]: value }));

  const saveAtendimento = async () => {
    try {
      if (!form.paciente_id) {
        setErro("Selecione um paciente.");
        return;
      }
      setSalvando(true);
      const payload = {
        paciente_id: Number(form.paciente_id),
        clinica_id: form.clinica_id ? Number(form.clinica_id) : null,
        agendamento_id: form.agendamento_id ? Number(form.agendamento_id) : null,
        data_atendimento: form.data_atendimento ? new Date(form.data_atendimento).toISOString() : null,
        status: form.status,
        queixa_principal: form.queixa_principal,
        anamnese: form.anamnese,
        exame_fisico: form.exame_fisico,
        dados_clinicos: form.dados_clinicos,
        diagnostico: form.diagnostico,
        plano_terapeutico: form.plano_terapeutico,
        retorno_recomendado: form.retorno_recomendado,
        observacoes: form.observacoes,
        exames: form.exames.filter((e) => (e.tipo_exame || "").trim()).map((e) => ({ ...e, valor: Number(e.valor || 0) })),
        prescricao: {
          orientacoes_gerais: form.prescricao_orientacoes,
          retorno_dias: form.prescricao_retorno_dias ? Number(form.prescricao_retorno_dias) : null,
          itens: form.prescricao_itens
            .map((item, index) => ({ ...item, ordem: index }))
            .filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim()),
        },
      };

      if (selecionado) {
        await api.put(`/atendimentos/${selecionado}`, payload);
        setSucesso("Atendimento atualizado com sucesso.");
        await abrirAtendimento(selecionado);
      } else {
        const response = await api.post("/atendimentos", payload);
        setSucesso("Atendimento criado com sucesso.");
        if (response.data?.id) {
          await abrirAtendimento(response.data.id);
        }
      }
      await carregarLista();
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao salvar atendimento.");
    } finally {
      setSalvando(false);
    }
  };

  const deleteAtendimento = async (id: number) => {
    if (!confirm(`Excluir atendimento #${id}?`)) return;
    try {
      await api.delete(`/atendimentos/${id}`);
      if (selecionado === id) novoAtendimento();
      await carregarLista();
      setSucesso("Atendimento excluido com sucesso.");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao excluir atendimento.");
    }
  };

  const goLaudo = (item: { id?: number | null; atendimento_id?: number | null; agendamento_id?: number | null; paciente_id?: number | null; clinica_id?: number | null }) => {
    const params = new URLSearchParams();
    const atendimentoId = item.atendimento_id || item.id;
    if (atendimentoId) params.set("atendimento_id", String(atendimentoId));
    if (item.agendamento_id) params.set("agendamento_id", String(item.agendamento_id));
    if (item.paciente_id) params.set("paciente_id", String(item.paciente_id));
    if (item.clinica_id) params.set("clinica_id", String(item.clinica_id));
    router.push(`/laudos/novo?${params.toString()}`);
  };

  const saveMedicamento = async () => {
    try {
      if (!medForm.nome.trim()) return;
      await api.post("/atendimentos/medicamentos/banco", { ...medForm, ativo: 1 });
      const response = await api.get("/atendimentos/medicamentos/banco?limit=500");
      setMedicamentos(response.data?.items || []);
      setMedForm({ nome: "", principio_ativo: "", concentracao: "", forma_farmaceutica: "", categoria: "", observacoes: "" });
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao salvar medicamento.");
    }
  };

  if (loading) {
    return <DashboardLayout><div className="p-6 text-gray-600">Carregando modulo de atendimento...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardPlus className="w-6 h-6 text-teal-600" />Atendimento Clinico</h1>
            <p className="text-gray-500">Consulta, solicitacao de exames, dados clinicos e receituario integrado.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={novoAtendimento} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"><Plus className="w-4 h-4" />Novo</button>
            <button onClick={saveAtendimento} disabled={salvando} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"><Save className="w-4 h-4" />{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>

        {erro ? <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{erro}</div> : null}
        {sucesso ? <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{sucesso}</div> : null}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Atendimentos</h2>
              <button onClick={carregarLista} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><RefreshCw className="w-4 h-4" />Atualizar</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm" />
              </div>
              <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                <option value="">Todos</option>
                {STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>

            <div className="max-h-[560px] overflow-auto border rounded-lg divide-y">
              {filtered.map((item) => (
                <div key={item.id} className={`p-3 ${selecionado === item.id ? "bg-teal-50" : ""}`}>
                  <button onClick={() => abrirAtendimento(item.id)} className="text-left w-full">
                    <p className="text-sm font-semibold text-gray-900">#{item.id} - {item.paciente_nome || "Paciente"}</p>
                    <p className="text-xs text-gray-500">{item.tutor_nome || "Tutor nao informado"}</p>
                    <p className="text-xs text-gray-500">{formatDate(item.data_atendimento)}</p>
                    <p className="text-xs text-gray-600">{item.status}</p>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => goLaudo({ ...item, atendimento_id: item.id })} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-1"><FileText className="w-3 h-3" />Laudar</button>
                    <button onClick={() => deleteAtendimento(item.id)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1"><Trash2 className="w-3 h-3" />Excluir</button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 ? <div className="p-4 text-sm text-gray-500">Nenhum atendimento encontrado.</div> : null}
            </div>
          </div>

          <div className="xl:col-span-8 space-y-6">
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-teal-600" />Consulta e dados clinicos</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <select value={form.paciente_id} onChange={(e) => setField("paciente_id", e.target.value)} className="md:col-span-2 px-3 py-2 border rounded-lg text-sm"><option value="">Paciente</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
                <select value={form.clinica_id} onChange={(e) => setField("clinica_id", e.target.value)} className="px-3 py-2 border rounded-lg text-sm"><option value="">Clinica</option>{clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                <input type="datetime-local" value={form.data_atendimento} onChange={(e) => setField("data_atendimento", e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                <input value={form.agendamento_id} onChange={(e) => setField("agendamento_id", e.target.value)} placeholder="Agendamento ID" className="px-3 py-2 border rounded-lg text-sm" />
                <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="px-3 py-2 border rounded-lg text-sm">{STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                <button onClick={() => goLaudo({ id: selecionado, paciente_id: Number(form.paciente_id || 0), clinica_id: Number(form.clinica_id || 0), agendamento_id: form.agendamento_id ? Number(form.agendamento_id) : null })} className="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm flex items-center justify-center gap-1"><FileText className="w-4 h-4" />Laudar</button>
              </div>
              {pacienteSelecionado ? (
                <div className="text-xs text-gray-500">Tutor: {pacienteSelecionado.tutor || "Nao informado"}</div>
              ) : null}
              <textarea value={form.queixa_principal} onChange={(e) => setField("queixa_principal", e.target.value)} placeholder="Queixa principal" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.anamnese} onChange={(e) => setField("anamnese", e.target.value)} placeholder="Anamnese" rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.exame_fisico} onChange={(e) => setField("exame_fisico", e.target.value)} placeholder="Exame fisico" rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.dados_clinicos} onChange={(e) => setField("dados_clinicos", e.target.value)} placeholder="Dados clinicos" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.diagnostico} onChange={(e) => setField("diagnostico", e.target.value)} placeholder="Diagnostico" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.plano_terapeutico} onChange={(e) => setField("plano_terapeutico", e.target.value)} placeholder="Plano terapeutico" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.retorno_recomendado} onChange={(e) => setField("retorno_recomendado", e.target.value)} placeholder="Retorno recomendado" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={form.observacoes} onChange={(e) => setField("observacoes", e.target.value)} placeholder="Observacoes gerais" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Solicitacao de exames</h2><button onClick={() => setField("exames", [...form.exames, emptyExam()])} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Plus className="w-4 h-4" />Exame</button></div>
              {form.exames.map((exame, idx) => (
                <div key={`${idx}-${exame.id || "novo"}`} className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                  <input value={exame.tipo_exame} onChange={(e) => setField("exames", form.exames.map((x, i) => i === idx ? { ...x, tipo_exame: e.target.value } : x))} placeholder="Tipo" className="md:col-span-2 px-3 py-2 border rounded-lg text-sm" />
                  <select value={exame.prioridade} onChange={(e) => setField("exames", form.exames.map((x, i) => i === idx ? { ...x, prioridade: e.target.value } : x))} className="px-3 py-2 border rounded-lg text-sm">{PRIORIDADE_EXAME.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  <select value={exame.status} onChange={(e) => setField("exames", form.exames.map((x, i) => i === idx ? { ...x, status: e.target.value } : x))} className="px-3 py-2 border rounded-lg text-sm">{STATUS_EXAME.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  <input type="number" value={exame.valor || 0} onChange={(e) => setField("exames", form.exames.map((x, i) => i === idx ? { ...x, valor: Number(e.target.value) } : x))} placeholder="Valor" className="px-3 py-2 border rounded-lg text-sm" />
                  <button onClick={() => setField("exames", form.exames.length === 1 ? form.exames : form.exames.filter((_, i) => i !== idx))} className="px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
                  <input value={exame.observacoes || ""} onChange={(e) => setField("exames", form.exames.map((x, i) => i === idx ? { ...x, observacoes: e.target.value } : x))} placeholder="Observacoes" className="md:col-span-5 px-3 py-2 border rounded-lg text-sm" />
                </div>
              ))}
            </div>

            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><Pill className="w-4 h-4 text-teal-600" />Receituario</h2><button onClick={() => setField("prescricao_itens", [...form.prescricao_itens, emptyPrescriptionItem()])} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Plus className="w-4 h-4" />Medicamento</button></div>
              <textarea value={form.prescricao_orientacoes} onChange={(e) => setField("prescricao_orientacoes", e.target.value)} placeholder="Orientacoes gerais" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input type="number" value={form.prescricao_retorno_dias} onChange={(e) => setField("prescricao_retorno_dias", e.target.value)} placeholder="Retorno em dias" className="w-full md:w-56 px-3 py-2 border rounded-lg text-sm" />
              {form.prescricao_itens.map((item, idx) => (
                <div key={`${idx}-${item.id || "novo"}`} className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                  <select value={item.medicamento_id || ""} onChange={(e) => {
                    const medId = e.target.value ? Number(e.target.value) : null;
                    const med = medicamentos.find((m) => m.id === medId);
                    setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, medicamento_id: medId, medicamento_nome: med?.nome || x.medicamento_nome } : x));
                  }} className="md:col-span-2 px-3 py-2 border rounded-lg text-sm"><option value="">Banco de medicamentos</option>{medicamentos.map((med) => <option key={med.id} value={med.id}>{med.nome}</option>)}</select>
                  <input value={item.medicamento_nome} onChange={(e) => setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, medicamento_nome: e.target.value } : x))} placeholder="Nome livre" className="md:col-span-2 px-3 py-2 border rounded-lg text-sm" />
                  <input value={item.dose} onChange={(e) => setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, dose: e.target.value } : x))} placeholder="Dose" className="px-3 py-2 border rounded-lg text-sm" />
                  <button onClick={() => setField("prescricao_itens", form.prescricao_itens.length === 1 ? form.prescricao_itens : form.prescricao_itens.filter((_, i) => i !== idx))} className="px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
                  <input value={item.frequencia} onChange={(e) => setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, frequencia: e.target.value } : x))} placeholder="Frequencia" className="px-3 py-2 border rounded-lg text-sm" />
                  <input value={item.duracao} onChange={(e) => setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, duracao: e.target.value } : x))} placeholder="Duracao" className="px-3 py-2 border rounded-lg text-sm" />
                  <input value={item.via} onChange={(e) => setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, via: e.target.value } : x))} placeholder="Via" className="px-3 py-2 border rounded-lg text-sm" />
                  <input value={item.instrucoes} onChange={(e) => setField("prescricao_itens", form.prescricao_itens.map((x, i) => i === idx ? { ...x, instrucoes: e.target.value } : x))} placeholder="Instrucoes" className="md:col-span-3 px-3 py-2 border rounded-lg text-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Pill className="w-4 h-4 text-teal-600" />Banco de medicamentos</h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="space-y-2">
              <input value={medForm.nome} onChange={(e) => setMedForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input value={medForm.principio_ativo} onChange={(e) => setMedForm((p) => ({ ...p, principio_ativo: e.target.value }))} placeholder="Principio ativo" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input value={medForm.concentracao} onChange={(e) => setMedForm((p) => ({ ...p, concentracao: e.target.value }))} placeholder="Concentracao" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input value={medForm.forma_farmaceutica} onChange={(e) => setMedForm((p) => ({ ...p, forma_farmaceutica: e.target.value }))} placeholder="Forma farmaceutica" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input value={medForm.categoria} onChange={(e) => setMedForm((p) => ({ ...p, categoria: e.target.value }))} placeholder="Categoria" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={medForm.observacoes} onChange={(e) => setMedForm((p) => ({ ...p, observacoes: e.target.value }))} placeholder="Observacoes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <button onClick={saveMedicamento} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm flex items-center gap-1"><Save className="w-4 h-4" />Salvar medicamento</button>
            </div>
            <div className="xl:col-span-2 border rounded-lg max-h-[360px] overflow-auto">
              <div className="p-2 border-b"><input value={medBusca} onChange={(e) => setMedBusca(e.target.value)} placeholder="Buscar medicamento..." className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Nome</th><th className="text-left px-3 py-2">Principio ativo</th><th className="text-left px-3 py-2">Concentracao</th><th className="text-right px-3 py-2">Acoes</th></tr></thead>
                <tbody>
                  {medFiltrados.map((med) => (
                    <tr key={med.id} className="border-t">
                      <td className="px-3 py-2">{med.nome}</td>
                      <td className="px-3 py-2">{med.principio_ativo || "-"}</td>
                      <td className="px-3 py-2">{med.concentracao || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() =>
                            setField("prescricao_itens", [
                              ...form.prescricao_itens,
                              {
                                ...emptyPrescriptionItem(),
                                medicamento_id: med.id,
                                medicamento_nome: med.nome,
                              },
                            ])
                          }
                          className="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200"
                        >
                          Prescrever
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
