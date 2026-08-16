"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, Building2, CalendarDays, Check, CheckCheck, ChevronRight,
  CircleDot, ClipboardList, Clock3, FileText, Filter, Inbox, Info, Link2,
  MessageSquare, MessagesSquare, PawPrint, RefreshCw, Search, Send, Settings,
  Sparkles, UserCheck, UserRound, Users,
} from "lucide-react";
import DashboardLayout from "../layout-dashboard";
import {
  CustomerServiceWindow,
  evaluateCustomerServiceWindow,
} from "@/lib/whatsapp-customer-service-window";

type AssignedFilter = "all" | "assigned" | "unassigned";
type ConversationStatus = "open" | "pending" | "closed";
type ComposerMode = "message" | "template";

interface Conversation {
  id: string;
  wa_phone_number: string;
  wa_psid: string | null;
  status: string;
  subject: string | null;
  last_agent_id: string | null;
  assigned_agent_name?: string | null;
  assigned_agent_email?: string | null;
  last_activity_at: string;
  last_inbound_at?: string | null;
  created_at: string;
  updated_at: string;
  last_message_body?: string | null;
  last_message_at?: string | null;
  last_message_from_me?: boolean | null;
  last_message_type?: string | null;
  customer_service_window?: CustomerServiceWindow;
}

interface Message {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  from_me: boolean;
  body: string | null;
  type: string;
  status: string;
  created_at: string;
  metadata?: unknown;
}

interface Agent {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

interface TemplateCatalogItem {
  key: string;
  name: string;
  meta_id: string;
  language: string;
  body: string;
  body_parameter_count: number;
  variable_labels: string[];
  quick_replies: readonly string[];
  category: "agenda" | "laudos" | "financeiro";
  workflow_label: string;
  requires_document: boolean;
  can_copy_as_free_text: boolean;
  meta_approval_live: null;
}

interface Pagination { page: number; limit: number; total: number }
interface ApiResult<T> { ok: boolean; status: number; data: T | null; errorText?: string }
interface ConversationsResponse { data: Conversation[]; pagination: Pagination }
interface AgentsResponse { data: Agent[] }
interface MessagesResponse {
  data: Message[];
  pagination: Pagination;
  customer_service_window: CustomerServiceWindow;
}
interface TemplateCatalogResponse {
  data: TemplateCatalogItem[];
  source: "configured_catalog";
  meta_approval_live: null;
}
interface DomainClinic { id: number; nome: string; cidade: string | null; estado: string | null }
interface DomainTutor { id: number; nome: string }
interface DomainPet {
  id: number; tutor_id: number | null; nome: string; especie: string | null; raca: string | null;
}
interface DomainAppointment {
  id: number; inicio: string | null; fim: string | null; status: string;
  clinica_id: number | null; clinica_nome: string; tutor_id: number | null; tutor_nome: string;
  pet_id: number | null; pet_nome: string; servico_id: number | null; servico_nome: string;
}
interface DomainServiceOrder {
  id: number; numero_os: string; agendamento_id: number; data_atendimento: string | null;
  status: string; valor_final: number; clinica_id: number | null; clinica_nome: string;
  tutor_id: number | null; tutor_nome: string; pet_id: number | null; pet_nome: string;
  servico_id: number | null; servico_nome: string;
}
interface ConversationDomainContext {
  normalized_phone: string;
  resolution: "matched" | "ambiguous" | "not_found";
  match_type: "clinica" | "tutor" | null;
  clinicas: DomainClinic[];
  tutores: DomainTutor[];
  pets: DomainPet[];
  agendamentos: DomainAppointment[];
  ordens_servico: DomainServiceOrder[];
}
interface LoadMessagesOptions { isCurrent?: () => boolean; silent?: boolean }

const MESSAGE_STATUS_REFRESH_INTERVAL_MS = 5_000;
const CUSTOMER_SERVICE_WINDOW_CLOCK_INTERVAL_MS = 30_000;
const QUICK_RESPONSES = [
  "Olá! Como podemos ajudar?",
  "Recebemos sua mensagem e já estamos verificando.",
  "Obrigada. Permanecemos à disposição.",
];
const CONVERSATION_STATUS_OPTIONS: Array<{ value: "" | ConversationStatus; label: string }> = [
  { value: "", label: "Todas" },
  { value: "open", label: "Em atendimento" },
  { value: "pending", label: "Aguardando" },
  { value: "closed", label: "Resolvidas" },
];

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...getAuthHeaders(), ...(init?.headers || {}) },
  });
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const parsed = (await response.json()) as T;
    return { ok: response.ok, status: response.status, data: parsed,
      errorText: response.ok ? undefined : JSON.stringify(parsed) };
  }
  const text = await response.text();
  const normalizedText = /<!doctype html/i.test(text)
    ? "Backend WhatsApp não configurado neste ambiente."
    : text.trim().slice(0, 500);
  return { ok: response.ok, status: response.status, data: null,
    errorText: normalizedText || `HTTP ${response.status}` };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatMessageDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Hoje";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const brazilian = digits.startsWith("55") ? digits.slice(2) : digits;
  if (brazilian.length === 11) return `+55 (${brazilian.slice(0, 2)}) ${brazilian.slice(2, 7)}-${brazilian.slice(7)}`;
  if (brazilian.length === 10) return `+55 (${brazilian.slice(0, 2)}) ${brazilian.slice(2, 6)}-${brazilian.slice(6)}`;
  return value.startsWith("+") ? value : `+${value}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function conversationStatusLabel(status: string): string {
  return status === "open" ? "Em atendimento" : status === "pending" ? "Aguardando" :
    status === "closed" ? "Resolvida" : status || "Sem status";
}
function conversationStatusClass(status: string): string {
  return status === "open" ? "fc-wa-status-open" : status === "pending" ? "fc-wa-status-pending" :
    status === "closed" ? "fc-wa-status-closed" : "fc-wa-status-neutral";
}
function messageStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    read: "Lida", delivered: "Entregue", sent: "Enviada", failed: "Falhou",
    pending: "Enviando", received: "Recebida",
  };
  return labels[status] || status || "Registrada";
}
function messageStatusIcon(status: string) {
  if (status === "read" || status === "delivered") return <CheckCheck className="h-3.5 w-3.5" />;
  if (status === "sent" || status === "received") return <Check className="h-3.5 w-3.5" />;
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}
function templateCategoryLabel(category: TemplateCatalogItem["category"]): string {
  return category === "agenda" ? "Agenda" : category === "laudos" ? "Laudos" : "Financeiro";
}
function renderTemplateBody(template: TemplateCatalogItem, parameters: string[]): string {
  return template.body.replace(/\{\{(\d+)\}\}/g, (_placeholder, rawIndex: string) =>
    parameters[Number(rawIndex) - 1]?.trim() || `{{${rawIndex}}}`);
}
function getInitials(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((word) => word[0]?.toUpperCase()).join("") || "WA";
}

function DomainContextPanel({
  context,
  loading,
  error,
}: {
  context: ConversationDomainContext | null;
  loading: boolean;
  error: string | null;
}) {
  return <section className="fc-wa-domain-context" aria-live="polite">
    <div className="fc-wa-context-section-title"><Link2 className="h-4 w-4" /><h3>Vínculos do cadastro</h3></div>
    {loading ? <div className="fc-wa-domain-state"><RefreshCw className="h-4 w-4 animate-spin" /><span>Localizando cadastros pelo telefone...</span></div> :
      error ? <div className="fc-wa-domain-state fc-wa-domain-state-error"><AlertCircle className="h-4 w-4" /><span>Não foi possível consultar os vínculos agora.</span></div> :
      context?.resolution === "not_found" ? <div className="fc-wa-domain-state"><Info className="h-4 w-4" /><div><strong>Nenhum cadastro encontrado</strong><span>Confira se este número está salvo na clínica ou no tutor.</span></div></div> :
      context?.resolution === "ambiguous" ? <div className="fc-wa-domain-ambiguous"><AlertCircle className="h-4 w-4" /><div><strong>Número presente em mais de um cadastro</strong>
        <span>Revise os candidatos antes de usar dados de agenda ou financeiro.</span>
        <ul>{context.clinicas.map((clinic) => <li key={`clinic-${clinic.id}`}><Building2 className="h-3.5 w-3.5" /> Clínica: {clinic.nome}</li>)}
          {context.tutores.map((tutor) => <li key={`tutor-${tutor.id}`}><UserRound className="h-3.5 w-3.5" /> Tutor: {tutor.nome}</li>)}</ul>
      </div></div> : context?.resolution === "matched" ? <div className="fc-wa-domain-groups">
        <div className="fc-wa-domain-match"><Check className="h-4 w-4" /><span>Vínculo automático por telefone</span><strong>{context.match_type === "clinica" ? "Clínica" : "Tutor"}</strong></div>

        <div className="fc-wa-domain-group"><div><Building2 className="h-4 w-4" /><h4>Clínicas</h4><span>{context.clinicas.length}</span></div>
          {context.clinicas.length ? <ul>{context.clinicas.map((clinic) => <li key={clinic.id}><span><strong>{clinic.nome}</strong><small>{[clinic.cidade, clinic.estado].filter(Boolean).join(" · ") || "Local não informado"}</small></span>
            <Link href={`/clinicas/${clinic.id}`}>Abrir</Link></li>)}</ul> : <p>Nenhuma clínica relacionada.</p>}</div>

        <div className="fc-wa-domain-group"><div><UserRound className="h-4 w-4" /><h4>Tutores</h4><span>{context.tutores.length}</span></div>
          {context.tutores.length ? <ul>{context.tutores.map((tutor) => <li key={tutor.id}><span><strong>{tutor.nome}</strong><small>Tutor vinculado</small></span></li>)}</ul> : <p>Nenhum tutor relacionado.</p>}</div>

        <div className="fc-wa-domain-group"><div><PawPrint className="h-4 w-4" /><h4>Pets</h4><span>{context.pets.length}</span></div>
          {context.pets.length ? <ul>{context.pets.map((pet) => <li key={pet.id}><span><strong>{pet.nome}</strong><small>{[pet.especie, pet.raca].filter(Boolean).join(" · ") || "Dados não informados"}</small></span>
            <Link href={`/pacientes/${pet.id}`}>Abrir</Link></li>)}</ul> : <p>Nenhum pet relacionado.</p>}</div>

        <div className="fc-wa-domain-group"><div><CalendarDays className="h-4 w-4" /><h4>Agendamentos</h4><span>{context.agendamentos.length}</span></div>
          {context.agendamentos.length ? <ul>{context.agendamentos.map((appointment) => <li key={appointment.id}><span><strong>{appointment.pet_nome || "Pet não informado"} · {appointment.servico_nome || "Serviço"}</strong>
            <small>{formatDateTime(appointment.inicio)} · {appointment.status}</small></span><Link href={`/agenda?agendamento_id=${appointment.id}`}>Agenda</Link></li>)}</ul> : <p>Nenhum agendamento recente ou futuro.</p>}</div>

        <div className="fc-wa-domain-group"><div><ClipboardList className="h-4 w-4" /><h4>Ordens de serviço</h4><span>{context.ordens_servico.length}</span></div>
          {context.ordens_servico.length ? <ul>{context.ordens_servico.map((serviceOrder) => <li key={serviceOrder.id}><span><strong>{serviceOrder.numero_os} · {serviceOrder.pet_nome || "Pet não informado"}</strong>
            <small>{serviceOrder.servico_nome || "Serviço"} · {serviceOrder.status} · {formatCurrency(serviceOrder.valor_final)}</small></span><Link href={`/financeiro?os_id=${serviceOrder.id}`}>Financeiro</Link></li>)}</ul> : <p>Nenhuma OS relacionada.</p>}</div>
      </div> : null}
  </section>;
}

export default function WhatsAppStagePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsPagination, setConversationsPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesPagination, setMessagesPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0 });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<TemplateCatalogItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingDomainContext, setLoadingDomainContext] = useState(false);
  const [domainContext, setDomainContext] = useState<ConversationDomainContext | null>(null);
  const [domainContextError, setDomainContextError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [integrationState, setIntegrationState] = useState<"checking" | "available" | "unavailable">("checking");
  const [statusFilter, setStatusFilter] = useState<"" | ConversationStatus>("");
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("agent");
  const [agentActionId, setAgentActionId] = useState("");
  const [sendMessageBody, setSendMessageBody] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("message");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateParameters, setTemplateParameters] = useState<string[]>([]);
  const [templateCatalogError, setTemplateCatalogError] = useState<string | null>(null);
  const [customerServiceWindows, setCustomerServiceWindows] = useState<Record<string, CustomerServiceWindow>>({});
  const [customerServiceWindowClock, setCustomerServiceWindowClock] = useState(() => Date.now());
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedConversation = useMemo(() =>
    conversations.find((item) => item.id === selectedConversationId) || null,
  [conversations, selectedConversationId]);
  const selectedTemplate = useMemo(() => templates.find((item) => item.key === selectedTemplateKey) || null,
    [selectedTemplateKey, templates]);
  const selectedCustomerServiceWindow = selectedConversationId
    ? customerServiceWindows[selectedConversationId] || selectedConversation?.customer_service_window || null : null;
  const windowState = evaluateCustomerServiceWindow(selectedCustomerServiceWindow, customerServiceWindowClock);
  const conversationDisplayName = selectedConversation?.subject?.trim() || "Contato do WhatsApp";
  const selectedAgent = agents.find((agent) => agent.id === selectedConversation?.last_agent_id) || null;
  const templatePreview = selectedTemplate ? renderTemplateBody(selectedTemplate, templateParameters) : "";
  const templateComplete = Boolean(selectedTemplate &&
    templateParameters.length === selectedTemplate.body_parameter_count &&
    templateParameters.every((parameter) => parameter.trim()));

  const loadConversations = async (
    page = 1,
    overrides: { status?: "" | ConversationStatus; assigned?: AssignedFilter } = {}
  ): Promise<void> => {
    setLoadingConversations(true); setErrorMessage(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(conversationsPagination.limit) });
      const effectiveStatus = overrides.status ?? statusFilter;
      const effectiveAssigned = overrides.assigned ?? assignedFilter;
      if (effectiveStatus) params.set("status", effectiveStatus);
      if (effectiveAssigned !== "all") params.set("assigned", effectiveAssigned);
      if (searchFilter.trim()) params.set("search", searchFilter.trim());
      const result = await requestJson<ConversationsResponse>(`/whatsapp/conversations?${params}`);
      if (!result.ok || !result.data) throw new Error(result.errorText || `Falha ao carregar conversas (HTTP ${result.status})`);
      setConversations(result.data.data); setConversationsPagination(result.data.pagination); setIntegrationState("available");
      if (!selectedConversationId && result.data.data.length) setSelectedConversationId(result.data.data[0].id);
      else if (selectedConversationId && !result.data.data.some((item) => item.id === selectedConversationId))
        setSelectedConversationId(result.data.data[0]?.id ?? null);
    } catch (error) { setIntegrationState("unavailable"); setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar conversas"); }
    finally { setLoadingConversations(false); }
  };

  const loadMessages = async (conversationId: string, page = 1, options: LoadMessagesOptions = {}): Promise<void> => {
    const { isCurrent, silent = false } = options;
    if (!silent) setLoadingMessages(true); setErrorMessage(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(messagesPagination.limit) });
      const result = await requestJson<MessagesResponse>(`/whatsapp/conversations/${conversationId}/messages?${params}`);
      if (!result.ok || !result.data) throw new Error(result.errorText || `Falha ao carregar mensagens (HTTP ${result.status})`);
      if (!isCurrent || isCurrent()) {
        setMessages(result.data.data); setMessagesPagination(result.data.pagination);
        setCustomerServiceWindows((current) => ({ ...current, [conversationId]: result.data!.customer_service_window }));
      }
    } catch (error) {
      if (!isCurrent || isCurrent()) setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar mensagens");
    } finally { if (!silent && (!isCurrent || isCurrent())) setLoadingMessages(false); }
  };

  const loadAgents = async (): Promise<void> => {
    setLoadingAgents(true);
    try {
      const result = await requestJson<AgentsResponse>("/whatsapp/agents");
      if (!result.ok || !result.data) throw new Error(result.errorText || `Falha ao carregar atendentes (HTTP ${result.status})`);
      setAgents(result.data.data);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar atendentes"); }
    finally { setLoadingAgents(false); }
  };

  const loadTemplates = async (): Promise<void> => {
    setLoadingTemplates(true); setTemplateCatalogError(null);
    try {
      const result = await requestJson<TemplateCatalogResponse>("/whatsapp/automation/templates");
      if (!result.ok || !result.data) throw new Error(result.errorText || `Falha ao carregar modelos (HTTP ${result.status})`);
      setTemplates(result.data.data);
      if (!selectedTemplateKey && result.data.data[0]) setSelectedTemplateKey(result.data.data[0].key);
    } catch (error) { setTemplateCatalogError(error instanceof Error ? error.message : "Catálogo indisponível"); }
    finally { setLoadingTemplates(false); }
  };

  const loadDomainContext = async (
    phone: string,
    isCurrent: () => boolean,
  ): Promise<void> => {
    setLoadingDomainContext(true); setDomainContext(null); setDomainContextError(null);
    try {
      const params = new URLSearchParams({ telefone: phone });
      const result = await requestJson<ConversationDomainContext>(`/api/v1/whatsapp-contexto?${params}`);
      if (!result.ok || !result.data) {
        throw new Error(result.errorText || `Falha ao carregar o vínculo cadastral (HTTP ${result.status})`);
      }
      if (isCurrent()) setDomainContext(result.data);
    } catch (error) {
      if (isCurrent()) setDomainContextError(error instanceof Error ? error.message : "Vínculo cadastral indisponível");
    } finally {
      if (isCurrent()) setLoadingDomainContext(false);
    }
  };

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await loadConversations(1); };
  const handleCreateAgent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setErrorMessage(null);
    if (!newAgentEmail.trim()) { setErrorMessage("Email do atendente é obrigatório."); return; }
    const result = await requestJson<Agent>("/whatsapp/agents", { method: "POST", body: JSON.stringify({
      name: newAgentName.trim() || null, email: newAgentEmail.trim(), role: newAgentRole.trim() || "agent",
    }) });
    if (!result.ok) { setErrorMessage(result.errorText || `Falha ao criar atendente (HTTP ${result.status})`); return; }
    setInfoMessage("Atendente criado com sucesso."); setNewAgentName(""); setNewAgentEmail(""); setNewAgentRole("agent");
    await loadAgents();
  };

  const handleClaimToggle = async (mode: "claim" | "unclaim", requestedAgentId?: string): Promise<void> => {
    if (!selectedConversationId) { setErrorMessage("Selecione uma conversa."); return; }
    const targetAgentId = requestedAgentId || agentActionId;
    if (!targetAgentId) { setErrorMessage("Selecione um atendente."); return; }
    const result = await requestJson<{ message: string }>(`/whatsapp/conversations/${selectedConversationId}/${mode}`, {
      method: "POST", body: JSON.stringify({ agent_id: Number(targetAgentId) }),
    });
    if (!result.ok) { setErrorMessage(result.errorText || `Não foi possível ${mode === "claim" ? "atribuir" : "liberar"} a conversa.`); return; }
    setInfoMessage(mode === "claim" ? "Responsável atualizado." : "Conversa liberada para a equipe.");
    await loadConversations(conversationsPagination.page || 1);
  };

  const handleStatusChange = async (status: ConversationStatus): Promise<void> => {
    if (!selectedConversationId || status === selectedConversation?.status) return;
    setSavingStatus(true); setErrorMessage(null);
    try {
      const result = await requestJson<{ data: Conversation; changed: boolean }>(
        `/whatsapp/conversations/${selectedConversationId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (!result.ok) throw new Error(result.errorText || `Falha ao atualizar status (HTTP ${result.status})`);
      setInfoMessage(`Conversa marcada como ${conversationStatusLabel(status).toLowerCase()}.`);
      await loadConversations(conversationsPagination.page || 1);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Erro ao atualizar o status"); }
    finally { setSavingStatus(false); }
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedConversationId) { setErrorMessage("Selecione uma conversa para enviar mensagem."); return; }
    if (!windowState.isOpen) {
      setErrorMessage(windowState.hasInboundMessage ? "A janela de 24 horas foi encerrada. Use o fluxo de modelo aprovado correspondente."
        : "Aguarde uma mensagem da clínica antes de responder com texto livre."); return;
    }
    if (!sendMessageBody.trim()) { setErrorMessage("Digite uma mensagem antes de enviar."); return; }
    const result = await requestJson<{ status?: string; code?: string; customer_service_window?: CustomerServiceWindow }>(
      `/whatsapp/conversations/${selectedConversationId}/messages`, {
        method: "POST", body: JSON.stringify({ body: sendMessageBody.trim(), type: "text" }),
      });
    if (!result.ok) {
      if (result.status === 409 && result.data?.code === "CUSTOMER_SERVICE_WINDOW_CLOSED") {
        if (result.data.customer_service_window) setCustomerServiceWindows((current) => ({
          ...current, [selectedConversationId]: result.data!.customer_service_window!,
        }));
        setErrorMessage("A janela de 24 horas foi encerrada. Use um modelo aprovado.");
      } else setErrorMessage(result.errorText || `Falha ao enviar mensagem (HTTP ${result.status})`);
    } else { setInfoMessage("Mensagem enviada."); setSendMessageBody(""); }
    await loadMessages(selectedConversationId, 1); await loadConversations(conversationsPagination.page || 1);
  };

  const handleTemplateSelection = (templateKey: string): void => {
    setSelectedTemplateKey(templateKey);
    const template = templates.find((item) => item.key === templateKey);
    const parameters = Array.from({ length: template?.body_parameter_count || 0 }, () => "");
    if (template && parameters.length && selectedConversation?.subject) parameters[0] = selectedConversation.subject;
    setTemplateParameters(parameters);
  };
  const handleCopyTemplateToComposer = (): void => {
    if (!selectedTemplate || !templateComplete) { setErrorMessage("Preencha todas as variáveis do modelo antes de copiar o texto."); return; }
    if (!windowState.isOpen || !selectedTemplate.can_copy_as_free_text) return;
    setSendMessageBody(templatePreview); setComposerMode("message");
    setInfoMessage("Texto copiado para o rascunho. Revise antes de enviar como resposta livre.");
  };

  useEffect(() => { void Promise.all([loadConversations(1), loadAgents(), loadTemplates()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const intervalId = window.setInterval(() => setCustomerServiceWindowClock(Date.now()), CUSTOMER_SERVICE_WINDOW_CLOCK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);
  useEffect(() => {
    if (!selectedConversationId) { setMessages([]); return; }
    let active = true; let refreshInProgress = false;
    const refreshMessages = async (silent: boolean) => {
      if (refreshInProgress) return; refreshInProgress = true;
      try { await loadMessages(selectedConversationId, 1, { isCurrent: () => active, silent }); }
      finally { refreshInProgress = false; }
    };
    void refreshMessages(false);
    const intervalId = window.setInterval(() => void refreshMessages(true), MESSAGE_STATUS_REFRESH_INTERVAL_MS);
    return () => { active = false; window.clearInterval(intervalId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);
  useEffect(() => {
    if (!selectedConversation) {
      setDomainContext(null); setDomainContextError(null); setLoadingDomainContext(false);
      return;
    }
    let active = true;
    void loadDomainContext(selectedConversation.wa_phone_number, () => active);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, selectedConversation?.wa_phone_number]);
  useEffect(() => {
    if (selectedConversation?.last_agent_id) setAgentActionId(selectedConversation.last_agent_id);
    else if (!agentActionId && agents[0]?.id) setAgentActionId(agents[0].id);
  }, [agentActionId, agents, selectedConversation]);
  useEffect(() => {
    if (!selectedTemplate) return;
    const parameters = Array.from({ length: selectedTemplate.body_parameter_count }, () => "");
    if (parameters.length && selectedConversation?.subject) parameters[0] = selectedConversation.subject;
    setTemplateParameters(parameters);
  }, [selectedConversation?.id, selectedTemplate]);

  return (
    <DashboardLayout>
      <main className="fc-wa-page">
        <header className="fc-wa-header">
          <div><span className="fc-wa-kicker"><MessageSquare className="h-4 w-4" /> Central de atendimento</span>
            <h1>WhatsApp Fort Cordis</h1><p>Atenda clínicas parceiras, organize a fila e acompanhe cada conversa em um só lugar.</p></div>
          <div className="fc-wa-header-actions"><span className={`fc-wa-live-dot fc-wa-live-dot-${integrationState}`}><span />
            {integrationState === "available" ? "Integração disponível" : integrationState === "unavailable" ? "Integração indisponível" : "Verificando integração"}
          </span><span className="fc-wa-environment">Stage</span></div>
        </header>

        <section className="fc-wa-metrics" aria-label="Resumo do atendimento WhatsApp">
          <div className="fc-wa-metric fc-wa-metric-cordis"><MessagesSquare className="h-5 w-5" /><strong>{conversationsPagination.total}</strong><span>Conversas na fila</span></div>
          <div className="fc-wa-metric fc-wa-metric-vital"><MessageSquare className="h-5 w-5" /><strong>{messagesPagination.total}</strong><span>Mensagens abertas</span></div>
          <div className="fc-wa-metric fc-wa-metric-amber"><UserCheck className="h-5 w-5" /><strong>{conversations.filter((item) => !item.last_agent_id).length}</strong><span>Sem responsável</span></div>
          <div className="fc-wa-metric fc-wa-metric-ink"><Users className="h-5 w-5" /><strong>{agents.filter((agent) => agent.active).length}</strong><span>Atendentes ativos</span></div>
        </section>
        {infoMessage ? <div className="fc-wa-message fc-wa-message-info">{infoMessage}</div> : null}
        {errorMessage ? <div className="fc-wa-message fc-wa-message-error">{errorMessage}</div> : null}

        <section className="fc-wa-workspace">
          <aside className="fc-wa-inbox" aria-label="Caixa de entrada">
            <div className="fc-wa-panel-heading"><div className="fc-wa-heading-icon"><Inbox className="h-5 w-5" /></div>
              <div><span>Caixa de entrada</span><h2>Conversas</h2></div>
              <button type="button" className="fc-wa-icon-button ml-auto" onClick={() => void loadConversations(conversationsPagination.page)} aria-label="Atualizar conversas" disabled={loadingConversations}>
                <RefreshCw className={`h-4 w-4 ${loadingConversations ? "animate-spin" : ""}`} /></button></div>
            <form className="fc-wa-search" onSubmit={handleFilterSubmit}><Search className="h-4 w-4" />
              <input value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Buscar nome, telefone ou mensagem" aria-label="Buscar conversas" />
              <button type="submit" aria-label="Aplicar busca"><ChevronRight className="h-4 w-4" /></button></form>
            <div className="fc-wa-queue-tabs" aria-label="Filtrar por status">
              {CONVERSATION_STATUS_OPTIONS.map((option) => <button key={option.value || "all"} type="button"
                className={statusFilter === option.value ? "active" : ""} onClick={() => { setStatusFilter(option.value); void loadConversations(1, { status: option.value }); }}>{option.label}</button>)}
            </div>
            <div className="fc-wa-assignment-filter"><Filter className="h-3.5 w-3.5" /><select value={assignedFilter}
              onChange={(event) => { const value = event.target.value as AssignedFilter; setAssignedFilter(value); void loadConversations(1, { assigned: value }); }} aria-label="Filtrar por responsável">
              <option value="all">Todos os responsáveis</option><option value="assigned">Com responsável</option><option value="unassigned">Sem responsável</option></select></div>
            <div className="fc-wa-conversation-list">
              {loadingConversations && conversations.length === 0 ? <div className="fc-wa-empty">Carregando conversas...</div> : conversations.length === 0 ?
                <div className="fc-wa-empty"><Inbox className="h-8 w-8" /><strong>Nenhuma conversa encontrada</strong><span>Tente alterar os filtros ou a busca.</span></div> :
                conversations.map((conversation) => {
                  const label = conversation.subject?.trim() || formatPhone(conversation.wa_phone_number);
                  return <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)}
                    className={`fc-wa-conversation ${conversation.id === selectedConversationId ? "fc-wa-conversation-active" : ""}`}>
                    <span className="fc-wa-avatar">{getInitials(label)}</span><span className="fc-wa-conversation-content">
                      <span className="fc-wa-conversation-line"><strong>{label}</strong><time>{formatMessageTime(conversation.last_message_at || conversation.last_activity_at)}</time></span>
                      {conversation.subject ? <small>{formatPhone(conversation.wa_phone_number)}</small> : null}
                      <span className="fc-wa-conversation-preview">{conversation.last_message_from_me ? "Você: " : ""}{conversation.last_message_body || "Conversa iniciada"}</span>
                      <span className="fc-wa-conversation-meta"><span className={`fc-wa-status ${conversationStatusClass(conversation.status)}`}>{conversationStatusLabel(conversation.status)}</span>
                        <span>{conversation.assigned_agent_name || "Sem responsável"}</span></span></span></button>;
                })}
            </div>
            <div className="fc-wa-pagination"><span>{conversationsPagination.total === 0 ? "0 conversas" :
              `${(conversationsPagination.page - 1) * conversationsPagination.limit + 1}-${Math.min(conversationsPagination.page * conversationsPagination.limit, conversationsPagination.total)} de ${conversationsPagination.total}`}</span>
              <div><button type="button" onClick={() => void loadConversations(Math.max(1, conversationsPagination.page - 1))} disabled={conversationsPagination.page <= 1 || loadingConversations} aria-label="Página anterior">‹</button>
                <button type="button" onClick={() => { const totalPages = Math.max(1, Math.ceil(conversationsPagination.total / conversationsPagination.limit)); void loadConversations(Math.min(totalPages, conversationsPagination.page + 1)); }}
                  disabled={loadingConversations || conversationsPagination.page >= Math.max(1, Math.ceil(conversationsPagination.total / conversationsPagination.limit))} aria-label="Próxima página">›</button></div></div>
          </aside>

          <section className="fc-wa-chat" aria-label="Conversa selecionada">
            <div className="fc-wa-chat-heading">{selectedConversation ? <>
              <span className="fc-wa-avatar fc-wa-avatar-large">{getInitials(conversationDisplayName)}</span><div><h2>{conversationDisplayName}</h2><p>{formatPhone(selectedConversation.wa_phone_number)}</p></div>
              <span className={`fc-wa-status ${conversationStatusClass(selectedConversation.status)} ml-auto`}>{conversationStatusLabel(selectedConversation.status)}</span>
              <button type="button" className="fc-wa-icon-button" onClick={() => selectedConversationId && void loadMessages(selectedConversationId, 1)} disabled={loadingMessages} aria-label="Atualizar mensagens">
                <RefreshCw className={`h-4 w-4 ${loadingMessages ? "animate-spin" : ""}`} /></button></> :
              <div><h2>Nenhuma conversa selecionada</h2><p>Escolha um contato na caixa de entrada.</p></div>}</div>
            {selectedConversation ? <div className={`fc-wa-window ${windowState.isOpen ? "fc-wa-window-open" : "fc-wa-window-closed"}`} role="status" aria-live="polite">
              <Clock3 className="h-4 w-4" /><span>{windowState.isOpen ? `Resposta livre disponível até ${formatDateTime(windowState.expiresAt)}` : windowState.hasInboundMessage ?
                `Janela encerrada em ${formatDateTime(windowState.expiresAt)}. Use o fluxo de modelo correspondente.` : "Aguardando uma mensagem da clínica para liberar respostas em texto livre."}</span></div> : null}
            <div className="fc-wa-message-stream">{!selectedConversationId ? <div className="fc-wa-empty"><MessageSquare className="h-8 w-8" /><strong>Selecione uma conversa</strong></div> : loadingMessages ?
              <div className="fc-wa-empty">Carregando mensagens...</div> : messages.length === 0 ? <div className="fc-wa-empty"><MessageSquare className="h-8 w-8" /><strong>A conversa ainda não tem mensagens</strong></div> :
              <div className="space-y-3">{messages.map((message, index) => {
                const previous = messages[index - 1]; const showDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
                return <Fragment key={message.id}>{showDay ? <div className="fc-wa-day-separator"><span>{formatMessageDay(message.created_at)}</span></div> : null}
                  <article className={`fc-wa-bubble ${message.from_me ? "fc-wa-bubble-agent" : "fc-wa-bubble-client"}`}><p>{message.body || `[${message.type}]`}</p>
                    <footer><time>{formatMessageTime(message.created_at)}</time><span className={`fc-wa-delivery fc-wa-delivery-${message.status}`}>{messageStatusIcon(message.status)} {messageStatusLabel(message.status)}</span></footer>
                    <details><summary>Detalhes técnicos</summary><span>Tipo: {message.type}</span>{message.wa_message_id ? <span>ID Meta: {message.wa_message_id}</span> : null}</details></article></Fragment>;
              })}</div>}</div>

            <div className="fc-wa-composer"><div className="fc-wa-composer-tabs" role="tablist" aria-label="Modo de resposta">
              <button type="button" role="tab" aria-selected={composerMode === "message"} className={composerMode === "message" ? "active" : ""} onClick={() => setComposerMode("message")}><MessageSquare className="h-4 w-4" /> Mensagem</button>
              <button type="button" role="tab" aria-selected={composerMode === "template"} className={composerMode === "template" ? "active" : ""} onClick={() => setComposerMode("template")}><Sparkles className="h-4 w-4" /> Modelos configurados</button></div>
              {composerMode === "message" ? <form onSubmit={handleSendMessage}><div className="fc-wa-quick-responses" aria-label="Respostas rápidas">
                {QUICK_RESPONSES.map((response) => <button key={response} type="button" onClick={() => setSendMessageBody(response)} disabled={!selectedConversationId || !windowState.isOpen}>{response}</button>)}</div>
                <div className="fc-wa-compose-row"><textarea placeholder="Digite sua resposta" aria-label="Digite sua resposta" value={sendMessageBody} onChange={(event) => setSendMessageBody(event.target.value)}
                  onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                  disabled={!selectedConversationId || !windowState.isOpen} rows={3} />
                  <button type="submit" className="fc-wa-send" disabled={!selectedConversationId || !windowState.isOpen || !sendMessageBody.trim()}><Send className="h-4 w-4" /> Enviar</button></div>
                <p className="fc-wa-composer-hint">{windowState.isOpen ? "Ctrl/Cmd + Enter para enviar" : "Texto livre indisponível. Consulte os modelos e use o fluxo correspondente."}</p></form> :
                <div className="fc-wa-template-composer"><div className="fc-wa-template-notice"><Info className="h-4 w-4" /><span>Catálogo configurado no Fort Cordis. A aprovação atual na Meta não é consultada nesta tela.</span></div>
                  {loadingTemplates ? <div className="fc-wa-empty">Carregando modelos...</div> : templateCatalogError ? <div className="fc-wa-template-error">{templateCatalogError}</div> : templates.length === 0 ? <div className="fc-wa-empty">Nenhum modelo configurado.</div> : <>
                    <label className="fc-wa-field"><span>Modelo</span><select value={selectedTemplateKey} onChange={(event) => handleTemplateSelection(event.target.value)}>
                      {(["agenda", "laudos", "financeiro"] as const).map((category) => <optgroup key={category} label={templateCategoryLabel(category)}>
                        {templates.filter((template) => template.category === category).map((template) => <option key={template.key} value={template.key}>{template.workflow_label}</option>)}</optgroup>)}</select></label>
                    {selectedTemplate ? <div className="fc-wa-template-grid"><div className="fc-wa-template-fields">{selectedTemplate.variable_labels.map((label, index) =>
                      <label className="fc-wa-field" key={`${selectedTemplate.key}-${label}-${index}`}><span>{label}</span><input value={templateParameters[index] || ""}
                        onChange={(event) => { const next = [...templateParameters]; next[index] = event.target.value; setTemplateParameters(next); }} placeholder={`Valor de {{${index + 1}}}`} /></label>)}</div>
                      <div className="fc-wa-template-preview"><span>Prévia da mensagem</span>{selectedTemplate.requires_document ? <em><FileText className="h-4 w-4" /> Inclui documento PDF</em> : null}<p>{templatePreview}</p>
                        {selectedTemplate.quick_replies.length ? <div>{selectedTemplate.quick_replies.map((reply) => <span key={reply}>{reply}</span>)}</div> : null}</div></div> : null}
                    <div className="fc-wa-template-actions"><p>{selectedTemplate?.requires_document ? "Este modelo deve ser enviado pelo fluxo Financeiro, junto com o PDF correto." : windowState.isOpen ?
                      "Você pode copiar apenas o texto para revisar e enviar como resposta livre. Os botões do modelo não serão incluídos." : "Fora da janela de 24 horas, envie pelo fluxo de Agenda, Laudos ou Financeiro para preservar vínculos e botões."}</p>
                      <button type="button" className="fc-wa-secondary" onClick={handleCopyTemplateToComposer} disabled={!templateComplete || !windowState.isOpen || !selectedTemplate?.can_copy_as_free_text}>Copiar texto para resposta</button></div></>}
                </div>}
            </div>
          </section>

          <aside className="fc-wa-context" aria-label="Contexto da conversa"><div className="fc-wa-context-heading"><UserRound className="h-5 w-5" /><div><span>Contexto</span><h2>Atendimento</h2></div></div>
            {selectedConversation ? <div className="fc-wa-context-body"><section className="fc-wa-contact-card"><span className="fc-wa-avatar fc-wa-avatar-xl">{getInitials(conversationDisplayName)}</span><h3>{conversationDisplayName}</h3>
              <p>{formatPhone(selectedConversation.wa_phone_number)}</p><span className={`fc-wa-status ${conversationStatusClass(selectedConversation.status)}`}>{conversationStatusLabel(selectedConversation.status)}</span></section>
              <section className="fc-wa-context-section"><div className="fc-wa-context-section-title"><CircleDot className="h-4 w-4" /><h3>Classificação</h3></div>
                <label className="fc-wa-field"><span>Status da conversa</span><select value={selectedConversation.status} onChange={(event) => void handleStatusChange(event.target.value as ConversationStatus)} disabled={savingStatus}>
                  <option value="open">Em atendimento</option><option value="pending">Aguardando cliente</option><option value="closed">Resolvida</option></select></label></section>
              <section className="fc-wa-context-section"><div className="fc-wa-context-section-title"><UserCheck className="h-4 w-4" /><h3>Responsável</h3></div>
                <p className="fc-wa-current-agent">{selectedAgent?.name || selectedConversation.assigned_agent_name || "Nenhum atendente atribuído"}
                  {(selectedAgent?.email || selectedConversation.assigned_agent_email) ? <small>{selectedAgent?.email || selectedConversation.assigned_agent_email}</small> : null}</p>
                <label className="fc-wa-field"><span>{selectedConversation.last_agent_id ? "Transferir para" : "Atribuir para"}</span><select value={agentActionId} onChange={(event) => setAgentActionId(event.target.value)}>
                  <option value="">Selecione um atendente</option>{agents.filter((agent) => agent.active).map((agent) => <option key={agent.id} value={agent.id}>{agent.name || agent.email || `Atendente ${agent.id}`}</option>)}</select></label>
                <div className="fc-wa-owner-actions"><button type="button" className="fc-wa-secondary" onClick={() => void handleClaimToggle("claim")} disabled={!agentActionId}>{selectedConversation.last_agent_id ? "Transferir" : "Assumir conversa"}</button>
                  {selectedConversation.last_agent_id ? <button type="button" className="fc-wa-ghost-danger" onClick={() => void handleClaimToggle("unclaim", selectedConversation.last_agent_id || undefined)}>Liberar</button> : null}</div></section>
              <section className="fc-wa-context-section"><div className="fc-wa-context-section-title"><Clock3 className="h-4 w-4" /><h3>Atividade</h3></div><dl className="fc-wa-context-list">
                <div><dt>Última atividade</dt><dd>{formatDateTime(selectedConversation.last_activity_at)}</dd></div><div><dt>Última mensagem recebida</dt><dd>{formatDateTime(selectedConversation.last_inbound_at)}</dd></div><div><dt>Canal</dt><dd>WhatsApp Business</dd></div></dl></section>
              <DomainContextPanel context={domainContext} loading={loadingDomainContext} error={domainContextError} />
              <details className="fc-wa-technical-details"><summary>Dados técnicos</summary><span>Conversa #{selectedConversation.id}</span><span>PSID: {selectedConversation.wa_psid || "não informado"}</span></details>
            </div> : <div className="fc-wa-empty"><UserRound className="h-8 w-8" /><strong>Selecione uma conversa</strong><span>Os dados do atendimento aparecerão aqui.</span></div>}</aside>
        </section>

        <details className="fc-wa-team-admin"><summary><Settings className="h-4 w-4" /> Configurar equipe</summary><div className="fc-wa-team-admin-body"><form onSubmit={handleCreateAgent}>
          <label className="fc-wa-field"><span>Nome</span><input value={newAgentName} onChange={(event) => setNewAgentName(event.target.value)} /></label>
          <label className="fc-wa-field"><span>Email</span><input type="email" value={newAgentEmail} onChange={(event) => setNewAgentEmail(event.target.value)} required /></label>
          <label className="fc-wa-field"><span>Perfil</span><select value={newAgentRole} onChange={(event) => setNewAgentRole(event.target.value)}><option value="agent">Atendente</option><option value="supervisor">Supervisor</option></select></label>
          <button className="fc-wa-primary" type="submit">Adicionar atendente</button></form><div className="fc-wa-agent-list"><strong>Equipe {loadingAgents ? "(carregando...)" : ""}</strong>
            {agents.length === 0 ? <p>Nenhum atendente cadastrado.</p> : <ul>{agents.map((agent) => <li key={agent.id}><span className="fc-wa-avatar">{getInitials(agent.name || agent.email || "A")}</span>
              <span>{agent.name || "Sem nome"}<small>{agent.email || "Sem email"} · {agent.active ? "Ativo" : "Inativo"}</small></span></li>)}</ul>}</div></div></details>
      </main>
    </DashboardLayout>
  );
}
