import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReferenciaComparison } from "./ReferenciaComparison";

const buscarReferencia = vi.hoisted(() => vi.fn(async () => ({ id: 1, especie: "Canina", peso_kg: 11 })));
const compararMedidas = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("../hooks/useReferenciaEco", () => ({
  useReferenciaEco: () => ({ buscarReferencia, compararMedidas, loading: false }),
}));

describe("identificação da referência ecocardiográfica", () => {
  it("distingue o peso do paciente da linha de cadastro selecionada", async () => {
    render(<ReferenciaComparison especie="Canina" peso={10.8} medidas={{}} onMedidaChange={vi.fn()} />);

    expect(await screen.findByText("Referência selecionada: Canina, cadastro de 11 kg")).toBeInTheDocument();
    expect(screen.getByText(/Peso do paciente: 10,8 kg/)).toBeInTheDocument();
    expect(screen.getByText("Dentro da faixa")).toBeInTheDocument();
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
  });

  it("exige confirmação da vista antes de pedir comparação das medidas 2D", async () => {
    compararMedidas.mockClear();
    function Example() {
      const [medidas, setMedidas] = useState({ DIVEd_2D: "33.53", DIVES_2D: "22.87" });
      return <ReferenciaComparison especie="Canina" peso={13.6} medidas={medidas}
        onMedidaChange={(key, value) => setMedidas((current) => ({ ...current, [key]: value }))} />;
    }
    render(<Example />);
    const vista = await screen.findByLabelText("Confirme cão adulto e vista 2D do ventrículo esquerdo");
    expect(screen.getByText(/Septo e parede não têm faixa 2D por peso nas fontes adotadas/)).toBeInTheDocument();
    expect(screen.getByText(/Teichholz não são comparados aos intervalos obtidos por Simpson/)).toBeInTheDocument();
    expect(vista).toHaveValue("");
    fireEvent.change(vista, { target: { value: "eixo_curto" } });
    await waitFor(() => expect(compararMedidas).toHaveBeenLastCalledWith(
      expect.objectContaining({ DIVEd_2D: "33.53", DIVES_2D: "22.87" }),
      expect.objectContaining({ especie: "Canina" }),
      "eixo_curto",
      13.6,
    ));
  });

  it("pede método de TAPSE somente quando preenchido e persiste seleção explícita", async () => {
    const change = vi.fn();
    const { rerender } = render(<ReferenciaComparison especie="Canina" peso={10} medidas={{}} onMedidaChange={change} />);
    await screen.findByText(/Referência selecionada/);
    expect(screen.queryByLabelText("Método de obtenção do TAPSE")).not.toBeInTheDocument();
    rerender(<ReferenciaComparison especie="Canina" peso={10} medidas={{ TAPSE: "10" }} onMedidaChange={change} />);
    const method = await screen.findByLabelText("Método de obtenção do TAPSE");
    expect(method).toHaveValue("");
    fireEvent.change(method, { target: { value: "modo_m_apical" } });
    expect(change).toHaveBeenCalledWith("TAPSE_metodo", "modo_m_apical");
  });

  it("exige vista e fase de AE/Ao felino sem assumir método por espécie", async () => {
    buscarReferencia.mockResolvedValueOnce({ id: 2, especie: "Felina", peso_kg: 4 });
    const change = vi.fn();
    render(<ReferenciaComparison especie="Felina" peso={4} medidas={{ AE_Ao: "1.42" }} onMedidaChange={change} />);
    const method = await screen.findByLabelText("Método de obtenção de AE/Ao");
    expect(method).toHaveValue("");
    fireEvent.change(method, { target: { value: "2d_eixo_curto_diastole_inicial" } });
    expect(change).toHaveBeenCalledWith("AE_Ao_metodo", "2d_eixo_curto_diastole_inicial");
  });

  it("confirma método canino sem inferir a vista da técnica ventricular", async () => {
    const change = vi.fn();
    const { rerender } = render(<ReferenciaComparison especie="Canina" peso={3.6}
      medidas={{ AE_Ao: "1.41", VE_tecnica_relatorio: "modo_m" }} onMedidaChange={change} />);
    const method = await screen.findByLabelText("Método de obtenção de AE/Ao");
    expect(method).toHaveValue("");
    expect(screen.queryByText(/O PDF apresentará AE\/Ao/)).not.toBeInTheDocument();
    fireEvent.change(method, { target: { value: "2d_eixo_curto_diastole_inicial" } });
    expect(change).toHaveBeenCalledWith("AE_Ao_metodo", "2d_eixo_curto_diastole_inicial");
    rerender(<ReferenciaComparison especie="Canina" peso={3.6}
      medidas={{ AE_Ao: "1.41", AE_Ao_metodo: "2d_eixo_curto_diastole_inicial" }} onMedidaChange={change} />);
    expect(screen.getByText(/O PDF apresentará AE\/Ao < 1,60/)).toBeInTheDocument();
    rerender(<ReferenciaComparison especie="Canina" peso={3.6}
      medidas={{ AE_Ao: "1.41", AE_Ao_metodo: "outro" }} onMedidaChange={change} />);
    expect(screen.queryByText(/O PDF apresentará AE\/Ao/)).not.toBeInTheDocument();
  });

  it("permite confirmar o limite clínico canino mesmo sem peso ou linha do catálogo", async () => {
    const change = vi.fn();
    render(<ReferenciaComparison especie="Canina" medidas={{ AE_Ao: "1.41" }} onMedidaChange={change} />);
    expect(screen.getByText("Nenhuma referência encontrada")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Método de obtenção de AE/Ao"),
      { target: { value: "2d_eixo_curto_diastole_inicial" } });
    expect(change).toHaveBeenCalledWith("AE_Ao_metodo", "2d_eixo_curto_diastole_inicial");
  });

  it("registra método sueco somente pela escolha explícita e identifica a fonte da técnica", async () => {
    const change = vi.fn();
    const { rerender } = render(<ReferenciaComparison especie="Canina" peso={4}
      medidas={{ AE_Ao: "1.41", AE_Ao_metodo: "2d_eixo_curto_diastole_inicial" }} onMedidaChange={change} />);
    const method = await screen.findByLabelText("Método de obtenção de AE/Ao");
    expect(method).toHaveValue("2d_eixo_curto_diastole_inicial");
    expect(screen.queryByText(/O PDF citará Hansson/)).not.toBeInTheDocument();
    fireEvent.change(method, { target: { value: "2d_eixo_curto_diastole_inicial_sueco" } });
    expect(change).toHaveBeenCalledWith("AE_Ao_metodo", "2d_eixo_curto_diastole_inicial_sueco");
    rerender(<ReferenciaComparison especie="Canina" peso={4}
      medidas={{ AE_Ao: "1.41", AE_Ao_metodo: "2d_eixo_curto_diastole_inicial_sueco" }} onMedidaChange={change} />);
    expect(screen.getByText(/O PDF citará Hansson/)).toBeInTheDocument();
    expect(screen.getByText(/O PDF apresentará AE\/Ao < 1,60/)).toBeInTheDocument();
  });

  it("não oferece método canino para razão ausente ou não finita", async () => {
    const { rerender } = render(<ReferenciaComparison especie="Canina" peso={4} medidas={{}} onMedidaChange={vi.fn()} />);
    await screen.findByText(/Referência selecionada/);
    expect(screen.queryByLabelText("Método de obtenção de AE/Ao")).not.toBeInTheDocument();
    rerender(<ReferenciaComparison especie="Canina" peso={4} medidas={{ AE_Ao: "Infinity" }} onMedidaChange={vi.fn()} />);
    expect(screen.queryByLabelText("Método de obtenção de AE/Ao")).not.toBeInTheDocument();
  });

  it("não promete limite no PDF enquanto unidades das origens são ambíguas", async () => {
    const medidas = { DIVEd: "2.5", DIVES: "1.5", Aorta: "1.0", Atrio_esquerdo: "1.4",
      AE_Ao: "1.4", AE_Ao_metodo: "2d_eixo_curto_diastole_inicial" };
    const { rerender } = render(<ReferenciaComparison especie="Canina" peso={4} medidas={medidas} onMedidaChange={vi.fn()} />);
    await screen.findByText(/Referência selecionada/);
    expect(screen.queryByLabelText("Método de obtenção de AE/Ao")).not.toBeInTheDocument();
    expect(screen.queryByText(/O PDF apresentará AE\/Ao/)).not.toBeInTheDocument();
    rerender(<ReferenciaComparison especie="Canina" peso={4} medidas={{ ...medidas,
      unidade_confirmada_Aorta: "cm", unidade_confirmada_Atrio_esquerdo: "cm" }} onMedidaChange={vi.fn()} />);
    expect(screen.getByLabelText("Método de obtenção de AE/Ao")).toBeInTheDocument();
    expect(screen.getByText(/O PDF apresentará AE\/Ao < 1,60/)).toBeInTheDocument();
  });
});
