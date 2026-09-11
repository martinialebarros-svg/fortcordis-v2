import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AtendimentoReceitasBar from "./AtendimentoReceitasBar";

afterEach(() => {
  cleanup();
});

const receitaDoDia = {
  id: 10,
  sequencia: 1,
  emitida_em: "2026-09-01T15:00:00-03:00",
  orientacoes_gerais: "Repouso",
  retorno_dias: 7,
  itens: [],
};
const complementar = {
  id: 11,
  sequencia: 2,
  emitida_em: null,
  orientacoes_gerais: "",
  retorno_dias: null,
  itens: [],
};

type HarnessProps = {
  receitas?: any[];
  receitaAtiva?: any;
  receitaEmitidaPendente?: any;
  selecionado?: number | null;
  atendimentoConcluido?: boolean;
  selecionarReceita?: (id: number | null) => void;
  criarReceitaComplementar?: () => void;
  confirmarEdicaoReceitaEmitida?: () => void;
  descartarEdicaoReceitaEmitida?: () => void;
};

function Harness(props: HarnessProps) {
  return (
    <AtendimentoReceitasBar
      atendimentoConcluido={props.atendimentoConcluido ?? true}
      confirmarEdicaoReceitaEmitida={props.confirmarEdicaoReceitaEmitida ?? (() => {})}
      criandoReceita={false}
      criarReceitaComplementar={props.criarReceitaComplementar ?? (() => {})}
      descartarEdicaoReceitaEmitida={props.descartarEdicaoReceitaEmitida ?? (() => {})}
      formatDate={(valor: string) => valor}
      receitaAtiva={props.receitaAtiva === undefined ? receitaDoDia : props.receitaAtiva}
      receitaEmitidaPendente={props.receitaEmitidaPendente ?? null}
      receitas={props.receitas ?? [receitaDoDia, complementar]}
      selecionado={props.selecionado === undefined ? 1 : props.selecionado}
      selecionarReceita={props.selecionarReceita ?? (() => {})}
    />
  );
}

describe("AtendimentoReceitasBar", () => {
  it("nao aparece sem atendimento salvo ou sem receita", () => {
    const { container: semAtendimento } = render(<Harness selecionado={null} />);
    expect(semAtendimento.firstChild).toBeNull();
    cleanup();
    const { container: semReceita } = render(<Harness receitas={[]} />);
    expect(semReceita.firstChild).toBeNull();
  });

  it("distingue receita emitida de rascunho", () => {
    render(<Harness />);
    expect(screen.getByText("Emitida")).toBeTruthy();
    expect(screen.getByText("Rascunho")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Receita do dia/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Complementar 2/i })).toBeTruthy();
  });

  it("avisa que a receita ativa ja foi emitida e pode estar com o tutor", () => {
    render(<Harness />);
    expect(screen.getByText(/ja pode estar com o tutor/i)).toBeTruthy();
  });

  it("manda null ao voltar para a receita do dia e o id ao abrir a complementar", () => {
    const selecionar = vi.fn();
    render(<Harness selecionarReceita={selecionar} receitaAtiva={complementar} />);

    fireEvent.click(screen.getByRole("button", { name: /Receita do dia/i }));
    expect(selecionar).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: /Complementar 2/i }));
    expect(selecionar).toHaveBeenLastCalledWith(11);
  });

  it("diz que a complementar nao altera a receita do dia", () => {
    render(<Harness receitaAtiva={complementar} />);
    expect(screen.getByText(/nao sao alterados por ela/i)).toBeTruthy();
  });

  it("oferece confirmar a edicao pendente com o texto vindo do backend", async () => {
    const confirmar = vi.fn();
    render(
      <Harness
        confirmarEdicaoReceitaEmitida={confirmar}
        receitaEmitidaPendente={{ prescricao_id: 10, mensagem: "A receita 1 foi emitida em 01/09/2026." }}
      />
    );

    expect(screen.getByText(/A receita 1 foi emitida em 01\/09\/2026\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e salvar/i }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
  });

  it("oferece descartar a alteracao ao lado de confirmar", async () => {
    // O descarte tem botao proprio de proposito: no dialogo booleano do
    // projeto, Escape e clique fora resolvem como cancelar, e descartar
    // texto clinico por Escape seria perda de dado silenciosa.
    const descartar = vi.fn();
    render(
      <Harness
        descartarEdicaoReceitaEmitida={descartar}
        receitaEmitidaPendente={{ prescricao_id: 10, mensagem: "A receita 1 foi emitida." }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Descartar alteracao/i }));
    await waitFor(() => expect(descartar).toHaveBeenCalledTimes(1));
  });

  it("nao mostra descartar quando nao ha alteracao pendente", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: /Descartar alteracao/i })).toBeNull();
  });

  it("cria receita complementar pelo botao dedicado", () => {
    const criar = vi.fn();
    render(<Harness criarReceitaComplementar={criar} />);
    fireEvent.click(screen.getByRole("button", { name: /Nova receita complementar/i }));
    expect(criar).toHaveBeenCalledTimes(1);
  });
});
