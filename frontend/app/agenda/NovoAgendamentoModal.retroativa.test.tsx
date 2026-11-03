import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENDA_SEMANAL } from "@/lib/agenda-config";

const { apiGet, apiPut, confirm, notify } = vi.hoisted(() => ({
  apiGet: vi.fn(), apiPut: vi.fn(), confirm: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/axios", () => ({ default: {
  get: (...args: unknown[]) => apiGet(...args),
  post: vi.fn(async () => ({ data: {} })),
  put: (...args: unknown[]) => apiPut(...args),
} }));
vi.mock("@/components/fortinho/FortinhoProvider", () => ({
  useFortinho: () => ({ confirm, notify }),
}));
vi.mock("@/lib/stable-catalog-cache", () => ({
  loadStableCatalog: ({ load }: { load: () => Promise<unknown> }) => load(),
}));
vi.mock("@/lib/credito-cliente", () => ({ consultarSaldoCreditoCliente: vi.fn(async () => 0) }));

import NovoAgendamentoModal from "./NovoAgendamentoModal";

const CLINICA = { id: 7, nome: "Clinica sintetica", latitude: -3.7319, longitude: -38.5267 };
const SERVICO = { id: 3, nome: "Consulta sintetica", duracao_minutos: 90 };
const TUTOR = { id: 11, nome: "Tutor sintetico", telefone: "85999999999", pets: [{ id: 21, nome: "Pet sintetico" }] };
const PACIENTE = { id: 21, nome: "Pet sintetico", tutor_id: 11, tutor: TUTOR.nome, especie: "Canina" };
const AGENDAMENTO = {
  id: 91, status: "Agendado", paciente_id: 21, tutor_id: 11,
  paciente: PACIENTE.nome, tutor: TUTOR.nome,
  clinica_id: 7, clinica: CLINICA.nome, servico_id: 3, servico: SERVICO.nome,
  origem_atendimento: "clinica_parceira",
  inicio: "2026-11-03T08:00:00", fim: "2026-11-03T09:30:00",
};
const blocked = (detail: Record<string, unknown> = {}) => ({ response: { status: 409, data: { detail: {
  codigo: "PRIMEIRA_SAIDA_INVIAVEL", mensagem: "Saida de casa impediria este horario.",
  confirmavel: true, confirmacao: "confirmar_alteracao_retroativa", ...detail,
} } } });

async function edit(admin = true) {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  const view = render(<NovoAgendamentoModal
    isOpen isAdmin={admin} agendamento={AGENDAMENTO} onSuccess={onSuccess} onClose={onClose}
    agendaSemanal={DEFAULT_AGENDA_SEMANAL} agendaFeriados={[]}
    agendaExcecoes={[{ data: "2026-11-03", ativo: true, inicio: "06:00", fim: "16:00" }]}
  />);
  await screen.findByRole("option", { name: SERVICO.nome });
  await waitFor(() => expect(view.container.querySelector('input[type="time"]')).toHaveValue("08:00"));
  const time = view.container.querySelector('input[type="time"]') as HTMLInputElement;
  fireEvent.change(time, { target: { value: "07:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));
  await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
  return { ...view, onSuccess, onClose, time };
}

describe("correcao retroativa de horario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPut.mockReset();
    confirm.mockReset();
    confirm.mockResolvedValue(true);
    apiGet.mockImplementation(async (url: string) => {
      if (url === `/tutores/${TUTOR.id}/panorama`) return { data: { tutor: TUTOR, pets: [PACIENTE], resumo: { total_pets: 1 } } };
      if (url.startsWith("/pacientes")) return { data: { items: [PACIENTE] } };
      if (url.startsWith("/tutores")) return { data: { items: [TUTOR] } };
      if (url.startsWith("/clinicas")) return { data: { items: [CLINICA] } };
      if (url.startsWith("/servicos")) return { data: { items: [SERVICO] } };
      return { data: {} };
    });
  });

  it("pede aceite ao admin antes de reenviar e conclui apenas depois do sucesso", async () => {
    apiPut.mockRejectedValueOnce(blocked()).mockResolvedValueOnce({ data: { ...AGENDAMENTO, inicio: "2026-11-03T07:00:00" } });
    const { onSuccess, onClose } = await edit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Confirmar correção retroativa" }));
    expect(apiPut).toHaveBeenNthCalledWith(1, "/agenda/91", expect.objectContaining({ confirmar_alteracao_retroativa: false }));
    expect(apiPut).toHaveBeenNthCalledWith(2, "/agenda/91", expect.objectContaining({ confirmar_alteracao_retroativa: true, inicio: "2026-11-03T07:00:00" }));
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ inicio: "2026-11-03T07:00:00" }),
      { manterModalAberto: true },
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancelar preserva formulario sem reenviar nem anunciar sucesso", async () => {
    apiPut.mockRejectedValueOnce(blocked());
    confirm.mockResolvedValue(false);
    const { time, onSuccess, onClose } = await edit();
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar Alterações" })).toBeEnabled());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(apiPut).toHaveBeenCalledTimes(1);
    expect(time).toHaveValue("07:00");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    [false, {}],
    [true, { confirmavel: false }],
    [true, { confirmacao: "outra_confirmacao" }],
  ])("nao oferece dispensa sem perfil/contrato valido (%s, %j)", async (admin, detail) => {
    apiPut.mockRejectedValue(blocked(detail));
    const { onSuccess } = await edit(admin);
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
    expect(apiPut).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.queryByText(/Gere novas ofertas/)).not.toBeInTheDocument();
  });

  it("mantem confirmacoes independentes de reserva expirada, retroatividade e rota", async () => {
    apiPut.mockRejectedValueOnce(blocked({ codigo: "CONFIRMACAO_SLOT_RESERVA_EXPIRADA" }))
      .mockRejectedValueOnce(blocked())
      .mockRejectedValueOnce(blocked({ codigo: "CONFLITO_DESLOCAMENTO" }))
      .mockResolvedValueOnce({ data: AGENDAMENTO });
    const { onSuccess } = await edit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(apiPut).toHaveBeenCalledTimes(4);
    expect(apiPut).toHaveBeenLastCalledWith("/agenda/91", expect.objectContaining({
      confirmar_alteracao_retroativa: true,
      confirmar_slot_reserva_expirada: true,
      confirmar_conflito_deslocamento: true,
    }));
  });

  it("falha repetida depois do aceite nao confirma nem reenvia de novo", async () => {
    apiPut.mockRejectedValue(blocked());
    const { onSuccess, time } = await edit();
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(apiPut).toHaveBeenCalledTimes(2);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(time).toHaveValue("07:00");
  });
});
