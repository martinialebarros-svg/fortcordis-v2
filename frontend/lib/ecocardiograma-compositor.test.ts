import { describe, expect, it } from "vitest";

import type { FraseEcoEstruturadoTeste } from "@/lib/ecocardiograma-estruturado-teste";

import {
  comporConclusaoDeFrases,
  obterOpcoesDeGrauRelacionadas,
} from "./ecocardiograma-compositor";

const frasesVe: FraseEcoEstruturadoTeste[] = [
  {
    id: 65,
    titulo: "VE com sobrecarga volumétrica leve",
    texto: "VE com discreta sobrecarga volumétrica.",
    tags: ["leve", "endocardiose", "cao"],
    ordem: 10,
  },
  {
    id: 66,
    titulo: "VE com sobrecarga volumétrica moderada",
    texto: "VE com sobrecarga volumétrica moderada.",
    tags: ["moderado", "endocardiose", "cao", "B2"],
    ordem: 20,
  },
  {
    id: 67,
    titulo: "VE com sobrecarga volumétrica importante",
    texto: "VE com sobrecarga volumétrica importante.",
    tags: ["grave", "endocardiose", "cao", "C"],
    ordem: 30,
  },
  {
    id: 70,
    titulo: "VE com hipertrofia concentrica moderada",
    texto: "VE com hipertrofia concentrica moderada.",
    tags: ["moderado", "hipertrofia", "gato", "hcm"],
    ordem: 40,
  },
];

describe("compositor de ecocardiograma", () => {
  it("oferece graus mutuamente exclusivos da mesma familia clinica", () => {
    const opcoes = obterOpcoesDeGrauRelacionadas(frasesVe, "66");

    expect(opcoes.map((opcao) => [opcao.label, opcao.frase.id])).toEqual([
      ["Discreta", 65],
      ["Moderada", 66],
      ["Importante", 67],
    ]);
    expect(opcoes.some((opcao) => opcao.frase.id === 70)).toBe(false);
  });

  it("nao inventa alternativas quando nao ha familia relacionada suficiente", () => {
    const frases: FraseEcoEstruturadoTeste[] = [
      { id: 1, titulo: "Achado leve isolado", texto: "A.", tags: ["leve"] },
      { id: 2, titulo: "Outro achado grave", texto: "B.", tags: ["grave"] },
    ];

    expect(obterOpcoesDeGrauRelacionadas(frases, "1")).toEqual([]);
  });

  it("compoe somente textos aprovados, preserva ordem e remove duplicatas", () => {
    const conclusoes: FraseEcoEstruturadoTeste[] = [
      { id: 1, titulo: "Valvopatia", texto: "* Doença valvar mixomatosa." },
      { id: 2, titulo: "HP", texto: "Alta probabilidade de hipertensão pulmonar." },
    ];

    expect(comporConclusaoDeFrases(conclusoes, ["1", "2", "1"], "topicos")).toBe(
      "* Doença valvar mixomatosa.\n* Alta probabilidade de hipertensão pulmonar.",
    );
    expect(comporConclusaoDeFrases(conclusoes, ["1", "2"], "paragrafo")).toBe(
      "Doença valvar mixomatosa. Alta probabilidade de hipertensão pulmonar.",
    );
  });

  it("ignora ids ausentes ou frases inativas sem criar texto clinico", () => {
    const conclusoes: FraseEcoEstruturadoTeste[] = [
      { id: 1, titulo: "Ativa", texto: "Texto aprovado.", ativo: 1 },
      { id: 2, titulo: "Inativa", texto: "Nao deve aparecer.", ativo: 0 },
    ];

    expect(comporConclusaoDeFrases(conclusoes, ["2", "999"], "topicos")).toBe("");
  });
});
