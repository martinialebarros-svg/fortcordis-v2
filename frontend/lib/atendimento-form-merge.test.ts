import { describe, expect, it } from "vitest";
import type { AtendimentoForm, ExameSolicitacao } from "@/app/atendimento/page";
import { mergeAutoSavedFormState } from "./atendimento-form-merge";

const baseForm = (): AtendimentoForm => ({
  paciente_id: "1",
  especie: "Canina",
  clinica_id: "1",
  agendamento_id: "",
  data_atendimento: "2026-08-07T10:00",
  status: "Em atendimento",
  triagem: {
    peso: null,
    temperatura: null,
    frequencia_cardiaca: null,
    frequencia_respiratoria: null,
    pressao_arterial: "",
    saturacao_oxigenio: null,
    escore_condicion_corpo: null,
    mucosas: "",
    hidratacao: "",
    triagem_observacoes: "",
  },
  triagem_concluida: 0,
  consulta_concluida: 0,
  queixa_principal: "",
  anamnese: "",
  exame_fisico: "",
  dados_clinicos: "",
  diagnostico: {
    diagnostico_principal: "",
    diagnostico_secundario: "",
    diagnostico_diferencial: "",
    prognostico: "",
  },
  plano_terapeutico: "",
  retorno_recomendado: "",
  motivo_retorno: "",
  observacoes: "",
  exames: [],
  prescricao_orientacoes: "",
  prescricao_retorno_dias: "",
  prescricao_itens: [],
  evolucoes: [],
  anexos: [],
  documentos: [],
});

const baseExam = (): ExameSolicitacao => ({
  catalogo_exame_id: null,
  painel_exame_id: null,
  tipo_exame: "Hemograma",
  prioridade: "Rotina",
  status: "Solicitado",
  observacoes: "",
});

describe("mergeAutoSavedFormState (finalizarAtendimento)", () => {
  it("preserva edicao de campo de texto feita durante o round-trip do POST /finalizar", () => {
    const current = { ...baseForm(), queixa_principal: "Vomito e apatia ha 2 dias - editado durante o finalizar" };
    const persisted = { ...baseForm(), queixa_principal: "Vomito e apatia ha 2 dias" };

    const merged = mergeAutoSavedFormState(current, persisted);

    expect(merged.queixa_principal).toBe("Vomito e apatia ha 2 dias - editado durante o finalizar");
  });

  it("adota o id retornado pelo servidor quando o form local ainda nao tem id", () => {
    const current = { ...baseForm(), id: undefined };
    const persisted = { ...baseForm(), id: 42 };

    const merged = mergeAutoSavedFormState(current, persisted);

    expect(merged.id).toBe(42);
  });

  it("mescla exame existente por id preservando edicao local de resultado", () => {
    const exameBase = { ...baseExam(), id: 7 };
    const current = { ...baseForm(), exames: [{ ...exameBase, resultado: "Editado apos o save, antes do finalizar responder" }] };
    const persisted = { ...baseForm(), exames: [{ ...exameBase, resultado: "" }] };

    const merged = mergeAutoSavedFormState(current, persisted);

    expect(merged.exames).toHaveLength(1);
    expect(merged.exames[0].resultado).toBe("Editado apos o save, antes do finalizar responder");
  });

  it("mantem exame sem correspondencia no persisted (adicionado apos o snapshot enviado)", () => {
    const current = { ...baseForm(), exames: [{ ...baseExam(), tipo_exame: "Exame novo, ainda nao salvo" }] };
    const persisted = { ...baseForm(), exames: [] };

    const merged = mergeAutoSavedFormState(current, persisted);

    expect(merged.exames).toHaveLength(1);
    expect(merged.exames[0].tipo_exame).toBe("Exame novo, ainda nao salvo");
  });
});
