"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layout-dashboard";

type AssignedFilter = "all" | "assigned" | "unassigned";

interface Conversation {
  id: string;
  wa_phone_number: string;
  wa_psid: string | null;
  status: string;
  subject: string | null;
  last_agent_id: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  last_message_body?: string | null;
  last_message_at?: string | null;
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorText?: string;
}

interface ConversationsResponse {
  data: Conversation[];
  pagination: Pagination;
}

interface MessagesResponse {
  data: Message[];
  pagination: Pagination;
}

interface AgentsResponse {
  data: Agent[];
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const token = window.localStorage.getItem("token");
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    const parsed = (await response.json()) as T;
    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
      errorText: response.ok ? undefined : JSON.stringify(parsed),
    };
  }

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: null,
    errorText: text || `HTTP ${response.status}`,
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "read":
      return "bg-emerald-100 text-emerald-700";
    case "delivered":
      return "bg-sky-100 text-sky-700";
    case "sent":
      return "bg-blue-100 text-blue-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function WhatsAppStagePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsPagination, setConversationsPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesPagination, setMessagesPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
  });
  const [agents, setAgents] = useState<Agent[]>([]);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("all");
  const [phoneFilter, setPhoneFilter] = useState("");

  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("agent");

  const [agentActionId, setAgentActionId] = useState("");
  const [sendMessageBody, setSendMessageBody] = useState("");
  const [sendMessageType, setSendMessageType] = useState("text");

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const loadConversations = async (page = 1): Promise<void> => {
    setLoadingConversations(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(conversationsPagination.limit));

      if (statusFilter.trim()) {
        params.set("status", statusFilter.trim());
      }

      if (assignedFilter !== "all") {
        params.set("assigned", assignedFilter);
      }

      if (phoneFilter.trim()) {
        params.set("phone", phoneFilter.trim());
      }

      const result = await requestJson<ConversationsResponse>(`/whatsapp/conversations?${params.toString()}`);

      if (!result.ok || !result.data) {
        throw new Error(result.errorText || `Falha ao carregar conversas (HTTP ${result.status})`);
      }

      setConversations(result.data.data);
      setConversationsPagination(result.data.pagination);

      if (!selectedConversationId && result.data.data.length > 0) {
        setSelectedConversationId(result.data.data[0].id);
      }

      if (
        selectedConversationId &&
        !result.data.data.some((conversation) => conversation.id === selectedConversationId)
      ) {
        setSelectedConversationId(result.data.data[0]?.id ?? null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar conversas";
      setErrorMessage(message);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string, page = 1): Promise<void> => {
    setLoadingMessages(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(messagesPagination.limit),
      });

      const result = await requestJson<MessagesResponse>(
        `/whatsapp/conversations/${conversationId}/messages?${params.toString()}`
      );

      if (!result.ok || !result.data) {
        throw new Error(result.errorText || `Falha ao carregar mensagens (HTTP ${result.status})`);
      }

      setMessages(result.data.data);
      setMessagesPagination(result.data.pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar mensagens";
      setErrorMessage(message);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadAgents = async (): Promise<void> => {
    setLoadingAgents(true);
    setErrorMessage(null);

    try {
      const result = await requestJson<AgentsResponse>("/whatsapp/agents");
      if (!result.ok || !result.data) {
        throw new Error(result.errorText || `Falha ao carregar agentes (HTTP ${result.status})`);
      }

      setAgents(result.data.data);
      if (!agentActionId && result.data.data[0]?.id) {
        setAgentActionId(result.data.data[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar agentes";
      setErrorMessage(message);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setInfoMessage("Atualizando conversas...");
    await loadConversations(1);
    setInfoMessage(null);
  };

  const handleCreateAgent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    if (!newAgentEmail.trim()) {
      setErrorMessage("Email do agente é obrigatório.");
      return;
    }

    const result = await requestJson<Agent>("/whatsapp/agents", {
      method: "POST",
      body: JSON.stringify({
        name: newAgentName.trim() || null,
        email: newAgentEmail.trim(),
        role: newAgentRole.trim() || "agent",
      }),
    });

    if (!result.ok) {
      setErrorMessage(result.errorText || `Falha ao criar agente (HTTP ${result.status})`);
      return;
    }

    setInfoMessage("Agente criado com sucesso.");
    setNewAgentName("");
    setNewAgentEmail("");
    setNewAgentRole("agent");
    await loadAgents();
  };

  const handleClaimToggle = async (mode: "claim" | "unclaim"): Promise<void> => {
    if (!selectedConversationId) {
      setErrorMessage("Selecione uma conversa antes de executar claim/unclaim.");
      return;
    }

    if (!agentActionId) {
      setErrorMessage("Selecione um agente para claim/unclaim.");
      return;
    }

    const result = await requestJson<{ message: string }>(
      `/whatsapp/conversations/${selectedConversationId}/${mode}`,
      {
        method: "POST",
        body: JSON.stringify({ agent_id: Number(agentActionId) }),
      }
    );

    if (!result.ok) {
      setErrorMessage(result.errorText || `Falha ao executar ${mode} (HTTP ${result.status})`);
      return;
    }

    setInfoMessage(result.data?.message || `${mode} executado com sucesso.`);
    await loadConversations(conversationsPagination.page || 1);
    await loadMessages(selectedConversationId, messagesPagination.page || 1);
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedConversationId) {
      setErrorMessage("Selecione uma conversa para enviar mensagem.");
      return;
    }

    if (!sendMessageBody.trim()) {
      setErrorMessage("Digite uma mensagem antes de enviar.");
      return;
    }

    const result = await requestJson<{ status?: string; error?: string; local_message_id?: string }>(
      `/whatsapp/conversations/${selectedConversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          body: sendMessageBody.trim(),
          type: sendMessageType,
        }),
      }
    );

    if (!result.ok) {
      setErrorMessage(result.errorText || `Falha ao enviar mensagem (HTTP ${result.status})`);
    } else {
      setInfoMessage(
        result.data?.status
          ? `Mensagem enviada com status: ${result.data.status}`
          : "Mensagem enviada com sucesso."
      );
      setSendMessageBody("");
    }

    await loadMessages(selectedConversationId, 1);
    await loadConversations(conversationsPagination.page || 1);
  };

  useEffect(() => {
    void Promise.all([loadConversations(1), loadAgents()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedConversationId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Stage Viewer</h1>
          <p className="text-sm text-gray-600">
            Tela temporária para visualizar e testar o backend WhatsApp em stage via rota <code>/whatsapp</code>.
          </p>
        </header>

        {infoMessage ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{infoMessage}</div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Filtros de Conversa</h2>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={handleFilterSubmit}>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Status (open, closed...)"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            />

            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={assignedFilter}
              onChange={(event) => setAssignedFilter(event.target.value as AssignedFilter)}
            >
              <option value="all">Todas</option>
              <option value="assigned">Atribuídas</option>
              <option value="unassigned">Não atribuídas</option>
            </select>

            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Telefone"
              value={phoneFilter}
              onChange={(event) => setPhoneFilter(event.target.value)}
            />

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {loadingConversations ? "Carregando..." : "Filtrar"}
            </button>
          </form>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">Conversas</h2>
              <p className="text-xs text-gray-500">
                Página {conversationsPagination.page} de {Math.max(1, Math.ceil(conversationsPagination.total / conversationsPagination.limit))} · Total {conversationsPagination.total}
              </p>
            </div>

            <div className="max-h-[520px] overflow-auto divide-y">
              {conversations.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">Nenhuma conversa encontrada.</div>
              ) : (
                conversations.map((conversation) => {
                  const selected = conversation.id === selectedConversationId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full p-4 text-left transition ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-gray-900">{conversation.wa_phone_number}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(conversation.status)}`}>
                          {conversation.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{conversation.subject || "Sem assunto"}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{conversation.last_message_body || "Sem mensagem"}</p>
                      <p className="mt-1 text-xs text-gray-400">Atividade: {formatDateTime(conversation.last_activity_at)}</p>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t p-3">
              <button
                type="button"
                onClick={() => void loadConversations(Math.max(1, conversationsPagination.page - 1))}
                disabled={conversationsPagination.page <= 1 || loadingConversations}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Anterior
              </button>

              <button
                type="button"
                onClick={() => {
                  const totalPages = Math.max(1, Math.ceil(conversationsPagination.total / conversationsPagination.limit));
                  void loadConversations(Math.min(totalPages, conversationsPagination.page + 1));
                }}
                disabled={
                  loadingConversations ||
                  conversationsPagination.page >= Math.max(1, Math.ceil(conversationsPagination.total / conversationsPagination.limit))
                }
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border bg-white">
              <div className="border-b px-4 py-3">
                <h2 className="text-lg font-semibold text-gray-900">Mensagens</h2>
                <p className="text-xs text-gray-500">
                  {selectedConversation
                    ? `Conversa #${selectedConversation.id} · ${selectedConversation.wa_phone_number}`
                    : "Selecione uma conversa"}
                </p>
              </div>

              <div className="max-h-[420px] overflow-auto p-4">
                {!selectedConversationId ? (
                  <p className="text-sm text-gray-500">Selecione uma conversa para carregar mensagens.</p>
                ) : loadingMessages ? (
                  <p className="text-sm text-gray-500">Carregando mensagens...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem mensagens nesta conversa.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <article
                        key={message.id}
                        className={`rounded-lg border p-3 ${message.from_me ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-700">{message.from_me ? "Agente" : "Cliente"}</span>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(message.status)}`}>
                            {message.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{message.body || "[sem body]"}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateTime(message.created_at)} · tipo {message.type}
                          {message.wa_message_id ? ` · wa_id ${message.wa_message_id}` : ""}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t p-3">
                <form className="space-y-2" onSubmit={handleSendMessage}>
                  <div className="flex gap-2">
                    <select
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={sendMessageType}
                      onChange={(event) => setSendMessageType(event.target.value)}
                    >
                      <option value="text">text</option>
                    </select>

                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Digite a resposta"
                      value={sendMessageBody}
                      onChange={(event) => setSendMessageBody(event.target.value)}
                    />

                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      disabled={!selectedConversationId}
                    >
                      Enviar
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Agentes e Claim</h2>

              <form className="grid gap-2 md:grid-cols-4" onSubmit={handleCreateAgent}>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Nome"
                  value={newAgentName}
                  onChange={(event) => setNewAgentName(event.target.value)}
                />
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Email"
                  value={newAgentEmail}
                  onChange={(event) => setNewAgentEmail(event.target.value)}
                  required
                />
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Role"
                  value={newAgentRole}
                  onChange={(event) => setNewAgentRole(event.target.value)}
                />
                <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" type="submit">
                  Criar agente
                </button>
              </form>

              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={agentActionId}
                  onChange={(event) => setAgentActionId(event.target.value)}
                >
                  <option value="">Selecione um agente</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      #{agent.id} {agent.name || agent.email || "Sem nome"}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void handleClaimToggle("claim")}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  disabled={!selectedConversationId || !agentActionId}
                >
                  Claim
                </button>

                <button
                  type="button"
                  onClick={() => void handleClaimToggle("unclaim")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                  disabled={!selectedConversationId || !agentActionId}
                >
                  Unclaim
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Agentes cadastrados {loadingAgents ? "(carregando...)" : ""}
                </p>
                {agents.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum agente cadastrado.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-gray-700">
                    {agents.map((agent) => (
                      <li key={agent.id}>
                        #{agent.id} · {agent.name || "Sem nome"} · {agent.email || "sem email"} · {agent.role}
                        {agent.active ? " · ativo" : " · inativo"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

