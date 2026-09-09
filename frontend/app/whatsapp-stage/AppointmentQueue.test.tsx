import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppointmentQueue from "./AppointmentQueue";
const item = { id: 1, conversation_id: "77", wa_identity: "phone", clinica_id: 9, clinica_nome: "Vet World", resumo: "Paciente: Rex", status: "aguardando_equipe", sem_responsavel: true, minha: false, responsavel_nome: null, prazo_em: "2026-09-09T10:00:00Z", atrasada: true, versao: 1, historico: [] };
const response = (itens = [item]) => new Response(JSON.stringify({ itens, total: itens.length, contagens: {} }), { headers: {"Content-Type":"application/json"} });
afterEach(() => { vi.unstubAllGlobals(); });
describe("Fila de agendamento", () => {
  it("carrega sob demanda, destaca atraso e assume com versão", async () => {
    const fetch = vi.fn().mockImplementation(async (_url, init) => init?.method === "PATCH" ? new Response("{}") : response());
    vi.stubGlobal("fetch",fetch);
    const onOpen = vi.fn();
    render(<AppointmentQueue onOpen={onOpen} />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Solicitações de agendamento/ }));
    expect(await screen.findByText(/Pedido #1 · Vet World/)).toBeInTheDocument();
    expect(screen.getByText(/Prazo vencido ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Abrir conversa"));
    expect(onOpen).toHaveBeenCalledWith("77","phone");
    fireEvent.click(screen.getByText("Assumir pedido"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/whatsapp/bot/solicitacoes/1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ versao:1, acao:"assumir" }) })));
  });
  it("exibe conflito sem alegar sucesso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url,init) => init?.method === "PATCH" ? new Response(JSON.stringify({detail:"Outro atendente já assumiu esta solicitação."}), {status:409}) : response()));
    render(<AppointmentQueue onOpen={() => {}} />);
    fireEvent.click(screen.getByRole("button", {name:/Solicitações de agendamento/}));
    fireEvent.click(await screen.findByText("Assumir pedido"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Outro atendente");
  });
  it("exige resultado para concluir", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(response([{...item, minha:true,sem_responsavel:false,status:"em_atendimento"}])));
    render(<AppointmentQueue onOpen={() => {}} />);
    fireEvent.click(screen.getByRole("button", {name:/Solicitações de agendamento/}));
    await screen.findByText("Salvar pedido");
    fireEvent.change(screen.getByLabelText("Status do pedido 1"),{target:{value:"agendado"}});
    expect(screen.getByText("Salvar pedido")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Resultado / observação"),{target:{value:"Confirmado na agenda"}});
    expect(screen.getByText("Salvar pedido")).not.toBeDisabled();
  });
  it("permite recuperar falha de leitura", async () => {
    const fetch=vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(async () => response([]));
    vi.stubGlobal("fetch",fetch);
    render(<AppointmentQueue onOpen={() => {}} />);
    fireEvent.click(screen.getByRole("button", {name:/Solicitações de agendamento/}));
    await screen.findByRole("alert");
    await act(async () => {fireEvent.click(screen.getByText("Atualizar fila"));});
    expect(await screen.findByText("Nenhuma solicitação neste filtro.")).toBeInTheDocument();
  });
});
