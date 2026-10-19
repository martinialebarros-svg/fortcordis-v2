import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EchoNarrativeConsistencyNotice from "./EchoNarrativeConsistencyNotice";

describe("aviso discreto de conferência clínica", () => {
  it("mostra diferenças numéricas sem substituir a narrativa", () => {
    render(<EchoNarrativeConsistencyNotice
      measurements={{ VE_tecnica_relatorio: "modo_m", FE_Teicholz: "95", DeltaD_FS: "67" }}
      qualitative={{ funcao: "Fração de ejeção estimada em 97% e fração de encurtamento de 71%." }}
      conclusion=""
    />);
    expect(screen.getByRole("status")).toHaveTextContent("FE: o texto cita 97%");
    expect(screen.getByRole("status")).toHaveTextContent("FEC: o texto cita 71%");
    expect(screen.getByRole("status")).toHaveTextContent("Aviso de conferência");
  });

  it("não ocupa espaço quando a narrativa concorda com a técnica selecionada", () => {
    const { container } = render(<EchoNarrativeConsistencyNotice
      measurements={{ VE_tecnica_relatorio: "2d", FE_Teicholz_2D: "61" }}
      qualitative={{ funcao: "Fração de ejeção de 61%." }}
      conclusion=""
    />);
    expect(container).toBeEmptyDOMElement();
  });

  it("localiza o trecho e oferece sugestão somente para revisão manual", () => {
    const sentence = "Ondas E e A separadas e mensuráveis.";
    render(<EchoNarrativeConsistencyNotice species="Gato"
      measurements={{ Diastolica_ondas: "fundidas" }}
      qualitative={{ funcao: sentence }} conclusion="Conclusão clínica preservada."
    />);
    const notice = screen.getByRole("status", { name: "Conferência de coerência do laudo" });
    expect(notice).toHaveAttribute("data-echo-consistency-review");
    fireEvent.click(within(notice).getByText(/Ver trecho/));
    expect(within(notice).getByText(sentence, { selector: "blockquote" })).toBeInTheDocument();
    expect(within(notice).getByText("Sugestão para sua revisão:")).toBeInTheDocument();
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
    expect(notice).toHaveTextContent("A interpretação e o salvamento permanecem sob sua decisão");
  });

  it("atualiza o aviso com a fusão e com a correção da narrativa", () => {
    const props = { species: "Felina", qualitative: { funcao: "Ondas E e A separadas e mensuráveis." }, conclusion: "" };
    const view = render(<EchoNarrativeConsistencyNotice {...props} measurements={{ Diastolica_ondas: "separadas" }} />);
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(<EchoNarrativeConsistencyNotice {...props} measurements={{ Diastolica_ondas: "fundidas" }} />);
    expect(screen.getByRole("status", { name: "Conferência de coerência do laudo" })).toBeInTheDocument();
    view.rerender(<EchoNarrativeConsistencyNotice {...props} measurements={{ Diastolica_ondas: "fundidas" }}
      qualitative={{ funcao: "Ondas E/A fundidas, sem mensuração independente." }} />);
    expect(view.container).toBeEmptyDOMElement();
  });
});
