import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AGENDA_SEMANAL } from "@/lib/agenda-config";

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: vi.fn(),
  },
}));

vi.mock("@/components/fortinho/FortinhoProvider", () => ({
  useFortinho: () => ({
    notify: vi.fn(),
    confirm: vi.fn(async () => false),
  }),
}));

vi.mock("@/lib/stable-catalog-cache", () => ({
  loadStableCatalog: ({ load }: { load: () => Promise<unknown> }) => load(),
}));

vi.mock("@/lib/credito-cliente", () => ({
  consultarSaldoCreditoCliente: vi.fn(async () => 0),
}));

import NovoAgendamentoModal from "./NovoAgendamentoModal";

const CLINICA = {
  id: 7,
  nome: "Pet Sanus Caucaia",
  latitude: -3.7327,
  longitude: -38.527,
};

const SERVICO = { id: 3, nome: "Ecocardiograma", duracao_minutos: 30 };

const OFERTA = {
  inicio: "2026-09-15 09:00",
  fim: "2026-09-15 09:30",
  score: 10,
  risco: 0,
  tempo_deslocamento_total_min: 12,
  anterior: null,
  proximo: null,
};

function montarModal() {
  return render(
    <NovoAgendamentoModal
      isOpen
      isAdmin
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      defaultDate="2026-09-15"
      defaultTime="09:00"
      agendaSemanal={DEFAULT_AGENDA_SEMANAL}
      agendaFeriados={[]}
      agendaExcecoes={[]}
    />
  );
}

async function selecionarClinicaEServico() {
  const labelClinica = await waitFor(() => {
    const encontrado = Array.from(document.querySelectorAll("label")).find(
      (label) => label.textContent === "Clínica"
    );
    if (!encontrado) throw new Error("label da clinica ainda nao renderizado");
    return encontrado;
  });
  const blocoClinica = labelClinica.parentElement as HTMLElement;
  fireEvent.click(blocoClinica.querySelector("button[aria-expanded]") as HTMLButtonElement);
  fireEvent.click(await screen.findByText(CLINICA.nome));

  const selectServico = document.querySelectorAll("select");
  const servicoSelect = Array.from(selectServico).find((select) =>
    Array.from(select.options).some((option) => option.textContent === SERVICO.nome)
  );
  expect(servicoSelect).toBeTruthy();
  fireEvent.change(servicoSelect as HTMLSelectElement, { target: { value: String(SERVICO.id) } });
}

describe("NovoAgendamentoModal - excecao manual de horario", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();

    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith("/pacientes")) return { data: { items: [] } };
      if (url.startsWith("/tutores")) return { data: { items: [] } };
      if (url.startsWith("/clinicas")) return { data: { items: [CLINICA] } };
      if (url.startsWith("/servicos")) return { data: { items: [SERVICO] } };
      return { data: {} };
    });

    apiPost.mockImplementation(async (url: string) => {
      if (url === "/agenda/assistente/ofertas") {
        return {
          data: {
            panorama_ofertas: { items: [OFERTA], itens_ignorados_janela: 0, motivo: "" },
            mensagem_panorama: "",
            sugestao_proximidade: null,
          },
        };
      }
      if (url === "/agenda/sugestao-proximidade") {
        return { data: { sugerir: false, mensagem: "" } };
      }
      return { data: {} };
    });
  });

  it("mantem motivo e horario liberados ao trocar a data depois da excecao concedida", async () => {
    const { container } = montarModal();

    await selecionarClinicaEServico();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerar melhor oferta" }));
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Nenhuma oferta atende a necessidade do cliente/i,
      })
    );

    const motivo = await screen.findByPlaceholderText(/cliente so pode no turno da manha/i);
    fireEvent.change(motivo, { target: { value: "Cliente so tem disponibilidade na proxima semana." } });

    fireEvent.click(screen.getByRole("button", { name: /Conceder excecao e liberar horario manual/i }));

    const inputData = container.querySelector('input[type="date"]') as HTMLInputElement;
    const inputHora = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(inputData.disabled).toBe(false);
    expect(inputHora.disabled).toBe(false);

    await act(async () => {
      fireEvent.change(inputData, { target: { value: "2026-09-22" } });
    });

    expect(inputData.value).toBe("2026-09-22");
    expect(inputHora.disabled).toBe(false);
    expect(
      (screen.getByPlaceholderText(/cliente so pode no turno da manha/i) as HTMLTextAreaElement).value
    ).toBe("Cliente so tem disponibilidade na proxima semana.");
    expect(screen.getByText(/Excecao concedida por admin/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Data ajustada sob excecao concedida/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Oferta 1:/)).not.toBeInTheDocument();
  });

  it("mantem o bloqueio guiado sem excecao e volta a bloquear apos revogar", async () => {
    const { container } = montarModal();

    await selecionarClinicaEServico();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerar melhor oferta" }));
    });

    expect(await screen.findByText(/Oferta 1:/)).toBeInTheDocument();

    const inputData = container.querySelector('input[type="date"]') as HTMLInputElement;
    const inputHora = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(inputData.disabled).toBe(true);
    expect(inputHora.disabled).toBe(true);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Nenhuma oferta atende a necessidade do cliente/i,
      })
    );
    expect(inputData.disabled).toBe(true);
    expect(inputHora.disabled).toBe(true);

    const motivo = await screen.findByPlaceholderText(/cliente so pode no turno da manha/i);
    fireEvent.change(motivo, { target: { value: "Cliente so aceita horario noturno." } });
    fireEvent.click(screen.getByRole("button", { name: /Conceder excecao e liberar horario manual/i }));
    expect(inputData.disabled).toBe(false);
    expect(inputHora.disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Revogar excecao/i }));
    expect(inputData.disabled).toBe(true);
    expect(inputHora.disabled).toBe(true);
  });
});
