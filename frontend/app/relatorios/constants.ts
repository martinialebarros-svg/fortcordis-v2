import { DominioRelatorio, SecaoExport } from "./types";

export const DOMINIOS_RELATORIO: Array<{ id: DominioRelatorio; label: string }> = [
  { id: "visao-geral", label: "Visao Geral" },
  { id: "operacao", label: "Operacao" },
  { id: "logistica", label: "Logistica" },
  { id: "financeiro", label: "Financeiro" },
  { id: "rentabilidade", label: "Rentabilidade" },
];

export const SECOES_EXPORT_OPCOES: Array<{ id: SecaoExport; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "logistica", label: "Logistica" },
  { id: "producao", label: "Operacao" },
  { id: "financeiro", label: "Financeiro" },
  { id: "rentabilidade", label: "Rentabilidade" },
  { id: "alertas", label: "Alertas" },
  { id: "insights", label: "Insights" },
  { id: "sugestoes", label: "Sugestoes" },
];

export const SECOES_POR_DOMINIO: Record<DominioRelatorio, SecaoExport[]> = {
  "visao-geral": ["resumo", "financeiro", "rentabilidade", "alertas", "insights"],
  operacao: ["producao", "insights", "alertas"],
  logistica: ["logistica", "resumo", "insights"],
  financeiro: ["financeiro", "insights"],
  rentabilidade: ["rentabilidade", "financeiro", "producao", "alertas"],
};

export const PERFIS_DESLOCAMENTO = ["comercial", "plantao"] as const;

