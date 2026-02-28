"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  ClipboardPlus,
  File,
  FileText,
  Heart,
  History,
  Paperclip,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Stethoscope,
  Thermometer,
  Trash2,
  TrendingUp,
  User,
  Wind,
  Download,
} from "lucide-react";

// === TIPOS ===

type Triagem = {
  peso: number | null;
  temperatura: number | null;
  frequencia_cardiaca: number | null;
  frequencia_respiratoria: number | null;
  pressao_arterial: string;
  saturacao_oxigenio: number | null;
  escore_condicion_corpo: number | null;
  mucosas: string;
  hidratacao: string;
  triagem_observacoes: string;
};

type Diagnostico = {
  diagnostico_principal: string;
  diagnostico_secundario: string;
  diagnostico_diferencial: string;
  prognostico: string;
};

type Evolucao = {
  id: number;
  data_evolucao: string;
  descricao: string;
  sinais_vitais: string;
  responsavel_nome: string;
};

type Anexo = {
  id: number;
  tipo: string;
  descricao: string;
  url: string;
  nome_original: string;
};

type Alerta = {
  id: number;
  tipo: string;
  titulo: string;
  descricao: string;
  gravidade: string;
};

type HistoricoPaciente = {
  paciente: {
    id: number;
    nome: string;
    especie: string;
    raca: string;
    peso: string;
    nascimento?: string | null;
  };
  alertas: Alerta[];
  atendimentos: {
    id: number;
    data_atendimento: string;
    status: string;
    queixa_principal: string;
    diagnostico_principal: string;
    veterinario: string;
  }[];
};

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
  triagem: Triagem;
  triagem_concluida: number;
  consulta_concluida: number;
  queixa_principal: string;
  anamnese: string;
  exame_fisico: string;
  dados_clinicos: string;
  diagnostico: Diagnostico;
  plano_terapeutico: string;
  retorno_recomendado: string;
  motivo_retorno: string;
  observacoes: string;
  exames: ExameSolicitacao[];
  prescricao_orientacoes: string;
  prescricao_retorno_dias: string;
  prescricao_itens: PrescricaoItem[];
  evolucoes: Evolucao[];
  anexos: Anexo[];
};

// === CONSTANTES ===

const STATUS_ATENDIMENTO = [
  "Triagem",
  "Em atendimento",
  "Aguardando exames",
  "Retorno agendado",
  "Concluido",
];
const STATUS_EXAME = ["Solicitado", "Em andamento", "Concluido"];
const PRIORIDADE_EXAME = ["Rotina", "Urgente", "Emergencial"];
const MUCOSAS = ["Rosadas", "Palidas", "Ictericas", "Cianoticas", "Hiperemicas"];
const HIDRATACAO = ["Normal", "Desidratado leve", "Desidratado moderado", "Desidratado grave"];
const PROGNOSTICO = ["Favoravel", "Reservado", "Ruim"];
const ESCALA_ECC = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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

const emptyTriagem = (): Triagem => ({
  peso: null,
  temperatura: null,
  frequencia_cardiaca: null,
  frequencia_respiratoria: null,
  pressao_arterial: "",
  saturacao_oxigenio: null,
  escore_condicion_corpo: null,
  mucosas: "",
  hidratacao: "",
  triagem_observacoes: "",
});

const emptyDiagnostico = (): Diagnostico => ({
  diagnostico_principal: "",
  diagnostico_secundario: "",
  diagnostico_diferencial: "",
  prognostico: "",
});

const emptyForm = (): AtendimentoForm => ({
  paciente_id: "",
  clinica_id: "",
  agendamento_id: "",
  data_atendimento: nowLocalInput(),
  status: "Triagem",
  triagem: emptyTriagem(),
  triagem_concluida: 0,
  consulta_concluida: 0,
  queixa_principal: "",
  anamnese: "",
  exame_fisico: "",
  dados_clinicos: "",
  diagnostico: emptyDiagnostico(),
  plano_terapeutico: "",
  retorno_recomendado: "",
  motivo_retorno: "",
  observacoes: "",
  exames: [emptyExam()],
  prescricao_orientacoes: "",
  prescricao_retorno_dias: "",
  prescricao_itens: [emptyPrescriptionItem()],
  evolucoes: [],
  anexos: [],
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

  // Histórico do paciente
  const [historicoPaciente, setHistoricoPaciente] = useState<HistoricoPaciente | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [tabActive, setTabActive] = useState<"triagem" | "consulta" | "prescricao" | "exames" | "evolucao" | "anexos">("triagem");

  // Alertas
  const [alertaForm, setAlertaForm] = useState({ tipo: "alergia", titulo: "", descricao: "", gravidade: "media" });
  const [mostrarAlertaForm, setMostrarAlertaForm] = useState(false);

  // Evolução
  const [evolucaoForm, setEvolucaoForm] = useState({ descricao: "", sinais_vitais: "" });

  // Anexo
  const [anexoForm, setAnexoForm] = useState({ tipo: "imagem", descricao: "", url: "" });

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

      // Carregar histórico do paciente
      if (d.paciente_id) {
        try {
          const histResponse = await api.get(`/atendimentos/paciente/${d.paciente_id}/historico?limite=5`);
          setHistoricoPaciente(histResponse.data);
        } catch {
          setHistoricoPaciente(null);
        }
      }

      setForm({
        id: d.id,
        paciente_id: String(d.paciente_id),
        clinica_id: d.clinica_id ? String(d.clinica_id) : "",
        agendamento_id: d.agendamento_id ? String(d.agendamento_id) : "",
        data_atendimento: isoToLocalInput(d.data_atendimento),
        status: d.status || "Triagem",
        // Triagem
        triagem: {
          peso: d.triagem?.peso ?? null,
          temperatura: d.triagem?.temperatura ?? null,
          frequencia_cardiaca: d.triagem?.frequencia_cardiaca ?? null,
          frequencia_respiratoria: d.triagem?.frequencia_respiratoria ?? null,
          pressao_arterial: d.triagem?.pressao_arterial || "",
          saturacao_oxigenio: d.triagem?.saturacao_oxigenio ?? null,
          escore_condicion_corpo: d.triagem?.escore_condicion_corpo ?? null,
          mucosas: d.triagem?.mucosas || "",
          hidratacao: d.triagem?.hidratacao || "",
          triagem_observacoes: d.triagem?.triagem_observacoes || "",
        },
        triagem_concluida: d.triagem_concluida || 0,
        consulta_concluida: d.consulta_concluida || 0,
        // Consulta
        queixa_principal: d.queixa_principal || "",
        anamnese: d.anamnese || "",
        exame_fisico: d.exame_fisico || "",
        dados_clinicos: d.dados_clinicos || "",
        diagnostico: {
          diagnostico_principal: d.diagnostico_principal || "",
          diagnostico_secundario: d.diagnostico_secundario || "",
          diagnostico_diferencial: d.diagnostico_diferencial || "",
          prognostico: d.prognostico || "",
        },
        plano_terapeutico: d.plano_terapeutico || "",
        retorno_recomendado: d.retorno_recomendado || "",
        motivo_retorno: d.motivo_retorno || "",
        observacoes: d.observacoes || "",
        exames: d.exames?.length ? d.exames : [emptyExam()],
        prescricao_orientacoes: d.prescricao?.orientacoes_gerais || "",
        prescricao_retorno_dias: d.prescricao?.retorno_dias ? String(d.prescricao.retorno_dias) : "",
        prescricao_itens: d.prescricao?.itens?.length ? d.prescricao.itens : [emptyPrescriptionItem()],
        evolucoes: d.evolucoes || [],
        anexos: d.anexos || [],
      });
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao abrir atendimento.");
    }
  };

  const novoAtendimento = () => {
    setSelecionado(null);
    setForm(emptyForm());
    setHistoricoPaciente(null);
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
        triagem: form.triagem,
        triagem_concluida: form.triagem_concluida,
        consulta_concluida: form.consulta_concluida,
        queixa_principal: form.queixa_principal,
        anamnese: form.anamnese,
        exame_fisico: form.exame_fisico,
        dados_clinicos: form.dados_clinicos,
        diagnostico: form.diagnostico,
        plano_terapeutico: form.plano_terapeutico,
        retorno_recomendado: form.retorno_recomendado,
        motivo_retorno: form.motivo_retorno,
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

  const escHtml = (value: any) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const abrirJanelaImpressao = (titulo: string, conteudoHtml: string) => {
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      setErro("Nao foi possivel abrir a janela de impressao. Verifique o bloqueador de pop-up.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${escHtml(titulo)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 12px; font-size: 22px; }
            h2 { margin: 20px 0 8px; font-size: 16px; }
            .meta { margin-bottom: 12px; font-size: 13px; color: #374151; }
            .meta p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
            .obs { white-space: pre-wrap; font-size: 12px; margin-top: 8px; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; }
            @media print {
              body { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${conteudoHtml}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const obterPacienteNome = () => pacientes.find((p) => String(p.id) === form.paciente_id)?.nome || "Nao informado";
  const obterClinicaNome = () => clinicas.find((c) => String(c.id) === form.clinica_id)?.nome || "Nao informada";

  const imprimirPrescricao = () => {
    const itens = form.prescricao_itens.filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim());
    if (!itens.length && !form.prescricao_orientacoes.trim()) {
      setErro("Preencha a prescricao para imprimir.");
      return;
    }

    const rows = itens
      .map((item, idx) => `
        <tr>
          <td>${idx + 1}. ${escHtml(item.medicamento_nome || "-")}</td>
          <td>${escHtml(item.dose || "-")}</td>
          <td>${escHtml(item.frequencia || "-")}</td>
          <td>${escHtml(item.duracao || "-")}</td>
          <td>${escHtml(item.via || "-")}</td>
          <td>${escHtml(item.instrucoes || "-")}</td>
        </tr>
      `)
      .join("");

    abrirJanelaImpressao(
      "Receita Veterinaria",
      `
      <h1>Receita Veterinaria</h1>
      <div class="meta">
        <p><b>Paciente:</b> ${escHtml(obterPacienteNome())}</p>
        <p><b>Clinica:</b> ${escHtml(obterClinicaNome())}</p>
        <p><b>Data:</b> ${escHtml(formatDate(form.data_atendimento))}</p>
        <p><b>Atendimento:</b> ${escHtml(selecionado ? `#${selecionado}` : "Nao salvo")}</p>
      </div>
      <h2>Medicamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Dose</th>
            <th>Frequencia</th>
            <th>Duracao</th>
            <th>Via</th>
            <th>Instrucoes</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">Sem itens de medicacao.</td></tr>`}</tbody>
      </table>
      <h2>Orientacoes gerais</h2>
      <div class="obs">${escHtml(form.prescricao_orientacoes || "-")}</div>
      ${form.prescricao_retorno_dias ? `<p><b>Retorno sugerido:</b> ${escHtml(form.prescricao_retorno_dias)} dia(s)</p>` : ""}
      <div class="footer">Documento emitido pelo modulo de atendimento.</div>
    `,
    );
  };

  const imprimirSolicitacaoExames = () => {
    const exames = form.exames.filter((item) => (item.tipo_exame || "").trim());
    if (!exames.length) {
      setErro("Adicione pelo menos um exame para imprimir a solicitacao.");
      return;
    }

    const rows = exames
      .map((exame, idx) => `
        <tr>
          <td>${idx + 1}. ${escHtml(exame.tipo_exame || "-")}</td>
          <td>${escHtml(exame.prioridade || "-")}</td>
          <td>${escHtml(exame.status || "-")}</td>
          <td>${escHtml(exame.valor ? `R$ ${Number(exame.valor).toFixed(2)}` : "-")}</td>
          <td>${escHtml(exame.observacoes || "-")}</td>
        </tr>
      `)
      .join("");

    abrirJanelaImpressao(
      "Solicitacao de Exames",
      `
      <h1>Solicitacao de Exames</h1>
      <div class="meta">
        <p><b>Paciente:</b> ${escHtml(obterPacienteNome())}</p>
        <p><b>Clinica:</b> ${escHtml(obterClinicaNome())}</p>
        <p><b>Data:</b> ${escHtml(formatDate(form.data_atendimento))}</p>
        <p><b>Atendimento:</b> ${escHtml(selecionado ? `#${selecionado}` : "Nao salvo")}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Exame</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Valor</th>
            <th>Observacoes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Documento emitido pelo modulo de atendimento.</div>
    `,
    );
  };

  const baixarPdfAtendimento = async (tipo: "prescricao" | "exames") => {
    if (!selecionado) {
      setErro("Salve o atendimento antes de gerar PDF.");
      return;
    }

    try {
      const response = await api.get(`/atendimentos/${selecionado}/${tipo}/pdf`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers?.["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const fallback = tipo === "prescricao" ? `receita_atendimento_${selecionado}.pdf` : `solicitacao_exames_atendimento_${selecionado}.pdf`;
      link.href = url;
      link.download = match?.[1] || fallback;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSucesso(tipo === "prescricao" ? "PDF da receita gerado com sucesso." : "PDF da solicitacao de exames gerado com sucesso.");
    } catch {
      setErro(tipo === "prescricao" ? "Erro ao gerar PDF da receita." : "Erro ao gerar PDF da solicitacao de exames.");
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
            {/* Header do atendimento */}
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-teal-600" />Atendimento Clinico</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <select value={form.paciente_id} onChange={(e) => { setField("paciente_id", e.target.value); setHistoricoPaciente(null); }} className="md:col-span-2 px-3 py-2 border rounded-lg text-sm"><option value="">Paciente</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
                <select value={form.clinica_id} onChange={(e) => setField("clinica_id", e.target.value)} className="px-3 py-2 border rounded-lg text-sm"><option value="">Clinica</option>{clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                <input type="datetime-local" value={form.data_atendimento} onChange={(e) => setField("data_atendimento", e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                <input value={form.agendamento_id} onChange={(e) => setField("agendamento_id", e.target.value)} placeholder="Agendamento ID" className="px-3 py-2 border rounded-lg text-sm" />
                <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="px-3 py-2 border rounded-lg text-sm">{STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                <button onClick={() => goLaudo({ id: selecionado, paciente_id: Number(form.paciente_id || 0), clinica_id: Number(form.clinica_id || 0), agendamento_id: form.agendamento_id ? Number(form.agendamento_id) : null })} className="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm flex items-center justify-center gap-1"><FileText className="w-4 h-4" />Laudar</button>
              </div>
              {pacienteSelecionado ? (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">Tutor: {pacienteSelecionado.tutor || "Nao informado"}</div>
                  <button onClick={async () => {
                    if (form.paciente_id) {
                      try {
                        const res = await api.get(`/atendimentos/paciente/${form.paciente_id}/historico?limite=5`);
                        setHistoricoPaciente(res.data);
                        setMostrarHistorico(true);
                      } catch { setErro("Erro ao carregar historico"); }
                    }
                  }} className="text-xs px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><History className="w-3 h-3" />Ver Historico</button>
                </div>
              ) : null}
            </div>

            {/* Modal de Historico do Paciente */}
            {mostrarHistorico && historicoPaciente && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Historico do Paciente</h3>
                    <button onClick={() => setMostrarHistorico(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                  </div>
                  <div className="border rounded-lg p-3 bg-blue-50">
                    <p className="font-semibold">{historicoPaciente.paciente.nome}</p>
                    <p className="text-sm text-gray-600">{historicoPaciente.paciente.especie} - {historicoPaciente.paciente.raca}</p>
                    <p className="text-sm text-gray-600">Peso: {historicoPaciente.paciente.peso || "Nao informado"}</p>
                  </div>
                  {historicoPaciente.alertas.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" />Alertas Clinicos</h4>
                      {historicoPaciente.alertas.map((alerta) => (
                        <div key={alerta.id} className={`p-2 rounded text-sm ${alerta.gravidade === "critica" ? "bg-red-100 text-red-800" : alerta.gravidade === "alta" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}>
                          <strong>{alerta.titulo}</strong> ({alerta.gravidade})<br/>
                          {alerta.descricao}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Atendimentos Anteriores</h4>
                    {historicoPaciente.atendimentos.map((att) => (
                      <div key={att.id} className="border rounded p-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">#{att.id} - {formatDate(att.data_atendimento)}</span>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{att.status}</span>
                        </div>
                        <p className="text-gray-600">{att.queixa_principal || "Sem queixa"}</p>
                        <p className="text-gray-600">{att.diagnostico_principal || "Sem diagnostico"}</p>
                        <p className="text-xs text-gray-500">Dr(a). {att.veterinario}</p>
                      </div>
                    ))}
                    {historicoPaciente.atendimentos.length === 0 && <p className="text-sm text-gray-500">Nenhum atendimento anterior.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Tabs de Navegacao */}
            <div className="bg-white border rounded-lg p-2">
              <div className="flex gap-1 overflow-x-auto">
                {[
                  { id: "triagem", label: "Triagem", icon: Thermometer },
                  { id: "consulta", label: "Consulta", icon: Stethoscope },
                  { id: "prescricao", label: "Prescricao", icon: Pill },
                  { id: "exames", label: "Exames", icon: FileText },
                  { id: "evolucao", label: "Evolucao", icon: TrendingUp },
                  { id: "anexos", label: "Anexos", icon: Paperclip },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setTabActive(tab.id as any)} className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap ${tabActive === tab.id ? "bg-teal-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>
                    <tab.icon className="w-4 h-4" />{tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteudo das Tabs */}
            {tabActive === "triagem" && (
              <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Thermometer className="w-4 h-4 text-blue-600" />Triagem - Sinais Vitais</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.triagem_concluida === 1} onChange={(e) => setField("triagem_concluida", e.target.checked ? 1 : 0)} className="w-4 h-4" />
                    Triagem Concluida
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Peso (kg)</label>
                    <input type="number" step="0.1" value={form.triagem.peso ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, peso: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Temperatura (°C)</label>
                    <input type="number" step="0.1" value={form.triagem.temperatura ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, temperatura: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">FC (bpm)</label>
                    <input type="number" value={form.triagem.frequencia_cardiaca ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, frequencia_cardiaca: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Batimentos" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">FR (mpm)</label>
                    <input type="number" value={form.triagem.frequencia_respiratoria ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, frequencia_respiratoria: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Movimentos" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Pressao Arterial</label>
                    <input value={form.triagem.pressao_arterial} onChange={(e) => setField("triagem", { ...form.triagem, pressao_arterial: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="mmHg" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">SpO2 (%)</label>
                    <input type="number" value={form.triagem.saturacao_oxigenio ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, saturacao_oxigenio: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="%" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Escore Condicao Corporal</label>
                    <select value={form.triagem.escore_condicion_corpo ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, escore_condicion_corpo: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">Selecione</option>
                      {ESCALA_ECC.map((e) => <option key={e} value={e}>{e} - {e <= 3 ? "Magro" : e <= 5 ? "Ideal" : "Obeso"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Mucosas</label>
                    <select value={form.triagem.mucosas} onChange={(e) => setField("triagem", { ...form.triagem, mucosas: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">Selecione</option>
                      {MUCOSAS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hidratacao</label>
                    <select value={form.triagem.hidratacao} onChange={(e) => setField("triagem", { ...form.triagem, hidratacao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">Selecione</option>
                      {HIDRATACAO.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Observacoes da Triagem</label>
                  <textarea value={form.triagem.triagem_observacoes} onChange={(e) => setField("triagem", { ...form.triagem, triagem_observacoes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Observacoes adicionais da triagem..." />
                </div>
              </div>
            )}

            {tabActive === "consulta" && (
              <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-teal-600" />Consulta Medica</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.consulta_concluida === 1} onChange={(e) => setField("consulta_concluida", e.target.checked ? 1 : 0)} className="w-4 h-4" />
                    Consulta Concluida
                  </label>
                </div>
                <textarea value={form.queixa_principal} onChange={(e) => setField("queixa_principal", e.target.value)} placeholder="Queixa principal" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <textarea value={form.anamnese} onChange={(e) => setField("anamnese", e.target.value)} placeholder="Anamnese" rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <textarea value={form.exame_fisico} onChange={(e) => setField("exame_fisico", e.target.value)} placeholder="Exame fisico" rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <textarea value={form.dados_clinicos} onChange={(e) => setField("dados_clinicos", e.target.value)} placeholder="Dados clinicos" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostico Principal</label>
                    <textarea value={form.diagnostico.diagnostico_principal} onChange={(e) => setField("diagnostico", { ...form.diagnostico, diagnostico_principal: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Diagnostico principal" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostico Secundario</label>
                    <textarea value={form.diagnostico.diagnostico_secundario} onChange={(e) => setField("diagnostico", { ...form.diagnostico, diagnostico_secundario: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Diagnosticos secundarios" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostico Diferencial</label>
                  <textarea value={form.diagnostico.diagnostico_diferencial} onChange={(e) => setField("diagnostico", { ...form.diagnostico, diagnostico_diferencial: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Diagnosticos diferenciais" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prognostico</label>
                  <select value={form.diagnostico.prognostico} onChange={(e) => setField("diagnostico", { ...form.diagnostico, prognostico: e.target.value })} className="w-full md:w-64 px-3 py-2 border rounded-lg text-sm">
                    <option value="">Selecione</option>
                    {PROGNOSTICO.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <textarea value={form.plano_terapeutico} onChange={(e) => setField("plano_terapeutico", e.target.value)} placeholder="Plano terapeutico" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <textarea value={form.retorno_recomendado} onChange={(e) => setField("retorno_recomendado", e.target.value)} placeholder="Retorno recomendado" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <textarea value={form.motivo_retorno} onChange={(e) => setField("motivo_retorno", e.target.value)} placeholder="Motivo do retorno" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <textarea value={form.observacoes} onChange={(e) => setField("observacoes", e.target.value)} placeholder="Observacoes gerais" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            )}

            {tabActive === "prescricao" && (
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Pill className="w-4 h-4 text-teal-600" />Receituario</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={imprimirPrescricao} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Printer className="w-4 h-4" />Imprimir</button>
                    <button onClick={() => baixarPdfAtendimento("prescricao")} disabled={!selecionado} className="text-sm px-3 py-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-700 disabled:opacity-50 flex items-center gap-1"><Download className="w-4 h-4" />Gerar PDF</button>
                  </div>
                </div>
                <textarea value={form.prescricao_orientacoes} onChange={(e) => setField("prescricao_orientacoes", e.target.value)} placeholder="Orientacoes gerais" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="number" value={form.prescricao_retorno_dias} onChange={(e) => setField("prescricao_retorno_dias", e.target.value)} placeholder="Retorno em dias" className="w-full md:w-56 px-3 py-2 border rounded-lg text-sm" />
                <div className="flex items-center justify-between mt-4">
                  <h3 className="font-medium text-gray-700">Medicamentos</h3>
                  <button onClick={() => setField("prescricao_itens", [...form.prescricao_itens, emptyPrescriptionItem()])} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Plus className="w-4 h-4" />Adicionar</button>
                </div>
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
            )}

            {tabActive === "exames" && (
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" />Solicitacao de exames</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={imprimirSolicitacaoExames} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Printer className="w-4 h-4" />Imprimir</button>
                    <button onClick={() => baixarPdfAtendimento("exames")} disabled={!selecionado} className="text-sm px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50 flex items-center gap-1"><Download className="w-4 h-4" />Gerar PDF</button>
                    <button onClick={() => setField("exames", [...form.exames, emptyExam()])} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Plus className="w-4 h-4" />Exame</button>
                  </div>
                </div>
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
            )}

            {tabActive === "evolucao" && (
              <div className="bg-white border rounded-lg p-4 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-600" />Evolucao Clinica</h2>
                {form.evolucoes.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h3 className="font-medium text-sm text-gray-600">Historico de evolucoes</h3>
                    {form.evolucoes.map((evo) => (
                      <div key={evo.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-500">{formatDate(evo.data_evolucao)} - {evo.responsavel_nome}</span>
                        </div>
                        <p className="text-sm mt-1">{evo.descricao}</p>
                        {evo.sinais_vitais && <p className="text-xs text-gray-500 mt-1">Sinais vitais: {evo.sinais_vitais}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Nova evolucao</h3>
                  <textarea value={evolucaoForm.descricao} onChange={(e) => setEvolucaoForm({ ...evolucaoForm, descricao: e.target.value })} placeholder="Descricao da evolucao..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                  <textarea value={evolucaoForm.sinais_vitais} onChange={(e) => setEvolucaoForm({ ...evolucaoForm, sinais_vitais: e.target.value })} placeholder="Sinais vitais (opcional)..." rows={2} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                  <button onClick={async () => {
                    if (!selecionado || !evolucaoForm.descricao.trim()) return;
                    try {
                      await api.post(`/atendimentos/${selecionado}/evolucoes`, evolucaoForm);
                      setEvolucaoForm({ descricao: "", sinais_vitais: "" });
                      await abrirAtendimento(selecionado);
                      setSucesso("Evolucao registrada com sucesso.");
                    } catch { setErro("Erro ao registrar evolucao."); }
                  }} disabled={!selecionado || !evolucaoForm.descricao.trim()} className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />Registrar Evolucao</button>
                </div>
              </div>
            )}

            {tabActive === "anexos" && (
              <div className="bg-white border rounded-lg p-4 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Paperclip className="w-4 h-4 text-orange-600" />Anexos e Imagens</h2>
                {form.anexos.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                    {form.anexos.map((anexo) => (
                      <div key={anexo.id} className="border rounded-lg p-3 flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{anexo.nome_original || anexo.tipo}</p>
                          <p className="text-xs text-gray-500">{anexo.tipo}</p>
                        </div>
                        <button onClick={async () => {
                          try {
                            await api.delete(`/atendimentos/anexos/${anexo.id}`);
                            if (selecionado) await abrirAtendimento(selecionado);
                          } catch { setErro("Erro ao excluir anexo."); }
                        }} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Novo anexo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <select value={anexoForm.tipo} onChange={(e) => setAnexoForm({ ...anexoForm, tipo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                      <option value="imagem">Imagem</option>
                      <option value="radiografia">Radiografia</option>
                      <option value="ultrassom">Ultrassom</option>
                      <option value="documento">Documento</option>
                      <option value="outro">Outro</option>
                    </select>
                    <input value={anexoForm.descricao} onChange={(e) => setAnexoForm({ ...anexoForm, descricao: e.target.value })} placeholder="Descricao" className="px-3 py-2 border rounded-lg text-sm" />
                    <input value={anexoForm.url} onChange={(e) => setAnexoForm({ ...anexoForm, url: e.target.value })} placeholder="URL do arquivo" className="px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <button onClick={async () => {
                    if (!selecionado || !anexoForm.url.trim()) return;
                    try {
                      await api.post(`/atendimentos/${selecionado}/anexos`, { ...anexoForm, nome_original: anexoForm.url.split("/").pop() || "" });
                      setAnexoForm({ tipo: "imagem", descricao: "", url: "" });
                      await abrirAtendimento(selecionado);
                      setSucesso("Anexo adicionado com sucesso.");
                    } catch { setErro("Erro ao adicionar anexo."); }
                  }} disabled={!selecionado || !anexoForm.url.trim()} className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />Adicionar Anexo</button>
                </div>
              </div>
            )}
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
