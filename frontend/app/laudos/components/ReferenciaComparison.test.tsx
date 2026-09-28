import { render, screen } from "@testing-library/react";
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
  });
});
