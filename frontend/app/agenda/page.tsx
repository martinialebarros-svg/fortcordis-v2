"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { 
  Calendar, Clock, User, Building, Plus, RefreshCw, X, Trash2,
  CheckCircle2, PlayCircle, CheckCircle, XCircle, AlertCircle,
  Search, ChevronLeft, ChevronRight, Sun, Moon, FileText, Download, Stethoscope, Undo2
} from "lucide-react";
import NovoAgendamentoModal from "./NovoAgendamentoModal";

interface Agendamento {
  id: number;
  paciente_id?: number | null;
  clinica_id?: number | null;
  servico_id?: number | null;
  paciente: string | null;
  tutor: string | null;
  clinica: string | null;
  servico: string | null;
  inicio: string;
  fim: string | null;
  status: string;
  observacoes: string | null;
  telefone: string | null;
  data: string;
  hora: string;
}

interface LaudoVinculado {
  id: number;
  status: string;
  titulo: string;
}

interface OrdemServicoPagamento {
  os_id: number;
  numero_os: string;
}

interface ClinicaEndereco {
  id: number;
  nome?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

type StatusType = "Agendado" | "Confirmado" | "Em atendimento" | "Realizado" | "Cancelado" | "Faltou";
type ModoVisualizacao = "lista" | "panoramica-dia" | "panoramica-semana";

const STATUS_LIST: StatusType[] = ["Agendado", "Confirmado", "Em atendimento", "Realizado", "Cancelado", "Faltou"];

const toDateInput = (date: Date) => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const parseDateInput = (value: string) => {
  const [ano, mes, dia] = value.split("-").map(Number);
  if (!ano || !mes || !dia) {
    return new Date();
  }
  return new Date(ano, mes - 1, dia);
};

const toTimeInput = (date: Date) => {
  const hora = String(date.getHours()).padStart(2, "0");
  const minuto = String(date.getMinutes()).padStart(2, "0");
  return `${hora}:${minuto}`;
};

const parseApiDateTime = (value?: string | null): Date | null => {
  if (!value) return null;

  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, ano, mes, dia, hora, minuto, segundo = "0"] = match;
    const dataLocal = new Date(
      Number(ano),
      Number(mes) - 1,
      Number(dia),
      Number(hora),
      Number(minuto),
      Number(segundo),
      0
    );
    if (!Number.isNaN(dataLocal.getTime())) {
      return dataLocal;
    }
  }

  const normalizado = value.includes("T") ? value : value.replace(" ", "T");
  const data = new Date(normalizado);
  return Number.isNaN(data.getTime()) ? null : data;
};

const parseAgendamentoInicioLocal = (ag: Agendamento): Date | null => {
  if (ag.data && ag.hora) {
    const [ano, mes, dia] = String(ag.data).split("-").map(Number);
    const [hora, minuto] = String(ag.hora).split(":").map(Number);
    if (
      Number.isFinite(ano) &&
      Number.isFinite(mes) &&
      Number.isFinite(dia) &&
      Number.isFinite(hora) &&
      Number.isFinite(minuto)
    ) {
      const data = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
      if (!Number.isNaN(data.getTime())) {
        return data;
      }
    }
  }

  return parseApiDateTime(ag.inicio);
};

const parseAgendamentoFimLocal = (ag: Agendamento, inicioLocal: Date): Date => {
  const rawInicio = parseApiDateTime(ag.inicio);
  const rawFim = parseApiDateTime(ag.fim);

  if (rawInicio && rawFim && rawFim > rawInicio) {
    const duracaoMs = rawFim.getTime() - rawInicio.getTime();
    return new Date(inicioLocal.getTime() + duracaoMs);
  }

  if (rawFim && rawFim > inicioLocal) {
    return rawFim;
  }

  return new Date(inicioLocal.getTime() + 30 * 60000);
};

const inicioDaSemana = (value: string) => {
  const data = parseDateInput(value);
  const diaSemana = data.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + ajuste);
  return data;
};

const gerarSlots = (horaInicio = 7, horaFim = 20, intervaloMinutos = 30) => {
  const slots: string[] = [];
  const inicioTotal = horaInicio * 60;
  const fimTotal = horaFim * 60;
  for (let minutos = inicioTotal; minutos <= fimTotal; minutos += intervaloMinutos) {
    const hora = Math.floor(minutos / 60);
    const minuto = minutos % 60;
    slots.push(`${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`);
  }
  return slots;
};

const hojeLocal = () => {
  return toDateInput(new Date());
};

export default function AgendaPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>("lista");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroData, setFiltroData] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [slotSelecionado, setSlotSelecionado] = useState<{ data: string; hora: string } | null>(null);
  const [confirmando, setConfirmando] = useState<{ id: number; acao: string } | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState<number | null>(null);
  const [modalTipoHorario, setModalTipoHorario] = useState<{ id: number; status: StatusType } | null>(null);
  const [tipoHorario, setTipoHorario] = useState<"comercial" | "plantao">("comercial");
  const [osGerada, setOsGerada] = useState<{ numero_os: string; valor_final: number } | null>(null);
  const [laudosVinculados, setLaudosVinculados] = useState<Record<number, LaudoVinculado>>({});
  const [osPagasVinculadas, setOsPagasVinculadas] = useState<Record<number, OrdemServicoPagamento>>({});
  const [clinicasEndereco, setClinicasEndereco] = useState<Record<number, ClinicaEndereco>>({});
  const router = useRouter();

  const periodoConsulta = useMemo(() => {
    const dataBase = filtroData || hojeLocal();

    if (modoVisualizacao === "panoramica-semana") {
      const inicioSemana = inicioDaSemana(dataBase);
      const inicio = toDateInput(inicioSemana);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(fimSemana.getDate() + 6);
      const fim = toDateInput(fimSemana);
      return { inicio, fim };
    }

    if (modoVisualizacao === "panoramica-dia") {
      return { inicio: dataBase, fim: dataBase };
    }

    if (filtroData) {
      return { inicio: filtroData, fim: filtroData };
    }

    if (modoVisualizacao === "lista") {
      return { inicio: hojeLocal(), fim: "" };
    }

    return { inicio: "", fim: "" };
  }, [filtroData, modoVisualizacao]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarAgendamentos();
  }, [router, periodoConsulta.inicio, periodoConsulta.fim]);

  const carregarAgendamentos = async () => {
    setLoading(true);
    try {
      let url = "/agenda";
      if (periodoConsulta.inicio && periodoConsulta.fim) {
        url += `?data_inicio=${periodoConsulta.inicio}&data_fim=${periodoConsulta.fim}`;
      }
      const response = await api.get(url);
      const items = response.data.items || [];
      setAgendamentos(items);
      await Promise.all([
        carregarLaudosVinculados(items),
        carregarOsPagasVinculadas(items),
        carregarClinicasComEndereco(items),
      ]);
      setErro("");
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      if (error.response?.status === 401) {
        setErro("Sessão expirada. Redirecionando...");
        localStorage.removeItem("token");
        setTimeout(() => router.push("/"), 2000);
      } else {
        setErro("Erro ao carregar agendamentos");
      }
    } finally {
      setLoading(false);
    }
  };

  const carregarLaudosVinculados = async (items: Agendamento[]) => {
    const idsAgendamento = new Set(items.map((item) => item.id));
    if (idsAgendamento.size === 0) {
      setLaudosVinculados({});
      return;
    }

    try {
      const respLaudos = await api.get("/laudos?limit=1000");
      const listaLaudos = respLaudos.data?.items || [];

      const mapa: Record<number, LaudoVinculado> = {};
      for (const laudo of listaLaudos) {
        const agendamentoId = Number(laudo?.agendamento_id);
        if (!Number.isFinite(agendamentoId) || !idsAgendamento.has(agendamentoId)) {
          continue;
        }

        const anterior = mapa[agendamentoId];
        if (!anterior || Number(laudo.id) > anterior.id) {
          mapa[agendamentoId] = {
            id: Number(laudo.id),
            status: laudo.status || "",
            titulo: laudo.titulo || `Laudo ${laudo.id}`,
          };
        }
      }

      setLaudosVinculados(mapa);
    } catch (error) {
      console.error("Erro ao carregar laudos vinculados aos agendamentos:", error);
      setLaudosVinculados({});
    }
  };

  const carregarOsPagasVinculadas = async (items: Agendamento[]) => {
    const idsAgendamento = new Set(items.map((item) => item.id));
    if (idsAgendamento.size === 0) {
      setOsPagasVinculadas({});
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("status", "Pago");
      params.append("limit", "2000");

      if (periodoConsulta.inicio && periodoConsulta.fim) {
        params.append("data_inicio", periodoConsulta.inicio);
        params.append("data_fim", periodoConsulta.fim);
      }

      const respOs = await api.get(`/ordens-servico?${params.toString()}`);
      const listaOs = respOs.data?.items || [];

      const mapa: Record<number, OrdemServicoPagamento> = {};
      for (const os of listaOs) {
        const agendamentoId = Number(os?.agendamento_id);
        if (!Number.isFinite(agendamentoId) || !idsAgendamento.has(agendamentoId)) {
          continue;
        }

        const statusOs = String(os?.status || "").trim().toLowerCase();
        if (statusOs !== "pago") {
          continue;
        }

        const osId = Number(os?.id);
        if (!Number.isFinite(osId)) {
          continue;
        }

        const anterior = mapa[agendamentoId];
        if (!anterior || osId > anterior.os_id) {
          mapa[agendamentoId] = {
            os_id: osId,
            numero_os: String(os?.numero_os || ""),
          };
        }
      }

      setOsPagasVinculadas(mapa);
    } catch (error) {
      console.error("Erro ao carregar status de pagamento das OS:", error);
      setOsPagasVinculadas({});
    }
  };

  const carregarClinicasComEndereco = async (items: Agendamento[]) => {
    const idsClinica = Array.from(
      new Set(
        items
          .map((item) => Number(item.clinica_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );

    if (idsClinica.length === 0) {
      setClinicasEndereco({});
      return;
    }

    try {
      const respClinicas = await api.get("/clinicas?limit=1000");
      const listaClinicas = respClinicas.data?.items || [];

      const mapa: Record<number, ClinicaEndereco> = {};
      for (const clinica of listaClinicas) {
        const clinicaId = Number(clinica?.id);
        if (!Number.isFinite(clinicaId) || !idsClinica.includes(clinicaId)) {
          continue;
        }

        mapa[clinicaId] = {
          id: clinicaId,
          nome: clinica?.nome || null,
          endereco: clinica?.endereco || null,
          cidade: clinica?.cidade || null,
          estado: clinica?.estado || null,
          cep: clinica?.cep || null,
        };
      }

      setClinicasEndereco(mapa);
    } catch (error) {
      console.error("Erro ao carregar enderecos das clinicas:", error);
      setClinicasEndereco({});
    }
  };

  const montarEnderecoClinica = (clinica: ClinicaEndereco | null | undefined): string => {
    if (!clinica) return "";

    const partes = [
      String(clinica.endereco || "").trim(),
      String(clinica.cidade || "").trim(),
      String(clinica.estado || "").trim(),
      String(clinica.cep || "").trim(),
    ].filter((parte) => Boolean(parte));

    return partes.join(", ");
  };

  const abrirWazeParaClinica = (enderecoClinica: string, nomeClinica?: string | null) => {
    const destino = String(enderecoClinica || "").trim();
    if (!destino) {
      alert(`A clinica ${nomeClinica || ""} nao possui endereco cadastrado.`);
      return;
    }

    const query = encodeURIComponent(destino);
    const appUrl = `waze://?q=${query}&navigate=yes`;
    const webUrl = `https://waze.com/ul?q=${query}&navigate=yes`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

    if (isMobile) {
      const startedAt = Date.now();
      window.location.href = appUrl;

      window.setTimeout(() => {
        const elapsed = Date.now() - startedAt;
        const appProvavelmenteAberto = document.visibilityState === "hidden";
        if (!appProvavelmenteAberto && elapsed < 2200) {
          window.location.href = webUrl;
        }
      }, 1200);
      return;
    }

    window.open(webUrl, "_blank", "noopener,noreferrer");
  };

  const atualizarStatus = async (id: number, novoStatus: StatusType, tipoHorarioParam?: "comercial" | "plantao") => {
    // Se for Realizado, abre o modal de seleção de tipo de horário
    if (novoStatus === "Realizado" && !tipoHorarioParam) {
      setModalTipoHorario({ id, status: novoStatus });
      return;
    }

    setAtualizandoStatus(id);
    try {
      const params = new URLSearchParams();
      params.append("status", novoStatus);
      if (tipoHorarioParam) {
        params.append("tipo_horario", tipoHorarioParam);
      }
      
      const response = await api.patch(`/agenda/${id}/status?${params.toString()}`);
      await carregarAgendamentos();
      
      // Se gerou OS, mostra o modal
      if (response.data?.os_gerada) {
        setOsGerada(response.data.os_gerada);
      }
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      setErro("Erro ao atualizar status: " + (error.response?.data?.detail || error.message));
    } finally {
      setAtualizandoStatus(null);
    }
  };

  const confirmarRealizado = async () => {
    if (!modalTipoHorario) return;
    await atualizarStatus(modalTipoHorario.id, modalTipoHorario.status, tipoHorario);
    setModalTipoHorario(null);
  };

  const cancelarAgendamento = async (id: number) => {
    try {
      await api.patch(`/agenda/${id}/status?status=Cancelado`);
      setConfirmando(null);
      await carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao cancelar:", error);
      setErro("Erro ao cancelar agendamento");
    }
  };

  const excluirAgendamento = async (id: number) => {
    try {
      await api.delete(`/agenda/${id}`);
      setConfirmando(null);
      await carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      if (error.response?.status === 403) {
        setErro("Apenas administradores podem excluir agendamentos");
      } else {
        setErro("Erro ao excluir agendamento");
      }
    }
  };

  const abrirFluxoLaudo = (ag: Agendamento) => {
    const laudoVinculado = laudosVinculados[ag.id];
    if (laudoVinculado?.id) {
      router.push(`/laudos/${laudoVinculado.id}/editar`);
      return;
    }
    router.push(`/laudos/novo?agendamento_id=${ag.id}`);
  };

  const abrirFluxoAtendimento = (ag: Agendamento) => {
    router.push(`/atendimento?agendamento_id=${ag.id}`);
  };

  const podeBaixarLaudo = (status?: string) => {
    const statusNormalizado = (status || "").trim().toLowerCase();
    return statusNormalizado === "finalizado" || statusNormalizado === "arquivado";
  };

  const baixarLaudoPdf = async (ag: Agendamento) => {
    const laudoVinculado = laudosVinculados[ag.id];
    if (!laudoVinculado?.id) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/laudos/${laudoVinculado.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Falha ao gerar PDF");
      }

      let filename = `laudo_agendamento_${ag.id}.pdf`;
      const contentDisposition = response.headers.get("content-disposition");
      const match = contentDisposition?.match(/filename="?([^";\s]+)"?/);
      if (match?.[1]) {
        filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar PDF do laudo:", error);
      alert("Nao foi possivel baixar o laudo agora.");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Agendado': 'bg-blue-100 text-blue-800 border-blue-200',
      'Confirmado': 'bg-green-100 text-green-800 border-green-200',
      'Em atendimento': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Realizado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Cancelado': 'bg-red-100 text-red-800 border-red-200',
      'Faltou': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      'Agendado': Calendar,
      'Confirmado': CheckCircle2,
      'Em atendimento': PlayCircle,
      'Realizado': CheckCircle,
      'Cancelado': XCircle,
      'Faltou': AlertCircle,
    };
    return icons[status] || Calendar;
  };

  const getProximosStatus = (statusAtual: string): StatusType[] => {
    const fluxos: Record<string, StatusType[]> = {
      'Agendado': ['Confirmado', 'Cancelado', 'Faltou'],
      'Confirmado': ['Em atendimento', 'Cancelado', 'Faltou'],
      'Em atendimento': ['Realizado', 'Cancelado'],
      'Realizado': ['Em atendimento'],
      'Cancelado': ['Agendado'],
      'Faltou': ['Agendado'],
    };
    return fluxos[statusAtual] || [];
  };

  const getOrdenacaoTimestamp = (ag: Agendamento) => {
    const inicioLocal = parseAgendamentoInicioLocal(ag);
    if (inicioLocal) return inicioLocal.getTime();
    return Number.MAX_SAFE_INTEGER;
  };

  const agendamentosFiltrados = [...agendamentos]
    .filter((a) => {
      const matchStatus = filtroStatus === "todos" || a.status === filtroStatus;
      const termo = busca.toLowerCase();
      const matchBusca = !busca ||
        (a.paciente?.toLowerCase().includes(termo)) ||
        (a.tutor?.toLowerCase().includes(termo)) ||
        (a.clinica?.toLowerCase().includes(termo)) ||
        (a.servico?.toLowerCase().includes(termo));
      return matchStatus && matchBusca;
    })
    .sort((a, b) => {
      const diff = getOrdenacaoTimestamp(a) - getOrdenacaoTimestamp(b);
      if (diff !== 0) return diff;
      return a.id - b.id;
    });

  const slotsPanoramica = useMemo(() => gerarSlots(), []);

  const diasPanoramica = useMemo(() => {
    const dataBase = filtroData || hojeLocal();

    if (modoVisualizacao === "panoramica-semana") {
      const inicioSemana = inicioDaSemana(dataBase);
      return Array.from({ length: 7 }, (_, idx) => {
        const data = new Date(inicioSemana);
        data.setDate(inicioSemana.getDate() + idx);
        return toDateInput(data);
      });
    }

    return [dataBase];
  }, [filtroData, modoVisualizacao]);

  const mapaOcupacao = useMemo(() => {
    const mapa = new Map<string, Agendamento[]>();

    for (const ag of agendamentosFiltrados) {
      // Cancelado não deve ocupar slot na panorâmica.
      if ((ag.status || "").trim().toLowerCase() === "cancelado") continue;

      const inicio = parseAgendamentoInicioLocal(ag);
      if (!inicio) continue;

      const fim = parseAgendamentoFimLocal(ag, inicio);

      const cursor = new Date(inicio);
      cursor.setSeconds(0, 0);
      cursor.setMinutes(Math.floor(cursor.getMinutes() / 30) * 30);

      while (cursor < fim) {
        const chave = `${toDateInput(cursor)}|${toTimeInput(cursor)}`;
        const existentes = mapa.get(chave) || [];
        existentes.push(ag);
        mapa.set(chave, existentes);
        cursor.setMinutes(cursor.getMinutes() + 30);
      }
    }

    return mapa;
  }, [agendamentosFiltrados]);

  const formatarDiaPanoramica = (data: string) => {
    const dt = parseDateInput(data);
    return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  const abrirNovoNoHorario = (data: string, hora: string) => {
    setAgendamentoEditando(null);
    setSlotSelecionado({ data, hora });
    setModalAberto(true);
  };

  const stats = {
    total: agendamentos.length,
    agendado: agendamentos.filter(a => a.status === 'Agendado').length,
    confirmado: agendamentos.filter(a => a.status === 'Confirmado').length,
    emAtendimento: agendamentos.filter(a => a.status === 'Em atendimento').length,
    realizado: agendamentos.filter(a => a.status === 'Realizado').length,
    cancelado: agendamentos.filter(a => a.status === 'Cancelado').length,
  };

  const formatarDataHora = (dataIso: string) => {
    if (!dataIso) return "-";
    const normalizado = dataIso.includes("T") ? dataIso : dataIso.replace(" ", "T");
    const data = new Date(normalizado);
    if (Number.isNaN(data.getTime())) {
      return dataIso;
    }
    return data.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const navegarData = (dias: number) => {
    const data = parseDateInput(filtroData);
    data.setDate(data.getDate() + dias);
    setFiltroData(toDateInput(data));
  };

  const formatarDataHoraAgendamento = (ag: Agendamento) => {
    if (ag.data && ag.hora) {
      const [ano, mes, dia] = String(ag.data).split("-");
      const hora = String(ag.hora).slice(0, 5);
      if (ano && mes && dia && hora) {
        return `${dia}/${mes}, ${hora}`;
      }
    }
    return formatarDataHora(ag.inicio);
  };

  const handleAgendamentoSuccess = async (agendamentoCriado?: { data?: string | null }) => {
    setSlotSelecionado(null);
    const dataCriada = agendamentoCriado?.data || "";
    if (dataCriada && dataCriada !== filtroData) {
      setFiltroData(dataCriada);
      return;
    }
    await carregarAgendamentos();
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-500">Gerencie os agendamentos</p>
          </div>
          <button
            onClick={() => {
              setAgendamentoEditando(null);
              setSlotSelecionado(null);
              setModalAberto(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{stats.agendado}</div>
            <div className="text-xs text-gray-500">Agendados</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-green-600">{stats.confirmado}</div>
            <div className="text-xs text-gray-500">Confirmados</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-yellow-600">{stats.emAtendimento}</div>
            <div className="text-xs text-gray-500">Em Atend.</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-emerald-600">{stats.realizado}</div>
            <div className="text-xs text-gray-500">Realizados</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-red-600">{stats.cancelado}</div>
            <div className="text-xs text-gray-500">Cancelados</div>
          </div>
        </div>

        {/* Filtros */}
        {erro && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex justify-between items-center">
            <span>{erro}</span>
            <button onClick={() => setErro("")} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setModoVisualizacao("lista")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${modoVisualizacao === "lista" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                Lista
              </button>
              <button
                onClick={() => setModoVisualizacao("panoramica-dia")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${modoVisualizacao === "panoramica-dia" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                Panoramica Dia
              </button>
              <button
                onClick={() => setModoVisualizacao("panoramica-semana")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${modoVisualizacao === "panoramica-semana" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                Panoramica Semana
              </button>
            </div>
            {/* Navegação de data */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navegarData(modoVisualizacao === "panoramica-semana" ? -7 : -1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onClick={() => navegarData(modoVisualizacao === "panoramica-semana" ? 7 : 1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar paciente, tutor ou serviço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro status */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os status</option>
              {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={carregarAgendamentos}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* Chips de status */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {STATUS_LIST.map((status) => {
              const count = agendamentos.filter(a => a.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setFiltroStatus(filtroStatus === status ? "todos" : status)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                    filtroStatus === status
                      ? getStatusColor(status)
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {status} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {modoVisualizacao === "lista" ? (
        <div className="bg-white shadow rounded-lg overflow-hidden border">
          {agendamentosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {busca ? "Nenhum agendamento encontrado para a busca" : "Nenhum agendamento para esta data"}
              </p>
              <button
                onClick={() => { setAgendamentoEditando(null); setSlotSelecionado(null); setModalAberto(true); }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Agendamento
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {agendamentosFiltrados.map((ag) => {
                const StatusIcon = getStatusIcon(ag.status);
                const proximosStatus = getProximosStatus(ag.status);
                const laudoVinculado = laudosVinculados[ag.id];
                const laudoPronto = podeBaixarLaudo(laudoVinculado?.status);
                const osPaga = osPagasVinculadas[ag.id];
                const clinicaComEndereco = ag.clinica_id ? clinicasEndereco[ag.clinica_id] : undefined;
                const enderecoClinica = montarEnderecoClinica(clinicaComEndereco);
                const podeAbrirWaze = Boolean(enderecoClinica);
                
                return (
                  <div key={ag.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                      {/* Info Principal */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Building className="w-4 h-4 text-gray-400" />
                            {ag.clinica || "Clinica nao informada"}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(ag.status)}`}>
                            <StatusIcon className="w-3 h-3" />
                            {ag.status}
                          </span>
                          {osPaga && (
                            <span
                              className="px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                              title={osPaga.numero_os ? `OS ${osPaga.numero_os} ja recebida no financeiro` : "OS recebida no financeiro"}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Pago
                            </span>
                          )}
                        </div>

                        <div className="text-base font-semibold text-gray-900 mb-2">
                          {ag.paciente || "Animal nao informado"}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{ag.tutor || "Tutor nao informado"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{formatarDataHoraAgendamento(ag)}</span>
                          </div>
                          {ag.servico && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">{ag.servico}</span>
                            </div>
                          )}
                        </div>

                        {ag.observacoes && (
                          <div className="mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                            <span className="font-medium">Obs:</span> {ag.observacoes}
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {/* Botões de mudança de status */}
                        {proximosStatus.map((novoStatus) => {
                          const desfazerRealizado = ag.status === 'Realizado' && novoStatus === 'Em atendimento';
                          const icons: Record<string, any> = {
                            'Confirmado': CheckCircle2,
                            'Em atendimento': PlayCircle,
                            'Realizado': CheckCircle,
                            'Cancelado': XCircle,
                            'Faltou': AlertCircle,
                            'Agendado': Calendar,
                          };
                          const Icon = desfazerRealizado ? Undo2 : (icons[novoStatus] || CheckCircle2);
                          const colors: Record<string, string> = {
                            'Confirmado': 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
                            'Em atendimento': 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200',
                            'Realizado': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
                            'Cancelado': 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
                            'Faltou': 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
                            'Agendado': 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
                          };
                          const actionLabel = desfazerRealizado ? "Desfazer realizado" : novoStatus;
                          const actionColor = desfazerRealizado
                            ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200'
                            : colors[novoStatus];
                          
                          return (
                            <button
                              key={novoStatus}
                              onClick={() => atualizarStatus(ag.id, novoStatus)}
                              disabled={atualizandoStatus === ag.id}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${actionColor}`}
                            >
                              {atualizandoStatus === ag.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Icon className="w-3.5 h-3.5" />
                              )}
                              {actionLabel}
                            </button>
                          );
                        })}

                        {/* Separador */}
                        {proximosStatus.length > 0 && <div className="w-px h-8 bg-gray-300 mx-1" />}

                        {/* Editar */}
                        <button
                          onClick={() => { setAgendamentoEditando(ag); setSlotSelecionado(null); setModalAberto(true); }}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => abrirFluxoAtendimento(ag)}
                          className="px-3 py-1.5 text-sm text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1"
                          title="Abrir atendimento clinico para este agendamento"
                        >
                          <Stethoscope className="w-4 h-4" />
                          Atender
                        </button>

                        <button
                          onClick={() => abrirWazeParaClinica(enderecoClinica, ag.clinica)}
                          disabled={!podeAbrirWaze}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                            podeAbrirWaze
                              ? "text-sky-700 hover:text-sky-900 hover:bg-sky-50"
                              : "text-gray-400 bg-gray-50 cursor-not-allowed"
                          }`}
                          title={
                            podeAbrirWaze
                              ? `Abrir Waze para ${ag.clinica || "clinica"}`
                              : "Clinica sem endereco cadastrado"
                          }
                        >
                          <img
                            src="/icons/waze.svg"
                            alt="Waze"
                            className="h-[19.4px] w-[19.4px] rounded-sm object-contain"
                            loading="lazy"
                          />
                          Waze
                        </button>

                        <button
                          onClick={() => abrirFluxoLaudo(ag)}
                          className="px-3 py-1.5 text-sm text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1"
                          title={laudoVinculado ? "Abrir laudo vinculado" : "Criar laudo para este agendamento"}
                        >
                          <FileText className="w-4 h-4" />
                          Laudar
                        </button>

                        {laudoVinculado && laudoPronto && (
                          <button
                            onClick={() => baixarLaudoPdf(ag)}
                            className="px-3 py-1.5 text-sm text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1"
                            title={`Baixar ${laudoVinculado.titulo}`}
                          >
                            <Download className="w-4 h-4" />
                            Baixar laudo
                          </button>
                        )}

                        {/* Excluir */}
                        <button
                          onClick={() => setConfirmando({ id: ag.id, acao: "excluir" })}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden border">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-700 font-medium">
              {modoVisualizacao === "panoramica-semana"
                ? `Semana de ${formatarDiaPanoramica(diasPanoramica[0])} até ${formatarDiaPanoramica(diasPanoramica[diasPanoramica.length - 1])}`
                : `Dia ${formatarDiaPanoramica(diasPanoramica[0])}`}
            </div>
            <div className="text-xs text-gray-500">
              Clique em um horário livre para agendar
            </div>
          </div>

          <div className="overflow-auto">
            <div
              className="grid min-w-[860px]"
              style={{ gridTemplateColumns: `80px repeat(${diasPanoramica.length}, minmax(180px, 1fr))` }}
            >
              <div className="sticky top-0 z-20 bg-gray-100 border-b border-r px-2 py-2 text-xs font-semibold text-gray-600">
                Hora
              </div>
              {diasPanoramica.map((dia) => (
                <div
                  key={`head-${dia}`}
                  className="sticky top-0 z-10 bg-gray-100 border-b border-r px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  {formatarDiaPanoramica(dia)}
                </div>
              ))}

              {slotsPanoramica.map((slot) => (
                <Fragment key={`row-${slot}`}>
                  <div
                    key={`hora-${slot}`}
                    className="border-b border-r px-2 py-3 text-xs font-medium text-gray-500 bg-gray-50"
                  >
                    {slot}
                  </div>
                  {diasPanoramica.map((dia) => {
                    const chave = `${dia}|${slot}`;
                    const itens = mapaOcupacao.get(chave) || [];

                    if (itens.length === 0) {
                      return (
                        <button
                          key={chave}
                          onClick={() => abrirNovoNoHorario(dia, slot)}
                          className="border-b border-r px-2 py-2 text-left bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          <div className="text-xs font-semibold text-emerald-700">Livre</div>
                          <div className="text-[11px] text-emerald-600">Clique para agendar</div>
                        </button>
                      );
                    }

                    const primeiro = itens[0];
                    return (
                      <button
                        key={chave}
                        onClick={() => { setAgendamentoEditando(primeiro); setSlotSelecionado(null); setModalAberto(true); }}
                        className="border-b border-r px-2 py-2 text-left bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <div className="text-xs font-bold text-red-800 truncate">
                          {primeiro.clinica || "Clinica nao informada"}
                        </div>
                        <div className="text-[11px] text-red-600 truncate">
                          {primeiro.paciente || "Animal nao informado"}
                        </div>
                        <div className="text-[11px] text-red-600 truncate">
                          Tutor: {primeiro.tutor || "Nao informado"}
                        </div>
                        {primeiro.servico && (
                          <div className="text-[11px] text-red-500 truncate">
                            {primeiro.servico}
                          </div>
                        )}
                        {itens.length > 1 && (
                          <div className="text-[11px] text-red-500 font-medium">
                            +{itens.length - 1} no mesmo slot
                          </div>
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Modal de Confirmação */}
        {confirmando && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {confirmando.acao === "excluir" ? "Excluir Agendamento" : "Confirmar Ação"}
              </h3>
              <p className="text-gray-600 mb-6">
                {confirmando.acao === "excluir"
                  ? "Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."
                  : "Tem certeza que deseja realizar esta ação?"}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmando(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (confirmando.acao === "excluir") {
                      excluirAgendamento(confirmando.id);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Seleção de Tipo de Horário */}
        {modalTipoHorario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Selecionar Tipo de Horário
              </h3>
              <p className="text-gray-600 mb-6">
                Este atendimento foi realizado em qual tipo de horário? Isso afetará o valor calculado na Ordem de Serviço.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setTipoHorario("comercial")}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    tipoHorario === "comercial" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <Sun className="w-8 h-8 text-amber-500" />
                  <span className="font-medium text-gray-900">Comercial</span>
                  <span className="text-xs text-gray-500">Seg-Sex 8h-18h</span>
                </button>
                
                <button
                  onClick={() => setTipoHorario("plantao")}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    tipoHorario === "plantao" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <Moon className="w-8 h-8 text-indigo-500" />
                  <span className="font-medium text-gray-900">Plantão</span>
                  <span className="text-xs text-gray-500">Fora do horário</span>
                </button>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setModalTipoHorario(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRealizado}
                  disabled={atualizandoStatus !== null}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                  {atualizandoStatus === modalTipoHorario.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Confirmar Realizado
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de OS Gerada */}
        {osGerada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Ordem de Serviço Gerada!
                  </h3>
                  <p className="text-sm text-gray-500">Nº {osGerada.numero_os}</p>
                </div>
              </div>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-emerald-800">
                  <span className="font-medium">Valor Final:</span>{" "}
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(osGerada.valor_final)}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  Baseado na tabela de preços da clínica e tipo de horário selecionado.
                </p>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setOsGerada(null)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        <NovoAgendamentoModal
          isOpen={modalAberto}
          agendamento={agendamentoEditando}
          onClose={() => { setModalAberto(false); setAgendamentoEditando(null); setSlotSelecionado(null); }}
          onSuccess={handleAgendamentoSuccess}
          defaultDate={slotSelecionado?.data || filtroData || hojeLocal()}
          defaultTime={slotSelecionado?.hora}
        />
      </div>
    </DashboardLayout>
  );
}
