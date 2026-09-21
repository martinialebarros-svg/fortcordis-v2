import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EcocardiogramaEstruturadoPersistido } from "@/lib/ecocardiograma-estruturado";

import EcocardiogramaEstruturadoEditor from "./EcocardiogramaEstruturadoEditor";

const apiMocks = vi.hoisted(() => ({
  aplicarPreset: vi.fn(),
  atualizarFrase: vi.fn(),
  carregarBanco: vi.fn(),
  criarFrase: vi.fn(),
  excluirPreset: vi.fn(),
  salvarPreset: vi.fn(),
}));

vi.mock("@/lib/frases-ecocardiograma-estruturado-teste-api", () => ({
  aplicarPresetEcoEstruturadoTeste: apiMocks.aplicarPreset,
  atualizarFraseEcoEstruturadoTeste: apiMocks.atualizarFrase,
  carregarBancoEcoEstruturadoTeste: apiMocks.carregarBanco,
  criarFraseEcoEstruturadoTeste: apiMocks.criarFrase,
  excluirPresetEcoEstruturadoTeste: apiMocks.excluirPreset,
  salvarPresetEcoEstruturadoTeste: apiMocks.salvarPreset,
}));

const textoModerado = "Ventrículo esquerdo com sobrecarga volumétrica moderada.";
const textoImportante = "Ventrículo esquerdo com sobrecarga volumétrica importante.";
const conclusaoDmvm = "Doença valvar mixomatosa com repercussão hemodinâmica.";
const conclusaoHp = "Alta probabilidade ecocardiográfica de hipertensão pulmonar.";

const payload = {
  version: "1",
  mode: "teste",
  last_updated: "2026-09-21T00:00:00Z",
  aspectos: [
    {
      key: "ventriculo_esquerdo",
      label: "Ventriculo esquerdo",
      categoria: "Camaras esquerdas",
      descricao: "Dimensoes do VE",
      placeholder: "Descreva o ventriculo esquerdo",
      legacy_field: "camaras",
      ordem: 10,
      frases: [
        {
          id: 65,
          titulo: "VE com sobrecarga volumétrica leve",
          texto: "Ventrículo esquerdo com sobrecarga volumétrica discreta.",
          tags: ["leve", "endocardiose", "cao"],
          ativo: 1,
        },
        {
          id: 66,
          titulo: "VE com sobrecarga volumétrica moderada",
          texto: textoModerado,
          tags: ["moderado", "endocardiose", "cao", "B2"],
          ativo: 1,
        },
        {
          id: 67,
          titulo: "VE com sobrecarga volumétrica importante",
          texto: textoImportante,
          tags: ["grave", "endocardiose", "cao", "C"],
          ativo: 1,
        },
      ],
    },
    {
      key: "conclusao",
      label: "Conclusao",
      categoria: "Conclusao",
      descricao: "Sintese",
      placeholder: "Escreva a conclusao",
      legacy_field: "conclusao",
      ordem: 20,
      frases: [
        {
          id: 170,
          titulo: "DMVM",
          texto: conclusaoDmvm,
          patologias: ["Doença valvar mixomatosa"],
          tags: ["dmvm"],
          ativo: 1,
        },
        {
          id: 181,
          titulo: "Hipertensao pulmonar importante",
          texto: conclusaoHp,
          patologias: ["Hipertensão pulmonar"],
          tags: ["hp", "grave"],
          ativo: 1,
        },
      ],
    },
  ],
  presets: [
    {
      id: 7,
      key: "dmvm_base",
      label: "DMVM base",
      selecoes: [
        { aspecto: "ventriculo_esquerdo", frase_id: 66, frase_titulo: "VE moderado" },
        { aspecto: "conclusao", frase_id: 170, frase_titulo: "DMVM" },
      ],
    },
  ],
};

const estadoInicial: EcocardiogramaEstruturadoPersistido = {
  versao: 1,
  modo: "teste",
  usar_no_laudo: true,
  preset_id: 7,
  preset_label: "DMVM base",
  preset_textos: {
    ventriculo_esquerdo: textoModerado,
    conclusao: conclusaoDmvm,
  },
  updated_at: "2026-09-21T00:00:00Z",
  textos: {
    ventriculo_esquerdo: textoModerado,
    conclusao: conclusaoDmvm,
  },
};

function EditorControlado({
  onChange,
}: {
  onChange: (estado: EcocardiogramaEstruturadoPersistido) => void;
}) {
  const [estado, setEstado] = useState(estadoInicial);
  return (
    <EcocardiogramaEstruturadoEditor
      value={estado}
      onChange={(proximo) => {
        onChange(proximo);
        setEstado(proximo);
      }}
    />
  );
}

describe("EcocardiogramaEstruturadoEditor - composicao de achados", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.carregarBanco.mockResolvedValue(payload);
    window.localStorage.clear();
  });

  it("substitui o grau do aspecto com escolha unica sem alterar a biblioteca", async () => {
    const onChange = vi.fn();
    render(<EditorControlado onChange={onChange} />);

    fireEvent.click(await screen.findByRole("button", { name: /Combinar achados/i }));
    const opcaoImportante = await screen.findByRole("radio", {
      name: /Importante/i,
    });
    fireEvent.click(opcaoImportante);

    await waitFor(() => {
      const ultimoEstado = onChange.mock.calls.at(-1)?.[0] as EcocardiogramaEstruturadoPersistido;
      expect(ultimoEstado.textos.ventriculo_esquerdo).toBe(textoImportante);
    });
    expect(screen.getByText("Alterado")).toBeInTheDocument();

    const campoVe = screen.getByPlaceholderText("Descreva o ventriculo esquerdo");
    fireEvent.change(campoVe, { target: { value: `${textoImportante} Revisado.` } });
    fireEvent.blur(campoVe);

    expect(apiMocks.atualizarFrase).not.toHaveBeenCalled();
  });

  it("combina varias conclusoes aprovadas somente apos aplicacao explicita", async () => {
    const onChange = vi.fn();
    render(<EditorControlado onChange={onChange} />);

    fireEvent.click(await screen.findByRole("button", { name: /Combinar achados/i }));
    fireEvent.click(await screen.findByRole("button", { name: "1 frase(s) selecionada(s)" }));
    fireEvent.change(screen.getByLabelText("Buscar conclusão"), {
      target: { value: "Hipertensao pulmonar" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /Hipertensao pulmonar importante/i }),
    );

    expect(screen.getAllByText(conclusaoHp, { exact: false })).not.toHaveLength(0);
    expect((screen.getByPlaceholderText("Escreva a conclusao") as HTMLTextAreaElement).value).toBe(
      conclusaoDmvm,
    );

    fireEvent.click(screen.getByRole("button", { name: /Aplicar 2 frase\(s\) na conclusão/i }));

    await waitFor(() => {
      const campo = screen.getByPlaceholderText("Escreva a conclusao") as HTMLTextAreaElement;
      expect(campo.value).toContain(`* ${conclusaoDmvm}`);
      expect(campo.value).toContain(`* ${conclusaoHp}`);
    });
  });
});
