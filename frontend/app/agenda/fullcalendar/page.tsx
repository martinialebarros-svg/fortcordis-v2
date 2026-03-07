"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import { CalendarDays, Download, FileText, RefreshCw, Stethoscope, Trash2, Wallet } from "lucide-react";

import DashboardLayout from "../../layout-dashboard";
import NovoAgendamentoModal from "../NovoAgendamentoModal";
import api from "@/lib/axios";
import { montarToastAgendaRealtime } from "@/lib/agenda-realtime-toast";
import { useAgendaRealtime, type AgendaRealtimePayload } from "@/lib/useAgendaRealtime";
import {
  AgendaExcecaoConfig,
  AgendaFeriadoConfig,
  AgendaSemanalConfig,
  DEFAULT_AGENDA_SEMANAL,
  horarioParaMinutos,
  normalizarAgendaExcecoes,
  normalizarAgendaFeriados,
  normalizarAgendaSemanal,
  obterJornadaDia,
  validarHorarioAgendamento,
} from "@/lib/agenda-config";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });

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

interface IntervaloConsulta {
  inicio: string;
  fim: string;
}

interface SlotSelecionado {
  data: string;
  hora: string;
}

type StatusAgenda =
  | "Agendado"
  | "Reservado"
  | "Confirmado"
  | "Em atendimento"
  | "Realizado"
  | "Cancelado"
  | "Faltou";

interface StatusVisual {
  bg: string;
  border: string;
  text: string;
}

interface AtualizacaoHorarioArgs {
  id: number;
  inicio: Date;
  fim: Date;
  revert: () => void;
}

interface AcaoStatus {
  label: string;
  status: StatusAgenda;
  danger?: boolean;
  precisaTipoHorario?: boolean;
}

interface ServicoAgenda {
  id: number;
  duracao_minutos?: number | null;
}

interface ClinicaEndereco {
  id: number;
  nome?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface OrdemServicoResumo {
  id: number;
  agendamento_id: number;
  numero_os: string;
  status: string;
  valor_final: number;
}

interface LaudoVinculado {
  id: number;
  status: string;
  titulo: string;
}

interface ToastRealtimeData {
  texto: string;
  classe: string;
  agendamentoId?: number;
}

type OpcaoRecorrencia = "apenas_este" | "cada_7_dias" | "seg_a_sex" | "todos_os_dias";

interface MovimentacaoPendente {
  origem: "movimentacao" | "edicao";
  id: number;
  inicioNovo: Date;
  fimNovo: Date;
  inicioOriginal: Date;
  fimOriginal: Date;
  revert: () => void;
}

const FORMAS_PAGAMENTO = [
  { id: "dinheiro", nome: "Dinheiro" },
  { id: "cartao_credito", nome: "Cartao de credito" },
  { id: "cartao_debito", nome: "Cartao de debito" },
  { id: "pix", nome: "PIX" },
  { id: "boleto", nome: "Boleto" },
  { id: "transferencia", nome: "Transferencia" },
];

const OPCOES_RECORRENCIA: Array<{ id: OpcaoRecorrencia; label: string; descricao: string }> = [
  { id: "apenas_este", label: "Apenas este", descricao: "Atualiza somente este agendamento." },
  { id: "cada_7_dias", label: "A cada 7 dias", descricao: "Replica semanalmente ate a data limite." },
  { id: "seg_a_sex", label: "Seg a sex", descricao: "Replica de segunda a sexta ate a data limite." },
  { id: "todos_os_dias", label: "Todos os dias", descricao: "Replica diariamente ate a data limite." },
];

const STATUS_CORES: Record<string, StatusVisual> = {
  Agendado: { bg: "#dbeafe", border: "#60a5fa", text: "#1e3a8a" },
  Reservado: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  Confirmado: { bg: "#dcfce7", border: "#4ade80", text: "#14532d" },
  "Em atendimento": { bg: "#fef9c3", border: "#facc15", text: "#713f12" },
  Realizado: { bg: "#d1fae5", border: "#34d399", text: "#064e3b" },
  Cancelado: { bg: "#fee2e2", border: "#f87171", text: "#7f1d1d" },
  Faltou: { bg: "#ffedd5", border: "#fb923c", text: "#7c2d12" },
};

const STATUS_FILTRO = [
  "todos",
  "Agendado",
  "Reservado",
  "Confirmado",
  "Em atendimento",
  "Realizado",
  "Cancelado",
  "Faltou",
];

const ACOES_STATUS: AcaoStatus[] = [
  { label: "Agendar", status: "Agendado" },
  { label: "Reservar", status: "Reservado" },
  { label: "Confirmar", status: "Confirmado" },
  { label: "Iniciar Atendimento", status: "Em atendimento" },
  { label: "Finalizar Atendimento", status: "Realizado", precisaTipoHorario: true },
  { label: "Marcar Falta", status: "Faltou", danger: true },
  { label: "Cancelar", status: "Cancelado", danger: true },
];

const toDateInput = (date: Date) => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const toTimeInput = (date: Date) => {
  const hora = String(date.getHours()).padStart(2, "0");
  const minuto = String(date.getMinutes()).padStart(2, "0");
  return `${hora}:${minuto}`;
};

const toApiDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const calcularMdc = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const resto = x % y;
    x = y;
    y = resto;
  }
  return x || 1;
};

const minutosParaDuracao = (minutos: number): string => {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
};

const minutosParaHoraComSegundos = (minutos: number): string => {
  const normalizado = Math.max(0, Math.min(24 * 60, Math.round(minutos)));
  const horas = Math.floor(normalizado / 60);
  const mins = normalizado % 60;
  return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
};

const adicionarDias = (data: Date, dias: number): Date => {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

const combinarDataComHorario = (dataBase: Date, modeloHorario: Date): Date => {
  return new Date(
    dataBase.getFullYear(),
    dataBase.getMonth(),
    dataBase.getDate(),
    modeloHorario.getHours(),
    modeloHorario.getMinutes(),
    modeloHorario.getSeconds(),
    modeloHorario.getMilliseconds()
  );
};

const parseApiDateTime = (value?: string | null): Date | null => {
  if (!value) return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
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

const parseInicioLocal = (ag: Agendamento): Date | null => {
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

const parseFimLocal = (ag: Agendamento, inicioLocal: Date): Date => {
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

const formatarDataHora = (ag: Agendamento) => {
  const inicio = parseInicioLocal(ag);
  if (!inicio) return "Horario invalido";
  const fim = parseFimLocal(ag, inicio);
  const data = inicio.toLocaleDateString("pt-BR");
  const horaInicio = inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const horaFim = fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} ${horaInicio} - ${horaFim}`;
};

export default function AgendaFullCalendarPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [intervalo, setIntervalo] = useState<IntervaloConsulta | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clinicasEndereco, setClinicasEndereco] = useState<Record<number, ClinicaEndereco>>({});
  const [ordensServicoPorAgendamento, setOrdensServicoPorAgendamento] = useState<Record<number, OrdemServicoResumo>>(
    {}
  );
  const [laudosVinculados, setLaudosVinculados] = useState<Record<number, LaudoVinculado>>({});
  const [loading, setLoading] = useState(false);
  const [atualizandoStatusId, setAtualizandoStatusId] = useState<number | null>(null);
  const [recebendoPagamentoId, setRecebendoPagamentoId] = useState<number | null>(null);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [excluindoAgendamentoId, setExcluindoAgendamentoId] = useState<number | null>(null);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [salvandoAgendaDia, setSalvandoAgendaDia] = useState(false);
  const [duracaoSlotMinutos, setDuracaoSlotMinutos] = useState(30);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [mensagemStatus, setMensagemStatus] = useState("");
  const [dataControleAgenda, setDataControleAgenda] = useState(() => toDateInput(new Date()));
  const [modalRecorrenciaAberto, setModalRecorrenciaAberto] = useState(false);
  const [movimentacaoPendente, setMovimentacaoPendente] = useState<MovimentacaoPendente | null>(null);
  const [opcaoRecorrencia, setOpcaoRecorrencia] = useState<OpcaoRecorrencia>("apenas_este");
  const [dataLimiteRecorrencia, setDataLimiteRecorrencia] = useState(() => toDateInput(adicionarDias(new Date(), 30)));
  const [aplicandoRecorrencia, setAplicandoRecorrencia] = useState(false);
  const [menuStatusAberto, setMenuStatusAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalTipoHorario, setModalTipoHorario] = useState<{ id: number; status: StatusAgenda } | null>(null);
  const [tipoHorario, setTipoHorario] = useState<"comercial" | "plantao">("comercial");
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [slotSelecionado, setSlotSelecionado] = useState<SlotSelecionado | null>(null);
  const [agendaSemanal, setAgendaSemanal] = useState<AgendaSemanalConfig>(() =>
    normalizarAgendaSemanal(DEFAULT_AGENDA_SEMANAL)
  );
  const [agendaFeriados, setAgendaFeriados] = useState<AgendaFeriadoConfig[]>([]);
  const [agendaExcecoes, setAgendaExcecoes] = useState<AgendaExcecaoConfig[]>([]);
  const [mensagemRealtime, setMensagemRealtime] = useState("");
  const [toastRealtime, setToastRealtime] = useState<ToastRealtimeData | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRealtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const duracaoSlot = useMemo(() => minutosParaDuracao(duracaoSlotMinutos), [duracaoSlotMinutos]);
  const osSelecionada = useMemo(() => {
    if (!selecionado) return null;
    return ordensServicoPorAgendamento[selecionado.id] || null;
  }, [ordensServicoPorAgendamento, selecionado]);
  const laudoSelecionado = useMemo(() => {
    if (!selecionado) return null;
    return laudosVinculados[selecionado.id] || null;
  }, [laudosVinculados, selecionado]);
  const jornadaDataControle = useMemo(
    () => obterJornadaDia(dataControleAgenda, agendaSemanal, agendaFeriados, agendaExcecoes),
    [agendaExcecoes, agendaFeriados, agendaSemanal, dataControleAgenda]
  );
  const excecaoDataControle = useMemo(
    () => agendaExcecoes.find((item) => item.data === dataControleAgenda) || null,
    [agendaExcecoes, dataControleAgenda]
  );
  const slotMinTime = useMemo(() => {
    const inicios = Object.values(agendaSemanal)
      .filter((dia) => dia.ativo)
      .map((dia) => horarioParaMinutos(dia.inicio))
      .filter((valor): valor is number => valor !== null);
    const menor = inicios.length > 0 ? Math.min(...inicios) : 6 * 60;
    return minutosParaHoraComSegundos(menor);
  }, [agendaSemanal]);
  const slotMaxTime = useMemo(() => {
    const fins = Object.values(agendaSemanal)
      .filter((dia) => dia.ativo)
      .map((dia) => horarioParaMinutos(dia.fim))
      .filter((valor): valor is number => valor !== null);
    const maior = fins.length > 0 ? Math.max(...fins) : 22 * 60;
    return minutosParaHoraComSegundos(maior);
  }, [agendaSemanal]);
  const businessHours = useMemo(() => {
    return (Object.entries(agendaSemanal) as Array<[string, { ativo: boolean; inicio: string; fim: string }]>)
      .filter(([, dia]) => dia.ativo)
      .map(([dia, configDia]) => ({
        daysOfWeek: [dia === "7" ? 0 : Number(dia)],
        startTime: `${configDia.inicio}:00`,
        endTime: `${configDia.fim}:00`,
      }));
  }, [agendaSemanal]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      if (toastRealtimeTimeoutRef.current) {
        clearTimeout(toastRealtimeTimeoutRef.current);
        toastRealtimeTimeoutRef.current = null;
      }
    };
  }, []);

  const montarEnderecoClinica = useCallback((clinica: ClinicaEndereco | null | undefined): string => {
    if (!clinica) return "";

    const partes = [
      String(clinica.endereco || "").trim(),
      String(clinica.cidade || "").trim(),
      String(clinica.estado || "").trim(),
      String(clinica.cep || "").trim(),
    ].filter((parte) => Boolean(parte));

    return partes.join(", ");
  }, []);

  const montarWazeWebUrl = useCallback((enderecoClinica: string): string => {
    const destino = String(enderecoClinica || "").trim();
    if (!destino) return "";
    return `https://waze.com/ul?q=${encodeURIComponent(destino)}&navigate=yes`;
  }, []);

  const wazeSelecionadoUrl = useMemo(() => {
    if (!selecionado) return "";
    const clinica = clinicasEndereco[Number(selecionado.clinica_id)];
    const endereco = montarEnderecoClinica(clinica);
    return montarWazeWebUrl(endereco);
  }, [clinicasEndereco, montarEnderecoClinica, montarWazeWebUrl, selecionado]);

  const carregarClinicasComEndereco = useCallback(async (items: Agendamento[]) => {
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
      const listaClinicas = Array.isArray(respClinicas.data?.items) ? respClinicas.data.items : [];

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
      console.error("Erro ao carregar enderecos de clinicas no FullCalendar:", error);
      setClinicasEndereco({});
    }
  }, []);

  const carregarOrdensServicoVinculadas = useCallback(
    async (items: Agendamento[], periodo: IntervaloConsulta) => {
      const idsAgendamento = new Set(items.map((item) => item.id));
      if (idsAgendamento.size === 0) {
        setOrdensServicoPorAgendamento({});
        return;
      }

      try {
        const params = new URLSearchParams();
        params.append("limit", "2000");
        if (periodo.inicio && periodo.fim) {
          params.append("data_inicio", periodo.inicio);
          params.append("data_fim", periodo.fim);
        }

        const response = await api.get(`/ordens-servico?${params.toString()}`);
        const listaOs = Array.isArray(response.data?.items) ? response.data.items : [];

        const mapa: Record<number, OrdemServicoResumo> = {};
        for (const os of listaOs) {
          const agendamentoId = Number(os?.agendamento_id);
          if (!Number.isFinite(agendamentoId) || !idsAgendamento.has(agendamentoId)) {
            continue;
          }

          const statusOs = String(os?.status || "").trim();
          if (statusOs === "Cancelado") {
            continue;
          }

          const osId = Number(os?.id);
          if (!Number.isFinite(osId)) {
            continue;
          }

          const anterior = mapa[agendamentoId];
          if (!anterior || osId > anterior.id) {
            mapa[agendamentoId] = {
              id: osId,
              agendamento_id: agendamentoId,
              numero_os: String(os?.numero_os || ""),
              status: statusOs || "Pendente",
              valor_final: Number(os?.valor_final || 0),
            };
          }
        }

        setOrdensServicoPorAgendamento(mapa);
      } catch (error) {
        console.error("Erro ao carregar OS vinculadas no FullCalendar:", error);
        setOrdensServicoPorAgendamento({});
      }
    },
    []
  );

  const carregarLaudosVinculados = useCallback(async (items: Agendamento[]) => {
    const idsAgendamento = new Set(items.map((item) => item.id));
    if (idsAgendamento.size === 0) {
      setLaudosVinculados({});
      return;
    }

    try {
      const response = await api.get("/laudos?limit=1000");
      const listaLaudos = Array.isArray(response.data?.items) ? response.data.items : [];

      const mapa: Record<number, LaudoVinculado> = {};
      for (const laudo of listaLaudos) {
        const agendamentoId = Number(laudo?.agendamento_id);
        if (!Number.isFinite(agendamentoId) || !idsAgendamento.has(agendamentoId)) {
          continue;
        }

        const laudoId = Number(laudo?.id);
        if (!Number.isFinite(laudoId)) {
          continue;
        }

        const anterior = mapa[agendamentoId];
        if (!anterior || laudoId > anterior.id) {
          mapa[agendamentoId] = {
            id: laudoId,
            status: String(laudo?.status || ""),
            titulo: String(laudo?.titulo || `Laudo ${laudoId}`),
          };
        }
      }

      setLaudosVinculados(mapa);
    } catch (error) {
      console.error("Erro ao carregar laudos vinculados no FullCalendar:", error);
      setLaudosVinculados({});
    }
  }, []);

  const carregarAgendamentos = useCallback(async (periodo: IntervaloConsulta) => {
    setLoading(true);
    try {
      const response = await api.get(`/agenda?data_inicio=${periodo.inicio}&data_fim=${periodo.fim}`);
      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      setAgendamentos(items);
      await Promise.all([
        carregarClinicasComEndereco(items),
        carregarOrdensServicoVinculadas(items, periodo),
        carregarLaudosVinculados(items),
      ]);
      setErro("");
    } catch (error) {
      console.error("Erro ao carregar agenda FullCalendar:", error);
      setErro("Nao foi possivel carregar os agendamentos neste periodo.");
    } finally {
      setLoading(false);
    }
  }, [carregarClinicasComEndereco, carregarLaudosVinculados, carregarOrdensServicoVinculadas]);

  const carregarConfiguracaoAgenda = useCallback(async () => {
    try {
      const response = await api.get("/agenda/configuracao");
      setAgendaSemanal(normalizarAgendaSemanal(response.data?.agenda_semanal));
      setAgendaFeriados(normalizarAgendaFeriados(response.data?.agenda_feriados));
      setAgendaExcecoes(normalizarAgendaExcecoes(response.data?.agenda_excecoes));
    } catch (error: any) {
      try {
        if (error?.response?.status === 404) {
          const fallback = await api.get("/configuracoes");
          setAgendaSemanal(normalizarAgendaSemanal(fallback.data?.agenda_semanal));
          setAgendaFeriados(normalizarAgendaFeriados(fallback.data?.agenda_feriados));
          setAgendaExcecoes(normalizarAgendaExcecoes(fallback.data?.agenda_excecoes));
          return;
        }
      } catch (fallbackError) {
        console.error("Erro no fallback de configuracao da agenda (FullCalendar):", fallbackError);
      }

      console.error("Erro ao carregar configuracao da agenda (FullCalendar):", error);
      setAgendaSemanal(normalizarAgendaSemanal(DEFAULT_AGENDA_SEMANAL));
      setAgendaFeriados([]);
      setAgendaExcecoes([]);
    }
  }, []);

  const carregarDuracaoSlots = useCallback(async () => {
    try {
      const response = await api.get("/servicos?limit=1000");
      const itens: ServicoAgenda[] = Array.isArray(response.data?.items) ? response.data.items : [];
      const duracoes = itens
        .map((servico) => Number(servico?.duracao_minutos || 0))
        .filter((valor) => Number.isFinite(valor) && valor > 0)
        .map((valor) => Math.round(valor));

      if (duracoes.length === 0) {
        setDuracaoSlotMinutos(30);
        return;
      }

      const base = duracoes.reduce((acumulado, atual) => calcularMdc(acumulado, atual));
      const normalizado = Math.max(5, base);
      setDuracaoSlotMinutos(normalizado);
    } catch (error) {
      console.error("Erro ao carregar duracao de servicos para slots:", error);
      setDuracaoSlotMinutos(30);
    }
  }, []);

  const agendarRefreshRealtime = useCallback(
    (payload?: { action?: string; agendamento_id?: number }) => {
      if (payload?.action) {
        const sufixoId =
          typeof payload.agendamento_id === "number" && Number.isFinite(payload.agendamento_id)
            ? ` #${payload.agendamento_id}`
            : "";
        setMensagemRealtime(`Atualizacao em tempo real: ${payload.action}${sufixoId}.`);
      }

      if (realtimeRefreshTimeoutRef.current) {
        return;
      }

      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null;
        if (intervalo) {
          void carregarAgendamentos(intervalo);
        }
      }, 700);
    },
    [carregarAgendamentos, intervalo]
  );

  const mostrarToastRealtime = useCallback((payload?: AgendaRealtimePayload) => {
    const toast = montarToastAgendaRealtime(payload);
    if (!toast) {
      return;
    }

    const agendamentoId =
      typeof payload?.agendamento_id === "number" && Number.isFinite(payload.agendamento_id)
        ? payload.agendamento_id
        : undefined;

    setToastRealtime({
      ...toast,
      agendamentoId,
    });
    if (toastRealtimeTimeoutRef.current) {
      clearTimeout(toastRealtimeTimeoutRef.current);
    }
    toastRealtimeTimeoutRef.current = setTimeout(() => {
      setToastRealtime(null);
      toastRealtimeTimeoutRef.current = null;
    }, 4000);
  }, []);

  const { conectado: realtimeConectado, ultimoEvento: realtimeUltimoEvento } = useAgendaRealtime(
    authChecked,
    (payload) => {
      agendarRefreshRealtime({
        action: payload.action,
        agendamento_id:
          typeof payload.agendamento_id === "number" ? payload.agendamento_id : undefined,
      });
      mostrarToastRealtime(payload);
    }
  );

  const abrirAgendamentoDoToast = useCallback(
    async (agendamentoId: number) => {
      try {
        let agendamento = agendamentos.find((item) => item.id === agendamentoId) || null;
        if (!agendamento) {
          const response = await api.get(`/agenda/${agendamentoId}`);
          agendamento = response.data as Agendamento;
        }

        setSelecionado(agendamento);
        setToastRealtime(null);
      } catch (error) {
        console.error("Erro ao abrir agendamento pelo toast em tempo real (FullCalendar):", error);
        setErro("Nao foi possivel abrir o agendamento do toast.");
      }
    },
    [agendamentos]
  );

  useEffect(() => {
    if (!authChecked || !intervalo) {
      return;
    }
    carregarAgendamentos(intervalo);
  }, [authChecked, intervalo, carregarAgendamentos]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }
    carregarConfiguracaoAgenda();
    carregarDuracaoSlots();
  }, [authChecked, carregarConfiguracaoAgenda, carregarDuracaoSlots]);

  useEffect(() => {
    if (!selecionado) return;
    const agendamentoAtualizado = agendamentos.find((item) => item.id === selecionado.id);
    if (agendamentoAtualizado) {
      setSelecionado(agendamentoAtualizado);
    }
  }, [agendamentos, selecionado]);

  useEffect(() => {
    setMenuStatusAberto(false);
  }, [selecionado?.id]);

  useEffect(() => {
    setModalPagamentoAberto(false);
    setFormaPagamento("dinheiro");
  }, [selecionado?.id]);

  useEffect(() => {
    if (!menuStatusAberto) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!statusMenuRef.current) return;
      if (!statusMenuRef.current.contains(event.target as Node)) {
        setMenuStatusAberto(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuStatusAberto]);

  const fecharModal = useCallback(() => {
    setModalAberto(false);
    setAgendamentoEditando(null);
    setSlotSelecionado(null);
  }, []);

  const handleAgendamentoSuccess = useCallback(async (agendamentoSalvo?: any) => {
    const edicaoAnterior = agendamentoEditando;
    if (intervalo) {
      await carregarAgendamentos(intervalo);
    }
    fecharModal();

    if (!edicaoAnterior || !agendamentoSalvo) {
      return;
    }

    const inicioOriginal = parseInicioLocal(edicaoAnterior);
    if (!inicioOriginal) {
      return;
    }
    const fimOriginal = parseFimLocal(edicaoAnterior, inicioOriginal);

    const salvoNormalizado = agendamentoSalvo as Agendamento;
    const inicioNovo = parseInicioLocal(salvoNormalizado);
    if (!inicioNovo) {
      return;
    }
    const fimNovo = parseFimLocal(salvoNormalizado, inicioNovo);

    const mudouHorario =
      inicioOriginal.getTime() !== inicioNovo.getTime() || fimOriginal.getTime() !== fimNovo.getTime();
    if (!mudouHorario) {
      return;
    }

    setOpcaoRecorrencia("apenas_este");
    setDataLimiteRecorrencia(toDateInput(adicionarDias(inicioNovo, 30)));
    setMovimentacaoPendente({
      origem: "edicao",
      id: Number(edicaoAnterior.id),
      inicioNovo,
      fimNovo,
      inicioOriginal,
      fimOriginal,
      revert: () => undefined,
    });
    setModalRecorrenciaAberto(true);
  }, [agendamentoEditando, carregarAgendamentos, fecharModal, intervalo]);

  const abrirEdicaoSelecionado = useCallback(() => {
    if (!selecionado) return;
    setAgendamentoEditando(selecionado);
    setSlotSelecionado(null);
    setModalAberto(true);
  }, [selecionado]);

  const abrirAtendimentoSelecionado = useCallback(() => {
    if (!selecionado) return;
    router.push(`/atendimento?agendamento_id=${selecionado.id}`);
  }, [router, selecionado]);

  const laudarSelecionado = useCallback(() => {
    if (!selecionado) return;
    const laudoVinculado = laudosVinculados[selecionado.id];
    if (laudoVinculado?.id) {
      router.push(`/laudos/${laudoVinculado.id}/editar`);
      return;
    }
    router.push(`/laudos/novo?agendamento_id=${selecionado.id}`);
  }, [laudosVinculados, router, selecionado]);

  const podeBaixarLaudo = useCallback((status?: string) => {
    const statusNormalizado = (status || "").trim().toLowerCase();
    return statusNormalizado === "finalizado" || statusNormalizado === "arquivado";
  }, []);

  const baixarLaudoPdfSelecionado = useCallback(async () => {
    if (!selecionado || !laudoSelecionado?.id) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/laudos/${laudoSelecionado.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Falha ao gerar PDF.");
      }

      let filename = `laudo_agendamento_${selecionado.id}.pdf`;
      const contentDisposition = response.headers.get("content-disposition");
      const match = contentDisposition?.match(/filename=\"?([^\";\s]+)\"?/);
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
      setErro("Nao foi possivel baixar o PDF do laudo agora.");
    }
  }, [laudoSelecionado?.id, selecionado]);

  const abrirModalCriacao = useCallback((data: Date, allDay = false) => {
    setDataControleAgenda(toDateInput(data));
    setAgendamentoEditando(null);
    setSelecionado(null);
    setSlotSelecionado({
      data: toDateInput(data),
      hora: allDay ? "08:00" : toTimeInput(data),
    });
    setModalAberto(true);
  }, []);

  const validarHorarioNaAgenda = useCallback(
    (inicio: Date, fim: Date): { valido: boolean; motivo: string } =>
      validarHorarioAgendamento(inicio, fim, agendaSemanal, agendaFeriados, agendaExcecoes),
    [agendaExcecoes, agendaFeriados, agendaSemanal]
  );

  const alternarAberturaAgendaDia = useCallback(async () => {
    const jornada = obterJornadaDia(dataControleAgenda, agendaSemanal, agendaFeriados, agendaExcecoes);
    const diaData = new Date(`${dataControleAgenda}T00:00:00`);
    const diaSemana = diaData.getDay();
    const diaKey = String(diaSemana === 0 ? 7 : diaSemana) as keyof AgendaSemanalConfig;
    const diaBase = agendaSemanal[diaKey] || DEFAULT_AGENDA_SEMANAL[diaKey];
    const excecaoExistente = agendaExcecoes.find((item) => item.data === dataControleAgenda);

    const inicioPadrao = jornada.inicio !== "00:00" ? jornada.inicio : diaBase.inicio;
    const fimPadrao = jornada.fim !== "00:00" ? jornada.fim : diaBase.fim;

    let novasExcecoes: AgendaExcecaoConfig[];
    if (jornada.fechado) {
      const abertura = {
        data: dataControleAgenda,
        ativo: true,
        inicio: excecaoExistente?.inicio || inicioPadrao,
        fim: excecaoExistente?.fim || fimPadrao,
        motivo: excecaoExistente?.motivo || "Abertura manual no FullCalendar",
      };
      novasExcecoes = [...agendaExcecoes.filter((item) => item.data !== dataControleAgenda), abertura];
    } else {
      const fechamento = {
        data: dataControleAgenda,
        ativo: false,
        inicio: excecaoExistente?.inicio || jornada.inicio || inicioPadrao,
        fim: excecaoExistente?.fim || jornada.fim || fimPadrao,
        motivo: excecaoExistente?.motivo || "Fechamento manual no FullCalendar",
      };
      novasExcecoes = [...agendaExcecoes.filter((item) => item.data !== dataControleAgenda), fechamento];
    }

    const payloadExcecoes = normalizarAgendaExcecoes(novasExcecoes);

    try {
      setSalvandoAgendaDia(true);
      setErro("");
      await api.put("/configuracoes", { agenda_excecoes: payloadExcecoes });
      setAgendaExcecoes(payloadExcecoes);
      setMensagemStatus(
        jornada.fechado
          ? `Agenda aberta em ${dataControleAgenda}.`
          : `Agenda fechada em ${dataControleAgenda}.`
      );
    } catch (error: any) {
      console.error("Erro ao atualizar abertura/fechamento da agenda:", error);
      if (error?.response?.status === 403) {
        setErro("Sem permissao para alterar abertura/fechamento da agenda.");
      } else {
        setErro(error?.response?.data?.detail || "Nao foi possivel atualizar a agenda desta data.");
      }
    } finally {
      setSalvandoAgendaDia(false);
    }
  }, [agendaExcecoes, agendaFeriados, agendaSemanal, dataControleAgenda]);

  const atualizarStatusAgendamento = useCallback(
    async (agendamentoId: number, novoStatus: StatusAgenda, tipoHorarioParam?: "comercial" | "plantao") => {
      setAtualizandoStatusId(agendamentoId);
      setMenuStatusAberto(false);

      try {
        const params = new URLSearchParams();
        params.append("status", novoStatus);
        if (tipoHorarioParam) {
          params.append("tipo_horario", tipoHorarioParam);
        }

        const response = await api.patch(`/agenda/${agendamentoId}/status?${params.toString()}`);
        setErro("");
        setMensagemStatus(response.data?.mensagem || `Status atualizado para ${novoStatus}.`);

        if (intervalo) {
          await carregarAgendamentos(intervalo);
        }
      } catch (error: any) {
        console.error("Erro ao atualizar status via FullCalendar:", error);
        setErro(error?.response?.data?.detail || "Nao foi possivel atualizar o status deste agendamento.");
      } finally {
        setAtualizandoStatusId(null);
      }
    },
    [carregarAgendamentos, intervalo]
  );

  const executarAcaoStatus = useCallback(
    (acao: AcaoStatus) => {
      if (!selecionado) return;

      if (selecionado.status === acao.status) {
        setMensagemStatus(`Este agendamento ja esta com status ${acao.status}.`);
        setMenuStatusAberto(false);
        return;
      }

      if (acao.precisaTipoHorario) {
        setTipoHorario("comercial");
        setModalTipoHorario({ id: selecionado.id, status: acao.status });
        setMenuStatusAberto(false);
        return;
      }

      void atualizarStatusAgendamento(selecionado.id, acao.status);
    },
    [atualizarStatusAgendamento, selecionado]
  );

  const confirmarAtualizacaoRealizado = useCallback(async () => {
    if (!modalTipoHorario) return;
    await atualizarStatusAgendamento(modalTipoHorario.id, modalTipoHorario.status, tipoHorario);
    setModalTipoHorario(null);
  }, [atualizarStatusAgendamento, modalTipoHorario, tipoHorario]);

  const abrirRecebimentoPagamentoModal = useCallback(() => {
    if (!selecionado) return;

    const osVinculada = ordensServicoPorAgendamento[selecionado.id];
    if (!osVinculada) {
      setErro("Este agendamento nao possui ordem de servico vinculada para recebimento.");
      return;
    }
    if (String(osVinculada.status || "").trim() === "Pago") {
      setMensagemStatus(`A OS ${osVinculada.numero_os || osVinculada.id} ja esta paga.`);
      return;
    }

    setErro("");
    setFormaPagamento("dinheiro");
    setModalPagamentoAberto(true);
  }, [ordensServicoPorAgendamento, selecionado]);

  const receberPagamentoSelecionado = useCallback(async () => {
    if (!selecionado) return;
    const osVinculada = ordensServicoPorAgendamento[selecionado.id];
    if (!osVinculada) {
      setErro("Este agendamento nao possui ordem de servico vinculada para recebimento.");
      setModalPagamentoAberto(false);
      return;
    }

    try {
      setRecebendoPagamentoId(selecionado.id);
      setErro("");

      await api.patch(`/ordens-servico/${osVinculada.id}/receber`, {
        forma_pagamento: formaPagamento,
      });

      setMensagemStatus(
        `Pagamento recebido para a OS ${osVinculada.numero_os || osVinculada.id} (${formaPagamento}).`
      );
      setModalPagamentoAberto(false);
      if (intervalo) {
        await carregarAgendamentos(intervalo);
      }
    } catch (error: any) {
      console.error("Erro ao receber pagamento da OS:", error);
      setErro(error?.response?.data?.detail || "Nao foi possivel registrar o recebimento desta OS.");
    } finally {
      setRecebendoPagamentoId(null);
    }
  }, [carregarAgendamentos, formaPagamento, intervalo, ordensServicoPorAgendamento, selecionado]);

  const excluirSelecionado = useCallback(async () => {
    if (!selecionado) return;
    const confirmar = window.confirm("Deseja realmente excluir este agendamento?");
    if (!confirmar) return;

    try {
      setExcluindoAgendamentoId(selecionado.id);
      setErro("");
      await api.delete(`/agenda/${selecionado.id}`);
      setMensagemStatus("Agendamento excluido com sucesso.");
      setSelecionado(null);
      if (intervalo) {
        await carregarAgendamentos(intervalo);
      }
    } catch (error: any) {
      console.error("Erro ao excluir agendamento no FullCalendar:", error);
      if (error?.response?.status === 403) {
        setErro("Apenas administradores podem excluir agendamentos.");
      } else {
        setErro(error?.response?.data?.detail || "Nao foi possivel excluir este agendamento.");
      }
    } finally {
      setExcluindoAgendamentoId(null);
    }
  }, [carregarAgendamentos, intervalo, selecionado]);

  const existeConflitoSlot = useCallback(
    (inicio: Date, fim: Date, agendamentoIgnoradoId?: number) => {
      return agendamentos.some((agendamento) => {
        if (agendamentoIgnoradoId && agendamento.id === agendamentoIgnoradoId) {
          return false;
        }
        if (String(agendamento.status || "").trim() === "Cancelado") {
          return false;
        }

        const inicioExistente = parseInicioLocal(agendamento);
        if (!inicioExistente) {
          return false;
        }
        const fimExistente = parseFimLocal(agendamento, inicioExistente);
        return inicio < fimExistente && fim > inicioExistente;
      });
    },
    [agendamentos]
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const inicio = toDateInput(arg.start);
    const fimExclusivo = new Date(arg.end);
    fimExclusivo.setDate(fimExclusivo.getDate() - 1);
    const fim = toDateInput(fimExclusivo);

    setIntervalo((atual) => {
      if (atual?.inicio === inicio && atual?.fim === fim) {
        return atual;
      }
      return { inicio, fim };
    });
  }, []);

  const atualizarHorarioAgendamento = useCallback(
    async ({ id, inicio, fim, revert }: AtualizacaoHorarioArgs) => {
      const agendamento = agendamentos.find((item) => item.id === id);
      if (!agendamento) {
        revert();
        setErro("Nao foi possivel localizar o agendamento para atualizar.");
        return;
      }

      const validacaoHorario = validarHorarioNaAgenda(inicio, fim);
      if (!validacaoHorario.valido) {
        revert();
        setErro(validacaoHorario.motivo || "Horario fora do funcionamento da agenda.");
        return;
      }

      if (existeConflitoSlot(inicio, fim, id)) {
        revert();
        setErro("Slot ocupado: ja existe outro atendimento neste horario.");
        return;
      }

      try {
        setSalvandoMovimentacao(true);
        setErro("");

        await api.put(`/agenda/${id}`, {
          paciente_id: agendamento.paciente_id ?? null,
          clinica_id: agendamento.clinica_id ?? null,
          servico_id: agendamento.servico_id ?? null,
          inicio: toApiDateTime(inicio),
          fim: toApiDateTime(fim),
          status: agendamento.status || "Agendado",
          observacoes: agendamento.observacoes || "",
        });

        if (intervalo) {
          await carregarAgendamentos(intervalo);
        }
        setDataControleAgenda(toDateInput(inicio));
      } catch (error) {
        console.error("Erro ao mover/redimensionar agendamento:", error);
        revert();
        setErro("Nao foi possivel salvar a alteracao do horario. A mudanca foi desfeita.");
      } finally {
        setSalvandoMovimentacao(false);
      }
    },
    [agendamentos, carregarAgendamentos, existeConflitoSlot, intervalo, validarHorarioNaAgenda]
  );

  const abrirFluxoRecorrenciaMovimentacao = useCallback(
    ({ id, inicio, fim, revert }: AtualizacaoHorarioArgs) => {
      const agendamento = agendamentos.find((item) => item.id === id);
      if (!agendamento) {
        revert();
        setErro("Nao foi possivel identificar o agendamento para atualizar.");
        return;
      }

      const inicioOriginal = parseInicioLocal(agendamento);
      if (!inicioOriginal) {
        revert();
        setErro("Nao foi possivel identificar o horario original do agendamento.");
        return;
      }
      const fimOriginal = parseFimLocal(agendamento, inicioOriginal);

      setErro("");
      setMensagemStatus("");
      setOpcaoRecorrencia("apenas_este");
      setDataLimiteRecorrencia(toDateInput(adicionarDias(inicio, 30)));
      setMovimentacaoPendente({
        origem: "movimentacao",
        id,
        inicioNovo: inicio,
        fimNovo: fim,
        inicioOriginal,
        fimOriginal,
        revert,
      });
      setModalRecorrenciaAberto(true);
    },
    [agendamentos]
  );

  const cancelarRecorrenciaMovimentacao = useCallback(() => {
    if (movimentacaoPendente?.origem === "movimentacao") {
      movimentacaoPendente.revert();
    }
    setModalRecorrenciaAberto(false);
    setMovimentacaoPendente(null);
    setOpcaoRecorrencia("apenas_este");
  }, [movimentacaoPendente]);

  const gerarIniciosRecorrencia = useCallback(
    (inicioBase: Date, opcao: OpcaoRecorrencia, dataLimite: Date): Date[] => {
      const resultado: Date[] = [];
      const limite = new Date(dataLimite);
      limite.setHours(23, 59, 59, 999);

      if (opcao === "cada_7_dias") {
        let cursor = adicionarDias(inicioBase, 7);
        while (cursor <= limite) {
          resultado.push(new Date(cursor));
          cursor = adicionarDias(cursor, 7);
        }
        return resultado;
      }

      let cursor = adicionarDias(inicioBase, 1);
      while (cursor <= limite) {
        const diaSemana = cursor.getDay();
        if (opcao === "todos_os_dias") {
          resultado.push(new Date(cursor));
        } else if (opcao === "seg_a_sex" && diaSemana >= 1 && diaSemana <= 5) {
          resultado.push(new Date(cursor));
        }
        cursor = adicionarDias(cursor, 1);
      }

      return resultado;
    },
    []
  );

  const confirmarRecorrenciaMovimentacao = useCallback(async () => {
    if (!movimentacaoPendente) return;

    const { id, inicioNovo, fimNovo, revert, origem } = movimentacaoPendente;
    const agendamento = agendamentos.find((item) => item.id === id);
    if (!agendamento) {
      revert();
      setModalRecorrenciaAberto(false);
      setMovimentacaoPendente(null);
      setErro("Nao foi possivel localizar o agendamento para aplicar recorrencia.");
      return;
    }

    if (opcaoRecorrencia === "apenas_este") {
      setModalRecorrenciaAberto(false);
      setMovimentacaoPendente(null);
      if (origem === "movimentacao") {
        await atualizarHorarioAgendamento({ id, inicio: inicioNovo, fim: fimNovo, revert });
      } else {
        setMensagemStatus("Alteracao aplicada somente neste agendamento.");
      }
      return;
    }

    const limite = new Date(`${dataLimiteRecorrencia}T23:59:59`);
    if (Number.isNaN(limite.getTime()) || limite < inicioNovo) {
      setErro("Informe uma data limite valida para aplicar a recorrencia.");
      return;
    }

    try {
      setAplicandoRecorrencia(true);
      setSalvandoMovimentacao(true);
      setErro("");

      const validacaoHorario = validarHorarioNaAgenda(inicioNovo, fimNovo);
      if (!validacaoHorario.valido) {
        if (origem === "movimentacao") {
          revert();
        }
        setErro(validacaoHorario.motivo || "Horario fora do funcionamento da agenda.");
        setModalRecorrenciaAberto(false);
        setMovimentacaoPendente(null);
        return;
      }

      if (existeConflitoSlot(inicioNovo, fimNovo, id)) {
        if (origem === "movimentacao") {
          revert();
        }
        setErro("Slot ocupado: ja existe outro atendimento neste horario.");
        setModalRecorrenciaAberto(false);
        setMovimentacaoPendente(null);
        return;
      }

      if (origem === "movimentacao") {
        await api.put(`/agenda/${id}`, {
          paciente_id: agendamento.paciente_id ?? null,
          clinica_id: agendamento.clinica_id ?? null,
          servico_id: agendamento.servico_id ?? null,
          inicio: toApiDateTime(inicioNovo),
          fim: toApiDateTime(fimNovo),
          status: agendamento.status || "Agendado",
          observacoes: agendamento.observacoes || "",
        });
      }

      const duracaoMs = Math.max(5 * 60000, fimNovo.getTime() - inicioNovo.getTime());
      const iniciosRecorrencia = gerarIniciosRecorrencia(inicioNovo, opcaoRecorrencia, limite);
      const ocupacoesLocais: Array<{ inicio: Date; fim: Date }> = [{ inicio: inicioNovo, fim: fimNovo }];
      let criados = 0;
      let pulados = 0;
      let falhas = 0;

      for (const inicioData of iniciosRecorrencia) {
        const inicioRecorrente = combinarDataComHorario(inicioData, inicioNovo);
        const fimRecorrente = new Date(inicioRecorrente.getTime() + duracaoMs);
        const validacaoRecorrente = validarHorarioNaAgenda(inicioRecorrente, fimRecorrente);
        if (!validacaoRecorrente.valido) {
          pulados += 1;
          continue;
        }

        const conflitaLocal = ocupacoesLocais.some(
          (slot) => inicioRecorrente < slot.fim && fimRecorrente > slot.inicio
        );
        if (conflitaLocal || existeConflitoSlot(inicioRecorrente, fimRecorrente)) {
          pulados += 1;
          continue;
        }

        try {
          await api.post("/agenda", {
            paciente_id: agendamento.paciente_id ?? null,
            clinica_id: agendamento.clinica_id ?? null,
            servico_id: agendamento.servico_id ?? null,
            inicio: toApiDateTime(inicioRecorrente),
            fim: toApiDateTime(fimRecorrente),
            status: agendamento.status || "Agendado",
            observacoes: agendamento.observacoes || "",
          });
          ocupacoesLocais.push({ inicio: inicioRecorrente, fim: fimRecorrente });
          criados += 1;
        } catch (error: any) {
          if (error?.response?.status === 409 || error?.response?.status === 422) {
            pulados += 1;
          } else {
            falhas += 1;
          }
        }
      }

      if (intervalo) {
        await carregarAgendamentos(intervalo);
      }

      setMensagemStatus(
        `Alteracao aplicada. Recorrencias criadas: ${criados}. Puladas: ${pulados}. Falhas: ${falhas}.`
      );
      setDataControleAgenda(toDateInput(inicioNovo));
      setModalRecorrenciaAberto(false);
      setMovimentacaoPendente(null);
    } catch (error: any) {
      console.error("Erro ao aplicar recorrencia de horario:", error);
      if (origem === "movimentacao") {
        revert();
      }
      setErro(error?.response?.data?.detail || "Nao foi possivel aplicar a alteracao recorrente.");
      setModalRecorrenciaAberto(false);
      setMovimentacaoPendente(null);
    } finally {
      setAplicandoRecorrencia(false);
      setSalvandoMovimentacao(false);
    }
  }, [
    agendamentos,
    carregarAgendamentos,
    dataLimiteRecorrencia,
    existeConflitoSlot,
    gerarIniciosRecorrencia,
    intervalo,
    movimentacaoPendente,
    opcaoRecorrencia,
    atualizarHorarioAgendamento,
    validarHorarioNaAgenda,
  ]);

  const eventos = useMemo<EventInput[]>(() => {
    const lista: EventInput[] = [];

    for (const ag of agendamentos) {
      if (filtroStatus !== "todos" && ag.status !== filtroStatus) {
        continue;
      }

      const inicio = parseInicioLocal(ag);
      if (!inicio) {
        continue;
      }

      const fim = parseFimLocal(ag, inicio);
      const statusVisual = STATUS_CORES[ag.status] || {
        bg: "#e5e7eb",
        border: "#9ca3af",
        text: "#111827",
      };
      const clinica = clinicasEndereco[Number(ag.clinica_id)];
      const enderecoClinica = montarEnderecoClinica(clinica);
      const wazeUrl = montarWazeWebUrl(enderecoClinica);

      lista.push({
        id: String(ag.id),
        title: ag.clinica || "Clinica nao informada",
        start: inicio,
        end: fim,
        backgroundColor: statusVisual.bg,
        borderColor: statusVisual.border,
        textColor: statusVisual.text,
        extendedProps: {
          agendamento: ag,
          wazeUrl,
        },
      });
    }

    return lista;
  }, [agendamentos, clinicasEndereco, filtroStatus, montarEnderecoClinica, montarWazeWebUrl]);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const agendamento = arg.event.extendedProps.agendamento as Agendamento | undefined;
    if (!agendamento) return;
    setSelecionado(agendamento);
    const inicio = parseInicioLocal(agendamento);
    if (inicio) {
      setDataControleAgenda(toDateInput(inicio));
    }
    setMensagemStatus("");
  }, []);

  const handleDateClick = useCallback(
    (arg: DateClickArg) => {
      const inicio = new Date(arg.date);
      if (arg.allDay) {
        const jornada = obterJornadaDia(toDateInput(inicio), agendaSemanal, agendaFeriados, agendaExcecoes);
        const [horaJornada = "08", minutoJornada = "00"] = String(jornada.inicio || "08:00").split(":");
        inicio.setHours(Number(horaJornada), Number(minutoJornada), 0, 0);
      }
      const fim = new Date(inicio.getTime() + duracaoSlotMinutos * 60000);
      const validacaoHorario = validarHorarioNaAgenda(inicio, fim);
      if (!validacaoHorario.valido) {
        setErro(validacaoHorario.motivo || "Agenda fechada para este horario.");
        return;
      }
      if (existeConflitoSlot(inicio, fim)) {
        setErro("Slot ocupado: selecione outro horario livre.");
        return;
      }
      setErro("");
      abrirModalCriacao(inicio, false);
    },
    [agendaExcecoes, agendaFeriados, agendaSemanal, abrirModalCriacao, duracaoSlotMinutos, existeConflitoSlot, validarHorarioNaAgenda]
  );

  const handleSelect = useCallback(
    (arg: DateSelectArg) => {
      const inicio = new Date(arg.start);
      if (arg.allDay) {
        const jornada = obterJornadaDia(toDateInput(inicio), agendaSemanal, agendaFeriados, agendaExcecoes);
        const [horaJornada = "08", minutoJornada = "00"] = String(jornada.inicio || "08:00").split(":");
        inicio.setHours(Number(horaJornada), Number(minutoJornada), 0, 0);
      }
      const fim = arg.allDay
        ? new Date(inicio.getTime() + duracaoSlotMinutos * 60000)
        : arg.end
          ? new Date(arg.end)
          : new Date(inicio.getTime() + duracaoSlotMinutos * 60000);
      const validacaoHorario = validarHorarioNaAgenda(inicio, fim);
      if (!validacaoHorario.valido) {
        setErro(validacaoHorario.motivo || "Agenda fechada para este horario.");
        return;
      }
      if (existeConflitoSlot(inicio, fim)) {
        setErro("Intervalo ocupado: nao e permitido mais de um atendimento no mesmo slot.");
        return;
      }
      setErro("");
      abrirModalCriacao(inicio, false);
    },
    [agendaExcecoes, agendaFeriados, agendaSemanal, abrirModalCriacao, duracaoSlotMinutos, existeConflitoSlot, validarHorarioNaAgenda]
  );

  const handleEventDrop = useCallback(
    (arg: EventDropArg) => {
      const id = Number(arg.event.id);
      const inicio = arg.event.start;

      if (!Number.isFinite(id) || !inicio) {
        arg.revert();
        setErro("Nao foi possivel identificar o agendamento para mover.");
        return;
      }

      const fim = arg.event.end ? new Date(arg.event.end) : new Date(inicio.getTime() + 30 * 60000);
      abrirFluxoRecorrenciaMovimentacao({ id, inicio: new Date(inicio), fim, revert: arg.revert });
    },
    [abrirFluxoRecorrenciaMovimentacao]
  );

  const handleEventResize = useCallback(
    (arg: EventResizeDoneArg) => {
      const id = Number(arg.event.id);
      const inicio = arg.event.start;

      if (!Number.isFinite(id) || !inicio) {
        arg.revert();
        setErro("Nao foi possivel identificar o agendamento para redimensionar.");
        return;
      }

      const fim = arg.event.end ? new Date(arg.event.end) : new Date(inicio.getTime() + 30 * 60000);
      abrirFluxoRecorrenciaMovimentacao({ id, inicio: new Date(inicio), fim, revert: arg.revert });
    },
    [abrirFluxoRecorrenciaMovimentacao]
  );

  const renderEventContent = useCallback((eventInfo: EventContentArg) => {
    const nomeClinica = String(eventInfo.event.title || "Clinica nao informada");

    return <span className="block truncate text-[11px] font-semibold leading-tight">{nomeClinica}</span>;
  }, []);

  const permiteInteracaoHorarioAgenda = useCallback(
    (inicio: Date, fim: Date) => validarHorarioNaAgenda(inicio, fim).valido,
    [validarHorarioNaAgenda]
  );

  return (
    <DashboardLayout>
      <div className="p-6">
        {toastRealtime && (
          <div className="fixed right-4 top-4 z-[70]">
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs shadow-lg ${toastRealtime.classe}`}>
              <span className="font-medium">{toastRealtime.texto}</span>
              {typeof toastRealtime.agendamentoId === "number" && (
                <button
                  type="button"
                  onClick={() => abrirAgendamentoDoToast(toastRealtime.agendamentoId as number)}
                  className="rounded-md border border-current/30 px-2 py-1 text-[11px] font-semibold hover:bg-white/40 transition-colors"
                >
                  Abrir
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda FullCalendar</h1>
            <p className="text-gray-500">
              Clique em horario vazio para criar, selecione um evento para editar/status, e arraste para alterar horario.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {STATUS_FILTRO.map((status) => (
                <option key={status} value={status}>
                  {status === "todos" ? "Todos os status" : status}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dataControleAgenda}
              onChange={(event) => setDataControleAgenda(event.target.value || toDateInput(new Date()))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <button
              onClick={alternarAberturaAgendaDia}
              disabled={salvandoAgendaDia}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                jornadaDataControle.fechado
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {salvandoAgendaDia
                ? "Salvando..."
                : jornadaDataControle.fechado
                  ? "Abrir data"
                  : "Fechar data"}
            </button>

            <button
              onClick={() => intervalo && carregarAgendamentos(intervalo)}
              disabled={!intervalo || loading || salvandoMovimentacao}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading || salvandoMovimentacao ? "animate-spin" : ""}`} />
              {salvandoMovimentacao ? "Salvando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-700">
          Data {dataControleAgenda}:{" "}
          <strong>{jornadaDataControle.fechado ? "fechada" : "aberta"}</strong>
          {jornadaDataControle.motivo ? ` (${jornadaDataControle.motivo})` : ""}
          {excecaoDataControle ? " - com excecao cadastrada." : ""}
        </div>

        <div
          className={`mb-4 rounded-lg border px-4 py-2 text-xs ${
            realtimeConectado
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          Tempo real: {realtimeConectado ? "conectado" : "reconectando..."}
          {realtimeUltimoEvento ? ` | Ultimo evento: ${realtimeUltimoEvento}` : ""}
          {mensagemRealtime ? ` | ${mensagemRealtime}` : ""}
        </div>

        {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

        <div className="rounded-xl border bg-white p-2 shadow-sm md:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            locales={[ptBrLocale]}
            locale="pt-br"
            buttonText={{ today: "Hoje", month: "Mes", week: "Semana", day: "Dia", list: "Lista" }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            events={eventos}
            eventContent={renderEventContent}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            nowIndicator
            businessHours={businessHours}
            editable
            selectable
            eventStartEditable
            eventDurationEditable
            selectMirror
            selectAllow={(selectInfo) => permiteInteracaoHorarioAgenda(selectInfo.start, selectInfo.end)}
            eventAllow={(dropInfo) => permiteInteracaoHorarioAgenda(dropInfo.start, dropInfo.end)}
            eventOverlap={(stillEvent, movingEvent) => {
              const statusStill = String(
                ((stillEvent.extendedProps?.agendamento as Agendamento | undefined)?.status || "").trim()
              );
              const statusMoving = String(
                ((movingEvent?.extendedProps?.agendamento as Agendamento | undefined)?.status || "").trim()
              );
              return statusStill === "Cancelado" || statusMoving === "Cancelado";
            }}
            selectOverlap={(event) => {
              const statusExistente = String(
                ((event.extendedProps?.agendamento as Agendamento | undefined)?.status || "").trim()
              );
              return statusExistente === "Cancelado";
            }}
            allDaySlot={false}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            slotDuration={duracaoSlot}
            snapDuration={duracaoSlot}
            slotLabelInterval={duracaoSlot}
            height="auto"
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            dayMaxEventRows={3}
            dayMaxEvents
            eventDisplay="block"
            eventClassNames="cursor-pointer overflow-hidden"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <CalendarDays className="h-4 w-4" />
              Resumo do periodo carregado
            </div>
            <p className="text-sm text-gray-600">
              {intervalo
                ? `${intervalo.inicio} ate ${intervalo.fim}`
                : "Escolha uma visualizacao para iniciar o carregamento."}
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{eventos.length}</p>
            <p className="text-xs text-gray-500">eventos no filtro atual</p>
            <p className="mt-1 text-xs text-gray-500">
              Grade de slots: {duracaoSlotMinutos} min (baseada na duracao cadastrada dos servicos)
            </p>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Detalhes do evento selecionado</h2>
            {!selecionado ? (
              <p className="text-sm text-gray-500">Clique em um evento para ver os detalhes e abrir as acoes.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={abrirEdicaoSelecionado}
                    className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Editar Agendamento
                  </button>

                  <button
                    onClick={abrirAtendimentoSelecionado}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    <Stethoscope className="h-3.5 w-3.5" />
                    Atender
                  </button>

                  <button
                    onClick={laudarSelecionado}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Laudar
                  </button>

                  {laudoSelecionado && podeBaixarLaudo(laudoSelecionado.status) && (
                    <button
                      onClick={baixarLaudoPdfSelecionado}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar laudo
                    </button>
                  )}

                  {wazeSelecionadoUrl && (
                    <a
                      href={wazeSelecionadoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      title="Abrir rota no Waze"
                    >
                      <img
                        src="/icons/waze.svg"
                        alt="Waze"
                        className="h-[14px] w-[14px] rounded-sm object-contain"
                        loading="lazy"
                      />
                      Waze
                    </a>
                  )}

                  <div className="relative" ref={statusMenuRef}>
                    <button
                      onClick={() => setMenuStatusAberto((valor) => !valor)}
                      disabled={atualizandoStatusId === selecionado.id}
                      className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {atualizandoStatusId === selecionado.id ? "Atualizando status..." : "Alterar Status"}
                    </button>

                    {menuStatusAberto && (
                      <div className="absolute left-0 z-30 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                        {ACOES_STATUS.map((acao) => {
                          const estaAtivo = selecionado.status === acao.status;
                          return (
                            <button
                              key={acao.status}
                              onClick={() => executarAcaoStatus(acao)}
                              disabled={estaAtivo}
                              className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-medium transition-colors ${
                                estaAtivo
                                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                  : acao.danger
                                    ? "text-red-700 hover:bg-red-50"
                                    : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              <span>{acao.label}</span>
                              {estaAtivo && <span className="text-[10px] uppercase">Atual</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={abrirRecebimentoPagamentoModal}
                    disabled={
                      recebendoPagamentoId === selecionado.id ||
                      !osSelecionada ||
                      String(osSelecionada.status || "").trim() === "Pago"
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    {recebendoPagamentoId === selecionado.id ? "Recebendo..." : "Receber Pagamento"}
                  </button>

                  <button
                    onClick={excluirSelecionado}
                    disabled={excluindoAgendamentoId === selecionado.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {excluindoAgendamentoId === selecionado.id ? "Excluindo..." : "Excluir"}
                  </button>

                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700">
                    Status atual: {selecionado.status || "Nao informado"}
                  </span>
                </div>

                {mensagemStatus && (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                    {mensagemStatus}
                  </p>
                )}

                {osSelecionada ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
                    OS: {osSelecionada.numero_os || osSelecionada.id} | Status: {osSelecionada.status} | Valor:{" "}
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      Number(osSelecionada.valor_final || 0)
                    )}
                  </p>
                ) : (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    Sem OS vinculada para este agendamento.
                  </p>
                )}

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-gray-700">Paciente:</span>{" "}
                    <span className="text-gray-900">{selecionado.paciente || "Nao informado"}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Tutor:</span>{" "}
                    <span className="text-gray-900">{selecionado.tutor || "Nao informado"}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Clinica:</span>{" "}
                    <span className="text-gray-900">{selecionado.clinica || "Nao informada"}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Servico:</span>{" "}
                    <span className="text-gray-900">{selecionado.servico || "Nao informado"}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Horario:</span>{" "}
                    <span className="text-gray-900">{formatarDataHora(selecionado)}</span>
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-gray-700">Observacoes:</span>{" "}
                    <span className="text-gray-900">{selecionado.observacoes || "Sem observacoes"}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {modalRecorrenciaAberto && movimentacaoPendente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Como aplicar esta alteracao?</h3>
              <p className="mt-1 text-sm text-gray-600">
                Voce alterou a data/horario do agendamento. Escolha se a mudanca vale somente para este item ou com
                recorrencia.
              </p>

              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <p>
                  <strong>Antes:</strong>{" "}
                  {movimentacaoPendente.inicioOriginal.toLocaleDateString("pt-BR")}{" "}
                  {movimentacaoPendente.inicioOriginal.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {movimentacaoPendente.fimOriginal.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1">
                  <strong>Depois:</strong>{" "}
                  {movimentacaoPendente.inicioNovo.toLocaleDateString("pt-BR")}{" "}
                  {movimentacaoPendente.inicioNovo.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {movimentacaoPendente.fimNovo.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {OPCOES_RECORRENCIA.map((opcao) => (
                  <label
                    key={opcao.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                      opcaoRecorrencia === opcao.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="opcao_recorrencia"
                      value={opcao.id}
                      checked={opcaoRecorrencia === opcao.id}
                      onChange={() => setOpcaoRecorrencia(opcao.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <strong>{opcao.label}</strong>
                      <span className="block text-xs text-gray-600">{opcao.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>

              {opcaoRecorrencia !== "apenas_este" && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Repetir ate</label>
                  <input
                    type="date"
                    value={dataLimiteRecorrencia}
                    onChange={(event) => setDataLimiteRecorrencia(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={cancelarRecorrenciaMovimentacao}
                  disabled={aplicandoRecorrencia}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRecorrenciaMovimentacao}
                  disabled={aplicandoRecorrencia}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aplicandoRecorrencia ? "Aplicando..." : "Confirmar alteracao"}
                </button>
              </div>
            </div>
          </div>
        )}

        {modalPagamentoAberto && selecionado && osSelecionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Confirmar recebimento</h3>
              <p className="mt-1 text-sm text-gray-600">
                Confirme o recebimento da OS <strong>{osSelecionada.numero_os || osSelecionada.id}</strong>.
              </p>

              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p>
                  <strong>Valor:</strong>{" "}
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    Number(osSelecionada.valor_final || 0)
                  )}
                </p>
                <p className="mt-1">
                  <strong>Paciente:</strong> {selecionado.paciente || "Nao informado"}
                </p>
              </div>

              <label className="mt-4 block text-sm font-medium text-gray-700">Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={(event) => setFormaPagamento(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {FORMAS_PAGAMENTO.map((forma) => (
                  <option key={forma.id} value={forma.id}>
                    {forma.nome}
                  </option>
                ))}
              </select>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setModalPagamentoAberto(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={receberPagamentoSelecionado}
                  disabled={recebendoPagamentoId === selecionado.id}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recebendoPagamentoId === selecionado.id ? "Recebendo..." : "Confirmar recebimento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {modalTipoHorario && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Finalizar atendimento</h3>
              <p className="mt-1 text-sm text-gray-600">
                Escolha o tipo de horario para concluir como <strong>Realizado</strong>.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTipoHorario("comercial")}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                    tipoHorario === "comercial"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Comercial
                </button>
                <button
                  onClick={() => setTipoHorario("plantao")}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                    tipoHorario === "plantao"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Plantao
                </button>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setModalTipoHorario(null)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarAtualizacaoRealizado}
                  disabled={atualizandoStatusId === modalTipoHorario.id}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {atualizandoStatusId === modalTipoHorario.id ? "Salvando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <NovoAgendamentoModal
          isOpen={modalAberto}
          onClose={fecharModal}
          onSuccess={handleAgendamentoSuccess}
          agendamento={agendamentoEditando}
          defaultDate={slotSelecionado?.data}
          defaultTime={slotSelecionado?.hora}
          agendaSemanal={agendaSemanal}
          agendaFeriados={agendaFeriados}
          agendaExcecoes={agendaExcecoes}
        />
      </div>
    </DashboardLayout>
  );
}
