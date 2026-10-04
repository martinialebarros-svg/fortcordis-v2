import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENDA_SEMANAL } from "@/lib/agenda-config";
import type { PedidoAgenda } from "@/lib/whatsapp-pedido-agenda";

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => apiGet(...args), post: (...args: unknown[]) => apiPost(...args), put: vi.fn() } }));
vi.mock("@/components/fortinho/FortinhoProvider", () => ({ useFortinho: () => ({ notify: vi.fn(), confirm: vi.fn(async () => false) }) }));
vi.mock("@/lib/stable-catalog-cache", () => ({ loadStableCatalog: ({ load }: { load: () => Promise<unknown> }) => load() }));
vi.mock("@/lib/credito-cliente", () => ({ consultarSaldoCreditoCliente: vi.fn(async () => 0) }));

import NovoAgendamentoModal from "./NovoAgendamentoModal";

const PEDIDO: PedidoAgenda = {
  pedido_id: 9, versao: 1, clinica_id: 7, resumo: "Solicitação de teste",
  paciente: null, tutor: null, servico_id: 3, avisos: [],
};
const OFERTA = { inicio: "2026-10-05 14:00", fim: "2026-10-05 14:40", score: 0, risco: 0, tempo_deslocamento_total_min: 0, anterior: null, proximo: null };
const resposta = () => ({ data: { panorama_ofertas: { items: [OFERTA] } } });

function formulario(pedido = PEDIDO, isOpen = true, agendamento?: { id: number; clinica_id: number; servico_id: number; inicio: string; status: string }) {
  return <NovoAgendamentoModal isOpen={isOpen} isAdmin pedidoWhatsApp={pedido} agendamento={agendamento} onClose={vi.fn()} onSuccess={vi.fn()}
    defaultDate="2026-10-04" defaultTime="09:00" intervaloSlotMinutos={60}
    agendaSemanal={DEFAULT_AGENDA_SEMANAL} agendaFeriados={[]} agendaExcecoes={[]} />;
}

function montar(pedido = PEDIDO) {
  return render(formulario(pedido));
}

async function botaoGerar() {
  const botao = screen.getByRole("button", { name: "Gerar melhor oferta" });
  await waitFor(() => expect(botao).toBeEnabled());
  return botao;
}

describe("preferências antes das ofertas", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T01:00:00Z"));
    apiGet.mockReset(); apiPost.mockReset();
    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith("/clinicas")) return { data: { items: [{ id: 7, nome: "Clínica teste", latitude: -3.73, longitude: -38.52 }] } };
      if (url.startsWith("/servicos")) return { data: { items: [{ id: 3, nome: "Ecocardiograma", duracao_minutos: 40 }] } };
      return { data: { items: [] } };
    });
    apiPost.mockImplementation(async () => resposta());
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("envia próxima semana à tarde antes de calcular, usando Fortaleza e passo independente da grade", async () => {
    montar();
    await botaoGerar();
    expect(apiPost).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Quando deseja o atendimento"), { target: { value: "proxima_semana" } });
    fireEvent.change(screen.getByLabelText("Turno desejado"), { target: { value: "tarde" } });
    expect(screen.getByText(/05\/10\/2026 a 11\/10\/2026/)).toBeInTheDocument();
    fireEvent.click(await botaoGerar());
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/agenda/assistente/ofertas", expect.objectContaining({
      intervalo_minutos: 15, duracao_minutos: 40, data_contato: "2026-10-04",
      preferencia: { data_inicio: "2026-10-05", data_fim: "2026-10-11", turno: "tarde" },
    })));
  });

  it("traz preferência estruturada do pedido e permite ampliar somente por ação explícita", async () => {
    montar({ ...PEDIDO, dados_coletados: { preferencia_agenda: { data_inicio: "2026-10-08", data_fim: "2026-10-08", turno: "manha" } } });
    fireEvent.click(await botaoGerar());
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/agenda/assistente/ofertas", expect.objectContaining({
      preferencia: { data_inicio: "2026-10-08", data_fim: "2026-10-08", turno: "manha" },
    })));
    fireEvent.click(screen.getByRole("button", { name: "Limpar preferências e ampliar busca" }));
    fireEvent.click(await botaoGerar());
    await waitFor(() => expect(apiPost).toHaveBeenLastCalledWith("/agenda/assistente/ofertas", expect.objectContaining({ preferencia: undefined })));
  });

  it("descarta resposta antiga ao mudar o turno e invalida uma oferta já aceita", async () => {
    let concluir!: (value: ReturnType<typeof resposta>) => void;
    apiPost.mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; }));
    const { container } = montar();
    fireEvent.click(await botaoGerar());
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Turno desejado"), { target: { value: "tarde" } });
    await act(async () => { concluir(resposta()); });
    expect(screen.queryByRole("button", { name: "Cliente aceitou esta oferta" })).not.toBeInTheDocument();
    fireEvent.click(await botaoGerar());
    fireEvent.click(await screen.findByRole("button", { name: "Cliente aceitou esta oferta" }));
    expect(container.querySelector<HTMLInputElement>('input[type="time"]')?.value).toBe("14:00");
    fireEvent.change(screen.getByLabelText("Turno desejado"), { target: { value: "manha" } });
    expect(screen.queryByText(/Aceite do cliente registrado/)).not.toBeInTheDocument();
    expect(container.querySelector<HTMLInputElement>('input[type="time"]')?.value).toBe("");
    expect(screen.queryByRole("button", { name: "Cliente aceitou esta oferta" })).not.toBeInTheDocument();
  });

  it("bloqueia a busca com período incompleto ou faixa horária invertida", async () => {
    montar();
    await botaoGerar();
    fireEvent.change(screen.getByLabelText("Quando deseja o atendimento"), { target: { value: "intervalo" } });
    expect(screen.getByRole("button", { name: "Gerar melhor oferta" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Primeiro dia"), { target: { value: "2026-10-05" } });
    fireEvent.change(screen.getByLabelText("Último dia"), { target: { value: "2026-10-06" } });
    fireEvent.change(screen.getByLabelText("Turno desejado"), { target: { value: "personalizado" } });
    fireEvent.change(screen.getByLabelText("A partir de"), { target: { value: "16:00" } });
    fireEvent.change(screen.getByLabelText("Terminar até"), { target: { value: "14:00" } });
    expect(screen.getByRole("button", { name: "Gerar melhor oferta" })).toBeDisabled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("mostra preferência importada antes de gerar e preserva a interseção do turno com a faixa", async () => {
    montar({ ...PEDIDO, dados_coletados: { preferencia_agenda: { turno: "tarde", hora_inicio: "10:00", hora_fim: "17:00" } } });
    const botao = await botaoGerar();
    const campo = screen.getByRole("group", { name: "Preferências deste atendimento" });
    expect(campo.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("A partir de")).toHaveValue("12:00");
    expect(screen.getByLabelText("Terminar até")).toHaveValue("17:00");
    fireEvent.click(botao);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/agenda/assistente/ofertas", expect.objectContaining({
      preferencia: { turno: "qualquer", hora_inicio: "12:00", hora_fim: "17:00" },
    })));
  });

  it("não reaplica resultado da sessão encerrada depois de reabrir o modal", async () => {
    let concluir!: (value: ReturnType<typeof resposta>) => void;
    apiPost.mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; }));
    const { rerender } = montar();
    fireEvent.click(await botaoGerar());
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    rerender(formulario(PEDIDO, false));
    rerender(formulario());
    await botaoGerar();
    await act(async () => { concluir(resposta()); });
    expect(screen.queryByRole("button", { name: "Cliente aceitou esta oferta" })).not.toBeInTheDocument();
  });

  it("mantém o filtro da edição quando a leitura de pacientes termina", async () => {
    let concluirPacientes!: (value: { data: { items: [] } }) => void;
    const getOriginal = apiGet.getMockImplementation()!;
    apiGet.mockImplementation((url: string) => url.startsWith("/pacientes")
      ? new Promise((resolve) => { concluirPacientes = resolve; }) : getOriginal(url));
    render(formulario(PEDIDO, true, { id: 5, clinica_id: 7, servico_id: 3, inicio: "2026-10-06T09:00:00", status: "Agendado" }));
    fireEvent.change(screen.getByLabelText("Turno desejado"), { target: { value: "manha" } });
    await waitFor(() => expect(concluirPacientes).toBeTypeOf("function"));
    await act(async () => { concluirPacientes({ data: { items: [] } }); });
    expect(screen.getByLabelText("Turno desejado")).toHaveValue("manha");
  });
});
