"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  CalendarPlus,
  CalendarSearch,
  Check,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  FileHeart,
  FlaskConical,
  MessageCircle,
  MessageSquare,
  Plus,
  ReceiptText,
  Radar,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Play,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { montarLinkWhatsAppReserva } from "@/lib/agenda-reserva-manual";
import { formatarWhatsAppVisual } from "@/lib/clinica-whatsapp";

type ToolTrace = {
  name: string;
  ok: boolean;
  summary: string;
};

type AssistantMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolTrace[];
  pending_action_id?: string | null;
  created_at?: string | null;
};

type PendingAction = {
  id: string;
  conversation_id: string;
  type: string;
  status: "pending" | "rejected" | "executed" | "invalidated" | "expired" | string;
  arguments: {
    agendamento_id?: number;
    motivo?: string;
    tipo?: "agendamento" | "reserva";
    destinatario_mensagem?: "clinica" | "tutor";
    observacoes?: string | null;
  };
  target: {
    agendamento_id?: number;
    inicio?: string | null;
    status?: string;
    clinica_nome?: string;
    servico_nome?: string;
    paciente_primeiro_nome?: string | null;
    paciente_nome?: string | null;
    tutor_nome?: string | null;
    tipo?: "agendamento" | "reserva";
    reserva_expira_em?: string | null;
    destinatario_mensagem?: {
      tipo?: "clinica" | "tutor";
      nome?: string | null;
      telefones?: string[];
    };
    data?: string;
    antes?: AgendaWindow;
    depois?: AgendaWindow;
    motivo?: string | null;
  };
  result?: {
    message?: string;
    reason?: string;
    agendamento?: {
      id?: number;
      status?: string;
      inicio?: string | null;
    };
    comunicacao?: {
      destinatario_tipo?: "clinica" | "tutor";
      destinatario_nome?: string | null;
      telefones?: string[];
      mensagem?: string;
      envio_manual?: boolean;
    };
    agenda_excecao?: {
      data?: string;
      ativo?: boolean;
      inicio?: string;
      fim?: string;
      motivo?: string | null;
    };
  } | null;
  expires_at?: string | null;
};

type AgendaWindow = {
  data?: string;
  ativo?: boolean;
  inicio?: string;
  fim?: string;
  motivo?: string | null;
  fonte?: string;
};

type Conversation = {
  id: string;
  title: string;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  messages?: AssistantMessage[];
  pending_actions?: PendingAction[];
};

type AssistantStatus = {
  enabled: boolean;
  configured: boolean;
  model: string;
  admin_only: boolean;
};

type ExecutiveSummary = {
  date: string;
  agenda: { total: number; by_status: Record<string, number>; reservations_expiring_6h: number };
  finance: { month_revenue: number; overdue_count: number; overdue_total: number };
  pending_approvals: number;
  alerts: Array<{ level: string; message: string }>;
};

type SupervisedMemory = {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  status: string;
  created_at?: string | null;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  source?: string | null;
  status: string;
  semantic_enabled: boolean;
  semantic_status: "disabled" | "queued" | "indexing" | "ready" | "error" | string;
  embedding_model?: string | null;
  semantic_error?: string | null;
  indexed_at?: string | null;
  created_at?: string | null;
};

type RadarOutput = {
  date: string;
  generated_at: string;
  alerts: Array<{
    key: string;
    level: "ok" | "info" | "attention" | "critical" | string;
    title: string;
    evidence: string;
    recommendation: string;
  }>;
  indicators: {
    revenue: {
      current_period: number;
      previous_comparable_period: number;
      change_percent?: number | null;
      comparable_days: number;
    };
    appointments: {
      last_7_days: number;
      previous_7_days: number;
      cancelled_last_7_days: number;
      cancelled_previous_7_days: number;
    };
    overdue: { count: number; total: number };
    reservations_expiring_6h: number;
    pending_approvals: number;
  };
  safety: string;
};

type AutonomousExecution = {
  id: string;
  mission_id?: string | null;
  type: string;
  source: string;
  status: "queued" | "running" | "completed" | "error" | string;
  output?: Record<string, unknown> | null;
  error?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
};

type AssistantMission = {
  id: string;
  title: string;
  type: "radar" | "executive_summary" | "billing_trend" | "overdue_debts" | "eval_lab";
  config: { months?: number; clinic?: string | null; overdue_only?: boolean };
  recurrence: "daily" | "weekly";
  local_time: string;
  weekdays: number[];
  enabled: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
};

type ClinicalDraft = {
  id: string;
  report_id: number;
  title: string;
  content: string;
  alerts: string[];
  status: string;
  created_at?: string | null;
  official_report_modified: boolean;
};

type AssistantMetrics = {
  period_days: number;
  assistant_responses: number;
  tokens: number;
  average_latency_ms?: number | null;
  feedback: { positive: number; negative: number };
  actions: Record<string, number>;
};

type WorkspaceView = "chat" | "radar" | "brief" | "missions" | "approvals" | "memory" | "knowledge" | "evaluations" | "clinical";

const EXAMPLES = [
  {
    icon: BarChart3,
    text: "Verifique a dinâmica de faturamento dos últimos 5 meses.",
  },
  {
    icon: Trash2,
    text: "Localize e prepare a exclusão do agendamento registrado hoje às 10h na Animal Care.",
  },
  {
    icon: CalendarSearch,
    text: "Verifique disponibilidade de horário para ecocardiograma na Vet World.",
  },
  {
    icon: CalendarPlus,
    text: "Reserve amanhã às 10h um ecocardiograma na Animal Care e deixe a mensagem pronta para a clínica.",
  },
  {
    icon: CalendarClock,
    text: "Deixe a agenda aberta amanhã até as 18h.",
  },
  {
    icon: ReceiptText,
    text: "Emita um relatório de débitos pendentes na Vet Plus.",
  },
];

const WORKSPACE_VIEWS: Array<{ id: WorkspaceView; label: string; icon: typeof BrainCircuit }> = [
  { id: "chat", label: "Conversa", icon: MessageSquare },
  { id: "radar", label: "Radar", icon: Radar },
  { id: "brief", label: "Resumo diário", icon: BarChart3 },
  { id: "missions", label: "Missões", icon: Target },
  { id: "approvals", label: "Aprovações", icon: ClipboardList },
  { id: "memory", label: "Memória", icon: BrainCircuit },
  { id: "knowledge", label: "Conhecimento", icon: BookOpen },
  { id: "evaluations", label: "Avaliações", icon: FlaskConical },
  { id: "clinical", label: "Rascunhos clínicos", icon: FileHeart },
];

function roleName(role: unknown): string {
  if (typeof role === "string") return role;
  if (typeof role === "object" && role !== null && "nome" in role) {
    return String((role as { nome?: unknown }).nome || "");
  }
  return "";
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "userMessage" in error) {
    return String((error as { userMessage?: unknown }).userMessage || fallback);
  }
  return fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "horário não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function formatDateOnly(value?: string | null): string {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "data não informada";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatAgendaWindow(value?: AgendaWindow): string {
  if (!value) return "Não informado";
  if (!value.ativo) return "Agenda fechada";
  return `${value.inicio || "?"} às ${value.fim || "?"}`;
}

function actionStatus(action: PendingAction): { label: string; className: string; Icon: typeof Clock3 } {
  if (action.status === "executed") {
    return { label: "Executada", className: "bg-vital-50 text-vital-700", Icon: CheckCircle2 };
  }
  if (action.status === "rejected") {
    return { label: "Rejeitada", className: "bg-ink-50 text-ink-600", Icon: XCircle };
  }
  if (action.status === "invalidated" || action.status === "expired") {
    return { label: action.status === "expired" ? "Expirada" : "Invalidada", className: "bg-amber-50 text-amber-800", Icon: AlertTriangle };
  }
  return { label: "Aguardando sua confirmação", className: "bg-amber-50 text-amber-800", Icon: Clock3 };
}

const MISSION_LABELS: Record<AssistantMission["type"], string> = {
  radar: "Radar proativo",
  executive_summary: "Resumo executivo",
  billing_trend: "Tendência de faturamento",
  overdue_debts: "Débitos pendentes por clínica",
  eval_lab: "Laboratório de avaliações",
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function AssistenteIAPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [view, setView] = useState<WorkspaceView>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [decidingActionId, setDecidingActionId] = useState<string | null>(null);
  const [selectedWhatsapps, setSelectedWhatsapps] = useState<Record<string, string>>({});
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [radarExecution, setRadarExecution] = useState<AutonomousExecution | null>(null);
  const [missions, setMissions] = useState<AssistantMission[]>([]);
  const [executions, setExecutions] = useState<AutonomousExecution[]>([]);
  const [evaluationRuns, setEvaluationRuns] = useState<AutonomousExecution[]>([]);
  const [approvalInbox, setApprovalInbox] = useState<PendingAction[]>([]);
  const [memories, setMemories] = useState<SupervisedMemory[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [clinicalDrafts, setClinicalDrafts] = useState<ClinicalDraft[]>([]);
  const [metrics, setMetrics] = useState<AssistantMetrics | null>(null);
  const [managementLoading, setManagementLoading] = useState(false);
  const [autonomyAction, setAutonomyAction] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "positive" | "negative">>({});
  const [memoryForm, setMemoryForm] = useState({ titulo: "", conteudo: "", categoria: "operacao" });
  const [documentForm, setDocumentForm] = useState({ titulo: "", conteudo: "", categoria: "manual", fonte: "", indexar_semanticamente: false });
  const [missionForm, setMissionForm] = useState({
    titulo: "Radar diário da gestão",
    tipo: "radar" as AssistantMission["type"],
    recorrencia: "daily" as AssistantMission["recurrence"],
    horario_local: "07:00",
    dias_semana: [0] as number[],
    clinic: "",
    months: 5,
  });
  const [error, setError] = useState("");

  const refreshConversations = async () => {
    const response = await api.get("/assistente-ia/conversas");
    setConversations(Array.isArray(response.data?.items) ? response.data.items : []);
  };

  const refreshManagement = async () => {
    setManagementLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get("/assistente-ia/resumo-executivo"),
        api.get("/assistente-ia/acoes"),
        api.get("/assistente-ia/memorias"),
        api.get("/assistente-ia/conhecimento"),
        api.get("/assistente-ia/rascunhos-clinicos"),
        api.get("/assistente-ia/metricas"),
        api.get("/assistente-ia/radar"),
        api.get("/assistente-ia/missoes"),
        api.get("/assistente-ia/execucoes?limit=30"),
        api.get("/assistente-ia/avaliacoes"),
      ]);
      if (results[0].status === "fulfilled") setExecutiveSummary(results[0].value.data);
      if (results[1].status === "fulfilled") setApprovalInbox(Array.isArray(results[1].value.data?.items) ? results[1].value.data.items : []);
      if (results[2].status === "fulfilled") setMemories(Array.isArray(results[2].value.data?.items) ? results[2].value.data.items : []);
      if (results[3].status === "fulfilled") setDocuments(Array.isArray(results[3].value.data?.items) ? results[3].value.data.items : []);
      if (results[4].status === "fulfilled") setClinicalDrafts(Array.isArray(results[4].value.data?.items) ? results[4].value.data.items : []);
      if (results[5].status === "fulfilled") setMetrics(results[5].value.data);
      if (results[6].status === "fulfilled") setRadarExecution(results[6].value.data?.execution || null);
      if (results[7].status === "fulfilled") setMissions(Array.isArray(results[7].value.data?.items) ? results[7].value.data.items : []);
      if (results[8].status === "fulfilled") setExecutions(Array.isArray(results[8].value.data?.items) ? results[8].value.data.items : []);
      if (results[9].status === "fulfilled") setEvaluationRuns(Array.isArray(results[9].value.data?.items) ? results[9].value.data.items : []);
    } finally {
      setManagementLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const me = await api.get("/auth/me");
        const roles = Array.isArray(me.data?.papeis) ? me.data.papeis : [];
        const isAdmin = roles.some((role: unknown) => roleName(role).toLowerCase() === "admin");
        if (!isAdmin) {
          if (!cancelled) setAuthorized(false);
          router.replace("/dashboard");
          return;
        }
        const [statusResponse, conversationsResponse] = await Promise.all([
          api.get("/assistente-ia/status"),
          api.get("/assistente-ia/conversas"),
        ]);
        if (cancelled) return;
        setAuthorized(true);
        setStatus(statusResponse.data);
        setConversations(
          Array.isArray(conversationsResponse.data?.items) ? conversationsResponse.data.items : [],
        );
        void refreshManagement();
      } catch (initializationError) {
        if (cancelled) return;
        setAuthorized(false);
        setError(errorMessage(initializationError, "Não foi possível iniciar a Mente FortCordis."));
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pendingActions, loading]);

  const startConversation = () => {
    setConversationId(null);
    setMessages([]);
    setPendingActions([]);
    setInput("");
    setSelectedWhatsapps({});
    setCopiedActionId(null);
    setError("");
  };

  const openConversation = async (id: string) => {
    if (loading || loadingHistory) return;
    setLoadingHistory(true);
    setError("");
    try {
      const response = await api.get(`/assistente-ia/conversas/${id}`);
      const conversation = response.data as Conversation;
      setConversationId(conversation.id);
      setMessages(Array.isArray(conversation.messages) ? conversation.messages : []);
      setPendingActions(Array.isArray(conversation.pending_actions) ? conversation.pending_actions : []);
    } catch (historyError) {
      setError(errorMessage(historyError, "Não foi possível carregar esta conversa."));
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    const cleanInput = input.trim();
    if (!cleanInput || loading || !status?.enabled || !status?.configured) return;

    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: optimisticId, role: "user", content: cleanInput },
    ]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/assistente-ia/chat", {
        mensagem: cleanInput,
        conversa_id: conversationId,
      });
      const data = response.data;
      const newConversationId = String(data.conversation?.id || conversationId || "");
      setConversationId(newConversationId || null);
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticId),
        data.user_message,
        data.assistant_message,
      ]);
      if (Array.isArray(data.pending_actions) && data.pending_actions.length > 0) {
        setPendingActions((current) => {
          const map = new Map(current.map((action) => [action.id, action]));
          data.pending_actions.forEach((action: PendingAction) => map.set(action.id, action));
          return Array.from(map.values());
        });
      }
      await refreshConversations();
    } catch (sendError) {
      setError(errorMessage(sendError, "A Mente FortCordis não conseguiu concluir a solicitação."));
    } finally {
      setLoading(false);
    }
  };

  const decideAction = async (actionId: string, decision: "approve" | "reject") => {
    setDecidingActionId(actionId);
    setError("");
    try {
      const response = await api.post(`/assistente-ia/acoes/${actionId}/decisao`, {
        decisao: decision,
        observacao: decision === "approve" ? "Confirmado na Mente FortCordis" : "Rejeitado na Mente FortCordis",
      });
      const updated = response.data?.action as PendingAction;
      setPendingActions((current) => current.map((action) => (action.id === updated.id ? updated : action)));
      setApprovalInbox((current) => current.filter((action) => action.id !== updated.id));
      void refreshManagement();
    } catch (decisionError) {
      setError(errorMessage(decisionError, "Não foi possível processar esta confirmação."));
      if (conversationId) await openConversation(conversationId);
    } finally {
      setDecidingActionId(null);
    }
  };

  const submitFeedback = async (message: AssistantMessage, rating: "positive" | "negative") => {
    if (typeof message.id !== "number" || feedbackSent[String(message.id)]) return;
    let correction = "";
    if (rating === "negative") {
      correction = window.prompt("O que a Mente deveria ter respondido ou feito diferente?", "") || "";
    }
    try {
      await api.post("/assistente-ia/feedbacks", {
        mensagem_id: message.id,
        avaliacao: rating,
        categoria: rating === "negative" ? "correcao" : "util",
        comentario: null,
        correcao_esperada: correction || null,
      });
      setFeedbackSent((current) => ({ ...current, [String(message.id)]: rating }));
      void refreshManagement();
    } catch (feedbackError) {
      setError(errorMessage(feedbackError, "Não foi possível registrar sua avaliação."));
    }
  };

  const submitMemory = async () => {
    if (!memoryForm.titulo.trim() || !memoryForm.conteudo.trim()) return;
    try {
      await api.post("/assistente-ia/memorias", memoryForm);
      setMemoryForm({ titulo: "", conteudo: "", categoria: "operacao" });
      await refreshManagement();
    } catch (memoryError) {
      setError(errorMessage(memoryError, "Não foi possível salvar a memória."));
    }
  };

  const decideMemory = async (memoryId: string, decision: "approve" | "reject") => {
    try {
      await api.post(`/assistente-ia/memorias/${memoryId}/decisao`, { decisao: decision });
      await refreshManagement();
    } catch (memoryError) {
      setError(errorMessage(memoryError, "Não foi possível decidir esta memória."));
    }
  };

  const submitDocument = async () => {
    if (!documentForm.titulo.trim() || documentForm.conteudo.trim().length < 20) return;
    if (documentForm.indexar_semanticamente && !documentForm.fonte.trim()) {
      setError("Informe a fonte do documento antes de ativar a memória semântica.");
      return;
    }
    try {
      await api.post("/assistente-ia/conhecimento", documentForm);
      setDocumentForm({ titulo: "", conteudo: "", categoria: "manual", fonte: "", indexar_semanticamente: false });
      await refreshManagement();
    } catch (documentError) {
      setError(errorMessage(documentError, "Não foi possível incluir o documento."));
    }
  };

  const runRadar = async () => {
    setAutonomyAction("radar");
    setError("");
    try {
      const response = await api.post("/assistente-ia/radar/executar");
      setRadarExecution(response.data?.execution || null);
      await refreshManagement();
    } catch (radarError) {
      setError(errorMessage(radarError, "Não foi possível atualizar o radar."));
    } finally {
      setAutonomyAction(null);
    }
  };

  const submitMission = async () => {
    if (!missionForm.titulo.trim()) return;
    setAutonomyAction("create-mission");
    setError("");
    const configuration = missionForm.tipo === "billing_trend"
      ? { months: missionForm.months, clinic: missionForm.clinic.trim() || null }
      : missionForm.tipo === "overdue_debts"
        ? { clinic: missionForm.clinic.trim(), overdue_only: true }
        : {};
    try {
      await api.post("/assistente-ia/missoes", {
        titulo: missionForm.titulo,
        tipo: missionForm.tipo,
        configuracao: configuration,
        recorrencia: missionForm.recorrencia,
        horario_local: missionForm.horario_local,
        dias_semana: missionForm.recorrencia === "weekly" ? missionForm.dias_semana : [],
        enabled: true,
      });
      await refreshManagement();
    } catch (missionError) {
      setError(errorMessage(missionError, "Não foi possível criar a missão."));
    } finally {
      setAutonomyAction(null);
    }
  };

  const toggleMission = async (mission: AssistantMission) => {
    setAutonomyAction(`toggle-${mission.id}`);
    setError("");
    try {
      await api.patch(`/assistente-ia/missoes/${mission.id}`, { enabled: !mission.enabled });
      await refreshManagement();
    } catch (missionError) {
      setError(errorMessage(missionError, "Não foi possível alterar a missão."));
    } finally {
      setAutonomyAction(null);
    }
  };

  const runMission = async (mission: AssistantMission) => {
    setAutonomyAction(`run-${mission.id}`);
    setError("");
    try {
      await api.post(`/assistente-ia/missoes/${mission.id}/executar`);
      await refreshManagement();
    } catch (missionError) {
      setError(errorMessage(missionError, "Não foi possível enfileirar a missão."));
    } finally {
      setAutonomyAction(null);
    }
  };

  const runEvaluation = async () => {
    setAutonomyAction("evaluation");
    setError("");
    try {
      await api.post("/assistente-ia/avaliacoes/executar");
      await refreshManagement();
    } catch (evaluationError) {
      setError(errorMessage(evaluationError, "Não foi possível iniciar o laboratório."));
    } finally {
      setAutonomyAction(null);
    }
  };

  const reindexDocument = async (documentId: string) => {
    setAutonomyAction(`index-${documentId}`);
    setError("");
    try {
      await api.post(`/assistente-ia/conhecimento/${documentId}/reindexar`);
      await refreshManagement();
    } catch (indexError) {
      setError(errorMessage(indexError, "Não foi possível iniciar a indexação semântica."));
    } finally {
      setAutonomyAction(null);
    }
  };

  const copyCommunication = async (action: PendingAction) => {
    const message = String(action.result?.comunicacao?.mensagem || "");
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopiedActionId(action.id);
      window.setTimeout(() => setCopiedActionId((current) => (current === action.id ? null : current)), 1800);
    } catch {
      setError("Não foi possível copiar a mensagem automaticamente.");
    }
  };

  const openWhatsApp = (action: PendingAction) => {
    const communication = action.result?.comunicacao;
    const message = String(communication?.mensagem || "");
    const phones = Array.isArray(communication?.telefones) ? communication.telefones.filter(Boolean) : [];
    const selectedPhone = selectedWhatsapps[action.id] || phones[0] || "";
    if (!message) return;
    window.open(montarLinkWhatsAppReserva(selectedPhone, message), "_blank", "noopener,noreferrer");
  };

  if (authorized !== true) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center bg-shell px-6">
          <div className="flex items-center gap-3 text-ink-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {error || "Validando acesso administrativo..."}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const assistantReady = Boolean(status?.enabled && status?.configured);
  const radarOutput = radarExecution?.output as unknown as RadarOutput | undefined;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-shell p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-700 to-vital-900 p-6 text-white shadow-fort-card sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-vital-100">
                  <BrainCircuit className="h-5 w-5" />
                  Inteligência de gestão exclusiva do administrador
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Mente FortCordis</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Consulte a operação em linguagem natural. A IA usa ferramentas delimitadas do sistema,
                  mantém o histórico e pede sua confirmação antes de criar, reservar, excluir ou alterar o funcionamento da agenda.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
                <span className={`h-2.5 w-2.5 rounded-full ${assistantReady ? "bg-emerald-400" : "bg-amber-400"}`} />
                {assistantReady ? `Pronta · ${status?.model}` : "Configuração pendente no backend"}
              </div>
            </div>
          </header>

          {!assistantReady ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">A interface está pronta, mas a credencial ainda não chegou ao processo do backend.</p>
                <p className="mt-1 text-amber-800">Configure OPENAI_API_KEY no ambiente do servidor para liberar as conversas.</p>
              </div>
            </div>
          ) : null}

          <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-ink-100 bg-white p-2 shadow-sm">
            {WORKSPACE_VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  view === id ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                {id === "approvals" && approvalInbox.length > 0 ? (
                  <span className="rounded-full bg-cordis-500 px-1.5 py-0.5 text-[10px] text-white">{approvalInbox.length}</span>
                ) : null}
                {id === "memory" && memories.some((item) => item.status === "pending") ? (
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                ) : null}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void refreshManagement()}
              className="ml-auto flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-500 hover:bg-ink-50"
            >
              <RefreshCw className={`h-4 w-4 ${managementLoading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </nav>

          {view !== "chat" ? (
            <section className="min-h-[620px] rounded-3xl border border-ink-100 bg-white p-5 shadow-fort-card sm:p-7">
              {error ? (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-cordis-50 px-3 py-2 text-sm text-cordis-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              ) : null}

              {view === "radar" ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3"><Radar className="h-7 w-7 text-cordis-600" /><h2 className="text-2xl font-bold text-ink-900">Radar proativo</h2></div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Compara faturamento, agenda, cancelamentos, débitos e pendências para chamar sua atenção antes que virem problemas.</p>
                    </div>
                    <button type="button" onClick={() => void runRadar()} disabled={autonomyAction === "radar"} className="flex items-center gap-2 rounded-xl bg-cordis-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                      {autonomyAction === "radar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar radar
                    </button>
                  </div>
                  {radarOutput ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-ink-100 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Faturamento comparável</p><p className="mt-2 text-2xl font-bold text-ink-900">{radarOutput.indicators.revenue.change_percent == null ? "—" : `${radarOutput.indicators.revenue.change_percent > 0 ? "+" : ""}${radarOutput.indicators.revenue.change_percent}%`}</p><p className="mt-1 text-xs text-ink-500">R$ {radarOutput.indicators.revenue.current_period.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no período atual</p></div>
                        <div className="rounded-2xl border border-ink-100 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Agenda · 7 dias</p><p className="mt-2 text-2xl font-bold text-ink-900">{radarOutput.indicators.appointments.last_7_days}</p><p className="mt-1 text-xs text-ink-500">anterior: {radarOutput.indicators.appointments.previous_7_days}</p></div>
                        <div className="rounded-2xl border border-ink-100 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Cancelamentos</p><p className="mt-2 text-2xl font-bold text-ink-900">{radarOutput.indicators.appointments.cancelled_last_7_days}</p><p className="mt-1 text-xs text-ink-500">anterior: {radarOutput.indicators.appointments.cancelled_previous_7_days}</p></div>
                        <div className="rounded-2xl border border-ink-100 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Débitos vencidos</p><p className="mt-2 text-2xl font-bold text-ink-900">R$ {radarOutput.indicators.overdue.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-ink-500">{radarOutput.indicators.overdue.count} conta(s)</p></div>
                      </div>
                      <div className="space-y-3">
                        {radarOutput.alerts.map((alert) => (
                          <article key={alert.key} className={`rounded-2xl border p-5 ${alert.level === "critical" ? "border-cordis-200 bg-cordis-50" : alert.level === "ok" ? "border-vital-100 bg-vital-50" : "border-amber-200 bg-amber-50/60"}`}>
                            <div className="flex items-start gap-3"><AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${alert.level === "ok" ? "text-vital-600" : alert.level === "critical" ? "text-cordis-600" : "text-amber-600"}`} /><div><h3 className="font-semibold text-ink-900">{alert.title}</h3><p className="mt-1 text-sm leading-6 text-ink-600">{alert.evidence}</p><p className="mt-2 text-sm font-medium text-ink-800">Próximo passo: {alert.recommendation}</p></div></div>
                          </article>
                        ))}
                      </div>
                      <p className="flex items-center gap-2 text-xs font-semibold text-vital-700"><ShieldCheck className="h-4 w-4" /> {radarOutput.safety}</p>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-ink-50 p-6 text-sm text-ink-600">O Radar ainda não possui uma leitura. Clique em “Atualizar radar” ou crie uma missão recorrente.</div>
                  )}
                </div>
              ) : null}

              {view === "brief" ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><h2 className="text-2xl font-bold text-ink-900">Resumo executivo diário</h2><p className="mt-1 text-sm text-ink-500">Leitura consolidada da operação em {formatDateOnly(executiveSummary?.date)}.</p></div>
                    <span className="rounded-full bg-vital-50 px-3 py-1 text-xs font-semibold text-vital-700">Atualização sob demanda</span>
                  </div>
                  {executiveSummary ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          { label: "Agenda do dia", value: executiveSummary.agenda.total, detail: `${executiveSummary.agenda.reservations_expiring_6h} reserva(s) próximas do prazo`, icon: CalendarClock },
                          { label: "Faturamento no mês", value: `R$ ${executiveSummary.finance.month_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, detail: "entradas recebidas", icon: BarChart3 },
                          { label: "Débitos vencidos", value: executiveSummary.finance.overdue_count, detail: `R$ ${executiveSummary.finance.overdue_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: ReceiptText },
                          { label: "Aprovações", value: executiveSummary.pending_approvals, detail: "ações aguardando decisão", icon: ClipboardList },
                        ].map(({ label, value, detail, icon: Icon }) => (
                          <div key={label} className="rounded-2xl border border-ink-100 p-5"><Icon className="h-5 w-5 text-cordis-600" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p><p className="mt-1 text-2xl font-bold text-ink-900">{value}</p><p className="mt-1 text-xs text-ink-500">{detail}</p></div>
                        ))}
                      </div>
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-2xl bg-ink-50 p-5"><h3 className="font-semibold text-ink-900">Alertas e prioridades</h3><div className="mt-3 space-y-2">{executiveSummary.alerts.map((alert, index) => <div key={`${alert.message}-${index}`} className="flex items-start gap-2 rounded-xl bg-white p-3 text-sm text-ink-700"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.level === "ok" ? "text-vital-600" : "text-amber-600"}`} />{alert.message}</div>)}</div></div>
                        <div className="rounded-2xl bg-ink-50 p-5"><h3 className="font-semibold text-ink-900">Qualidade da Mente · {metrics?.period_days || 30} dias</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-white p-3"><dt className="text-ink-400">Respostas</dt><dd className="mt-1 text-xl font-bold text-ink-900">{metrics?.assistant_responses || 0}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-ink-400">Latência média</dt><dd className="mt-1 text-xl font-bold text-ink-900">{metrics?.average_latency_ms ? `${(metrics.average_latency_ms / 1000).toFixed(1)}s` : "—"}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-ink-400">Úteis</dt><dd className="mt-1 text-xl font-bold text-vital-700">{metrics?.feedback.positive || 0}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-ink-400">A corrigir</dt><dd className="mt-1 text-xl font-bold text-cordis-700">{metrics?.feedback.negative || 0}</dd></div></dl></div>
                      </div>
                    </>
                  ) : <p className="text-sm text-ink-400">Carregando a leitura executiva...</p>}
                </div>
              ) : null}

              {view === "missions" ? (
                <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
                  <div>
                    <div className="flex items-center gap-3"><Target className="h-7 w-7 text-cordis-600" /><h2 className="text-2xl font-bold text-ink-900">Missões recorrentes</h2></div>
                    <p className="mt-2 text-sm leading-6 text-ink-500">A Mente executa apenas consultas permitidas. Missões nunca criam, apagam ou alteram dados operacionais.</p>
                    <div className="mt-5 space-y-3 rounded-2xl bg-ink-50 p-4">
                      <input value={missionForm.titulo} onChange={(event) => setMissionForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Nome da missão" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" />
                      <select value={missionForm.tipo} onChange={(event) => setMissionForm((current) => ({ ...current, tipo: event.target.value as AssistantMission["type"], titulo: MISSION_LABELS[event.target.value as AssistantMission["type"]] }))} className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm">
                        {Object.entries(MISSION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      {missionForm.tipo === "billing_trend" ? <div className="grid grid-cols-2 gap-2"><input type="number" min={2} max={24} value={missionForm.months} onChange={(event) => setMissionForm((current) => ({ ...current, months: Number(event.target.value) || 5 }))} className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><input value={missionForm.clinic} onChange={(event) => setMissionForm((current) => ({ ...current, clinic: event.target.value }))} placeholder="Clínica opcional" className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /></div> : null}
                      {missionForm.tipo === "overdue_debts" ? <input value={missionForm.clinic} onChange={(event) => setMissionForm((current) => ({ ...current, clinic: event.target.value }))} placeholder="Clínica obrigatória" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /> : null}
                      <div className="grid grid-cols-2 gap-2"><select value={missionForm.recorrencia} onChange={(event) => setMissionForm((current) => ({ ...current, recorrencia: event.target.value as AssistantMission["recurrence"] }))} className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm"><option value="daily">Todos os dias</option><option value="weekly">Semanal</option></select><input type="time" value={missionForm.horario_local} onChange={(event) => setMissionForm((current) => ({ ...current, horario_local: event.target.value }))} className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /></div>
                      {missionForm.recorrencia === "weekly" ? <div className="flex flex-wrap gap-1.5">{WEEKDAY_LABELS.map((label, index) => <button key={label} type="button" onClick={() => setMissionForm((current) => ({ ...current, dias_semana: current.dias_semana.includes(index) ? current.dias_semana.filter((day) => day !== index) : [...current.dias_semana, index] }))} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${missionForm.dias_semana.includes(index) ? "bg-ink-900 text-white" : "bg-white text-ink-500"}`}>{label}</button>)}</div> : null}
                      <button type="button" onClick={() => void submitMission()} disabled={autonomyAction === "create-mission" || (missionForm.tipo === "overdue_debts" && !missionForm.clinic.trim())} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cordis-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{autonomyAction === "create-mission" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar missão</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {missions.map((mission) => {
                      const recentExecution = executions.find((item) => item.mission_id === mission.id);
                      return <article key={mission.id} className="rounded-2xl border border-ink-100 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink-900">{mission.title}</p><p className="mt-1 text-xs text-ink-400">{MISSION_LABELS[mission.type]} · {mission.recurrence === "daily" ? "diária" : `semanal (${mission.weekdays.map((day) => WEEKDAY_LABELS[day]).join(", ")})`} às {mission.local_time}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${mission.enabled ? "bg-vital-50 text-vital-700" : "bg-ink-50 text-ink-500"}`}>{mission.enabled ? "Ativa" : "Pausada"}</span></div><div className="mt-4 grid gap-2 text-xs text-ink-500 sm:grid-cols-2"><p>Próxima: {mission.enabled ? formatDateTime(mission.next_run_at) : "pausada"}</p><p>Última: {mission.last_run_at ? formatDateTime(mission.last_run_at) : "ainda não executada"}</p></div>{recentExecution ? <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">Execução mais recente: <strong>{recentExecution.status === "completed" ? "concluída" : recentExecution.status === "error" ? "falhou" : "na fila/processando"}</strong>{recentExecution.error ? ` · ${recentExecution.error}` : ""}</div> : null}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => void toggleMission(mission)} disabled={autonomyAction === `toggle-${mission.id}`} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600">{mission.enabled ? "Pausar" : "Ativar"}</button><button type="button" onClick={() => void runMission(mission)} disabled={autonomyAction === `run-${mission.id}`} className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white">{autonomyAction === `run-${mission.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Executar agora</button></div></article>;
                    })}
                    {missions.length === 0 ? <div className="rounded-2xl bg-ink-50 p-5 text-sm text-ink-500">Nenhuma missão criada. Comece pelo Radar diário da gestão.</div> : null}
                  </div>
                </div>
              ) : null}

              {view === "approvals" ? (
                <div><h2 className="text-2xl font-bold text-ink-900">Caixa central de aprovações</h2><p className="mt-1 text-sm text-ink-500">Todas as ações propostas pela Mente, independentemente da conversa.</p><div className="mt-6 space-y-4">{approvalInbox.length === 0 ? <div className="rounded-2xl bg-vital-50 p-5 text-sm text-vital-800">Nenhuma ação aguardando sua decisão.</div> : approvalInbox.map((action) => <div key={action.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink-900">{action.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-ink-500">Expira em {formatDateTime(action.expires_at)}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Requer confirmação</span></div><pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs leading-5 text-ink-600">{JSON.stringify(action.target, null, 2)}</pre><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => void decideAction(action.id, "reject")} className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700">Rejeitar</button><button type="button" onClick={() => void decideAction(action.id, "approve")} className="rounded-xl bg-cordis-600 px-4 py-2 text-sm font-semibold text-white">Confirmar ação</button></div></div>)}</div></div>
              ) : null}

              {view === "memory" ? (
                <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"><div><h2 className="text-2xl font-bold text-ink-900">Memória supervisionada</h2><p className="mt-1 text-sm leading-6 text-ink-500">O que você cadastrar entra aprovado. O que a IA propuser fica pendente até sua decisão.</p><div className="mt-5 space-y-3 rounded-2xl bg-ink-50 p-4"><input value={memoryForm.titulo} onChange={(event) => setMemoryForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Título da regra ou preferência" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><input value={memoryForm.categoria} onChange={(event) => setMemoryForm((current) => ({ ...current, categoria: event.target.value }))} placeholder="Categoria" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><textarea value={memoryForm.conteudo} onChange={(event) => setMemoryForm((current) => ({ ...current, conteudo: event.target.value }))} rows={5} placeholder="Ex.: sempre priorizamos..." className="w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><button type="button" onClick={() => void submitMemory()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cordis-600 px-4 py-2.5 text-sm font-semibold text-white"><Save className="h-4 w-4" /> Salvar memória aprovada</button></div></div><div className="space-y-3">{memories.map((memory) => <div key={memory.id} className="rounded-2xl border border-ink-100 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink-900">{memory.title}</p><p className="mt-1 text-xs text-ink-400">{memory.category} · origem {memory.source}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${memory.status === "approved" ? "bg-vital-50 text-vital-700" : memory.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-ink-50 text-ink-500"}`}>{memory.status === "approved" ? "Aprovada" : memory.status === "pending" ? "Aguardando revisão" : "Rejeitada"}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-600">{memory.content}</p>{memory.status === "pending" ? <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => void decideMemory(memory.id, "reject")} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600">Rejeitar</button><button type="button" onClick={() => void decideMemory(memory.id, "approve")} className="rounded-lg bg-vital-600 px-3 py-2 text-xs font-semibold text-white">Aprovar memória</button></div> : null}</div>)}{memories.length === 0 ? <p className="text-sm text-ink-400">Nenhuma memória cadastrada ainda.</p> : null}</div></div>
              ) : null}

              {view === "knowledge" ? (
                <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]"><div><h2 className="text-2xl font-bold text-ink-900">Memória semântica com fontes</h2><p className="mt-1 text-sm leading-6 text-ink-500">Adicione manuais, modelos e procedimentos. A busca híbrida combina palavras e significado, sempre citando a fonte cadastrada.</p><div className="mt-5 space-y-3 rounded-2xl bg-ink-50 p-4"><input value={documentForm.titulo} onChange={(event) => setDocumentForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Título do documento" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-2"><input value={documentForm.categoria} onChange={(event) => setDocumentForm((current) => ({ ...current, categoria: event.target.value }))} placeholder="Categoria" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><input value={documentForm.fonte} onChange={(event) => setDocumentForm((current) => ({ ...current, fonte: event.target.value }))} placeholder="Fonte recomendada" className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /></div><textarea value={documentForm.conteudo} onChange={(event) => setDocumentForm((current) => ({ ...current, conteudo: event.target.value }))} rows={12} placeholder="Cole aqui o conteúdo..." className="w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" /><label className="flex items-start gap-3 rounded-xl border border-vital-100 bg-white p-3 text-xs leading-5 text-ink-600"><input type="checkbox" checked={documentForm.indexar_semanticamente} onChange={(event) => setDocumentForm((current) => ({ ...current, indexar_semanticamente: event.target.checked }))} className="mt-1" /><span><strong className="block text-ink-800">Ativar memória semântica</strong>O texto será enviado à OpenAI apenas para gerar vetores; os vetores e os trechos permanecem no banco da FortCordis.</span></label><button type="button" onClick={() => void submitDocument()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cordis-600 px-4 py-2.5 text-sm font-semibold text-white"><Database className="h-4 w-4" /> Incluir na base</button></div></div><div className="space-y-3">{documents.map((document) => <div key={document.id} className="flex items-start gap-3 rounded-2xl border border-ink-100 p-4"><BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-cordis-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-ink-900">{document.title}</p><p className="mt-1 text-xs text-ink-400">{document.category}{document.source ? ` · fonte: ${document.source}` : " · fonte não informada"}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${document.semantic_status === "ready" ? "bg-vital-50 text-vital-700" : document.semantic_status === "error" ? "bg-cordis-50 text-cordis-700" : document.semantic_status === "queued" || document.semantic_status === "indexing" ? "bg-amber-50 text-amber-800" : "bg-ink-50 text-ink-500"}`}>{document.semantic_status === "ready" ? "Semântica pronta" : document.semantic_status === "error" ? "Falha na indexação" : document.semantic_status === "queued" ? "Na fila" : document.semantic_status === "indexing" ? "Indexando" : "Busca por palavras"}</span></div>{document.semantic_error ? <p className="mt-2 text-xs text-cordis-700">{document.semantic_error}</p> : null}{document.semantic_status !== "queued" && document.semantic_status !== "indexing" ? <button type="button" onClick={() => void reindexDocument(document.id)} disabled={autonomyAction === `index-${document.id}`} className="mt-3 flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 disabled:opacity-50">{autonomyAction === `index-${document.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {document.semantic_status === "ready" ? "Reindexar" : "Ativar semântica"}</button> : null}</div></div>)}{documents.length === 0 ? <p className="text-sm text-ink-400">Nenhum documento ativo na base interna.</p> : null}</div></div>
              ) : null}

              {view === "evaluations" ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><FlaskConical className="h-7 w-7 text-cordis-600" /><h2 className="text-2xl font-bold text-ink-900">Laboratório automático de avaliações</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Executa casos versionados contra o modelo atual e mede o roteamento. As ferramentas reais nunca são chamadas durante o teste.</p></div><button type="button" onClick={() => void runEvaluation()} disabled={autonomyAction === "evaluation" || evaluationRuns.some((item) => item.status === "queued" || item.status === "running")} className="flex items-center gap-2 rounded-xl bg-cordis-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{autonomyAction === "evaluation" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Executar avaliação</button></div>
                  <div className="space-y-3">
                    {evaluationRuns.map((run) => {
                      const output = run.output as { dataset_version?: string; model?: string; total?: number; passed?: number; failed?: number; score_percent?: number; cases?: Array<{ id: string; expected_tool: string; selected_tools: string[]; passed: boolean; error?: string | null }>; safety?: string } | null | undefined;
                      return <article key={run.id} className="rounded-2xl border border-ink-100 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink-900">Avaliação de {formatDateTime(run.created_at)}</p><p className="mt-1 text-xs text-ink-400">{output?.model || status?.model} · dataset {output?.dataset_version || "versionado"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${run.status === "completed" ? "bg-vital-50 text-vital-700" : run.status === "error" ? "bg-cordis-50 text-cordis-700" : "bg-amber-50 text-amber-800"}`}>{run.status === "completed" ? "Concluída" : run.status === "error" ? "Falhou" : "Na fila/processando"}</span></div>{output ? <><div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Nota</p><p className="mt-1 text-xl font-bold text-ink-900">{output.score_percent ?? 0}%</p></div><div className="rounded-xl bg-vital-50 p-3"><p className="text-xs text-vital-700">Aprovados</p><p className="mt-1 text-xl font-bold text-vital-800">{output.passed ?? 0}</p></div><div className="rounded-xl bg-cordis-50 p-3"><p className="text-xs text-cordis-700">Falhas</p><p className="mt-1 text-xl font-bold text-cordis-800">{output.failed ?? 0}</p></div></div>{(output.cases || []).some((item) => !item.passed) ? <div className="mt-4 space-y-2">{(output.cases || []).filter((item) => !item.passed).map((item) => <div key={item.id} className="rounded-xl bg-cordis-50 p-3 text-xs text-cordis-800"><strong>{item.id}</strong>: esperava {item.expected_tool}; escolheu {item.selected_tools.join(", ") || "nenhuma"}{item.error ? ` · ${item.error}` : ""}</div>)}</div> : <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-vital-700"><CheckCircle2 className="h-4 w-4" /> Todos os casos escolheram a ferramenta esperada.</p>}<p className="mt-4 flex items-center gap-2 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 text-vital-600" /> {output.safety}</p></> : run.error ? <p className="mt-4 text-sm text-cordis-700">{run.error}</p> : <p className="mt-4 text-sm text-ink-500">Aguardando o worker seguro concluir os casos.</p>}</article>;
                    })}
                    {evaluationRuns.length === 0 ? <div className="rounded-2xl bg-ink-50 p-5 text-sm text-ink-500">Nenhuma avaliação executada. Você também pode criar uma missão semanal para este laboratório.</div> : null}
                  </div>
                </div>
              ) : null}

              {view === "clinical" ? (
                <div><div className="flex items-start gap-3"><FileHeart className="h-7 w-7 text-cordis-600" /><div><h2 className="text-2xl font-bold text-ink-900">Rascunhos clínicos assistidos</h2><p className="mt-1 text-sm text-ink-500">Conteúdo separado do laudo oficial. A finalização continua exclusivamente humana.</p></div></div><div className="mt-6 grid gap-4 lg:grid-cols-2">{clinicalDrafts.map((draft) => <article key={draft.id} className="rounded-2xl border border-ink-100 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink-900">{draft.title}</p><p className="mt-1 text-xs text-ink-400">Laudo #{draft.report_id} · {formatDateTime(draft.created_at)}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Rascunho</span></div><p className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6 text-ink-600">{draft.content}</p>{draft.alerts.length > 0 ? <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{draft.alerts.map((alert) => <p key={alert}>• {alert}</p>)}</div> : null}<div className="mt-4 flex items-center gap-2 text-xs font-semibold text-vital-700"><ShieldCheck className="h-4 w-4" /> Laudo oficial não modificado</div></article>)}{clinicalDrafts.length === 0 ? <div className="rounded-2xl bg-ink-50 p-5 text-sm text-ink-500">Peça na conversa: “Ajude a elaborar o laudo #...”</div> : null}</div></div>
              ) : null}
            </section>
          ) : (
          <div className="grid min-h-[680px] overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-fort-card lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-ink-100 bg-ink-50/60 p-4 lg:border-b-0 lg:border-r">
              <button
                type="button"
                onClick={startConversation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cordis-600 px-4 py-3 text-sm font-semibold text-white shadow-fort-soft transition hover:bg-cordis-700"
              >
                <Plus className="h-4 w-4" /> Nova conversa
              </button>
              <div className="mt-5 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-[0.15em] text-ink-400">
                <MessageSquare className="h-3.5 w-3.5" /> Histórico
              </div>
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto lg:max-h-[540px]">
                {conversations.length === 0 ? (
                  <p className="px-2 py-4 text-sm leading-5 text-ink-400">As conversas aparecerão aqui.</p>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      type="button"
                      key={conversation.id}
                      onClick={() => void openConversation(conversation.id)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        conversationId === conversation.id
                          ? "bg-white text-ink-900 shadow-sm ring-1 ring-ink-100"
                          : "text-ink-600 hover:bg-white/70"
                      }`}
                    >
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                      {conversation.updated_at ? (
                        <span className="mt-1 block text-xs text-ink-400">{formatDateTime(conversation.updated_at)}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <div className="mt-5 rounded-2xl border border-vital-100 bg-vital-50 p-4 text-xs leading-5 text-vital-900">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Controle administrativo
                </div>
                Consultas são automáticas. Alterações operacionais exigem confirmação e deixam registro de auditoria.
              </div>
            </aside>

            <section className="flex min-h-[680px] min-w-0 flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingHistory ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Carregando conversa...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mx-auto flex min-h-[480px] max-w-3xl flex-col justify-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cordis-50 text-cordis-600">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <h2 className="mt-5 text-center text-2xl font-bold text-ink-900">Como posso ajudar na gestão hoje?</h2>
                    <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-6 text-ink-500">
                      Comece por um destes exemplos ou escreva sua solicitação com clínica, período e serviço quando souber.
                    </p>
                    <div className="mt-7 grid gap-3 sm:grid-cols-2">
                      {EXAMPLES.map(({ icon: Icon, text }) => (
                        <button
                          type="button"
                          key={text}
                          onClick={() => setInput(text)}
                          className="group flex items-start gap-3 rounded-2xl border border-ink-100 p-4 text-left text-sm leading-5 text-ink-700 transition hover:-translate-y-0.5 hover:border-cordis-200 hover:bg-cordis-50/50 hover:shadow-sm"
                        >
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cordis-500" />
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-5">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${
                            message.role === "user"
                              ? "rounded-br-md bg-ink-900 text-white"
                              : "rounded-bl-md border border-ink-100 bg-ink-50 text-ink-800"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {Array.isArray(message.tools) && message.tools.length > 0 ? (
                            <div className="mt-3 border-t border-ink-100 pt-2">
                              {message.tools.map((tool, index) => (
                                <div key={`${tool.name}-${index}`} className="flex items-center gap-2 text-xs text-ink-400">
                                  {tool.ok ? <Check className="h-3.5 w-3.5 text-vital-600" /> : <X className="h-3.5 w-3.5 text-cordis-600" />}
                                  {tool.summary}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {message.role === "assistant" && typeof message.id === "number" ? (
                            <div className="mt-3 flex items-center gap-1 border-t border-ink-100 pt-2 text-xs text-ink-400">
                              <span className="mr-1">Esta resposta ajudou?</span>
                              <button
                                type="button"
                                aria-label="Resposta útil"
                                onClick={() => void submitFeedback(message, "positive")}
                                className={`rounded-lg p-1.5 transition hover:bg-vital-50 hover:text-vital-700 ${feedbackSent[String(message.id)] === "positive" ? "bg-vital-50 text-vital-700" : ""}`}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Resposta precisa de correção"
                                onClick={() => void submitFeedback(message, "negative")}
                                className={`rounded-lg p-1.5 transition hover:bg-cordis-50 hover:text-cordis-700 ${feedbackSent[String(message.id)] === "negative" ? "bg-cordis-50 text-cordis-700" : ""}`}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {pendingActions.map((action) => {
                      const badge = actionStatus(action);
                      const BadgeIcon = badge.Icon;
                      const isDeciding = decidingActionId === action.id;
                      const isCreation = action.type === "create_appointment";
                      const isAgendaException = action.type === "update_agenda_exception";
                      const isDelete = action.type === "delete_appointment";
                      const isNewOperational = !isCreation && !isAgendaException && !isDelete;
                      const isReservation = action.target.tipo === "reserva" || action.arguments.tipo === "reserva";
                      const actionTitles: Record<string, string> = {
                        reschedule_appointment: "Remarcação de agendamento",
                        cancel_appointment: "Cancelamento de agendamento",
                        create_agenda_block: "Bloqueio de slot da agenda",
                        release_agenda_block: "Liberação de bloqueio",
                        update_clinic_whatsapps: "Atualização de WhatsApps da clínica",
                      };
                      const ActionIcon = isAgendaException ? CalendarClock : isCreation ? CalendarPlus : isDelete ? Trash2 : ShieldCheck;
                      const communication = action.result?.comunicacao;
                      const phones = Array.isArray(communication?.telefones)
                        ? communication.telefones.filter(Boolean)
                        : [];
                      const selectedPhone = selectedWhatsapps[action.id] || phones[0] || "";
                      return (
                        <div key={action.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-2 font-semibold text-ink-900">
                                <ActionIcon className="h-4 w-4 text-cordis-600" />
                                {isAgendaException
                                  ? "Funcionamento excepcional da agenda"
                                  : isCreation
                                    ? isReservation ? "Reserva de horário" : "Novo agendamento"
                                    : isDelete ? "Exclusão de agendamento" : actionTitles[action.type] || "Ação operacional"}
                              </p>
                              <p className="mt-1 text-sm text-ink-500">Esta ação não é executada sem a sua decisão.</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                              <BadgeIcon className="h-3.5 w-3.5" /> {badge.label}
                            </span>
                          </div>
                          <dl className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
                            {isNewOperational ? (
                              <div className="sm:col-span-2">
                                <dt className="text-xs text-ink-400">Alteração preparada</dt>
                                <dd><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs leading-5 text-ink-700">{JSON.stringify(action.target, null, 2)}</pre></dd>
                              </div>
                            ) : isAgendaException ? (
                              <>
                                <div><dt className="text-xs text-ink-400">Data</dt><dd className="font-medium text-ink-800">{formatDateOnly(action.target.data)}</dd></div>
                                <div><dt className="text-xs text-ink-400">Origem atual</dt><dd className="font-medium text-ink-800">{action.target.antes?.fonte === "excecao" ? "Exceção existente" : action.target.antes?.fonte === "feriado" ? "Feriado" : "Rotina semanal"}</dd></div>
                                <div><dt className="text-xs text-ink-400">Funcionamento atual</dt><dd className="font-medium text-ink-800">{formatAgendaWindow(action.target.antes)}</dd></div>
                                <div><dt className="text-xs text-ink-400">Após confirmar</dt><dd className="font-medium text-ink-800">{formatAgendaWindow(action.target.depois)}</dd></div>
                                <div className="sm:col-span-2"><dt className="text-xs text-ink-400">Motivo</dt><dd className="font-medium text-ink-800">{action.target.motivo || "Ajuste solicitado pelo administrador"}</dd></div>
                              </>
                            ) : (
                              <>
                                <div><dt className="text-xs text-ink-400">Clínica</dt><dd className="font-medium text-ink-800">{action.target.clinica_nome || "Não informada"}</dd></div>
                                <div><dt className="text-xs text-ink-400">Data e hora</dt><dd className="font-medium text-ink-800">{formatDateTime(action.target.inicio)}</dd></div>
                                <div><dt className="text-xs text-ink-400">Serviço</dt><dd className="font-medium text-ink-800">{action.target.servico_nome || "Não informado"}</dd></div>
                                <div><dt className="text-xs text-ink-400">Paciente</dt><dd className="font-medium text-ink-800">{action.target.paciente_nome || action.target.paciente_primeiro_nome || (isReservation ? "Pendente" : "Não informado")}</dd></div>
                                {isCreation ? (
                                  <>
                                    <div><dt className="text-xs text-ink-400">Tutor</dt><dd className="font-medium text-ink-800">{action.target.tutor_nome || "Pendente"}</dd></div>
                                    <div><dt className="text-xs text-ink-400">Mensagem para</dt><dd className="font-medium text-ink-800">{action.target.destinatario_mensagem?.nome || "Não informado"}</dd></div>
                                    {isReservation ? (
                                      <div className="sm:col-span-2"><dt className="text-xs text-ink-400">Prazo de confirmação</dt><dd className="font-medium text-ink-800">{formatDateTime(action.target.reserva_expira_em)}</dd></div>
                                    ) : null}
                                    {action.arguments.observacoes ? (
                                      <div className="sm:col-span-2"><dt className="text-xs text-ink-400">Observações</dt><dd className="font-medium text-ink-800">{action.arguments.observacoes}</dd></div>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="sm:col-span-2"><dt className="text-xs text-ink-400">Motivo</dt><dd className="font-medium text-ink-800">{action.arguments.motivo || "Não informado"}</dd></div>
                                )}
                              </>
                            )}
                          </dl>
                          {action.status === "pending" ? (
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                disabled={isDeciding}
                                onClick={() => void decideAction(action.id, "reject")}
                                className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                              >
                                Rejeitar
                              </button>
                              <button
                                type="button"
                                disabled={isDeciding}
                                onClick={() => void decideAction(action.id, "approve")}
                                className="flex items-center justify-center gap-2 rounded-xl bg-cordis-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cordis-700 disabled:opacity-60"
                              >
                                {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
                                {isAgendaException
                                  ? "Confirmar funcionamento"
                                  : isCreation
                                    ? isReservation ? "Confirmar reserva" : "Confirmar agendamento"
                                    : isDelete ? "Confirmar exclusão" : "Confirmar ação"}
                              </button>
                            </div>
                          ) : null}
                          {action.status === "executed" && action.result?.message ? (
                            <div className="mt-4 flex items-start gap-2 rounded-xl border border-vital-100 bg-vital-50 p-3 text-sm text-vital-800">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{action.result.message}{action.result.agendamento?.id ? ` Código #${action.result.agendamento.id}.` : ""}</span>
                            </div>
                          ) : null}
                          {action.status === "executed" && communication?.mensagem ? (
                            <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4">
                              <div className="flex items-start gap-3">
                                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-ink-900">Mensagem pronta para envio manual</p>
                                  <p className="mt-1 text-xs text-ink-500">
                                    {communication.destinatario_nome || "Destinatário"}
                                    {phones.length > 0 ? ` · ${phones.map(formatarWhatsAppVisual).join(" / ")}` : " · sem WhatsApp cadastrado"}
                                  </p>
                                </div>
                              </div>
                              <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 font-sans text-xs leading-5 text-ink-700">
                                {communication.mensagem}
                              </pre>
                              {phones.length > 1 ? (
                                <label className="mt-3 block text-xs font-medium text-ink-600">
                                  Número para abrir
                                  <select
                                    value={selectedPhone}
                                    onChange={(event) => setSelectedWhatsapps((current) => ({ ...current, [action.id]: event.target.value }))}
                                    className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-cordis-300"
                                  >
                                    {phones.map((phone) => (
                                      <option key={phone} value={phone}>{formatarWhatsAppVisual(phone)}</option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <button
                                  type="button"
                                  onClick={() => void copyCommunication(action)}
                                  className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                                >
                                  {copiedActionId === action.id ? <Check className="h-4 w-4 text-vital-600" /> : <Copy className="h-4 w-4" />}
                                  {copiedActionId === action.id ? "Copiada" : "Copiar mensagem"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openWhatsApp(action)}
                                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  <ExternalLink className="h-4 w-4" /> Abrir WhatsApp
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {loading ? (
                      <div className="flex items-center gap-3 text-sm text-ink-400">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vital-50 text-vital-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                        Consultando as ferramentas do FortCordis...
                      </div>
                    ) : null}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-ink-100 bg-white p-4 sm:p-5">
                {error ? (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-cordis-50 px-3 py-2 text-sm text-cordis-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                  </div>
                ) : null}
                <div className="mx-auto max-w-3xl">
                  <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-white p-2 shadow-sm focus-within:border-cordis-300 focus-within:ring-4 focus-within:ring-cordis-50">
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      rows={2}
                      disabled={!assistantReady || loading}
                      placeholder="Ex.: analise o faturamento dos últimos cinco meses..."
                      className="max-h-40 min-h-[48px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={!input.trim() || !assistantReady || loading}
                      aria-label="Enviar mensagem"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cordis-600 text-white transition hover:bg-cordis-700 disabled:cursor-not-allowed disabled:bg-ink-200"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[11px] leading-4 text-ink-400">
                    A IA pode errar interpretações. Dados vêm das ferramentas do sistema; revise o cartão antes de confirmar qualquer ação.
                  </p>
                </div>
              </div>
            </section>
          </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
