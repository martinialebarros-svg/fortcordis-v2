"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  CalendarPlus,
  CalendarSearch,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
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

export default function AssistenteIAPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
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
  const [error, setError] = useState("");

  const refreshConversations = async () => {
    const response = await api.get("/assistente-ia/conversas");
    setConversations(Array.isArray(response.data?.items) ? response.data.items : []);
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
    } catch (decisionError) {
      setError(errorMessage(decisionError, "Não foi possível processar esta confirmação."));
      if (conversationId) await openConversation(conversationId);
    } finally {
      setDecidingActionId(null);
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
                        </div>
                      </div>
                    ))}

                    {pendingActions.map((action) => {
                      const badge = actionStatus(action);
                      const BadgeIcon = badge.Icon;
                      const isDeciding = decidingActionId === action.id;
                      const isCreation = action.type === "create_appointment";
                      const isAgendaException = action.type === "update_agenda_exception";
                      const isReservation = action.target.tipo === "reserva" || action.arguments.tipo === "reserva";
                      const ActionIcon = isAgendaException ? CalendarClock : isCreation ? CalendarPlus : Trash2;
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
                                    : "Exclusão de agendamento"}
                              </p>
                              <p className="mt-1 text-sm text-ink-500">Esta ação não é executada sem a sua decisão.</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                              <BadgeIcon className="h-3.5 w-3.5" /> {badge.label}
                            </span>
                          </div>
                          <dl className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
                            {isAgendaException ? (
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
                                    : "Confirmar exclusão"}
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
        </div>
      </div>
    </DashboardLayout>
  );
}
