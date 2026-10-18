import { render, screen } from "@testing-library/react";
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
});
