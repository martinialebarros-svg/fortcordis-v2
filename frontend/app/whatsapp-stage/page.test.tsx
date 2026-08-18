import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WhatsAppStagePage from "./page";

vi.mock("../layout-dashboard", () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function notFoundDomainContextResponse(): Response {
  return jsonResponse({
    normalized_phone: "558500000000",
    resolution: "not_found",
    match_type: null,
    clinicas: [],
    tutores: [],
    pets: [],
    agendamentos: [],
    ordens_servico: [],
  });
}

describe("WhatsAppStagePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T03:00:00.000Z"));
    window.localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("atualiza silenciosamente o status da mensagem selecionada", async () => {
    let messagesRequestCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith("/whatsapp/conversations?")) {
          return jsonResponse({
            data: [
              {
                id: "3926",
                wa_phone_number: "558500000000",
                wa_psid: "558500000000",
                status: "open",
                subject: "Cliente de teste",
                last_agent_id: null,
                last_activity_at: "2026-08-14T02:26:00.000Z",
                created_at: "2026-08-14T02:26:00.000Z",
                updated_at: "2026-08-14T02:26:00.000Z",
                last_message_body: "Teste recebido com sucesso pela Fort Cordis.",
                last_message_at: "2026-08-14T02:26:00.000Z",
                customer_service_window: {
                  last_inbound_at: "2026-08-14T02:26:00.000Z",
                  expires_at: "2026-08-15T02:26:00.000Z",
                  is_open: true,
                },
              },
            ],
            pagination: { page: 1, limit: 20, total: 1 },
          });
        }

        if (url === "/whatsapp/agents") {
          return jsonResponse({ data: [] });
        }

        if (url.startsWith("/whatsapp/conversations/3926/messages?")) {
          messagesRequestCount += 1;
          return jsonResponse({
            data: [
              {
                id: "1",
                conversation_id: "3926",
                wa_message_id: "wamid.test",
                from_me: true,
                body: "Teste recebido com sucesso pela Fort Cordis.",
                type: "text",
                status: messagesRequestCount === 1 ? "sent" : "delivered",
                created_at: "2026-08-14T02:26:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 50, total: 1 },
            customer_service_window: {
              last_inbound_at: "2026-08-14T02:26:00.000Z",
              expires_at: "2026-08-15T02:26:00.000Z",
              is_open: true,
            },
          });
        }

        if (url.startsWith("/api/v1/whatsapp-contexto?")) return notFoundDomainContextResponse();

        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Enviada")).toBeInTheDocument();
    expect(screen.getByText(/Resposta livre disponível até/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Digite sua resposta")).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByText("Entregue")).toBeInTheDocument();
    expect(screen.queryByText("Carregando mensagens...")).not.toBeInTheDocument();
  });

  it("bloqueia texto livre quando a janela de 24 horas encerrou", async () => {
    vi.setSystemTime(new Date("2026-08-16T03:00:00.000Z"));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const customerServiceWindow = {
          last_inbound_at: "2026-08-14T02:26:00.000Z",
          expires_at: "2026-08-15T02:26:00.000Z",
          is_open: false,
        };

        if (url.startsWith("/whatsapp/conversations?")) {
          return jsonResponse({
            data: [
              {
                id: "3926",
                wa_phone_number: "558500000000",
                wa_psid: "558500000000",
                status: "open",
                subject: "Cliente de teste",
                last_agent_id: null,
                last_activity_at: "2026-08-14T02:26:00.000Z",
                created_at: "2026-08-14T02:26:00.000Z",
                updated_at: "2026-08-14T02:26:00.000Z",
                last_message_body: "Pergunta da clínica.",
                last_message_at: "2026-08-14T02:26:00.000Z",
                customer_service_window: customerServiceWindow,
              },
            ],
            pagination: { page: 1, limit: 20, total: 1 },
          });
        }

        if (url === "/whatsapp/agents") {
          return jsonResponse({ data: [] });
        }

        if (url.startsWith("/whatsapp/conversations/3926/messages?")) {
          return jsonResponse({
            data: [
              {
                id: "1",
                conversation_id: "3926",
                wa_message_id: "wamid.inbound",
                from_me: false,
                body: "Pergunta da clínica.",
                type: "text",
                status: "received",
                created_at: "2026-08-14T02:26:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 50, total: 1 },
            customer_service_window: customerServiceWindow,
          });
        }

        if (url.startsWith("/api/v1/whatsapp-contexto?")) return notFoundDomainContextResponse();

        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Janela encerrada em/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Digite sua resposta")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("preenche a previa de um modelo e copia o texto para revisao", async () => {
    const requestedUrls: string[] = [];
    const customerServiceWindow = {
      last_inbound_at: "2026-08-14T02:26:00.000Z",
      expires_at: "2026-08-15T02:26:00.000Z",
      is_open: true,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestedUrls.push(url);

        if (url.startsWith("/whatsapp/conversations?")) {
          return jsonResponse({
            data: [
              {
                id: "3926",
                wa_phone_number: "558500000000",
                wa_psid: "558500000000",
                status: "open",
                subject: "Animal Care",
                last_agent_id: "7",
                assigned_agent_name: "Ana",
                assigned_agent_email: "ana@fortcordis.com",
                last_activity_at: "2026-08-14T02:26:00.000Z",
                last_inbound_at: "2026-08-14T02:26:00.000Z",
                created_at: "2026-08-14T02:26:00.000Z",
                updated_at: "2026-08-14T02:26:00.000Z",
                last_message_body: "Olá",
                last_message_at: "2026-08-14T02:26:00.000Z",
                customer_service_window: customerServiceWindow,
              },
            ],
            pagination: { page: 1, limit: 20, total: 1 },
          });
        }

        if (url === "/whatsapp/agents") {
          return jsonResponse({
            data: [
              {
                id: "7",
                name: "Ana",
                email: "ana@fortcordis.com",
                role: "agent",
                active: true,
                created_at: "2026-08-14T02:00:00.000Z",
              },
            ],
          });
        }

        if (url === "/whatsapp/automation/templates") {
          return jsonResponse({
            data: [
              {
                key: "portalReportAvailable",
                name: "laudo_disponivel_portal",
                meta_id: "1682393009502350",
                language: "pt_BR",
                body: "Olá, {{1}}. O laudo do exame {{2}} de {{3}} está disponível no Portal Fort Cordis.",
                body_parameter_count: 3,
                variable_labels: ["Clínica ou destinatário", "Exame", "Pet"],
                quick_replies: [],
                category: "laudos",
                workflow_label: "Laudo disponível no portal",
                requires_document: false,
                can_copy_as_free_text: true,
                meta_approval_live: null,
              },
            ],
            source: "configured_catalog",
            meta_approval_live: null,
          });
        }

        if (url.startsWith("/whatsapp/conversations/3926/messages?")) {
          return jsonResponse({
            data: [],
            pagination: { page: 1, limit: 50, total: 0 },
            customer_service_window: customerServiceWindow,
          });
        }

        if (url.startsWith("/api/v1/whatsapp-contexto?")) return notFoundDomainContextResponse();

        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("tab", { name: /Modelos configurados/ }));
    expect(screen.getByText(/A aprovação atual na Meta não é consultada/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Exame"), { target: { value: "Ecocardiograma" } });
    fireEvent.change(screen.getByLabelText("Pet"), { target: { value: "Gamora" } });
    const copyButton = screen.getByRole("button", { name: "Copiar texto para resposta" });
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);

    expect(screen.getByPlaceholderText("Digite sua resposta")).toHaveValue(
      "Olá, Animal Care. O laudo do exame Ecocardiograma de Gamora está disponível no Portal Fort Cordis."
    );

    fireEvent.change(screen.getByLabelText("Buscar conversas"), { target: { value: "Animal Care" } });
    fireEvent.submit(screen.getByLabelText("Buscar conversas").closest("form")!);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(requestedUrls.some((url) => url.includes("search=Animal+Care"))).toBe(true);
  });

  it("mostra clinica, tutor, pet, agendamento e OS vinculados pelo telefone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/whatsapp/conversations?")) {
          return jsonResponse({
            data: [{
              id: "3926", wa_phone_number: "558588281436", wa_psid: "558588281436",
              status: "open", subject: "Animal Care", last_agent_id: null,
              last_activity_at: "2026-08-14T02:26:00.000Z", last_inbound_at: "2026-08-14T02:26:00.000Z",
              created_at: "2026-08-14T02:26:00.000Z", updated_at: "2026-08-14T02:26:00.000Z",
              customer_service_window: { last_inbound_at: "2026-08-14T02:26:00.000Z", expires_at: "2026-08-15T02:26:00.000Z", is_open: true },
            }],
            pagination: { page: 1, limit: 20, total: 1 },
          });
        }
        if (url === "/whatsapp/agents") return jsonResponse({ data: [] });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });
        if (url.startsWith("/whatsapp/conversations/3926/messages?")) return jsonResponse({
          data: [], pagination: { page: 1, limit: 50, total: 0 },
          customer_service_window: { last_inbound_at: "2026-08-14T02:26:00.000Z", expires_at: "2026-08-15T02:26:00.000Z", is_open: true },
        });
        if (url.startsWith("/api/v1/whatsapp-contexto?")) return jsonResponse({
          normalized_phone: "558588281436", resolution: "matched", match_type: "clinica",
          clinicas: [{ id: 10, nome: "Animal Care", cidade: "Fortaleza", estado: "CE" }],
          tutores: [{ id: 20, nome: "Maria Oliveira" }],
          pets: [{ id: 30, tutor_id: 20, nome: "Gamora", especie: "Canina", raca: "SRD" }],
          agendamentos: [{ id: 40, inicio: "2026-08-15T12:00:00.000Z", fim: "2026-08-15T12:30:00.000Z", status: "Confirmado",
            clinica_id: 10, clinica_nome: "Animal Care", tutor_id: 20, tutor_nome: "Maria Oliveira", pet_id: 30, pet_nome: "Gamora",
            servico_id: 50, servico_nome: "Ecocardiograma" }],
          ordens_servico: [{ id: 60, numero_os: "OS-0001", agendamento_id: 40, data_atendimento: "2026-08-15T12:00:00.000Z",
            status: "Pendente", valor_final: 250, clinica_id: 10, clinica_nome: "Animal Care", tutor_id: 20, tutor_nome: "Maria Oliveira",
            pet_id: 30, pet_nome: "Gamora", servico_id: 50, servico_nome: "Ecocardiograma" }],
        });
        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Vínculo automático por telefone")).toBeInTheDocument();
    expect(screen.getByText("Maria Oliveira")).toBeInTheDocument();
    expect(screen.getByText("Canina · SRD")).toBeInTheDocument();
    expect(screen.getByText(/OS-0001 · Gamora/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/agenda?agendamento_id=40");
    expect(screen.getByRole("link", { name: "Financeiro" })).toHaveAttribute("href", "/financeiro?os_id=60");
  });

  it("avisa quando o telefone pertence a mais de um cadastro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/whatsapp/conversations?")) return jsonResponse({
          data: [{ id: "3926", wa_phone_number: "5585999990001", wa_psid: null, status: "open", subject: "Contato compartilhado",
            last_agent_id: null, last_activity_at: "2026-08-14T02:26:00.000Z", last_inbound_at: null,
            created_at: "2026-08-14T02:26:00.000Z", updated_at: "2026-08-14T02:26:00.000Z" }],
          pagination: { page: 1, limit: 20, total: 1 },
        });
        if (url === "/whatsapp/agents") return jsonResponse({ data: [] });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });
        if (url.startsWith("/whatsapp/conversations/3926/messages?")) return jsonResponse({
          data: [], pagination: { page: 1, limit: 50, total: 0 },
          customer_service_window: { last_inbound_at: null, expires_at: null, is_open: false },
        });
        if (url.startsWith("/api/v1/whatsapp-contexto?")) return jsonResponse({
          normalized_phone: "5585999990001", resolution: "ambiguous", match_type: null,
          clinicas: [{ id: 10, nome: "Animal Care", cidade: "Fortaleza", estado: "CE" }],
          tutores: [{ id: 20, nome: "Maria Oliveira" }], pets: [], agendamentos: [], ordens_servico: [],
        });
        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Número presente em mais de um cadastro")).toBeInTheDocument();
    expect(screen.getByText("Clínica: Animal Care")).toBeInTheDocument();
    expect(screen.getByText("Tutor: Maria Oliveira")).toBeInTheDocument();
    expect(screen.queryByText("Vínculo automático por telefone")).not.toBeInTheDocument();
  });

  it("descarta um contexto atrasado depois da troca de conversa", async () => {
    let resolveFirstContext!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/whatsapp/conversations?")) return jsonResponse({
          data: [
            { id: "1", wa_phone_number: "558511111111", wa_psid: null, status: "open", subject: "Conversa Um", last_agent_id: null,
              last_activity_at: "2026-08-14T02:26:00.000Z", last_inbound_at: null, created_at: "2026-08-14T02:26:00.000Z", updated_at: "2026-08-14T02:26:00.000Z" },
            { id: "2", wa_phone_number: "558522222222", wa_psid: null, status: "open", subject: "Conversa Dois", last_agent_id: null,
              last_activity_at: "2026-08-14T02:25:00.000Z", last_inbound_at: null, created_at: "2026-08-14T02:25:00.000Z", updated_at: "2026-08-14T02:25:00.000Z" },
          ],
          pagination: { page: 1, limit: 20, total: 2 },
        });
        if (url === "/whatsapp/agents") return jsonResponse({ data: [] });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });
        if (url.includes("/messages?")) return jsonResponse({ data: [], pagination: { page: 1, limit: 50, total: 0 },
          customer_service_window: { last_inbound_at: null, expires_at: null, is_open: false } });
        if (url.includes("telefone=558511111111")) {
          return await new Promise<Response>((resolve) => { resolveFirstContext = resolve; });
        }
        if (url.includes("telefone=558522222222")) return jsonResponse({
          normalized_phone: "558522222222", resolution: "matched", match_type: "clinica",
          clinicas: [{ id: 2, nome: "Clínica Dois Vinculada", cidade: "Fortaleza", estado: "CE" }],
          tutores: [], pets: [], agendamentos: [], ordens_servico: [],
        });
        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /Conversa Dois/ }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Clínica Dois Vinculada")).toBeInTheDocument();

    await act(async () => {
      resolveFirstContext(jsonResponse({
        normalized_phone: "558511111111", resolution: "matched", match_type: "clinica",
        clinicas: [{ id: 1, nome: "Cadastro Antigo", cidade: null, estado: null }],
        tutores: [], pets: [], agendamentos: [], ordens_servico: [],
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Clínica Dois Vinculada")).toBeInTheDocument();
    expect(screen.queryByText("Cadastro Antigo")).not.toBeInTheDocument();
  });

  it("edita e desativa um atendente na seção Configurar equipe", async () => {
    let agentsCallCount = 0;
    const requestedCalls: Array<{ url: string; method: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        if (method !== "GET") {
          requestedCalls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
        }

        if (url.startsWith("/whatsapp/conversations?")) return jsonResponse({ data: [], pagination: { page: 1, limit: 20, total: 0 } });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });

        if (url === "/whatsapp/agents") {
          agentsCallCount += 1;
          return jsonResponse({
            data: [
              {
                id: "7",
                name: agentsCallCount === 1 ? "Ana" : "Ana Paula",
                email: "ana@fortcordis.com",
                role: agentsCallCount === 1 ? "agent" : "supervisor",
                active: agentsCallCount < 3,
                created_at: "2026-08-14T02:00:00.000Z",
              },
            ],
          });
        }

        if (url === "/whatsapp/agents/7" && method === "PATCH") {
          return jsonResponse({ id: "7", name: "Ana Paula", email: "ana@fortcordis.com", role: "supervisor", active: agentsCallCount < 2, created_at: "2026-08-14T02:00:00.000Z" });
        }

        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText("Configurar equipe"));
    fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));

    const nameInput = screen.getByDisplayValue("Ana");
    fireEvent.change(nameInput, { target: { value: "Ana Paula" } });
    const roleSelects = screen.getAllByDisplayValue("Atendente");
    fireEvent.change(roleSelects[roleSelects.length - 1], { target: { value: "supervisor" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestedCalls[0]).toEqual({
      url: "/whatsapp/agents/7",
      method: "PATCH",
      body: { name: "Ana Paula", email: "ana@fortcordis.com", role: "supervisor" },
    });
    expect(screen.getByText("Atendente atualizado com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestedCalls[1]).toEqual({
      url: "/whatsapp/agents/7",
      method: "PATCH",
      body: { active: false },
    });
    expect(screen.getByText("Atendente desativado.")).toBeInTheDocument();
  });

  it("pré-seleciona o atendente logado pelo email ao assumir uma conversa sem responsável", async () => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, email: " Eu@FortCordis.com ", nome: "Eu Mesma", ativo: 1, papeis: [] })
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/whatsapp/conversations?")) return jsonResponse({
          data: [{ id: "3926", wa_phone_number: "558500000000", wa_psid: null, status: "open", subject: "Sem responsável",
            last_agent_id: null, last_activity_at: "2026-08-14T02:26:00.000Z", last_inbound_at: null,
            created_at: "2026-08-14T02:26:00.000Z", updated_at: "2026-08-14T02:26:00.000Z" }],
          pagination: { page: 1, limit: 20, total: 1 },
        });
        if (url === "/whatsapp/agents") return jsonResponse({
          data: [
            { id: "5", name: "Outra Pessoa", email: "outra@fortcordis.com", role: "agent", active: true, created_at: "2026-08-14T02:00:00.000Z" },
            { id: "9", name: "Eu Mesma", email: "eu@fortcordis.com", role: "agent", active: true, created_at: "2026-08-14T02:00:00.000Z" },
          ],
        });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });
        if (url.startsWith("/whatsapp/conversations/3926/messages?")) return jsonResponse({
          data: [], pagination: { page: 1, limit: 50, total: 0 },
          customer_service_window: { last_inbound_at: null, expires_at: null, is_open: false },
        });
        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Atribuir para")).toHaveValue("9");
  });

  it("usa o primeiro atendente ativo quando o email logado não corresponde a nenhum atendente", async () => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, email: "ninguem@fortcordis.com", nome: "Ninguém", ativo: 1, papeis: [] })
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/whatsapp/conversations?")) return jsonResponse({
          data: [{ id: "3926", wa_phone_number: "558500000000", wa_psid: null, status: "open", subject: "Sem responsável",
            last_agent_id: null, last_activity_at: "2026-08-14T02:26:00.000Z", last_inbound_at: null,
            created_at: "2026-08-14T02:26:00.000Z", updated_at: "2026-08-14T02:26:00.000Z" }],
          pagination: { page: 1, limit: 20, total: 1 },
        });
        if (url === "/whatsapp/agents") return jsonResponse({
          data: [
            { id: "3", name: "Inativa Primeiro", email: "inativa@fortcordis.com", role: "agent", active: false, created_at: "2026-08-14T02:00:00.000Z" },
            { id: "5", name: "Ativa Segunda", email: "ativa@fortcordis.com", role: "agent", active: true, created_at: "2026-08-14T02:00:00.000Z" },
          ],
        });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });
        if (url.startsWith("/whatsapp/conversations/3926/messages?")) return jsonResponse({
          data: [], pagination: { page: 1, limit: 50, total: 0 },
          customer_service_window: { last_inbound_at: null, expires_at: null, is_open: false },
        });
        if (url.includes("/seen")) return jsonResponse({ data: { id: "0", last_seen_at: "2026-08-14T00:00:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Atribuir para")).toHaveValue("5");
  });

  it("mostra indicador de não lida e marca como vista ao abrir a conversa", async () => {
    const patchCalls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method || "GET") === "PATCH") patchCalls.push(url);

        if (url.startsWith("/whatsapp/conversations?")) return jsonResponse({
          data: [
            { id: "50", wa_phone_number: "558511110000", wa_psid: null, status: "open", subject: "Já vista",
              last_agent_id: null, last_activity_at: "2026-08-14T02:26:00.000Z", last_inbound_at: "2026-08-14T02:20:00.000Z",
              unread: false, created_at: "2026-08-14T02:00:00.000Z", updated_at: "2026-08-14T02:00:00.000Z" },
            { id: "60", wa_phone_number: "558522220000", wa_psid: null, status: "open", subject: "Contato Pendente",
              last_agent_id: null, last_activity_at: "2026-08-14T02:30:00.000Z", last_inbound_at: "2026-08-14T02:29:00.000Z",
              unread: true, created_at: "2026-08-14T02:10:00.000Z", updated_at: "2026-08-14T02:10:00.000Z" },
          ],
          pagination: { page: 1, limit: 20, total: 2 },
        });
        if (url === "/whatsapp/agents") return jsonResponse({ data: [] });
        if (url === "/whatsapp/automation/templates") return jsonResponse({ data: [], source: "configured_catalog", meta_approval_live: null });
        if (url.startsWith("/whatsapp/conversations/50/messages?")) return jsonResponse({
          data: [], pagination: { page: 1, limit: 50, total: 0 }, last_inbound_at: "2026-08-14T02:20:00.000Z",
          customer_service_window: { last_inbound_at: "2026-08-14T02:20:00.000Z", expires_at: "2026-08-15T02:20:00.000Z", is_open: true },
        });
        if (url.startsWith("/whatsapp/conversations/60/messages?")) return jsonResponse({
          data: [], pagination: { page: 1, limit: 50, total: 0 }, last_inbound_at: "2026-08-14T02:29:00.000Z",
          customer_service_window: { last_inbound_at: "2026-08-14T02:29:00.000Z", expires_at: "2026-08-15T02:29:00.000Z", is_open: true },
        });
        if (url.includes("/seen")) return jsonResponse({ data: { id: url.split("/")[3] ?? "", last_seen_at: "2026-08-14T02:31:00.000Z" } });

        throw new Error(`URL inesperada no teste: ${url}`);
      })
    );

    render(<WhatsAppStagePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Não lida")).toBeInTheDocument();
    expect(patchCalls).toContain("/whatsapp/conversations/50/seen");
    expect(patchCalls).not.toContain("/whatsapp/conversations/60/seen");

    fireEvent.click(screen.getByText("Contato Pendente"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(patchCalls).toContain("/whatsapp/conversations/60/seen");
    expect(screen.queryByLabelText("Não lida")).not.toBeInTheDocument();
  });
});
