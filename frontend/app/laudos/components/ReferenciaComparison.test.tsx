import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenciaComparison } from "./ReferenciaComparison";

const buscarReferencia = vi.hoisted(() => vi.fn(async () => ({ id: 1, especie: "Canina", peso_kg: 11 })));
const compararMedidas = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("../hooks/useReferenciaEco", () => ({
  useReferenciaEco: () => ({ buscarReferencia, compararMedidas, loading: false }),
}));

describe("identificação da referência ecocardiográfica", () => {
  it("distingue o peso do paciente da linha de cadastro selecionada", async () => {
    render(<ReferenciaComparison especie="Canina" peso={10.8} medidas={{}} />);

    expect(await screen.findByText("Referência selecionada: Canina, cadastro de 11 kg")).toBeInTheDocument();
    expect(screen.getByText(/Peso do paciente: 10,8 kg/)).toBeInTheDocument();
    expect(screen.getByText("Dentro da faixa")).toBeInTheDocument();
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
  });

  it("exige confirmação da vista antes de pedir comparação das medidas 2D", async () => {
    compararMedidas.mockClear();
    render(<ReferenciaComparison especie="Canina" peso={13.6} medidas={{ DIVEd_2D: "33.53", DIVES_2D: "22.87" }} />);
    const vista = await screen.findByLabelText("Confirme cão adulto e vista 2D do ventrículo esquerdo");
    expect(vista).toHaveValue("");
    fireEvent.change(vista, { target: { value: "eixo_curto" } });
    await waitFor(() => expect(compararMedidas).toHaveBeenLastCalledWith(
      expect.objectContaining({ DIVEd_2D: "33.53", DIVES_2D: "22.87" }),
      expect.objectContaining({ especie: "Canina" }),
      "eixo_curto",
      13.6,
    ));
  });
});
