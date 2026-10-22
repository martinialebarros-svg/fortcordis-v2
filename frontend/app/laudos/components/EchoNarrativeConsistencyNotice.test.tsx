import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it.each([
    "E de 1,08 m/s e onda A de 0,95 m/s.",
    "Não há aumento atrial, e a relação E/A é 1,14.",
    "E/A=1,14, sem interpretação do Doppler tecidual.",
    "E/A=1,14; não interpretável a função sistólica por artefato.",
  ])("P2: mostra o trecho completo sem mudar a narrativa nem impedir o submit: %s", (sentence) => {
    const measurements = Object.freeze({ Diastolica_ondas: "fundidas", TDI_ondas: "separadas", Onda_E: "1.08", Onda_A: "0.95" });
    const qualitative = Object.freeze({ funcao: sentence });
    const conclusion = "Conclusão oficial preservada.";
    const onSave = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <textarea aria-label="Narrativa oficial" readOnly value={sentence} />
      <EchoNarrativeConsistencyNotice species="Gato" measurements={measurements}
        qualitative={qualitative} conclusion={conclusion} />
      <button type="submit">Salvar laudo sintético</button>
    </form>);
    const notice = screen.getByRole("status", { name: "Conferência de coerência do laudo" });
    fireEvent.click(within(notice).getByText(/Ver trecho.*Função.*e sugestão/));
    expect(notice.querySelector("blockquote")?.textContent).toBe(sentence);
    expect(within(notice).getByText("Sugestão para sua revisão:")).toBeInTheDocument();
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar laudo sintético" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Narrativa oficial" })).toHaveValue(sentence);
    expect(qualitative.funcao).toBe(sentence);
    expect(measurements).toEqual({ Diastolica_ondas: "fundidas", TDI_ondas: "separadas", Onda_E: "1.08", Onda_A: "0.95" });
    expect(conclusion).toBe("Conclusão oficial preservada.");
  });

  it("P2: mantém a frase mista inteira na UI e avisa somente a família afirmada", () => {
    const sentence = "Relação E/A não mensurável por fusão; relação e′/a′ de 1,33.";
    render(<EchoNarrativeConsistencyNotice species="Cat"
      measurements={{ Diastolica_ondas: "fundidas", TDI_ondas: "fundidas" }}
      qualitative={{ funcao: sentence }} conclusion="Conclusão oficial preservada." />);
    const notice = screen.getByRole("status", { name: "Conferência de coerência do laudo" });
    expect(within(notice).getAllByRole("listitem")).toHaveLength(1);
    expect(notice).toHaveTextContent("Ondas e′/a′ registradas como fundidas");
    expect(notice).not.toHaveTextContent("Ondas E/A registradas como fundidas");
    fireEvent.click(within(notice).getByText(/Ver trecho/));
    expect(notice.querySelector("blockquote")?.textContent).toBe(sentence);
  });

  it.each([
    "Relação E/A de 1,14 não interpretável por fusão; relação e′/a′ de 1,33 desconsiderada por artefato.",
    "E =0,80 m/s, A =0,60 m/s, descartados por artefato.",
    "E =0,80 m/s, A =0,60 m/s, não interpretáveis por fusão.",
    "When E/A=1.14.",
    "E / A = 1,14 m/s, desconsiderada por artefato.",
    "E/e′=6,75, não interpretável por fusão tecidual.",
    "E/e′=6,75, não interpretável por fusão transmitral.",
    "Relação E/A de 1,14, registrada no exame anterior.",
    "Relação E/A de 1,14, com ondas fundidas.",
    "Relação e′/a′ de 1,33, registrada no exame anterior.",
    "Relação e′/a′ de 1,33, com ondas fundidas.",
    "No exame anterior, relação E/A de 1,14; relação e′/a′ de 1,33.",
  ])("P2: continua vazio quando a afirmação está explicitamente desconsiderada ou condicionada: %s", (sentence) => {
    const { container } = render(<EchoNarrativeConsistencyNotice species="Felina"
      measurements={{ Diastolica_ondas: "fundidas", TDI_ondas: "fundidas" }}
      qualitative={{ funcao: sentence }}
      conclusion="Interpretação integrada preservada." />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["atualmente", "neste exame", "no exame atual"])("histórico na UI termina somente no retorno explícito %s", (current) => {
    const sentence = `No exame anterior, relação E/A de 1,14; ${current} relação e′/a′ de 1,33.`;
    render(<EchoNarrativeConsistencyNotice species="Gato"
      measurements={{ Diastolica_ondas: "fundidas", TDI_ondas: "fundidas" }}
      qualitative={{ funcao: sentence }} conclusion="Conclusão oficial preservada." />);
    const notice = screen.getByRole("status", { name: "Conferência de coerência do laudo" });
    expect(within(notice).getAllByRole("listitem")).toHaveLength(1);
    expect(notice).toHaveTextContent("Ondas e′/a′ registradas como fundidas");
    expect(notice).not.toHaveTextContent("Ondas E/A registradas como fundidas");
    fireEvent.click(within(notice).getByText(/Ver trecho/));
    expect(notice.querySelector("blockquote")?.textContent).toBe(sentence);
  });
});
