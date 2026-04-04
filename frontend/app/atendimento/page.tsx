"use client";

import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import ClinicalFieldCard from "./components/ClinicalFieldCard";
import api from "@/lib/axios";
import {
  CLINICAL_SECTION_OPTIONS,
  buildClinicalFieldConfigsWithPhraseBank,
  buildClinicalQuickSummary,
  buildClinicalFieldValues,
  hasMeaningfulDraft,
  insertSnippetIntoText,
  type ClinicalFieldKey,
  type ClinicalPhraseRecord,
} from "@/lib/atendimento-clinical-notes";
import { buildPrescriptionSupport, suggestMedicationPresentation } from "@/lib/clinical-medication";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  Download,
  Eye,
  FileUp,
  FileX,
  FileText,
  Heart,
  History,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Pill,
  Plus,
  Minus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Stethoscope,
  Thermometer,
  Trash2,
  TrendingUp,
  Upload,
  User,
  X,
} from "lucide-react";

// === TIPOS ===

type Triagem = {
  peso: number | null;
  temperatura: number | null;
  frequencia_cardiaca: number | null;
  frequencia_respiratoria: number | null;
  pressao_arterial: string;
  saturacao_oxigenio: number | null;
  escore_condicion_corpo: number | null;
  mucosas: string;
  hidratacao: string;
  triagem_observacoes: string;
};

type Diagnostico = {
  diagnostico_principal: string;
  diagnostico_secundario: string;
  diagnostico_diferencial: string;
  prognostico: string;
};

type Evolucao = {
  id: number;
  data_evolucao: string;
  descricao: string;
  sinais_vitais: string;
  responsavel_nome: string;
};

type Anexo = {
  id: number;
  exame_id?: number | null;
  tipo: string;
  descricao: string;
  url: string;
  nome_original: string;
  tamanho?: number | null;
  mime_type?: string;
  origem?: string;
  download_url?: string | null;
  preview_disponivel?: boolean;
  created_at?: string;
};

type AttachmentPreview = {
  anexo: Anexo;
  url: string;
  title: string;
  kind: "image" | "pdf";
  objectUrl?: string | null;
};

type PendingExamUpload = {
  file: File;
  previewUrl: string | null;
  kind: "image" | "pdf" | "other";
};

type ExameFluxoStatus = "aguardando_arquivo" | "arquivo_anexado" | "interpretado";
type ExameFiltroRapido = "todos" | ExameFluxoStatus;

type Alerta = {
  id: number;
  tipo: string;
  titulo: string;
  descricao: string;
  gravidade: string;
};

type TimelineEvento = {
  data: string;
  tipo: string;
  titulo: string;
  descricao: string;
  status: string;
  referencia_id: number;
};

type TimelineGrupo = {
  ano: string;
  eventos: TimelineEvento[];
};

type PesoHistorico = {
  atendimento_id: number;
  data_atendimento: string;
  peso: number;
};

type HistoricoPaciente = {
  paciente: {
    id: number;
    nome: string;
    especie: string;
    raca: string;
    peso: number | null;
    nascimento?: string | null;
  };
  alertas: Alerta[];
  atendimentos: {
    id: number;
    data_atendimento: string;
    status: string;
    queixa_principal: string;
    diagnostico_principal: string;
    veterinario: string;
    peso?: number | null;
  }[];
  pesos?: PesoHistorico[];
  timeline: TimelineGrupo[];
};

type ExameSolicitacao = {
  id?: number;
  catalogo_exame_id?: number | null;
  painel_exame_id?: number | null;
  painel_exame_nome?: string;
  tipo_exame: string;
  categoria_exame?: string;
  preparo?: string;
  prioridade: string;
  status: string;
  resultado?: string;
  valor_referencia?: string;
  unidade?: string;
  observacoes: string;
  valor?: number;
  laudo_id?: number | null;
  data_solicitacao?: string;
  data_resultado?: string;
  anexos_resultado?: Anexo[];
};

type CatalogoExame = {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  especie_alvo: string;
  prioridade_padrao: string;
  valor_padrao: number;
  preparo: string;
  observacoes_padrao: string;
  sinonimos: string[];
  ativo: number;
};

type PainelExameItem = {
  catalogo_exame_id: number;
  codigo: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  prioridade_padrao: string;
  valor_padrao: number;
  preparo: string;
  observacoes_padrao: string;
  ordem: number;
};

type PainelExame = {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  especie_alvo: string;
  observacoes: string;
  ativo: number;
  itens: PainelExameItem[];
};

type WorkspacePainel = "consulta" | "exames" | "prescricao" | "documentos" | "bibliotecas";
type ConsultaEditorEtapa = "anamnese" | "diagnostico" | "plano";
type PrescricaoCampoObrigatorio = "medicamento_nome" | "dose" | "frequencia" | "via";

type PrescricaoItem = {
  id?: number;
  medicamento_id?: number | null;
  medicamento_nome: string;
  apresentacao_selecionada: string;
  dose: string;
  frequencia: string;
  duracao: string;
  via: string;
  instrucoes: string;
  dose_mg_kg?: string;
  peso_referencia_kg?: string;
  unidade_dose_calculo?: "mg" | "ml" | "comprimido";
  concentracao_personalizada?: string;
  historico_ajustes?: {
    id: number;
    campo: string;
    valor_anterior: string;
    valor_novo: string;
    motivo: string;
    responsavel_nome: string;
    created_at: string;
  }[];
};

type PrescricaoCalculo = {
  medicamento: Medicamento | null;
  pesoKg: number | null;
  doseMgKg: number | null;
  doseTotalMg: number | null;
  unidade: "mg" | "ml" | "comprimido";
  concentracao: number | null;
  volumeMl: number | null;
  comprimidos: number | null;
};

type ProtocoloPrescricaoItem = {
  nomeFallback: string;
  keywords: string[];
  doseMgKg?: number;
  frequencia: string;
  duracao: string;
  via?: string;
  instrucoes?: string;
  unidadeCalculo?: "mg" | "ml" | "comprimido";
};

type ProtocoloPrescricao = {
  key: string;
  label: string;
  descricao: string;
  gatilhos: string[];
  retornoDias?: string;
  orientacoesPadrao?: string;
  itens: ProtocoloPrescricaoItem[];
};

type AtendimentoResumo = {
  id: number;
  paciente_id: number;
  clinica_id?: number | null;
  agendamento_id?: number | null;
  data_atendimento?: string | null;
  status: string;
  paciente_nome?: string;
  tutor_nome?: string;
  clinica_nome?: string;
  diagnostico?: string;
  queixa_principal?: string;
  total_exames?: number;
  tem_prescricao?: boolean;
};

type Medicamento = {
  id: number;
  nome: string;
  principio_ativo: string;
  concentracao: string;
  forma_farmaceutica: string;
  categoria: string;
  classe_terapeutica: string;
  especie_alvo: string;
  dose_min_mg_kg?: number | null;
  dose_max_mg_kg?: number | null;
  dose_intervalo_horas?: number | null;
  dose_unidade: string;
  via_padrao: string;
  duracao_padrao: string;
  concentracao_mg_ml?: number | null;
  concentracao_mg_comprimido?: number | null;
  indicacoes: string;
  contraindicacoes: string;
  interacoes: string[];
  observacao_seguranca: string;
  parametrizacao_origem: string;
  parametrizado: boolean;
  observacoes: string;
  ativo: number;
};

type MedicamentoForm = {
  id: number | null;
  nome: string;
  principio_ativo: string;
  concentracao: string;
  forma_farmaceutica: string;
  categoria: string;
  classe_terapeutica: string;
  especie_alvo: string;
  dose_min_mg_kg: string;
  dose_max_mg_kg: string;
  dose_intervalo_horas: string;
  dose_unidade: string;
  via_padrao: string;
  duracao_padrao: string;
  concentracao_mg_ml: string;
  concentracao_mg_comprimido: string;
  indicacoes: string;
  contraindicacoes: string;
  interacoes: string;
  observacao_seguranca: string;
  parametrizacao_origem: string;
  observacoes: string;
  ativo: number;
};

type PacienteResumo = {
  id: number;
  nome: string;
  tutor?: string;
  tutor_id?: number | null;
  especie?: string;
  raca?: string;
};
type ClinicaResumo = { id: number; nome: string };
type ClinicalPhraseForm = {
  id?: number | null;
  secao: ClinicalFieldKey;
  titulo: string;
  texto: string;
  ordem: string;
  ativo: number;
};

type AtendimentoForm = {
  id?: number;
  paciente_id: string;
  especie: string;
  clinica_id: string;
  agendamento_id: string;
  data_atendimento: string;
  status: string;
  triagem: Triagem;
  triagem_concluida: number;
  consulta_concluida: number;
  queixa_principal: string;
  anamnese: string;
  exame_fisico: string;
  dados_clinicos: string;
  diagnostico: Diagnostico;
  plano_terapeutico: string;
  retorno_recomendado: string;
  motivo_retorno: string;
  observacoes: string;
  exames: ExameSolicitacao[];
  prescricao_orientacoes: string;
  prescricao_retorno_dias: string;
  prescricao_itens: PrescricaoItem[];
  evolucoes: Evolucao[];
  anexos: Anexo[];
};

// === CONSTANTES ===

const STATUS_ATENDIMENTO = [
  "Triagem",
  "Em atendimento",
  "Aguardando exames",
  "Retorno agendado",
  "Concluido",
];
const MUCOSAS = ["Rosadas", "Palidas", "Ictericas", "Cianoticas", "Hiperemicas"];
const HIDRATACAO = ["Normal", "Desidratado leve", "Desidratado moderado", "Desidratado grave"];
const PROGNOSTICO = ["Favoravel", "Reservado", "Ruim"];
const ESCALA_ECC = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const EXAME_FILTRO_OPCOES: Array<{ key: ExameFiltroRapido; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "aguardando_arquivo", label: "Sem arquivo" },
  { key: "arquivo_anexado", label: "Com arquivo" },
  { key: "interpretado", label: "Interpretados" },
];
const EXAME_STATUS_META: Record<ExameFluxoStatus, { label: string; chipClass: string; cardClass: string }> = {
  aguardando_arquivo: {
    label: "Aguardando arquivo",
    chipClass: "bg-amber-100 text-amber-700",
    cardClass: "border-amber-200 bg-amber-50/60",
  },
  arquivo_anexado: {
    label: "Arquivo anexado",
    chipClass: "bg-sky-100 text-sky-700",
    cardClass: "border-sky-200 bg-sky-50/50",
  },
  interpretado: {
    label: "Interpretado",
    chipClass: "bg-emerald-100 text-emerald-700",
    cardClass: "border-emerald-200 bg-emerald-50/50",
  },
};

const CONSULTA_EDITOR_ETAPAS: Array<{
  key: ConsultaEditorEtapa;
  titulo: string;
  descricao: string;
  campos: ClinicalFieldKey[];
}> = [
  {
    key: "anamnese",
    titulo: "Anamnese e exame",
    descricao: "Queixa, historia e avaliacao fisica",
    campos: ["queixa_principal", "anamnese", "exame_fisico", "dados_clinicos"],
  },
  {
    key: "diagnostico",
    titulo: "Diagnostico",
    descricao: "Hipoteses e definicao clinica",
    campos: ["diagnostico_principal", "diagnostico_secundario", "diagnostico_diferencial"],
  },
  {
    key: "plano",
    titulo: "Plano e retorno",
    descricao: "Conduta terapeutica e seguimento",
    campos: ["plano_terapeutico", "retorno_recomendado", "motivo_retorno", "observacoes"],
  },
];

const PROTOCOLOS_PRESCRICAO: ProtocoloPrescricao[] = [
  {
    key: "endocardiose_b1",
    label: "Endocardiose B1",
    descricao: "Monitorizacao sem terapia agressiva inicial.",
    gatilhos: ["b1", "endocardiose b1", "dmvm b1", "endocardiose mitral b1"],
    retornoDias: "120",
    orientacoesPadrao:
      "Manter acompanhamento clinico e ecocardiografico periodico. Registrar tosse, intolerancia ao exercicio e FR em repouso.",
    itens: [],
  },
  {
    key: "endocardiose_b2",
    label: "Endocardiose B2",
    descricao: "Suporte cardiaco precoce com remodelamento.",
    gatilhos: ["b2", "endocardiose b2", "dmvm b2", "remodelamento atrial"],
    retornoDias: "30",
    orientacoesPadrao:
      "Reavaliar com ECO e aferir FR em repouso diariamente. Ajustar terapia se houver progressao clinica.",
    itens: [
      {
        nomeFallback: "Pimobendan",
        keywords: ["pimobendan", "vetmedin"],
        doseMgKg: 0.25,
        frequencia: "a cada 12h",
        duracao: "uso continuo",
        via: "Oral",
        instrucoes: "Administrar em jejum quando possivel.",
      },
      {
        nomeFallback: "Benazepril",
        keywords: ["benazepril"],
        doseMgKg: 0.5,
        frequencia: "a cada 24h",
        duracao: "uso continuo",
        via: "Oral",
        instrucoes: "Monitorar creatinina e pressao arterial.",
      },
    ],
  },
  {
    key: "icc_compensada",
    label: "ICC compensada",
    descricao: "Controle de congestao e remodelamento.",
    gatilhos: ["icc", "insuficiencia cardiaca", "congestao", "edema pulmonar"],
    retornoDias: "7",
    orientacoesPadrao:
      "Monitorar FR em repouso, apetite e tolerancia ao exercicio. Retorno imediato se dispneia ou piora clinica.",
    itens: [
      {
        nomeFallback: "Furosemida",
        keywords: ["furosemida", "furosemide"],
        doseMgKg: 2,
        frequencia: "a cada 12h",
        duracao: "7 dias e reavaliar",
        via: "Oral",
        instrucoes: "Ajustar conforme congestao e funcao renal.",
      },
      {
        nomeFallback: "Pimobendan",
        keywords: ["pimobendan", "vetmedin"],
        doseMgKg: 0.25,
        frequencia: "a cada 12h",
        duracao: "uso continuo",
        via: "Oral",
      },
      {
        nomeFallback: "Espironolactona",
        keywords: ["espironolactona", "spironolactone"],
        doseMgKg: 2,
        frequencia: "a cada 24h",
        duracao: "uso continuo",
        via: "Oral",
      },
    ],
  },
  {
    key: "hipertensao_sistemica",
    label: "HAS sistemica",
    descricao: "Controle pressorico com revisao seriada.",
    gatilhos: ["hipertensao", "has", "pressao arterial elevada"],
    retornoDias: "14",
    orientacoesPadrao:
      "Aferir pressao arterial em ambiente calmo e registrar media de medidas sequenciais.",
    itens: [
      {
        nomeFallback: "Amlodipina",
        keywords: ["amlodipina", "amlodipine"],
        doseMgKg: 0.15,
        frequencia: "a cada 24h",
        duracao: "uso continuo",
        via: "Oral",
      },
      {
        nomeFallback: "Benazepril",
        keywords: ["benazepril"],
        doseMgKg: 0.5,
        frequencia: "a cada 24h",
        duracao: "uso continuo",
        via: "Oral",
      },
    ],
  },
];

const emptyExam = (): ExameSolicitacao => ({
  catalogo_exame_id: null,
  painel_exame_id: null,
  painel_exame_nome: "",
  tipo_exame: "",
  categoria_exame: "",
  preparo: "",
  prioridade: "Rotina",
  status: "Solicitado",
  resultado: "",
  valor_referencia: "",
  unidade: "",
  observacoes: "",
  valor: 0,
  laudo_id: null,
  data_solicitacao: "",
  data_resultado: "",
  anexos_resultado: [],
});

const emptyPrescriptionItem = (): PrescricaoItem => ({
  medicamento_id: null,
  medicamento_nome: "",
  apresentacao_selecionada: "",
  dose: "",
  frequencia: "",
  duracao: "",
  via: "Oral",
  instrucoes: "",
  dose_mg_kg: "",
  peso_referencia_kg: "",
  unidade_dose_calculo: "mg",
  concentracao_personalizada: "",
});

const isPrescriptionItemEmpty = (item?: Partial<PrescricaoItem> | null) => {
  const current = item || {};
  return (
    !current.medicamento_id &&
    !(current.medicamento_nome || "").trim() &&
    !(current.dose || "").trim() &&
    !(current.frequencia || "").trim() &&
    !(current.duracao || "").trim() &&
    !(current.instrucoes || "").trim()
  );
};

const hydratePrescriptionItem = (item?: Partial<PrescricaoItem> | null): PrescricaoItem => ({
  ...emptyPrescriptionItem(),
  ...(item || {}),
  medicamento_id: item?.medicamento_id ?? null,
  medicamento_nome: item?.medicamento_nome || "",
  apresentacao_selecionada: item?.apresentacao_selecionada || "",
  dose: item?.dose || "",
  frequencia: item?.frequencia || "",
  duracao: item?.duracao || "",
  via: item?.via || "Oral",
  instrucoes: item?.instrucoes || "",
  dose_mg_kg: item?.dose_mg_kg || "",
  peso_referencia_kg: item?.peso_referencia_kg || "",
  unidade_dose_calculo: item?.unidade_dose_calculo || "mg",
  concentracao_personalizada: item?.concentracao_personalizada || "",
  historico_ajustes: item?.historico_ajustes || [],
});

const ATENDIMENTO_ATTACHMENT_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const;
const ATENDIMENTO_ATTACHMENT_ACCEPT = ATENDIMENTO_ATTACHMENT_ALLOWED_EXTENSIONS.join(",");
const ATENDIMENTO_ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;

const isAllowedAttachmentFilename = (filename: string) => {
  const normalized = (filename || "").trim().toLowerCase();
  return ATENDIMENTO_ATTACHMENT_ALLOWED_EXTENSIONS.some((ext) => normalized.endsWith(ext));
};

const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const isoToLocalInput = (value?: string | null) => {
  if (!value) return nowLocalInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLocalInput();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const isoToOptionalLocalInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
};

const formatBytes = (value?: number | null) => {
  if (!value || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const parseDownloadFilename = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    const raw = utf8Match[1].trim().replace(/^"(.*)"$/, "$1");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw || fallback;
    }
  }
  const plainMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return fallback;
};

const extractApiErrorMessage = async (error: any, fallback: string) => {
  const directDetail = error?.response?.data?.detail;
  if (typeof directDetail === "string" && directDetail.trim()) {
    return directDetail.trim();
  }

  const rawData = error?.response?.data;
  if (typeof rawData === "string" && rawData.trim()) {
    try {
      const parsed = JSON.parse(rawData);
      if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
    } catch {
      return rawData.trim();
    }
  }

  if (typeof Blob !== "undefined" && rawData instanceof Blob) {
    try {
      const text = (await rawData.text()).trim();
      if (!text) return fallback;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
          return parsed.detail.trim();
        }
      } catch {
        return text;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const normalizePeso = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric);
};

const parseDecimalInput = (value?: string | number | null): number | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseStringListInput = (value: string): string[] =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizarTokenPrescricao = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const formatarDoseTextoCalculada = (calculo: PrescricaoCalculo): string => {
  if (!calculo.doseTotalMg) return "";
  let doseTexto = `${calculo.doseTotalMg.toFixed(2)} mg por dose`;
  if (calculo.unidade === "ml" && calculo.volumeMl) {
    doseTexto = `${calculo.doseTotalMg.toFixed(2)} mg (${calculo.volumeMl.toFixed(2)} mL por dose)`;
  }
  if (calculo.unidade === "comprimido" && calculo.comprimidos) {
    doseTexto = `${calculo.doseTotalMg.toFixed(2)} mg (${calculo.comprimidos.toFixed(2)} comprimido(s) por dose)`;
  }
  return doseTexto;
};

const classificarAlertaPrescricao = (texto: string): "alta" | "media" | "baixa" => {
  const normalized = (texto || "").toLowerCase();
  if (
    normalized.includes("contraindic") ||
    normalized.includes("toxic") ||
    normalized.includes("grave") ||
    normalized.includes("risco alto")
  ) {
    return "alta";
  }
  if (
    normalized.includes("interacao") ||
    normalized.includes("potencial") ||
    normalized.includes("monitor") ||
    normalized.includes("peso")
  ) {
    return "media";
  }
  return "baixa";
};

const getAlertaPrescricaoClass = (gravidade: "alta" | "media" | "baixa") => {
  if (gravidade === "alta") return "border-rose-300/40 bg-rose-400/15 text-rose-50";
  if (gravidade === "media") return "border-amber-300/40 bg-amber-400/15 text-amber-100";
  return "border-sky-300/30 bg-sky-400/10 text-sky-100";
};

const formatarOrigemMedicamento = (origem?: string | null) => {
  const normalized = (origem || "").trim().toLowerCase();
  if (!normalized || normalized === "manual") return "Manual";
  if (normalized === "vetsmart_html") return "HTML Vetsmart";
  if (normalized === "starter" || normalized === "seed") return "Base inicial";
  return origem || "Manual";
};

const calcularDosePrescricaoItem = (
  item: PrescricaoItem,
  medicamento: Medicamento | null,
  pesoClinico: number | null
): PrescricaoCalculo => {
  const pesoKg = parseDecimalInput(item.peso_referencia_kg) ?? normalizePeso(pesoClinico);
  const doseMgKg = parseDecimalInput(item.dose_mg_kg) ?? medicamento?.dose_max_mg_kg ?? medicamento?.dose_min_mg_kg ?? null;
  const unidade = item.unidade_dose_calculo || (medicamento?.concentracao_mg_ml ? "ml" : medicamento?.concentracao_mg_comprimido ? "comprimido" : "mg");
  const concentracao = unidade === "ml"
    ? parseDecimalInput(item.concentracao_personalizada) ?? medicamento?.concentracao_mg_ml ?? null
    : unidade === "comprimido"
      ? parseDecimalInput(item.concentracao_personalizada) ?? medicamento?.concentracao_mg_comprimido ?? null
      : null;
  const doseTotalMg = pesoKg && doseMgKg ? Number((pesoKg * doseMgKg).toFixed(3)) : null;
  const volumeMl = unidade === "ml" && doseTotalMg && concentracao ? Number((doseTotalMg / concentracao).toFixed(3)) : null;
  const comprimidos =
    unidade === "comprimido" && doseTotalMg && concentracao
      ? Number((doseTotalMg / concentracao).toFixed(3))
      : null;

  return {
    medicamento,
    pesoKg,
    doseMgKg,
    doseTotalMg,
    unidade,
    concentracao,
    volumeMl,
    comprimidos,
  };
};

const validarItensPrescricao = (itens: PrescricaoItem[]) => {
  const errors: Record<number, Partial<Record<PrescricaoCampoObrigatorio, string>>> = {};
  let total = 0;

  itens.forEach((item, index) => {
    const ativo = Boolean(item.medicamento_id || (item.medicamento_nome || "").trim());
    if (!ativo) return;

    const itemErrors: Partial<Record<PrescricaoCampoObrigatorio, string>> = {};
    if (!(item.medicamento_nome || "").trim()) itemErrors.medicamento_nome = "Informe o medicamento.";
    if (!(item.dose || "").trim()) itemErrors.dose = "Informe a dose.";
    if (!(item.frequencia || "").trim()) itemErrors.frequencia = "Informe a frequencia.";
    if (!(item.via || "").trim()) itemErrors.via = "Informe a via.";

    if (Object.keys(itemErrors).length > 0) {
      errors[index] = itemErrors;
      total += Object.keys(itemErrors).length;
    }
  });

  return { total, errors };
};

const resolveExamFlowStatus = (exame: ExameSolicitacao, anexosCount: number): ExameFluxoStatus => {
  if ((exame.resultado || "").trim()) return "interpretado";
  if (anexosCount > 0) return "arquivo_anexado";
  return "aguardando_arquivo";
};

const resolveExamBackendStatus = (exame: ExameSolicitacao, anexosCount: number): string => {
  const flow = resolveExamFlowStatus(exame, anexosCount);
  if (flow === "interpretado") return "Concluido";
  if (flow === "arquivo_anexado") return "Em andamento";
  return "Solicitado";
};

const emptyTriagem = (): Triagem => ({
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
});

const emptyDiagnostico = (): Diagnostico => ({
  diagnostico_principal: "",
  diagnostico_secundario: "",
  diagnostico_diferencial: "",
  prognostico: "",
});

const emptyForm = (): AtendimentoForm => ({
  paciente_id: "",
  especie: "",
  clinica_id: "",
  agendamento_id: "",
  data_atendimento: nowLocalInput(),
  status: "Triagem",
  triagem: emptyTriagem(),
  triagem_concluida: 0,
  consulta_concluida: 0,
  queixa_principal: "",
  anamnese: "",
  exame_fisico: "",
  dados_clinicos: "",
  diagnostico: emptyDiagnostico(),
  plano_terapeutico: "",
  retorno_recomendado: "",
  motivo_retorno: "",
  observacoes: "",
  exames: [emptyExam()],
  prescricao_orientacoes: "",
  prescricao_retorno_dias: "",
  prescricao_itens: [emptyPrescriptionItem()],
  evolucoes: [],
  anexos: [],
});

const emptyClinicalPhraseForm = (): ClinicalPhraseForm => ({
  secao: "anamnese",
  titulo: "",
  texto: "",
  ordem: "",
  ativo: 1,
});

const emptyMedicationForm = (): MedicamentoForm => ({
  id: null,
  nome: "",
  principio_ativo: "",
  concentracao: "",
  forma_farmaceutica: "",
  categoria: "Cardiologia",
  classe_terapeutica: "",
  especie_alvo: "Canina,Felina",
  dose_min_mg_kg: "",
  dose_max_mg_kg: "",
  dose_intervalo_horas: "",
  dose_unidade: "mg/kg",
  via_padrao: "",
  duracao_padrao: "",
  concentracao_mg_ml: "",
  concentracao_mg_comprimido: "",
  indicacoes: "",
  contraindicacoes: "",
  interacoes: "",
  observacao_seguranca: "",
  parametrizacao_origem: "manual",
  observacoes: "",
  ativo: 1,
});

const hydrateMedicationForm = (item?: Partial<Medicamento> | null): MedicamentoForm => ({
  ...emptyMedicationForm(),
  id: item?.id ?? null,
  nome: item?.nome || "",
  principio_ativo: item?.principio_ativo || "",
  concentracao: item?.concentracao || "",
  forma_farmaceutica: item?.forma_farmaceutica || "",
  categoria: item?.categoria || "Cardiologia",
  classe_terapeutica: item?.classe_terapeutica || "",
  especie_alvo: item?.especie_alvo || "Canina,Felina",
  dose_min_mg_kg: item?.dose_min_mg_kg != null ? String(item.dose_min_mg_kg) : "",
  dose_max_mg_kg: item?.dose_max_mg_kg != null ? String(item.dose_max_mg_kg) : "",
  dose_intervalo_horas: item?.dose_intervalo_horas != null ? String(item.dose_intervalo_horas) : "",
  dose_unidade: item?.dose_unidade || "mg/kg",
  via_padrao: item?.via_padrao || "",
  duracao_padrao: item?.duracao_padrao || "",
  concentracao_mg_ml: item?.concentracao_mg_ml != null ? String(item.concentracao_mg_ml) : "",
  concentracao_mg_comprimido: item?.concentracao_mg_comprimido != null ? String(item.concentracao_mg_comprimido) : "",
  indicacoes: item?.indicacoes || "",
  contraindicacoes: item?.contraindicacoes || "",
  interacoes: Array.isArray(item?.interacoes) ? item?.interacoes.join("\n") : "",
  observacao_seguranca: item?.observacao_seguranca || "",
  parametrizacao_origem: item?.parametrizacao_origem || "manual",
  observacoes: item?.observacoes || "",
  ativo: Number(item?.ativo ?? 1),
});

const hydrateExam = (item: any): ExameSolicitacao => ({
  ...emptyExam(),
  ...(item || {}),
  resultado: item?.resultado || "",
  valor_referencia: item?.valor_referencia || "",
  unidade: item?.unidade || "",
  data_solicitacao: item?.data_solicitacao || "",
  data_resultado: isoToOptionalLocalInput(item?.data_resultado),
  anexos_resultado: item?.anexos_resultado || [],
});

const ATENDIMENTO_DRAFT_KEY = "fortcordis:atendimento:draft:v1";
const AUTOSAVE_DELAY_MS = 1800;

const hydrateFormFromDetail = (d: any): AtendimentoForm => ({
  id: d.id,
  paciente_id: String(d.paciente_id || ""),
  especie: d.especie || "",
  clinica_id: d.clinica_id ? String(d.clinica_id) : "",
  agendamento_id: d.agendamento_id ? String(d.agendamento_id) : "",
  data_atendimento: isoToLocalInput(d.data_atendimento),
  status: d.status || "Triagem",
  triagem: {
    peso: d.triagem?.peso ?? null,
    temperatura: d.triagem?.temperatura ?? null,
    frequencia_cardiaca: d.triagem?.frequencia_cardiaca ?? null,
    frequencia_respiratoria: d.triagem?.frequencia_respiratoria ?? null,
    pressao_arterial: d.triagem?.pressao_arterial || "",
    saturacao_oxigenio: d.triagem?.saturacao_oxigenio ?? null,
    escore_condicion_corpo: d.triagem?.escore_condicion_corpo ?? null,
    mucosas: d.triagem?.mucosas || "",
    hidratacao: d.triagem?.hidratacao || "",
    triagem_observacoes: d.triagem?.triagem_observacoes || "",
  },
  triagem_concluida: d.triagem_concluida || 0,
  consulta_concluida: d.consulta_concluida || 0,
  queixa_principal: d.queixa_principal || "",
  anamnese: d.anamnese || "",
  exame_fisico: d.exame_fisico || "",
  dados_clinicos: d.dados_clinicos || "",
  diagnostico: {
    diagnostico_principal: d.diagnostico_principal || "",
    diagnostico_secundario: d.diagnostico_secundario || "",
    diagnostico_diferencial: d.diagnostico_diferencial || "",
    prognostico: d.prognostico || "",
  },
  plano_terapeutico: d.plano_terapeutico || "",
  retorno_recomendado: d.retorno_recomendado || "",
  motivo_retorno: d.motivo_retorno || "",
  observacoes: d.observacoes || "",
  exames: d.exames?.length ? d.exames.map((item: any) => hydrateExam(item)) : [emptyExam()],
  prescricao_orientacoes: d.prescricao?.orientacoes_gerais || "",
  prescricao_retorno_dias: d.prescricao?.retorno_dias ? String(d.prescricao.retorno_dias) : "",
  prescricao_itens: d.prescricao?.itens?.length ? d.prescricao.itens.map(hydratePrescriptionItem) : [emptyPrescriptionItem()],
  evolucoes: d.evolucoes || [],
  anexos: d.anexos || [],
});

const sanitizeDraftForm = (raw: Partial<AtendimentoForm> | null | undefined): AtendimentoForm => ({
  ...emptyForm(),
  ...raw,
  data_atendimento: raw?.data_atendimento || nowLocalInput(),
  triagem: {
    ...emptyTriagem(),
    ...(raw?.triagem || {}),
  },
  diagnostico: {
    ...emptyDiagnostico(),
    ...(raw?.diagnostico || {}),
  },
  exames: raw?.exames?.length ? raw.exames.map((item) => ({ ...emptyExam(), ...item })) : [emptyExam()],
  prescricao_itens: raw?.prescricao_itens?.length ? raw.prescricao_itens.map(hydratePrescriptionItem) : [emptyPrescriptionItem()],
  evolucoes: raw?.evolucoes || [],
  anexos: raw?.anexos || [],
});

const buildAtendimentoPayload = (form: AtendimentoForm) => {
  const anexosPorExame = form.anexos.reduce<Record<number, number>>((acc, anexo) => {
    if (!anexo.exame_id) return acc;
    acc[anexo.exame_id] = (acc[anexo.exame_id] || 0) + 1;
    return acc;
  }, {});

  return {
    paciente_id: Number(form.paciente_id),
    clinica_id: form.clinica_id ? Number(form.clinica_id) : null,
    agendamento_id: form.agendamento_id ? Number(form.agendamento_id) : null,
    data_atendimento: form.data_atendimento ? new Date(form.data_atendimento).toISOString() : null,
    status: form.status,
    triagem: form.triagem,
    triagem_concluida: form.triagem_concluida,
    consulta_concluida: form.consulta_concluida,
    queixa_principal: form.queixa_principal,
    anamnese: form.anamnese,
    exame_fisico: form.exame_fisico,
    dados_clinicos: form.dados_clinicos,
    diagnostico: form.diagnostico,
    plano_terapeutico: form.plano_terapeutico,
    retorno_recomendado: form.retorno_recomendado,
    motivo_retorno: form.motivo_retorno,
    observacoes: form.observacoes,
    exames: form.exames
      .filter((item) => (item.tipo_exame || "").trim())
      .map((item) => {
        const anexosCount = item.id ? (anexosPorExame[item.id] || 0) : (item.anexos_resultado?.length || 0);
        return {
          id: item.id,
          catalogo_exame_id: item.catalogo_exame_id || null,
          painel_exame_id: item.painel_exame_id || null,
          painel_exame_nome: item.painel_exame_nome || "",
          tipo_exame: item.tipo_exame,
          categoria_exame: item.categoria_exame || "",
          preparo: item.preparo || "",
          prioridade: item.prioridade,
          status: resolveExamBackendStatus(item, anexosCount),
          resultado: item.resultado || "",
          valor_referencia: item.valor_referencia || "",
          unidade: item.unidade || "",
          observacoes: item.observacoes || "",
          valor: Number(item.valor || 0),
          laudo_id: item.laudo_id || null,
          data_resultado: item.data_resultado ? new Date(item.data_resultado).toISOString() : null,
        };
      }),
    prescricao: {
      orientacoes_gerais: form.prescricao_orientacoes,
      retorno_dias: form.prescricao_retorno_dias ? Number(form.prescricao_retorno_dias) : null,
      itens: form.prescricao_itens
        .map((item, index) => ({
          id: item.id,
          medicamento_id: item.medicamento_id,
          medicamento_nome: item.medicamento_nome,
          apresentacao_selecionada: item.apresentacao_selecionada,
          dose: item.dose,
          frequencia: item.frequencia,
          duracao: item.duracao,
          via: item.via,
          instrucoes: item.instrucoes,
          ordem: index,
        }))
        .filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim()),
    },
  };
};

const serializeAtendimentoSnapshot = (form: AtendimentoForm) => JSON.stringify(buildAtendimentoPayload(form));

const buildExamMergeKey = (item: ExameSolicitacao) =>
  [
    item.catalogo_exame_id || "",
    (item.tipo_exame || "").trim().toLowerCase(),
    item.painel_exame_id || "",
    item.prioridade || "",
    item.status || "",
    (item.resultado || "").trim().toLowerCase(),
    item.data_resultado || "",
    Number(item.valor || 0),
    (item.observacoes || "").trim().toLowerCase(),
  ].join("|");

const buildPrescriptionMergeKey = (item: PrescricaoItem) =>
  [
    item.medicamento_id || "",
    (item.medicamento_nome || "").trim().toLowerCase(),
    (item.apresentacao_selecionada || "").trim().toLowerCase(),
    (item.dose || "").trim().toLowerCase(),
    (item.frequencia || "").trim().toLowerCase(),
    (item.duracao || "").trim().toLowerCase(),
    (item.via || "").trim().toLowerCase(),
  ].join("|");

const mergeAutoSavedItems = <T extends { id?: number | null }>(
  currentItems: T[],
  persistedItems: T[],
  getMergeKey: (item: T) => string,
  applyPersisted: (currentItem: T, persistedItem: T) => T
) => {
  const pool = [...persistedItems];
  return currentItems.map((currentItem) => {
    if (currentItem.id) {
      const byIdIndex = pool.findIndex((persistedItem) => persistedItem.id === currentItem.id);
      if (byIdIndex >= 0) {
        return applyPersisted(currentItem, pool.splice(byIdIndex, 1)[0]);
      }
    }

    const mergeKey = getMergeKey(currentItem);
    if (!mergeKey) return currentItem;

    const bySignatureIndex = pool.findIndex((persistedItem) => getMergeKey(persistedItem) === mergeKey);
    if (bySignatureIndex >= 0) {
      return applyPersisted(currentItem, pool.splice(bySignatureIndex, 1)[0]);
    }

    return currentItem;
  });
};

const mergeAutoSavedFormState = (current: AtendimentoForm, persisted: AtendimentoForm): AtendimentoForm => ({
  ...current,
  id: persisted.id || current.id,
  exames: mergeAutoSavedItems(
    current.exames,
    persisted.exames,
    buildExamMergeKey,
    (currentItem, persistedItem) => ({
      ...currentItem,
      id: currentItem.id ?? persistedItem.id,
      laudo_id: currentItem.laudo_id ?? persistedItem.laudo_id ?? null,
      data_solicitacao: currentItem.data_solicitacao || persistedItem.data_solicitacao || "",
      data_resultado: currentItem.data_resultado || persistedItem.data_resultado || "",
      resultado: currentItem.resultado || persistedItem.resultado || "",
      valor_referencia: currentItem.valor_referencia || persistedItem.valor_referencia || "",
      unidade: currentItem.unidade || persistedItem.unidade || "",
      anexos_resultado: persistedItem.anexos_resultado || currentItem.anexos_resultado || [],
    })
  ),
  prescricao_itens: mergeAutoSavedItems(
    current.prescricao_itens,
    persisted.prescricao_itens,
    buildPrescriptionMergeKey,
    (currentItem, persistedItem) => ({
      ...currentItem,
      id: currentItem.id ?? persistedItem.id,
      medicamento_nome: currentItem.medicamento_nome || persistedItem.medicamento_nome,
      apresentacao_selecionada: currentItem.apresentacao_selecionada || persistedItem.apresentacao_selecionada || "",
      historico_ajustes: persistedItem.historico_ajustes || currentItem.historico_ajustes,
    })
  ),
});

export default function AtendimentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [erroPopup, setErroPopup] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState("");
  const [sucessoPopup, setSucessoPopup] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [workspacePainel, setWorkspacePainel] = useState<WorkspacePainel>("consulta");
  const [consultaEditorEtapa, setConsultaEditorEtapa] = useState<ConsultaEditorEtapa>("anamnese");
  const [consultaCampoAtivo, setConsultaCampoAtivo] = useState<ClinicalFieldKey>("queixa_principal");
  const [prescricaoModoFoco, setPrescricaoModoFoco] = useState(true);
  const [protocoloPrescricaoSelecionado, setProtocoloPrescricaoSelecionado] = useState("");
  const [triagemExpandida, setTriagemExpandida] = useState(true);
  const [examesExpandidos, setExamesExpandidos] = useState<Record<number, boolean>>({});
  const [gerandoPdfTipo, setGerandoPdfTipo] = useState<"prescricao" | "exames" | null>(null);
  const [contextoAplicado, setContextoAplicado] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "local" | "dirty" | "saving" | "saved" | "error">("idle");
  const [autosaveAt, setAutosaveAt] = useState("");

  const [lista, setLista] = useState<AtendimentoResumo[]>([]);
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [clinicas, setClinicas] = useState<ClinicaResumo[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [catalogoExames, setCatalogoExames] = useState<CatalogoExame[]>([]);
  const [paineisExames, setPaineisExames] = useState<PainelExame[]>([]);
  const [clinicalPhrases, setClinicalPhrases] = useState<ClinicalPhraseRecord[]>([]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [form, setForm] = useState<AtendimentoForm>(emptyForm());
  const [pacienteBusca, setPacienteBusca] = useState("");
  const [exameBusca, setExameBusca] = useState("");
  const [exameFiltroRapido, setExameFiltroRapido] = useState<ExameFiltroRapido>("todos");
  const [painelExameSelecionado, setPainelExameSelecionado] = useState("");

  const [historicoPaciente, setHistoricoPaciente] = useState<HistoricoPaciente | null>(null);
  const [evolucaoForm, setEvolucaoForm] = useState({ descricao: "", sinais_vitais: "" });
  const [anexoForm, setAnexoForm] = useState({ tipo: "imagem", descricao: "", url: "" });
  const [anexoArquivo, setAnexoArquivo] = useState<File | null>(null);
  const [uploadingAttachmentKey, setUploadingAttachmentKey] = useState<string | null>(null);
  const [uploadProgressByKey, setUploadProgressByKey] = useState<Record<string, number | null>>({});
  const [openingAttachmentId, setOpeningAttachmentId] = useState<number | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [attachmentImageZoom, setAttachmentImageZoom] = useState(1);
  const [attachmentImageOffset, setAttachmentImageOffset] = useState({ x: 0, y: 0 });
  const [attachmentImageDragging, setAttachmentImageDragging] = useState(false);
  const [attachmentPdfPage, setAttachmentPdfPage] = useState(1);
  const [attachmentPdfZoom, setAttachmentPdfZoom] = useState(110);
  const [examUploadDrafts, setExamUploadDrafts] = useState<Record<number, PendingExamUpload>>({});
  const [examDropActive, setExamDropActive] = useState<Record<number, boolean>>({});
  const [clinicalPhraseSearch, setClinicalPhraseSearch] = useState("");
  const [clinicalPhraseSectionFilter, setClinicalPhraseSectionFilter] = useState<ClinicalFieldKey | "">("");
  const [clinicalPhraseForm, setClinicalPhraseForm] = useState<ClinicalPhraseForm>(emptyClinicalPhraseForm());
  const [savingClinicalPhrase, setSavingClinicalPhrase] = useState(false);
  const [mostrarPacientes, setMostrarPacientes] = useState(false);
  const [showPhraseBank, setShowPhraseBank] = useState(false);
  const [showMedicationBank, setShowMedicationBank] = useState(false);
  const [prescricaoValidationErrors, setPrescricaoValidationErrors] = useState<
    Record<number, Partial<Record<PrescricaoCampoObrigatorio, string>>>
  >({});
  const formRef = useRef(form);
  const autosaveTimerRef = useRef<number | null>(null);
  const erroPopupTimeoutRef = useRef<number | null>(null);
  const sucessoPopupTimeoutRef = useRef<number | null>(null);
  const pacienteDropdownBlurTimeoutRef = useRef<number | null>(null);
  const lastPersistedSnapshotRef = useRef(serializeAtendimentoSnapshot(form));
  const hydratingFormRef = useRef(false);
  const draftRestoreRef = useRef(false);
  const clinicalTextareaRefs = useRef<Partial<Record<ClinicalFieldKey, HTMLTextAreaElement | null>>>({});
  const attachmentImagePanRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const uploadAbortControllersRef = useRef<Record<string, AbortController>>({});
  const activeUploadSignaturesRef = useRef<Set<string>>(new Set());
  const examUploadDraftsRef = useRef<Record<number, PendingExamUpload>>({});
  const pdfDownloadInFlightRef = useRef<"prescricao" | "exames" | null>(null);

  const [medBusca, setMedBusca] = useState("");
  const [medForm, setMedForm] = useState<MedicamentoForm>(emptyMedicationForm());
  const [prescricaoEntradaModo, setPrescricaoEntradaModo] = useState<"industrializado" | "manipulado" | null>(null);
  const [prescricaoBuscaRapida, setPrescricaoBuscaRapida] = useState("");
  const [prescricaoPreviewAtivo, setPrescricaoPreviewAtivo] = useState(false);
  const [prescricaoPreviewPdf, setPrescricaoPreviewPdf] = useState<string | null>(null);
  const [prescricaoPreviewLoading, setPrescricaoPreviewLoading] = useState(false);
  const [prescricaoPreviewErro, setPrescricaoPreviewErro] = useState<string | null>(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    examUploadDraftsRef.current = examUploadDrafts;
  }, [examUploadDrafts]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!erro) {
      setErroPopup(null);
      if (erroPopupTimeoutRef.current) {
        window.clearTimeout(erroPopupTimeoutRef.current);
        erroPopupTimeoutRef.current = null;
      }
      return;
    }

    setErroPopup(erro);
    if (sucessoPopupTimeoutRef.current) {
      window.clearTimeout(sucessoPopupTimeoutRef.current);
      sucessoPopupTimeoutRef.current = null;
    }
    setSucessoPopup(null);
    setSucesso("");

    if (erroPopupTimeoutRef.current) {
      window.clearTimeout(erroPopupTimeoutRef.current);
    }
    erroPopupTimeoutRef.current = window.setTimeout(() => {
      setErroPopup(null);
      erroPopupTimeoutRef.current = null;
      setErro("");
    }, 8000);
  }, [erro]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!sucesso) {
      setSucessoPopup(null);
      if (sucessoPopupTimeoutRef.current) {
        window.clearTimeout(sucessoPopupTimeoutRef.current);
        sucessoPopupTimeoutRef.current = null;
      }
      return;
    }

    setSucessoPopup(sucesso);
    if (erroPopupTimeoutRef.current) {
      window.clearTimeout(erroPopupTimeoutRef.current);
      erroPopupTimeoutRef.current = null;
    }
    setErroPopup(null);
    setErro("");

    if (sucessoPopupTimeoutRef.current) {
      window.clearTimeout(sucessoPopupTimeoutRef.current);
    }
    sucessoPopupTimeoutRef.current = window.setTimeout(() => {
      setSucessoPopup(null);
      sucessoPopupTimeoutRef.current = null;
      setSucesso("");
    }, 5000);
  }, [sucesso]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (erroPopupTimeoutRef.current) {
        window.clearTimeout(erroPopupTimeoutRef.current);
        erroPopupTimeoutRef.current = null;
      }
      if (sucessoPopupTimeoutRef.current) {
        window.clearTimeout(sucessoPopupTimeoutRef.current);
        sucessoPopupTimeoutRef.current = null;
      }
      Object.values(examUploadDraftsRef.current).forEach((entry) => {
        if (entry.previewUrl) {
          window.URL.revokeObjectURL(entry.previewUrl);
        }
      });
      Object.values(uploadAbortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
      uploadAbortControllersRef.current = {};
      activeUploadSignaturesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pacienteDropdownBlurTimeoutRef.current) {
        window.clearTimeout(pacienteDropdownBlurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!attachmentPreview) return;

    if (attachmentPreview.kind === "image") {
      setAttachmentImageZoom(1);
      setAttachmentImageOffset({ x: 0, y: 0 });
      setAttachmentImageDragging(false);
      attachmentImagePanRef.current.pointerId = null;
    } else {
      setAttachmentPdfPage(1);
      setAttachmentPdfZoom(110);
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (attachmentPreview.objectUrl) {
          window.URL.revokeObjectURL(attachmentPreview.objectUrl);
        }
        setAttachmentImageOffset({ x: 0, y: 0 });
        setAttachmentImageDragging(false);
        attachmentImagePanRef.current.pointerId = null;
        setAttachmentPreview(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      if (attachmentPreview.objectUrl) {
        window.URL.revokeObjectURL(attachmentPreview.objectUrl);
      }
    };
  }, [attachmentPreview]);

  useEffect(() => {
    if (attachmentImageZoom > 1) return;
    setAttachmentImageOffset((current) => (current.x === 0 && current.y === 0 ? current : { x: 0, y: 0 }));
    setAttachmentImageDragging(false);
    attachmentImagePanRef.current.pointerId = null;
  }, [attachmentImageZoom]);

  const clearDraftStorage = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ATENDIMENTO_DRAFT_KEY);
  };

  const clearExamUploadDrafts = () => {
    setExamUploadDrafts((prev) => {
      Object.values(prev).forEach((entry) => {
        if (entry.previewUrl) {
          window.URL.revokeObjectURL(entry.previewUrl);
        }
      });
      return {};
    });
    setExamDropActive({});
  };

  const getDraftContext = (source: AtendimentoForm) => ({
    paciente_id: source.paciente_id || "",
    clinica_id: source.clinica_id || "",
    agendamento_id: source.agendamento_id || "",
  });

  const canRestoreDraft = (
    storedContext: { paciente_id?: string; clinica_id?: string; agendamento_id?: string } | undefined,
    currentContext: { paciente_id?: string; clinica_id?: string; agendamento_id?: string }
  ) =>
    ["paciente_id", "clinica_id", "agendamento_id"].every((field) => {
      const storedValue = String(storedContext?.[field as keyof typeof currentContext] || "").trim();
      const currentValue = String(currentContext[field as keyof typeof currentContext] || "").trim();
      return !storedValue || !currentValue || storedValue === currentValue;
    });

  const getClinicalFieldValue = (field: ClinicalFieldKey) => {
    switch (field) {
      case "queixa_principal":
        return form.queixa_principal;
      case "anamnese":
        return form.anamnese;
      case "exame_fisico":
        return form.exame_fisico;
      case "dados_clinicos":
        return form.dados_clinicos;
      case "diagnostico_principal":
        return form.diagnostico.diagnostico_principal;
      case "diagnostico_secundario":
        return form.diagnostico.diagnostico_secundario;
      case "diagnostico_diferencial":
        return form.diagnostico.diagnostico_diferencial;
      case "plano_terapeutico":
        return form.plano_terapeutico;
      case "retorno_recomendado":
        return form.retorno_recomendado;
      case "motivo_retorno":
        return form.motivo_retorno;
      case "observacoes":
        return form.observacoes;
      default:
        return "";
    }
  };

  const setClinicalFieldValue = (field: ClinicalFieldKey, value: string) => {
    setForm((prev) => {
      switch (field) {
        case "queixa_principal":
          return { ...prev, queixa_principal: value };
        case "anamnese":
          return { ...prev, anamnese: value };
        case "exame_fisico":
          return { ...prev, exame_fisico: value };
        case "dados_clinicos":
          return { ...prev, dados_clinicos: value };
        case "diagnostico_principal":
          return {
            ...prev,
            diagnostico: { ...prev.diagnostico, diagnostico_principal: value },
          };
        case "diagnostico_secundario":
          return {
            ...prev,
            diagnostico: { ...prev.diagnostico, diagnostico_secundario: value },
          };
        case "diagnostico_diferencial":
          return {
            ...prev,
            diagnostico: { ...prev.diagnostico, diagnostico_diferencial: value },
          };
        case "plano_terapeutico":
          return { ...prev, plano_terapeutico: value };
        case "retorno_recomendado":
          return { ...prev, retorno_recomendado: value };
        case "motivo_retorno":
          return { ...prev, motivo_retorno: value };
        case "observacoes":
          return { ...prev, observacoes: value };
        default:
          return prev;
      }
    });
  };

  const registerClinicalTextarea = (field: ClinicalFieldKey) => (node: HTMLTextAreaElement | null) => {
    clinicalTextareaRefs.current[field] = node;
  };

  const injectClinicalSnippet = (field: ClinicalFieldKey, snippet: string) => {
    const textarea = clinicalTextareaRefs.current[field];
    const currentValue = getClinicalFieldValue(field);
    const next = insertSnippetIntoText(
      currentValue,
      snippet,
      textarea?.selectionStart,
      textarea?.selectionEnd
    );
    setClinicalFieldValue(field, next.value);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const target = clinicalTextareaRefs.current[field];
        if (!target) return;
        target.focus();
        target.setSelectionRange(next.cursor, next.cursor);
      });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarBase();
  }, [router]);

  useEffect(() => {
    const aplicarContexto = async () => {
      if (loading || contextoAplicado) return;

      const params = new URLSearchParams(window.location.search);
      const atendimentoIdParam = params.get("atendimento_id");
      const agendamentoIdParam = params.get("agendamento_id");
      const pacienteIdParam = params.get("paciente_id");
      const clinicaIdParam = params.get("clinica_id");

      const atendimentoId = Number(atendimentoIdParam || 0);
      const agendamentoId = Number(agendamentoIdParam || 0);

      if (Number.isFinite(atendimentoId) && atendimentoId > 0) {
        await abrirAtendimento(atendimentoId);
        setContextoAplicado(true);
        return;
      }

      if (Number.isFinite(agendamentoId) && agendamentoId > 0) {
        try {
          const existentes = await api.get(`/atendimentos?agendamento_id=${agendamentoId}&limit=1`);
          const atendimentoExistente = existentes.data?.items?.[0];
          if (atendimentoExistente?.id) {
            await abrirAtendimento(atendimentoExistente.id);
            setSucesso(`Atendimento #${atendimentoExistente.id} carregado a partir da agenda.`);
            setContextoAplicado(true);
            return;
          }
        } catch {
          // segue para carregar contexto do agendamento
        }

        try {
          const response = await api.get(`/atendimentos/contexto?agendamento_id=${agendamentoId}`);
          const contexto = response.data || {};
          setForm((prev) => ({
            ...prev,
            paciente_id: contexto.paciente_id ? String(contexto.paciente_id) : prev.paciente_id,
            especie: contexto.especie || prev.especie,
            clinica_id: contexto.clinica_id ? String(contexto.clinica_id) : prev.clinica_id,
            agendamento_id: String(agendamentoId),
          }));
        } catch (e: any) {
          setErro(e?.response?.data?.detail || "Erro ao carregar contexto do agendamento.");
        }
        setContextoAplicado(true);
        return;
      }

      if (pacienteIdParam || clinicaIdParam) {
        setForm((prev) => ({
          ...prev,
          paciente_id: pacienteIdParam || prev.paciente_id,
          clinica_id: clinicaIdParam || prev.clinica_id,
        }));
      }

      setContextoAplicado(true);
    };

    aplicarContexto();
  }, [loading, contextoAplicado]);

  const carregarBase = async () => {
    try {
      setLoading(true);
      const [rp, rc, rm, re, rf] = await Promise.all([
        api.get("/pacientes?limit=1000"),
        api.get("/clinicas?limit=500"),
        api.get("/atendimentos/medicamentos/banco?limit=500"),
        api.get("/atendimentos/exames/catalogo"),
        api.get("/atendimentos/frases-clinicas?include_inactive=1&limit=1000"),
      ]);
      setPacientes(rp.data?.items || []);
      setClinicas(rc.data?.items || []);
      setMedicamentos(rm.data?.items || []);
      setCatalogoExames(re.data?.exames || []);
      setPaineisExames(re.data?.paineis || []);
      setClinicalPhrases(rf.data?.frases || []);
      await carregarLista();
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao carregar dados de atendimento.");
    } finally {
      setLoading(false);
    }
  };

  const carregarLista = async () => {
    try {
      const params = new URLSearchParams();
      params.append("limit", "300");
      if (statusFiltro) params.append("status", statusFiltro);
      if (busca.trim()) params.append("search", busca.trim());
      const response = await api.get(`/atendimentos?${params.toString()}`);
      setLista(response.data?.items || []);
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao listar atendimentos.");
    }
  };

  const filtered = useMemo(() => {
    const term = busca.toLowerCase().trim();
    return lista.filter((item) => {
      if (statusFiltro && item.status !== statusFiltro) return false;
      if (!term) return true;
      return (
        (item.paciente_nome || "").toLowerCase().includes(term) ||
        (item.tutor_nome || "").toLowerCase().includes(term) ||
        (item.clinica_nome || "").toLowerCase().includes(term) ||
        (item.diagnostico || "").toLowerCase().includes(term)
      );
    });
  }, [lista, busca, statusFiltro]);

  const pacientesFuse = useMemo(
    () =>
      new Fuse(pacientes, {
        keys: ["nome", "tutor"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [pacientes]
  );

  const medicamentosFuse = useMemo(
    () =>
      new Fuse(medicamentos, {
        keys: ["nome", "principio_ativo", "categoria", "classe_terapeutica"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [medicamentos]
  );

  const catalogoExamesFuse = useMemo(
    () =>
      new Fuse(catalogoExames, {
        keys: ["nome", "codigo", "categoria", "subcategoria", "sinonimos"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [catalogoExames]
  );

  const pacientesFiltrados = useMemo(() => {
    const term = pacienteBusca.trim();
    if (term.length < 2) return [];
    return pacientesFuse.search(term).map((entry) => entry.item).slice(0, 8);
  }, [pacienteBusca, pacientes, pacientesFuse]);

  const medFiltrados = useMemo(() => {
    const term = medBusca.trim();
    if (!term) return medicamentos;
    return medicamentosFuse.search(term).map((entry) => entry.item);
  }, [medicamentos, medBusca, medicamentosFuse]);

  const medicamentosCardiologiaLista = useMemo(() => {
    return medicamentos.filter((item) => {
      const categoria = (item.categoria || "").toLowerCase();
      const classe = (item.classe_terapeutica || "").toLowerCase();
      return categoria.includes("cardio") || classe.includes("cardio");
    });
  }, [medicamentos]);

  const prescricaoBuscaResultados = useMemo(() => {
    const term = prescricaoBuscaRapida.trim();
    if (!term) {
      return medicamentosCardiologiaLista.slice(0, 6);
    }
    return medicamentosFuse.search(term).map((entry) => entry.item).slice(0, 8);
  }, [medicamentosCardiologiaLista, medicamentosFuse, prescricaoBuscaRapida]);

  const examesCatalogoFiltrados = useMemo(() => {
    const term = exameBusca.trim();
    if (!term) return catalogoExames.slice(0, 8);
    return catalogoExamesFuse.search(term).map((entry) => entry.item).slice(0, 8);
  }, [catalogoExames, exameBusca, catalogoExamesFuse]);

  const pacienteSelecionado = useMemo(() => {
    return pacientes.find((p) => String(p.id) === form.paciente_id) || null;
  }, [pacientes, form.paciente_id]);

  // Espécie unificada: prioriza form.especie (do banco) com fallback para pacienteSelecionado
  const especieExibicao = useMemo(() => {
    if (form.especie) return form.especie;
    if (pacienteSelecionado?.especie) return pacienteSelecionado.especie;
    return null;
  }, [form.especie, pacienteSelecionado?.especie]);

  const painelExameAtual = useMemo(() => {
    return paineisExames.find((item) => String(item.id) === painelExameSelecionado) || null;
  }, [paineisExames, painelExameSelecionado]);

  const anexosGerais = useMemo(() => {
    return form.anexos.filter((item) => !item.exame_id);
  }, [form.anexos]);

  const anexosPorExame = useMemo(() => {
    return form.anexos.reduce<Record<number, Anexo[]>>((acc, item) => {
      if (!item.exame_id) return acc;
      if (!acc[item.exame_id]) acc[item.exame_id] = [];
      acc[item.exame_id].push(item);
      return acc;
    }, {});
  }, [form.anexos]);
  const examesComContexto = useMemo(
    () =>
      form.exames.map((exame, index) => {
        const anexosResultado = exame.id
          ? anexosPorExame[exame.id] || exame.anexos_resultado || []
          : exame.anexos_resultado || [];
        const flowStatus = resolveExamFlowStatus(exame, anexosResultado.length);
        return {
          index,
          exame,
          anexosResultado,
          flowStatus,
        };
      }),
    [anexosPorExame, form.exames]
  );
  const resumoExamesFluxo = useMemo(() => {
    const base = {
      solicitados: 0,
      aguardando_arquivo: 0,
      arquivo_anexado: 0,
      interpretado: 0,
    };
    examesComContexto.forEach((item) => {
      if (!(item.exame.tipo_exame || "").trim()) return;
      base.solicitados += 1;
      base[item.flowStatus] += 1;
    });
    return base;
  }, [examesComContexto]);
  const examesVisiveis = useMemo(
    () =>
      examesComContexto.filter((item) => {
        const hasNome = (item.exame.tipo_exame || "").trim().length > 0;
        if (!hasNome) return exameFiltroRapido === "todos";
        if (exameFiltroRapido === "todos") return true;
        return item.flowStatus === exameFiltroRapido;
      }),
    [exameFiltroRapido, examesComContexto]
  );
  const pesoSerie = useMemo(() => {
    const pontosMap = new Map<number, { atendimento_id: number; data_atendimento: string; peso: number }>();
    const origem = (historicoPaciente?.pesos || [])
      .map((item) => ({
        atendimento_id: Number(item.atendimento_id || 0),
        data_atendimento: item.data_atendimento || "",
        peso: normalizePeso(item.peso),
      }))
      .filter((item): item is { atendimento_id: number; data_atendimento: string; peso: number } => Boolean(item.peso && item.data_atendimento));

    origem.forEach((item) => {
      if (!item.atendimento_id) return;
      pontosMap.set(item.atendimento_id, item);
    });

    if (!origem.length) {
      (historicoPaciente?.atendimentos || []).forEach((item) => {
        const peso = normalizePeso(item.peso);
        if (!peso) return;
        const atendimentoId = Number(item.id || 0);
        if (!atendimentoId) return;
        pontosMap.set(atendimentoId, {
          atendimento_id: atendimentoId,
          data_atendimento: item.data_atendimento || "",
          peso,
        });
      });
    }

    const pesoAtual = normalizePeso(form.triagem.peso);
    if (pesoAtual) {
      const atendimentoAtualId = Number(selecionado || 0);
      const dataAtual = form.data_atendimento ? new Date(form.data_atendimento).toISOString() : new Date().toISOString();
      if (atendimentoAtualId) {
        pontosMap.set(atendimentoAtualId, {
          atendimento_id: atendimentoAtualId,
          data_atendimento: dataAtual,
          peso: pesoAtual,
        });
      } else {
        pontosMap.set(-1, {
          atendimento_id: -1,
          data_atendimento: dataAtual,
          peso: pesoAtual,
        });
      }
    }

    return Array.from(pontosMap.values())
      .filter((item) => item.data_atendimento)
      .sort((a, b) => {
        const aTime = new Date(a.data_atendimento).getTime();
        const bTime = new Date(b.data_atendimento).getTime();
        return aTime - bTime;
      });
  }, [form.data_atendimento, form.triagem.peso, historicoPaciente?.atendimentos, historicoPaciente?.pesos, selecionado]);
  const pesoAtualPonto = pesoSerie.length > 0 ? pesoSerie[pesoSerie.length - 1] : null;
  const pesoAnteriorPonto = pesoSerie.length > 1 ? pesoSerie[pesoSerie.length - 2] : null;
  const pesoDelta = pesoAtualPonto && pesoAnteriorPonto ? Number((pesoAtualPonto.peso - pesoAnteriorPonto.peso).toFixed(2)) : null;
  const pesoSparkline = useMemo(() => {
    if (pesoSerie.length === 0) return "";
    const valores = pesoSerie.map((item) => item.peso);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const range = max - min || 1;
    return pesoSerie
      .map((item, index) => {
        const x = pesoSerie.length === 1 ? 50 : (index / (pesoSerie.length - 1)) * 100;
        const y = 56 - ((item.peso - min) / range) * 44;
        return `${x},${y}`;
      })
      .join(" ");
  }, [pesoSerie]);

  const pacienteDropdownAberto =
    mostrarPacientes &&
    pacientesFiltrados.length > 0 &&
    (!pacienteSelecionado || pacienteBusca.trim() !== pacienteSelecionado.nome);

  const prescricaoSupport = useMemo(
    () => buildPrescriptionSupport(form.triagem.peso, medicamentos, form.prescricao_itens),
    [form.triagem.peso, medicamentos, form.prescricao_itens]
  );
  const prescricaoCalculos = useMemo(
    () =>
      form.prescricao_itens.map((item) => {
        const medicamento =
          item.medicamento_id != null
            ? medicamentos.find((entry) => entry.id === item.medicamento_id) || null
            : null;
        return calcularDosePrescricaoItem(item, medicamento, normalizePeso(form.triagem.peso));
      }),
    [form.prescricao_itens, form.triagem.peso, medicamentos]
  );
  const prescricaoValidacaoAtual = useMemo(
    () => validarItensPrescricao(form.prescricao_itens),
    [form.prescricao_itens]
  );
  const diagnosticoTextoConsolidado = useMemo(
    () =>
      normalizarTokenPrescricao(
        [
          form.diagnostico.diagnostico_principal,
          form.diagnostico.diagnostico_secundario,
          form.diagnostico.diagnostico_diferencial,
          form.queixa_principal,
        ]
          .filter(Boolean)
          .join(" ")
      ),
    [
      form.diagnostico.diagnostico_diferencial,
      form.diagnostico.diagnostico_principal,
      form.diagnostico.diagnostico_secundario,
      form.queixa_principal,
    ]
  );
  const protocoloPrescricaoRecomendado = useMemo(
    () =>
      PROTOCOLOS_PRESCRICAO.find((protocolo) =>
        protocolo.gatilhos.some((gatilho) => diagnosticoTextoConsolidado.includes(normalizarTokenPrescricao(gatilho)))
      ) || null,
    [diagnosticoTextoConsolidado]
  );
  const protocoloPrescricaoSelecionadoDetalhe = useMemo(
    () =>
      PROTOCOLOS_PRESCRICAO.find((protocolo) => protocolo.key === protocoloPrescricaoSelecionado) || null,
    [protocoloPrescricaoSelecionado]
  );
  const prescricaoErrosCount = useMemo(
    () =>
      Object.values(prescricaoValidationErrors).reduce(
        (total, item) => total + Object.keys(item || {}).length,
        0
      ),
    [prescricaoValidationErrors]
  );
  const hasExamRequest = useMemo(
    () => form.exames.some((item) => (item.tipo_exame || "").trim()),
    [form.exames]
  );
  const hasPrescriptionItems = useMemo(
    () => form.prescricao_itens.some((item) => item.medicamento_id || (item.medicamento_nome || "").trim()),
    [form.prescricao_itens]
  );

  const clinicalFieldValues = useMemo(
    () =>
      buildClinicalFieldValues({
        queixa_principal: form.queixa_principal,
        anamnese: form.anamnese,
        exame_fisico: form.exame_fisico,
        dados_clinicos: form.dados_clinicos,
        diagnostico_principal: form.diagnostico.diagnostico_principal,
        diagnostico_secundario: form.diagnostico.diagnostico_secundario,
        diagnostico_diferencial: form.diagnostico.diagnostico_diferencial,
        plano_terapeutico: form.plano_terapeutico,
        retorno_recomendado: form.retorno_recomendado,
        motivo_retorno: form.motivo_retorno,
        observacoes: form.observacoes,
      }),
    [form]
  );

  const clinicalSummary = useMemo(
    () => buildClinicalQuickSummary(clinicalFieldValues, form.diagnostico.prognostico),
    [clinicalFieldValues, form.diagnostico.prognostico]
  );

  const clinicalFieldConfigs = useMemo(
    () => buildClinicalFieldConfigsWithPhraseBank(clinicalPhrases),
    [clinicalPhrases]
  );

  const clinicalPhrasesFiltered = useMemo(() => {
    const search = clinicalPhraseSearch.trim().toLowerCase();
    return clinicalPhrases.filter((item) => {
      if (clinicalPhraseSectionFilter && item.secao !== clinicalPhraseSectionFilter) return false;
      if (!search) return true;
      return (
        item.secao.toLowerCase().includes(search) ||
        item.titulo.toLowerCase().includes(search) ||
        item.texto.toLowerCase().includes(search)
      );
    });
  }, [clinicalPhraseSearch, clinicalPhraseSectionFilter, clinicalPhrases]);

  useEffect(() => {
    if (!pacienteSelecionado) return;
    setPacienteBusca(pacienteSelecionado.nome);
  }, [pacienteSelecionado]);

  useEffect(() => {
    if (typeof window === "undefined" || loading || !contextoAplicado || selecionado || draftRestoreRef.current) {
      return;
    }

    draftRestoreRef.current = true;
    const rawDraft = localStorage.getItem(ATENDIMENTO_DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const parsed = JSON.parse(rawDraft) as {
        form?: Partial<AtendimentoForm>;
        context?: { paciente_id?: string; clinica_id?: string; agendamento_id?: string };
        updated_at?: string;
      };

      const currentContext = getDraftContext(formRef.current);
      if (!canRestoreDraft(parsed.context, currentContext) || !parsed.form) return;

      const restored = sanitizeDraftForm(parsed.form);
      const merged = {
        ...restored,
        paciente_id: currentContext.paciente_id || restored.paciente_id,
        clinica_id: currentContext.clinica_id || restored.clinica_id,
        agendamento_id: currentContext.agendamento_id || restored.agendamento_id,
      };

      hydratingFormRef.current = true;
      setForm(merged);
      setAutosaveState("local");
      setAutosaveAt(parsed.updated_at || new Date().toISOString());
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          hydratingFormRef.current = false;
        });
      }
    } catch {
      clearDraftStorage();
    }
  }, [contextoAplicado, loading, selecionado]);

  useEffect(() => {
    if (typeof window === "undefined" || loading || !contextoAplicado || selecionado || hydratingFormRef.current) {
      return;
    }

    const hasData =
      Boolean(form.paciente_id || form.clinica_id || form.agendamento_id) ||
      hasMeaningfulDraft(clinicalFieldValues) ||
      Boolean(form.triagem.peso || form.triagem.temperatura || form.triagem.pressao_arterial.trim()) ||
      form.exames.some((item) => (item.tipo_exame || "").trim()) ||
      form.prescricao_itens.some((item) => item.medicamento_id || (item.medicamento_nome || "").trim());

    if (!hasData) {
      clearDraftStorage();
      if (autosaveState === "local") {
        setAutosaveState("idle");
        setAutosaveAt("");
      }
      return;
    }

    const timer = window.setTimeout(() => {
      localStorage.setItem(
        ATENDIMENTO_DRAFT_KEY,
        JSON.stringify({
          form: formRef.current,
          context: getDraftContext(formRef.current),
          updated_at: new Date().toISOString(),
        })
      );
      setAutosaveState("local");
      setAutosaveAt(new Date().toISOString());
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clinicalFieldValues, contextoAplicado, form.agendamento_id, form.clinica_id, form.exames, form.paciente_id, form.prescricao_itens, form.triagem.peso, form.triagem.pressao_arterial, form.triagem.temperatura, loading, selecionado]);

  const carregarHistoricoPaciente = async (pacienteId: string | number, limite = 12) => {
    const normalized = Number(pacienteId || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setHistoricoPaciente(null);
      return;
    }

    try {
      const response = await api.get(`/atendimentos/paciente/${normalized}/historico?limite=${limite}`);
      setHistoricoPaciente(response.data);
    } catch {
      setHistoricoPaciente(null);
    }
  };

  useEffect(() => {
    if (!form.paciente_id) {
      setHistoricoPaciente(null);
      return;
    }
    void carregarHistoricoPaciente(form.paciente_id);
  }, [form.paciente_id]);

  const abrirAtendimento = async (id: number) => {
    try {
      const response = await api.get(`/atendimentos/${id}`);
      const d = response.data;
      const hydrated = hydrateFormFromDetail(d);
      setSelecionado(id);
      clearDraftStorage();
      draftRestoreRef.current = true;

      // Carregar histórico do paciente
      if (d.paciente_id) {
        await carregarHistoricoPaciente(d.paciente_id);
      }
      hydratingFormRef.current = true;
      setForm(hydrated);
      setProtocoloPrescricaoSelecionado("");
      setPrescricaoEntradaModo(null);
      setPrescricaoBuscaRapida("");
      setAnexoArquivo(null);
      clearExamUploadDrafts();
      lastPersistedSnapshotRef.current = serializeAtendimentoSnapshot(hydrated);
      setAutosaveState("saved");
      setAutosaveAt(d.updated_at || d.created_at || new Date().toISOString());
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          hydratingFormRef.current = false;
        });
      }
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao abrir atendimento.");
    }
  };

  const novoAtendimento = () => {
    const next = emptyForm();
    setSelecionado(null);
    hydratingFormRef.current = true;
    setForm(next);
    lastPersistedSnapshotRef.current = serializeAtendimentoSnapshot(next);
    setPacienteBusca("");
    setMostrarPacientes(false);
    setExameBusca("");
    setPainelExameSelecionado("");
    setProtocoloPrescricaoSelecionado("");
    setPrescricaoEntradaModo(null);
    setPrescricaoBuscaRapida("");
    setAnexoArquivo(null);
    clearExamUploadDrafts();
    setHistoricoPaciente(null);
    setAutosaveState("idle");
    setAutosaveAt("");
    clearDraftStorage();
    draftRestoreRef.current = false;
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        hydratingFormRef.current = false;
      });
    }
    setErro("");
    setSucesso("");
  };

  const setField = (name: keyof AtendimentoForm, value: any) => setForm((prev) => ({ ...prev, [name]: value }));

  const selecionarPaciente = (paciente: PacienteResumo) => {
    setField("paciente_id", String(paciente.id));
    setField("especie", paciente.especie || "");
    setPacienteBusca(paciente.nome);
    setHistoricoPaciente(null);
    setMostrarPacientes(false);
  };

  const updatePrescricaoItem = (index: number, updates: Partial<PrescricaoItem>) => {
    setField(
      "prescricao_itens",
      form.prescricao_itens.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item))
    );
  };

  const aplicarCalculoNaDose = (index: number, calculo: PrescricaoCalculo) => {
    const doseTexto = formatarDoseTextoCalculada(calculo);
    if (!doseTexto) return;
    updatePrescricaoItem(index, { dose: doseTexto });
  };

  const stripFormulaManipulada = (nome?: string | null) =>
    (nome || "").replace(/\s+-\s*formula manipulada$/i, "").trim();

  const aplicarSugestaoApresentacaoNaPrescricao = (
    idx: number,
    suggestion: ReturnType<typeof suggestMedicationPresentation>
  ) => {
    if (!suggestion) return;
    const itemAtual = form.prescricao_itens[idx];
    const medicamentoSelecionado = medicamentos.find((med) => med.id === itemAtual?.medicamento_id) || null;
    const nomeBase =
      stripFormulaManipulada(itemAtual?.medicamento_nome)
      || medicamentoSelecionado?.nome
      || itemAtual?.medicamento_nome
      || "";

    if (suggestion.requerManipulacao) {
      updatePrescricaoItem(idx, {
        medicamento_nome: nomeBase ? `${nomeBase} - formula manipulada` : itemAtual.medicamento_nome,
        apresentacao_selecionada: "",
      });
      return;
    }

    updatePrescricaoItem(idx, {
      medicamento_nome: nomeBase || itemAtual.medicamento_nome,
      apresentacao_selecionada: suggestion.presentationLabel,
      dose: suggestion.doseAplicada || itemAtual.dose,
    });
  };

  const criarItemPrescricaoDoMedicamento = (
    med: Medicamento,
    options?: { nomePersonalizado?: string; manipulado?: boolean }
  ): PrescricaoItem => {
    const pesoReferencia = normalizePeso(form.triagem.peso);
    const presentationSuggestion =
      options?.manipulado || !pesoReferencia
        ? null
        : suggestMedicationPresentation(pesoReferencia, med);
    const suggestedPresentation =
      presentationSuggestion && !presentationSuggestion.requerManipulacao
        ? presentationSuggestion.presentationLabel
        : "";
    const unidade = med.concentracao_mg_ml
      ? "ml"
      : med.concentracao_mg_comprimido
        ? "comprimido"
        : "mg";
    const itemBase: PrescricaoItem = {
      ...emptyPrescriptionItem(),
      medicamento_id: med.id,
      medicamento_nome: options?.nomePersonalizado || med.nome,
      apresentacao_selecionada: suggestedPresentation,
      frequencia: med.dose_intervalo_horas ? `a cada ${med.dose_intervalo_horas}h` : "",
      duracao: med.duracao_padrao || "",
      via: med.via_padrao || "Oral",
      dose_mg_kg:
        med.dose_max_mg_kg != null
          ? String(med.dose_max_mg_kg)
          : med.dose_min_mg_kg != null
            ? String(med.dose_min_mg_kg)
            : "",
      peso_referencia_kg: pesoReferencia ? String(pesoReferencia) : "",
      unidade_dose_calculo: unidade,
      concentracao_personalizada:
        unidade === "ml"
          ? (med.concentracao_mg_ml != null ? String(med.concentracao_mg_ml) : "")
          : unidade === "comprimido"
            ? (med.concentracao_mg_comprimido != null ? String(med.concentracao_mg_comprimido) : "")
            : "",
    };
    const calculo = calcularDosePrescricaoItem(itemBase, med, pesoReferencia);
    const doseCalculada = formatarDoseTextoCalculada(calculo);
    return {
      ...itemBase,
      dose:
        presentationSuggestion && !presentationSuggestion.requerManipulacao && presentationSuggestion.doseAplicada
          ? presentationSuggestion.doseAplicada
          : (doseCalculada || itemBase.dose),
    };
  };

  const adicionarMedicamentoNaPrescricao = (
    med: Medicamento,
    options?: { manipulado?: boolean }
  ) => {
    const nomeBase = stripFormulaManipulada(med.nome) || med.nome;
    const novoItem = criarItemPrescricaoDoMedicamento(med, {
      nomePersonalizado: options?.manipulado ? `${nomeBase} - formula manipulada` : med.nome,
      manipulado: options?.manipulado,
    });
    const primeiroItemVazio =
      form.prescricao_itens.length === 1 &&
      isPrescriptionItemEmpty(form.prescricao_itens[0]);
    setField(
      "prescricao_itens",
      primeiroItemVazio ? [novoItem] : [...form.prescricao_itens, novoItem]
    );
    setWorkspacePainel("prescricao");
  };

  const adicionarItemPrescricaoEmBranco = (options?: { manipulado?: boolean }) => {
    const itemVazio = {
      ...emptyPrescriptionItem(),
      medicamento_nome: options?.manipulado ? "Formula manipulada" : "",
    };
    const primeiroItemVazio =
      form.prescricao_itens.length === 1 &&
      isPrescriptionItemEmpty(form.prescricao_itens[0]);

    setField(
      "prescricao_itens",
      primeiroItemVazio ? [itemVazio] : [...form.prescricao_itens, itemVazio]
    );
    setWorkspacePainel("prescricao");
  };

  const selecionarMedicamentoBuscaRapida = (med: Medicamento, manipulado = false) => {
    adicionarMedicamentoNaPrescricao(med, manipulado ? { manipulado: true } : undefined);
    setPrescricaoBuscaRapida("");
  };

  // Preview em tempo real do PDF da prescricao
  const gerarPreviewPdf = useCallback(async () => {
    const itensValidos = form.prescricao_itens.filter(
      (item) => (item.medicamento_nome || "").trim()
    );
    if (itensValidos.length === 0) {
      setPrescricaoPreviewPdf(null);
      setPrescricaoPreviewErro(null);
      return;
    }
    setPrescricaoPreviewLoading(true);
    try {
      const payload = {
        paciente_nome: pacienteSelecionado?.nome || "",
        paciente_especie: especieExibicao || "",
        paciente_raca: pacienteSelecionado?.raca || "",
        paciente_peso: form.triagem.peso || null,
        paciente_sexo: "",
        paciente_idade: "",
        tutor_nome: pacienteSelecionado?.tutor || "",
        veterinario_nome: "",
        data_atendimento: form.data_atendimento || new Date().toISOString().split("T")[0],
        orientacoes_gerais: form.prescricao_orientacoes || "",
        retorno_dias: form.prescricao_retorno_dias ? Number(form.prescricao_retorno_dias) : null,
        itens: form.prescricao_itens.map((item) => ({
          id: item.id || null,
          medicamento_id: item.medicamento_id || null,
          medicamento_nome: item.medicamento_nome || "",
          apresentacao_selecionada: item.apresentacao_selecionada || "",
          dose: item.dose || "",
          frequencia: item.frequencia || "",
          duracao: item.duracao || "",
          via: item.via || "",
          instrucoes: item.instrucoes || "",
        })),
      };
      const response = await api.post("/atendimentos/prescricao/preview", payload);
      setPrescricaoPreviewErro(null);
      const pdfB64 = response.data?.pdf_base64;
      if (!pdfB64) {
        console.error("Resposta sem pdf_base64:", response.data);
        setPrescricaoPreviewErro("Resposta inválida do servidor.");
        return;
      }
      // data URL direto no iframe funciona na maioria dos navegadores
      setPrescricaoPreviewPdf(`data:application/pdf;base64,${pdfB64}`);
    } catch (err: any) {
      console.error("Erro ao gerar preview PDF:", err);
      setPrescricaoPreviewPdf(null);
      const msg = err?.response?.data?.detail || err?.message || "Erro ao gerar preview.";
      setPrescricaoPreviewErro(msg);
    } finally {
      setPrescricaoPreviewLoading(false);
    }
  }, [form, pacienteSelecionado, especieExibicao]);

  const abrirMedicamentoBuscaRapida = (med: Medicamento) => {
    editarMedicamento(med);
    setWorkspacePainel("bibliotecas");
  };

  const toggleFormulaManipuladaPrescricao = (idx: number) => {
    const item = form.prescricao_itens[idx];
    const nomeAtual = (item?.medicamento_nome || "").trim();
    const medicamentoSelecionado = medicamentos.find((med) => med.id === item?.medicamento_id) || null;
    const nomeBase =
      stripFormulaManipulada(nomeAtual)
      || medicamentoSelecionado?.nome
      || nomeAtual;
    const formulaAtiva = /formula manipulada/i.test(nomeAtual);
    updatePrescricaoItem(idx, {
      medicamento_nome: formulaAtiva ? nomeBase : `${nomeBase} - formula manipulada`,
      apresentacao_selecionada: formulaAtiva ? item.apresentacao_selecionada : "",
    });
  };

  const aplicarMedicamentoNaPrescricao = (idx: number, medId: number | null) => {
    const med = medicamentos.find((item) => item.id === medId) || null;
    const pesoReferencia = normalizePeso(form.triagem.peso);
    const presentationSuggestion =
      med && pesoReferencia && !(form.prescricao_itens[idx]?.medicamento_nome || "").toLowerCase().includes("formula manipulada")
        ? suggestMedicationPresentation(pesoReferencia, med)
        : null;
    const suggestedPresentation =
      presentationSuggestion && !presentationSuggestion.requerManipulacao
        ? presentationSuggestion.presentationLabel
        : "";
    setField(
      "prescricao_itens",
      form.prescricao_itens.map((item, itemIndex) =>
        itemIndex === idx
          ? {
              ...item,
              dose:
                item.medicamento_id !== medId
                  ? (presentationSuggestion && !presentationSuggestion.requerManipulacao && presentationSuggestion.doseAplicada
                    ? presentationSuggestion.doseAplicada
                    : item.dose)
                  : item.dose,
              medicamento_id: medId,
              medicamento_nome:
                med
                  ? (item.medicamento_nome || "").toLowerCase().includes("formula manipulada")
                    ? `${med.nome} - formula manipulada`
                    : med.nome
                  : item.medicamento_nome,
              apresentacao_selecionada:
                (item.medicamento_nome || "").toLowerCase().includes("formula manipulada")
                  ? ""
                  : suggestedPresentation,
              frequencia:
                !item.frequencia && med?.dose_intervalo_horas
                  ? `a cada ${med.dose_intervalo_horas}h`
                  : item.frequencia,
              duracao: !item.duracao && med?.duracao_padrao ? med.duracao_padrao : item.duracao,
              via: (!item.via || item.via === "Oral") && med?.via_padrao ? med.via_padrao : item.via,
              dose_mg_kg:
                item.dose_mg_kg ||
                (med?.dose_max_mg_kg != null ? String(med.dose_max_mg_kg) : med?.dose_min_mg_kg != null ? String(med.dose_min_mg_kg) : ""),
              peso_referencia_kg: item.peso_referencia_kg || (form.triagem.peso ? String(form.triagem.peso) : ""),
              unidade_dose_calculo: med?.concentracao_mg_ml
                ? "ml"
                : med?.concentracao_mg_comprimido
                  ? "comprimido"
                  : "mg",
              concentracao_personalizada: med?.concentracao_mg_ml
                ? String(med.concentracao_mg_ml)
                : med?.concentracao_mg_comprimido
                  ? String(med.concentracao_mg_comprimido)
                  : item.concentracao_personalizada || "",
            }
          : item
      )
    );
  };

  const buscarMedicamentoPorKeywords = (keywords: string[]) => {
    if (!keywords.length) return null;
    const normalizedKeywords = keywords.map((keyword) => normalizarTokenPrescricao(keyword)).filter(Boolean);
    if (!normalizedKeywords.length) return null;

    return (
      medicamentos.find((med) => {
        const haystack = [
          med.nome,
          med.principio_ativo,
          med.classe_terapeutica,
          med.categoria,
          med.observacoes,
        ]
          .map((value) => normalizarTokenPrescricao(value))
          .join(" ");
        return normalizedKeywords.some((token) => haystack.includes(token));
      }) || null
    );
  };

  const montarItemDeProtocoloPrescricao = (config: ProtocoloPrescricaoItem): PrescricaoItem => {
    const med = buscarMedicamentoPorKeywords(config.keywords);
    const pesoReferencia = normalizePeso(form.triagem.peso);
    const presentationSuggestion =
      med && pesoReferencia
        ? suggestMedicationPresentation(pesoReferencia, med)
        : null;
    const suggestedPresentation =
      presentationSuggestion && !presentationSuggestion.requerManipulacao
        ? presentationSuggestion.presentationLabel
        : "";
    const unidade = config.unidadeCalculo
      || (med?.concentracao_mg_ml ? "ml" : med?.concentracao_mg_comprimido ? "comprimido" : "mg");
    const itemBase: PrescricaoItem = {
      ...emptyPrescriptionItem(),
      medicamento_id: med?.id ?? null,
      medicamento_nome: med?.nome || config.nomeFallback,
      apresentacao_selecionada: suggestedPresentation,
      frequencia: config.frequencia || (med?.dose_intervalo_horas ? `a cada ${med.dose_intervalo_horas}h` : ""),
      duracao: config.duracao || med?.duracao_padrao || "",
      via: config.via || med?.via_padrao || "Oral",
      instrucoes: config.instrucoes || "",
      dose_mg_kg: config.doseMgKg != null ? String(config.doseMgKg) : med?.dose_max_mg_kg != null ? String(med.dose_max_mg_kg) : med?.dose_min_mg_kg != null ? String(med.dose_min_mg_kg) : "",
      peso_referencia_kg: pesoReferencia ? String(pesoReferencia) : "",
      unidade_dose_calculo: unidade,
      concentracao_personalizada:
        unidade === "ml"
          ? (med?.concentracao_mg_ml != null ? String(med.concentracao_mg_ml) : "")
          : unidade === "comprimido"
            ? (med?.concentracao_mg_comprimido != null ? String(med.concentracao_mg_comprimido) : "")
            : "",
    };
    const calculo = calcularDosePrescricaoItem(itemBase, med, pesoReferencia);
    const doseCalculada = formatarDoseTextoCalculada(calculo);
    return {
      ...itemBase,
      dose:
        presentationSuggestion && !presentationSuggestion.requerManipulacao && presentationSuggestion.doseAplicada
          ? presentationSuggestion.doseAplicada
          : (doseCalculada || itemBase.dose),
    };
  };

  const aplicarProtocoloPrescricao = (protocolo: ProtocoloPrescricao) => {
    const itensGerados = protocolo.itens.map(montarItemDeProtocoloPrescricao);
    const itensAtuaisPreenchidos = form.prescricao_itens.filter(
      (item) =>
        item.medicamento_id
        || (item.medicamento_nome || "").trim()
        || (item.dose || "").trim()
        || (item.frequencia || "").trim()
        || (item.duracao || "").trim()
        || (item.instrucoes || "").trim()
    );
    const itensFinais = itensAtuaisPreenchidos.length === 0 ? itensGerados : [...itensAtuaisPreenchidos, ...itensGerados];

    const orientacaoProtocolo = (protocolo.orientacoesPadrao || "").trim();
    const orientacoesAtuais = (form.prescricao_orientacoes || "").trim();
    const orientacoesFinais = orientacaoProtocolo
      ? orientacoesAtuais
        ? orientacoesAtuais.includes(orientacaoProtocolo)
          ? orientacoesAtuais
          : `${orientacoesAtuais}\n\n${orientacaoProtocolo}`
        : orientacaoProtocolo
      : orientacoesAtuais;

    const retornoDiasFinal =
      form.prescricao_retorno_dias || protocolo.retornoDias || "";

    setField("prescricao_itens", itensFinais.length ? itensFinais : [emptyPrescriptionItem()]);
    setField("prescricao_orientacoes", orientacoesFinais);
    setField("prescricao_retorno_dias", retornoDiasFinal);
    setPrescricaoValidationErrors({});
    setSucesso(`Protocolo "${protocolo.label}" aplicado.`);
    setErro("");
  };

  const aplicarProtocoloSelecionado = () => {
    if (!protocoloPrescricaoSelecionado) return;
    const protocolo = PROTOCOLOS_PRESCRICAO.find((item) => item.key === protocoloPrescricaoSelecionado);
    if (!protocolo) return;
    aplicarProtocoloPrescricao(protocolo);
  };

  const buildExamFromCatalog = (item: CatalogoExame, painel?: PainelExame | null): ExameSolicitacao => ({
    ...emptyExam(),
    catalogo_exame_id: item.id,
    painel_exame_id: painel?.id ?? null,
    painel_exame_nome: painel?.nome || "",
    tipo_exame: item.nome,
    categoria_exame: item.categoria,
    preparo: item.preparo || "",
    prioridade: item.prioridade_padrao || "Rotina",
    observacoes: item.observacoes_padrao || "",
    valor: item.valor_padrao || 0,
  });

  const mergeExamesNoFormulario = (novosExames: ExameSolicitacao[]) => {
    if (!novosExames.length) return;
    const base = form.exames.length === 1 && !(form.exames[0].tipo_exame || "").trim() ? [] : form.exames;
    setField("exames", [...base, ...novosExames]);
    setExameFiltroRapido("todos");
    const firstNewIndex = base.length;
    setExamesExpandidos((prev) => {
      const next = { ...prev };
      novosExames.forEach((_, offset) => {
        next[firstNewIndex + offset] = true;
      });
      return next;
    });
  };

  const atualizarExame = (index: number, updates: Partial<ExameSolicitacao>) => {
    setField(
      "exames",
      form.exames.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item))
    );
  };

  const adicionarExameDoCatalogo = (item: CatalogoExame) => {
    mergeExamesNoFormulario([buildExamFromCatalog(item)]);
    setExameBusca("");
    setSucesso(`Exame "${item.nome}" adicionado a solicitacao.`);
  };

  const aplicarPainelExames = () => {
    if (!painelExameAtual) return;

    const examesExistentes = new Set(
      form.exames
        .map((item) => item.catalogo_exame_id)
        .filter((value): value is number => Number.isFinite(value as number) && Number(value) > 0)
    );

    const novosExames = painelExameAtual.itens
      .filter((item) => !examesExistentes.has(item.catalogo_exame_id))
      .map((item) =>
        buildExamFromCatalog(
          {
            id: item.catalogo_exame_id,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            subcategoria: item.subcategoria,
            especie_alvo: "",
            prioridade_padrao: item.prioridade_padrao,
            valor_padrao: item.valor_padrao,
            preparo: item.preparo,
            observacoes_padrao: item.observacoes_padrao,
            sinonimos: [],
            ativo: 1,
          },
          painelExameAtual
        )
      );

    if (!novosExames.length) {
      setSucesso(`Todos os exames do painel "${painelExameAtual.nome}" ja estao na solicitacao.`);
      return;
    }

    mergeExamesNoFormulario(novosExames);
    setSucesso(`Painel "${painelExameAtual.nome}" aplicado com ${novosExames.length} exame(s).`);
  };

  const saveAtendimento = async (mode: "manual" | "autosave" = "manual") => {
    try {
      const currentForm = formRef.current;
      const isAutosave = mode === "autosave";
      if (!isAutosave) {
        const validacaoPrescricao = validarItensPrescricao(currentForm.prescricao_itens);
        setPrescricaoValidationErrors(validacaoPrescricao.errors);
        if (validacaoPrescricao.total > 0) {
          setWorkspacePainel("prescricao");
          setErro("Prescricao incompleta: preencha dose, frequencia e via em todos os itens ativos.");
          return null;
        }
      }
      if (!currentForm.paciente_id) {
        if (isAutosave) return;
        setErro("Selecione um paciente.");
        return null;
      }
      if (!isAutosave) {
        setSalvando(true);
      } else {
        setAutosaveState("saving");
      }

      const payload = buildAtendimentoPayload(currentForm);
      let response;

      if (selecionado) {
        response = await api.put(`/atendimentos/${selecionado}`, payload);
      } else {
        if (isAutosave) return;
        response = await api.post("/atendimentos", payload);
      }
      const hydrated = hydrateFormFromDetail(response.data || {});
      lastPersistedSnapshotRef.current = serializeAtendimentoSnapshot(hydrated);

      if (mode === "manual") {
        if (response.data?.id) {
          setSelecionado(response.data.id);
        }
        hydratingFormRef.current = true;
        setForm(hydrated);
        clearDraftStorage();
        draftRestoreRef.current = true;
        setAutosaveState("saved");
        setAutosaveAt(response.data?.updated_at || response.data?.created_at || new Date().toISOString());
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            hydratingFormRef.current = false;
          });
        }
        setSucesso(selecionado ? "Atendimento atualizado com sucesso." : "Atendimento criado com sucesso.");
        await carregarLista();
        if (hydrated.paciente_id) {
          await carregarHistoricoPaciente(hydrated.paciente_id);
        }
      } else {
        setForm((current) => {
          return mergeAutoSavedFormState(current, hydrated);
        });
        setAutosaveState("saved");
        setAutosaveAt(response.data?.updated_at || response.data?.created_at || new Date().toISOString());
      }
      setErro("");
      return response.data?.id || selecionado || null;
    } catch (e: any) {
      if (mode === "autosave") {
        setAutosaveState("error");
      } else {
        setErro(e?.response?.data?.detail || "Erro ao salvar atendimento.");
      }
      return null;
    } finally {
      if (mode === "manual") {
        setSalvando(false);
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || loading || !contextoAplicado || !selecionado || hydratingFormRef.current) {
      return;
    }

    const currentSnapshot = serializeAtendimentoSnapshot(form);
    if (currentSnapshot === lastPersistedSnapshotRef.current) {
      if (autosaveState !== "saved") {
        setAutosaveState("saved");
      }
      return;
    }

    setAutosaveState("dirty");
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveAtendimento("autosave");
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [contextoAplicado, form, loading, selecionado]);

  const deleteAtendimento = async (id: number) => {
    if (!confirm(`Excluir atendimento #${id}?`)) return;
    try {
      await api.delete(`/atendimentos/${id}`);
      if (selecionado === id) novoAtendimento();
      await carregarLista();
      setSucesso("Atendimento excluido com sucesso.");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao excluir atendimento.");
    }
  };

  const goLaudo = (item: { id?: number | null; atendimento_id?: number | null; agendamento_id?: number | null; paciente_id?: number | null; clinica_id?: number | null }) => {
    const params = new URLSearchParams();
    const atendimentoId = item.atendimento_id || item.id;
    if (atendimentoId) params.set("atendimento_id", String(atendimentoId));
    if (item.agendamento_id) params.set("agendamento_id", String(item.agendamento_id));
    if (item.paciente_id) params.set("paciente_id", String(item.paciente_id));
    if (item.clinica_id) params.set("clinica_id", String(item.clinica_id));
    router.push(`/laudos/novo?${params.toString()}`);
  };

  const mergeUploadedAnexo = (anexo: Anexo) => {
    setForm((current) => ({
      ...current,
      anexos: [anexo, ...current.anexos.filter((item) => item.id !== anexo.id)],
      exames: current.exames.map((item) => {
        if (!anexo.exame_id || item.id !== anexo.exame_id) return item;
        return {
          ...item,
          status: item.status === "Solicitado" ? "Em andamento" : item.status,
          data_resultado: item.data_resultado || nowLocalInput(),
        };
      }),
    }));
  };

  const removerAnexoDoFormulario = (anexoId: number) => {
    setForm((current) => ({
      ...current,
      anexos: current.anexos.filter((item) => item.id !== anexoId),
    }));
  };

  const normalizeApiPath = (url: string) => (url.startsWith("/api/v1") ? url.slice("/api/v1".length) : url);

  const resolvePreviewKind = (anexo: Anexo): "image" | "pdf" | null => {
    const mime = (anexo.mime_type || "").toLowerCase();
    const url = (anexo.url || "").toLowerCase();
    if (mime.startsWith("image/") || /\.(png|jpe?g|gif|bmp|webp|svg)(\?|#|$)/i.test(url)) {
      return "image";
    }
    if (mime === "application/pdf" || /\.pdf(\?|#|$)/i.test(url)) {
      return "pdf";
    }
    return null;
  };

  const closeAttachmentPreview = () => {
    if (attachmentPreview?.objectUrl) {
      window.URL.revokeObjectURL(attachmentPreview.objectUrl);
    }
    setAttachmentImageOffset({ x: 0, y: 0 });
    setAttachmentImageDragging(false);
    attachmentImagePanRef.current.pointerId = null;
    setAttachmentPreview(null);
  };

  const resetAttachmentImageView = () => {
    setAttachmentImageZoom(1);
    setAttachmentImageOffset({ x: 0, y: 0 });
    setAttachmentImageDragging(false);
    attachmentImagePanRef.current.pointerId = null;
  };

  const zoomInAttachmentImage = () => {
    setAttachmentImageZoom((current) => Math.min(4, Number((current + 0.25).toFixed(2))));
  };

  const zoomOutAttachmentImage = () => {
    setAttachmentImageZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))));
  };

  const handleAttachmentImagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (attachmentImageZoom <= 1) return;
    attachmentImagePanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: attachmentImageOffset.x,
      originY: attachmentImageOffset.y,
    };
    setAttachmentImageDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAttachmentImagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (attachmentImagePanRef.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - attachmentImagePanRef.current.startX;
    const deltaY = event.clientY - attachmentImagePanRef.current.startY;
    setAttachmentImageOffset({
      x: attachmentImagePanRef.current.originX + deltaX,
      y: attachmentImagePanRef.current.originY + deltaY,
    });
  };

  const handleAttachmentImagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (attachmentImagePanRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    attachmentImagePanRef.current.pointerId = null;
    setAttachmentImageDragging(false);
  };

  const buildPdfPreviewUrl = (preview: AttachmentPreview | null) => {
    if (!preview) return "";
    const baseUrl = preview.url.split("#")[0];
    return `${baseUrl}#toolbar=0&navpanes=0&scrollbar=1&page=${attachmentPdfPage}`;
  };

  const buildPendingExamUpload = (file: File): PendingExamUpload => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    return {
      file,
      previewUrl: isImage ? window.URL.createObjectURL(file) : null,
      kind: isImage ? "image" : isPdf ? "pdf" : "other",
    };
  };

  const clearExamUploadDraft = (index: number) => {
    setExamUploadDrafts((prev) => {
      const current = prev[index];
      if (current?.previewUrl) {
        window.URL.revokeObjectURL(current.previewUrl);
      }
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const setExamUploadDraftFile = (index: number, file: File) => {
    setExamUploadDrafts((prev) => {
      const current = prev[index];
      if (current?.previewUrl) {
        window.URL.revokeObjectURL(current.previewUrl);
      }
      return {
        ...prev,
        [index]: buildPendingExamUpload(file),
      };
    });
  };

  const clearExamDropState = (index: number) => {
    setExamDropActive((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const resolveExamIdForUpload = async (index: number) => {
    const examAtual = formRef.current.exames[index];
    if (!examAtual) return null;
    if (examAtual.id) return examAtual.id;

    const lookupKey = buildExamMergeKey(examAtual);
    const atendimentoId = await saveAtendimento("manual");
    if (!atendimentoId) return null;

    if (typeof window !== "undefined") {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }

    const isMatch = (item: ExameSolicitacao) => {
      const sameCatalogo = Number(item.catalogo_exame_id || 0) === Number(examAtual.catalogo_exame_id || 0);
      const sameNome = (item.tipo_exame || "").trim().toLowerCase() === (examAtual.tipo_exame || "").trim().toLowerCase();
      return buildExamMergeKey(item) === lookupKey || (sameCatalogo && sameNome);
    };

    let synced = formRef.current.exames.find((item) => item.id && isMatch(item));
    if (!synced?.id) {
      await abrirAtendimento(Number(atendimentoId));
      synced = formRef.current.exames.find((item) => item.id && isMatch(item));
    }
    return synced?.id || null;
  };

  const uploadArquivoResultadoExame = async (index: number, file: File) => {
    const examAtual = formRef.current.exames[index];
    if (!examAtual) return;
    if (!(examAtual.tipo_exame || "").trim()) {
      setErro("Informe o nome do exame antes de anexar o arquivo.");
      return;
    }
    const uploadKey = `exame-${index}`;
    const exameId = await resolveExamIdForUpload(index);
    if (!exameId) {
      setErro("Nao foi possivel salvar o exame para anexar o arquivo.");
      return;
    }

    const uploadConcluido = await uploadAnexoArquivo(file, {
      exameId,
      tipo: "resultado_exame",
      descricao: `Arquivo de resultado: ${examAtual.tipo_exame || "Exame"}`,
      uploadKey,
    });
    if (uploadConcluido) {
      clearExamUploadDraft(index);
      clearExamDropState(index);
    }
  };

  const cancelarUploadAnexo = (uploadKey: string) => {
    const controller = uploadAbortControllersRef.current[uploadKey];
    if (!controller) return;
    controller.abort();
  };

  const buildUploadSignature = (atendimentoId: number, uploadKey: string, file: File) =>
    `${atendimentoId}|${uploadKey}|${file.name}|${file.size}|${file.lastModified}`;

  const uploadAnexoArquivo = async (
    file: File,
    options?: { exameId?: number | null; tipo?: string; descricao?: string; uploadKey?: string }
  ): Promise<boolean> => {
    if (!selecionado) {
      setErro("Salve o atendimento antes de enviar arquivos.");
      return false;
    }
    if (!isAllowedAttachmentFilename(file.name)) {
      setErro("Tipo de arquivo nao permitido. Use: .jpeg, .jpg, .pdf, .png, .webp");
      return false;
    }
    if (file.size > ATENDIMENTO_ATTACHMENT_MAX_SIZE_BYTES) {
      setErro("Arquivo excede o limite de 25MB");
      return false;
    }

    const uploadKey = options?.uploadKey || (options?.exameId ? `exame-${options.exameId}` : "geral");
    const uploadSignature = buildUploadSignature(selecionado, uploadKey, file);
    if (activeUploadSignaturesRef.current.has(uploadSignature)) {
      setSucesso("Upload ja esta em andamento para este arquivo.");
      setErro("");
      return false;
    }

    activeUploadSignaturesRef.current.add(uploadSignature);
    const formData = new FormData();
    formData.append("arquivo", file);
    formData.append("tipo", options?.tipo || anexoForm.tipo || "documento");
    formData.append("descricao", options?.descricao || anexoForm.descricao || "");
    if (options?.exameId) {
      formData.append("exame_id", String(options.exameId));
    }

    try {
      setUploadingAttachmentKey(uploadKey);
      setUploadProgressByKey((prev) => ({ ...prev, [uploadKey]: null }));
      const uploadAbortController = new AbortController();
      uploadAbortControllersRef.current[uploadKey] = uploadAbortController;
      const response = await api.post(`/atendimentos/${selecionado}/anexos/upload`, formData, {
        signal: uploadAbortController.signal,
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total;
          const nextValue =
            typeof total === "number" && total > 0
              ? Math.max(0, Math.min(100, Math.round((progressEvent.loaded * 100) / total)))
              : null;
          setUploadProgressByKey((prev) => {
            if (prev[uploadKey] === nextValue) return prev;
            return { ...prev, [uploadKey]: nextValue };
          });
        },
      });
      mergeUploadedAnexo(response.data);
      const deduplicado = response?.data?.deduplicado === true;
      if (deduplicado) {
        setSucesso(
          options?.exameId
            ? "Arquivo ja estava vinculado a este exame."
            : "Arquivo ja estava anexado neste atendimento."
        );
      } else {
        setSucesso(options?.exameId ? "Arquivo vinculado ao exame com sucesso." : "Arquivo anexado com sucesso.");
      }
      if (!options?.exameId) {
        setAnexoArquivo(null);
        setAnexoForm((current) => ({ ...current, descricao: "", url: "" }));
      }
      setErro("");
      return true;
    } catch (e: any) {
      const isCanceled =
        e?.code === "ERR_CANCELED" ||
        e?.name === "CanceledError" ||
        (typeof e?.message === "string" && /cancel/i.test(e.message));
      if (isCanceled) {
        setSucesso("Upload cancelado.");
        setErro("");
        return false;
      }
      setErro(e?.response?.data?.detail || "Erro ao enviar arquivo.");
      return false;
    } finally {
      setUploadingAttachmentKey(null);
      setUploadProgressByKey((prev) => {
        if (!(uploadKey in prev)) return prev;
        const next = { ...prev };
        delete next[uploadKey];
        return next;
      });
      if (uploadAbortControllersRef.current[uploadKey]) {
        delete uploadAbortControllersRef.current[uploadKey];
      }
      activeUploadSignaturesRef.current.delete(uploadSignature);
    }
  };

  const adicionarLinkAnexo = async () => {
    if (!selecionado || !anexoForm.url.trim()) return;
    try {
      const response = await api.post(`/atendimentos/${selecionado}/anexos`, {
        ...anexoForm,
        nome_original: anexoForm.url.split("/").pop() || "",
      });
      mergeUploadedAnexo(response.data);
      setAnexoForm({ tipo: "imagem", descricao: "", url: "" });
      setSucesso("Link anexado com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao adicionar link do anexo.");
    }
  };

  const abrirAnexo = async (anexo: Anexo, mode: "preview" | "download" = "preview") => {
    if (!anexo) return;
    const previewKind = resolvePreviewKind(anexo);

    if (anexo.download_url) {
      try {
        setOpeningAttachmentId(anexo.id);
        const response = await api.get(normalizeApiPath(anexo.download_url), {
          responseType: "blob",
        });
        const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: anexo.mime_type || "application/octet-stream" });
        const blobUrl = window.URL.createObjectURL(blob);
        if (mode === "preview" && previewKind) {
          setAttachmentPreview({
            anexo,
            url: blobUrl,
            title: anexo.nome_original || anexo.tipo,
            kind: previewKind,
            objectUrl: blobUrl,
          });
        } else {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = anexo.nome_original || `anexo_${anexo.id}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
        }
      } catch (e: any) {
        setErro(e?.response?.data?.detail || "Erro ao abrir anexo.");
      } finally {
        setOpeningAttachmentId(null);
      }
      return;
    }

    if (anexo.url) {
      if (mode === "preview" && previewKind) {
        setAttachmentPreview({
          anexo,
          url: anexo.url,
          title: anexo.nome_original || anexo.tipo,
          kind: previewKind,
          objectUrl: null,
        });
        return;
      }
      window.open(anexo.url, "_blank", "noopener,noreferrer");
    }
  };

  const excluirAnexo = async (anexo: Anexo) => {
    try {
      await api.delete(`/atendimentos/anexos/${anexo.id}`);
      if (attachmentPreview?.anexo.id === anexo.id) {
        closeAttachmentPreview();
      }
      removerAnexoDoFormulario(anexo.id);
      setSucesso("Anexo removido com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao excluir anexo.");
    }
  };

  const carregarMedicamentosBanco = async () => {
    try {
      const response = await api.get("/atendimentos/medicamentos/banco?limit=500");
      const items = response.data?.items || [];
      setMedicamentos(items);
      return items;
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao atualizar banco de medicamentos.");
      return [];
    }
  };

  const resetMedicationForm = () => {
    setMedForm(emptyMedicationForm());
  };

  const editarMedicamento = (item: Medicamento) => {
    setShowMedicationBank(true);
    setMedForm(hydrateMedicationForm(item));
    setSucesso("");
    setErro("");
  };

  const duplicarMedicamentoManipulado = (item: Medicamento) => {
    const baseName = (item.nome || "").replace(/\s+-\s*formula manipulada$/i, "").trim() || item.nome;
    const observacoes = [
      `Formula manipulada derivada de ${baseName}.`,
      item.observacoes || "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setShowMedicationBank(true);
    setMedForm({
      ...hydrateMedicationForm(item),
      id: null,
      nome: `${baseName} - formula manipulada`,
      parametrizacao_origem: "manual",
      duracao_padrao: "",
      observacoes,
    });
    setSucesso("");
    setErro("");
  };

  const desativarMedicamento = async (item: Medicamento) => {
    try {
      await api.delete(`/atendimentos/medicamentos/banco/${item.id}`);
      await carregarMedicamentosBanco();
      if (medForm.id === item.id) {
        resetMedicationForm();
      }
      setSucesso("Medicamento desativado com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao desativar medicamento.");
    }
  };

  const saveMedicamento = async () => {
    try {
      if (!medForm.nome.trim()) {
        setErro("Informe o nome do medicamento.");
        return;
      }

      const payload = {
        ...medForm,
        id: undefined,
        dose_min_mg_kg: medForm.dose_min_mg_kg ? Number(medForm.dose_min_mg_kg) : null,
        dose_max_mg_kg: medForm.dose_max_mg_kg ? Number(medForm.dose_max_mg_kg) : null,
        dose_intervalo_horas: medForm.dose_intervalo_horas ? Number(medForm.dose_intervalo_horas) : null,
        concentracao_mg_ml: medForm.concentracao_mg_ml ? Number(medForm.concentracao_mg_ml) : null,
        concentracao_mg_comprimido: medForm.concentracao_mg_comprimido ? Number(medForm.concentracao_mg_comprimido) : null,
        interacoes: parseStringListInput(medForm.interacoes),
        ativo: medForm.ativo ?? 1,
      };

      if (medForm.id) {
        await api.put(`/atendimentos/medicamentos/banco/${medForm.id}`, payload);
        setSucesso("Medicamento atualizado com sucesso.");
      } else {
        await api.post("/atendimentos/medicamentos/banco", payload);
        setSucesso("Medicamento salvo com sucesso.");
      }

      await carregarMedicamentosBanco();
      resetMedicationForm();
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao salvar medicamento.");
    }
  };

  const carregarFrasesClinicas = async () => {
    const response = await api.get("/atendimentos/frases-clinicas?include_inactive=1&limit=1000");
    setClinicalPhrases(response.data?.frases || []);
  };

  const editarFraseClinica = (item: ClinicalPhraseRecord) => {
    setClinicalPhraseForm({
      id: item.id,
      secao: item.secao,
      titulo: item.titulo,
      texto: item.texto,
      ordem: String(item.ordem ?? ""),
      ativo: Number(item.ativo ?? 1),
    });
  };

  const resetClinicalPhraseForm = () => {
    setClinicalPhraseForm(emptyClinicalPhraseForm());
  };

  const saveClinicalPhrase = async () => {
    try {
      if (!clinicalPhraseForm.titulo.trim() || !clinicalPhraseForm.texto.trim()) {
        setErro("Preencha titulo e texto da frase clinica.");
        return;
      }

      setSavingClinicalPhrase(true);
      const payload = {
        secao: clinicalPhraseForm.secao,
        titulo: clinicalPhraseForm.titulo,
        texto: clinicalPhraseForm.texto,
        ordem: clinicalPhraseForm.ordem ? Number(clinicalPhraseForm.ordem) : 0,
        ativo: clinicalPhraseForm.ativo,
      };

      if (clinicalPhraseForm.id) {
        await api.put(`/atendimentos/frases-clinicas/${clinicalPhraseForm.id}`, payload);
        setSucesso("Frase clinica atualizada com sucesso.");
      } else {
        await api.post("/atendimentos/frases-clinicas", payload);
        setSucesso("Frase clinica criada com sucesso.");
      }

      await carregarFrasesClinicas();
      resetClinicalPhraseForm();
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao salvar frase clinica.");
    } finally {
      setSavingClinicalPhrase(false);
    }
  };

  const toggleClinicalPhrase = async (item: ClinicalPhraseRecord) => {
    try {
      if (Number(item.ativo ?? 1) === 1) {
        await api.delete(`/atendimentos/frases-clinicas/${item.id}`);
        setSucesso("Frase clinica desativada.");
      } else {
        await api.post(`/atendimentos/frases-clinicas/${item.id}/restaurar`);
        setSucesso("Frase clinica reativada.");
      }
      await carregarFrasesClinicas();
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.detail || "Erro ao atualizar status da frase clinica.");
    }
  };

  const escHtml = (value: any) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const abrirJanelaImpressao = (titulo: string, conteudoHtml: string) => {
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      setErro("Nao foi possivel abrir a janela de impressao. Verifique o bloqueador de pop-up.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${escHtml(titulo)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 12px; font-size: 22px; }
            h2 { margin: 20px 0 8px; font-size: 16px; }
            .meta { margin-bottom: 12px; font-size: 13px; color: #374151; }
            .meta p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
            .obs { white-space: pre-wrap; font-size: 12px; margin-top: 8px; }
            .sub { display: block; margin-top: 4px; font-size: 11px; color: #4b5563; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; }
            @media print {
              body { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${conteudoHtml}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const obterPacienteNome = () => pacientes.find((p) => String(p.id) === form.paciente_id)?.nome || "Nao informado";
  const obterClinicaNome = () => clinicas.find((c) => String(c.id) === form.clinica_id)?.nome || "Nao informada";

  const imprimirPrescricao = () => {
    const itens = form.prescricao_itens.filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim());
    const validacaoPrescricao = validarItensPrescricao(form.prescricao_itens);
    setPrescricaoValidationErrors(validacaoPrescricao.errors);
    if (validacaoPrescricao.total > 0) {
      setWorkspacePainel("prescricao");
      setErro("Prescricao incompleta: corrija os campos obrigatorios antes de imprimir.");
      return;
    }
    if (!itens.length && !form.prescricao_orientacoes.trim()) {
      setErro("Preencha a prescricao para imprimir.");
      return;
    }

    const rows = itens
      .map((item, idx) => `
        <tr>
          <td>${idx + 1}. ${escHtml(item.medicamento_nome || "-")}${item.apresentacao_selecionada ? `<span class="sub">Apresentacao: ${escHtml(item.apresentacao_selecionada)}</span>` : ""}</td>
          <td>${escHtml(item.dose || "-")}</td>
          <td>${escHtml(item.frequencia || "-")}</td>
          <td>${escHtml(item.duracao || "-")}</td>
          <td>${escHtml(item.via || "-")}</td>
          <td>${escHtml(item.instrucoes || "-")}</td>
        </tr>
      `)
      .join("");

    abrirJanelaImpressao(
      "Receita Veterinaria",
      `
      <h1>Receita Veterinaria</h1>
      <div class="meta">
        <p><b>Paciente:</b> ${escHtml(obterPacienteNome())}</p>
        <p><b>Clinica:</b> ${escHtml(obterClinicaNome())}</p>
        <p><b>Data:</b> ${escHtml(formatDate(form.data_atendimento))}</p>
        <p><b>Atendimento:</b> ${escHtml(selecionado ? `#${selecionado}` : "Nao salvo")}</p>
      </div>
      <h2>Medicamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Dose</th>
            <th>Frequencia</th>
            <th>Duracao</th>
            <th>Via</th>
            <th>Instrucoes</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">Sem itens de medicacao.</td></tr>`}</tbody>
      </table>
      <h2>Orientacoes gerais</h2>
      <div class="obs">${escHtml(form.prescricao_orientacoes || "-")}</div>
      ${form.prescricao_retorno_dias ? `<p><b>Retorno sugerido:</b> ${escHtml(form.prescricao_retorno_dias)} dia(s)</p>` : ""}
      <div class="footer">Documento emitido pelo modulo de atendimento.</div>
    `,
    );
  };

  const imprimirSolicitacaoExames = () => {
    const exames = form.exames.filter((item) => (item.tipo_exame || "").trim());
    if (!exames.length) {
      setErro("Adicione pelo menos um exame para imprimir a solicitacao.");
      return;
    }

    const rows = exames
      .map((exame, idx) => `
        <tr>
          <td>${idx + 1}. ${escHtml(exame.tipo_exame || "-")}</td>
          <td>${escHtml(exame.prioridade || "-")}</td>
          <td>${escHtml(exame.status || "-")}</td>
          <td>${escHtml(exame.valor ? `R$ ${Number(exame.valor).toFixed(2)}` : "-")}</td>
          <td>${escHtml(exame.observacoes || "-")}</td>
        </tr>
      `)
      .join("");

    abrirJanelaImpressao(
      "Solicitacao de Exames",
      `
      <h1>Solicitacao de Exames</h1>
      <div class="meta">
        <p><b>Paciente:</b> ${escHtml(obterPacienteNome())}</p>
        <p><b>Clinica:</b> ${escHtml(obterClinicaNome())}</p>
        <p><b>Data:</b> ${escHtml(formatDate(form.data_atendimento))}</p>
        <p><b>Atendimento:</b> ${escHtml(selecionado ? `#${selecionado}` : "Nao salvo")}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Exame</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Valor</th>
            <th>Observacoes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Documento emitido pelo modulo de atendimento.</div>
    `,
    );
  };

  const baixarPdfAtendimento = async (tipo: "prescricao" | "exames") => {
    if (tipo === "prescricao" && !hasPrescriptionItems) {
      setErro("Adicione pelo menos um item na prescricao antes de gerar o PDF.");
      return;
    }
    if (tipo === "prescricao") {
      const validacaoPrescricao = validarItensPrescricao(form.prescricao_itens);
      setPrescricaoValidationErrors(validacaoPrescricao.errors);
      if (validacaoPrescricao.total > 0) {
        setWorkspacePainel("prescricao");
        setErro("Prescricao incompleta: corrija os campos obrigatorios antes de gerar o PDF.");
        return;
      }
    }
    if (tipo === "exames" && !hasExamRequest) {
      setErro("Adicione pelo menos um exame antes de gerar o PDF.");
      return;
    }

    if (pdfDownloadInFlightRef.current) {
      return;
    }

    pdfDownloadInFlightRef.current = tipo;
    setGerandoPdfTipo(tipo);

    try {
      const currentSnapshot = serializeAtendimentoSnapshot(formRef.current);
      let atendimentoId = selecionado;
      const precisaSalvarAntesDoPdf =
        !atendimentoId
        || currentSnapshot !== lastPersistedSnapshotRef.current
        || autosaveState === "error";

      if (precisaSalvarAntesDoPdf) {
        atendimentoId = await saveAtendimento("manual");
        if (!atendimentoId) return;
      }

      const response = await api.get(`/atendimentos/${atendimentoId}/${tipo}/pdf`, {
        responseType: "blob",
      });

      const fallbackFilename =
        tipo === "prescricao"
          ? `receita_atendimento_${atendimentoId}.pdf`
          : `solicitacao_exames_atendimento_${atendimentoId}.pdf`;
      const filename = parseDownloadFilename(response.headers?.["content-disposition"], fallbackFilename);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setSucesso(tipo === "prescricao" ? "PDF da receita gerado com sucesso." : "PDF da solicitacao de exames gerado com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(await extractApiErrorMessage(e, "Falha ao gerar o PDF."));
    } finally {
      window.setTimeout(() => {
        if (pdfDownloadInFlightRef.current === tipo) {
          pdfDownloadInFlightRef.current = null;
          setGerandoPdfTipo((current) => (current === tipo ? null : current));
        }
      }, 1200);
    }
  };

  const getBadgeStatusClass = (status: string) => {
    const normalized = (status || "").toLowerCase();
    if (normalized.includes("concl")) return "bg-emerald-100 text-emerald-800";
    if (normalized.includes("aguard")) return "bg-amber-100 text-amber-800";
    if (normalized.includes("atendimento")) return "bg-sky-100 text-sky-800";
    if (normalized.includes("triagem")) return "bg-violet-100 text-violet-800";
    return "bg-slate-100 text-slate-700";
  };

  const getGravidadeClass = (gravidade: string) => {
    const normalized = (gravidade || "").toLowerCase();
    if (normalized === "critica") return "border-red-200 bg-red-50 text-red-800";
    if (normalized === "alta") return "border-orange-200 bg-orange-50 text-orange-800";
    if (normalized === "media") return "border-amber-200 bg-amber-50 text-amber-800";
    return "border-slate-200 bg-slate-50 text-slate-700";
  };

  const fluxoClinico = [
    {
      id: "triagem",
      titulo: "Triagem",
      descricao: "Sinais vitais e estabilidade",
      concluido: form.triagem_concluida === 1,
    },
    {
      id: "consulta",
      titulo: "Consulta",
      descricao: "Anamnese, exame fisico e plano",
      concluido: form.consulta_concluida === 1,
    },
    {
      id: "exames",
      titulo: "Exames",
      descricao: `${form.exames.filter((item) => (item.tipo_exame || "").trim()).length} solicitacao(oes)`,
      concluido: form.exames.some((item) => (item.tipo_exame || "").trim()),
    },
    {
      id: "prescricao",
      titulo: "Prescricao",
      descricao: `${form.prescricao_itens.filter((item) => item.medicamento_id || item.medicamento_nome.trim()).length} item(ns)`,
      concluido: form.prescricao_itens.some((item) => item.medicamento_id || item.medicamento_nome.trim()),
    },
  ];
  const totalExamesSolicitados = form.exames.filter((item) => (item.tipo_exame || "").trim()).length;
  const totalPrescricaoItens = form.prescricao_itens.filter((item) => item.medicamento_id || item.medicamento_nome.trim()).length;
  const totalAnexosExame = form.exames.reduce((acc, exame) => acc + (exame.anexos_resultado?.length || 0), 0);
  const totalAnexosDocumento = anexosGerais.length + totalAnexosExame;
  const workspaceCards: Array<{ key: WorkspacePainel; titulo: string; resumo: string; badge: string }> = [
    {
      key: "consulta",
      titulo: "Consulta",
      resumo: "Triagem + editor clinico",
      badge: `${clinicalSummary.completeness}%`,
    },
    {
      key: "exames",
      titulo: "Exames",
      resumo: "Solicitacao e resultados",
      badge: `${totalExamesSolicitados}`,
    },
    {
      key: "prescricao",
      titulo: "Prescricao",
      resumo: "Receituario assistido",
      badge: `${totalPrescricaoItens}`,
    },
    {
      key: "documentos",
      titulo: "Documentos",
      resumo: "Evolucao e anexos",
      badge: `${totalAnexosDocumento}`,
    },
    {
      key: "bibliotecas",
      titulo: "Bibliotecas",
      resumo: "Frases e farmacos",
      badge: `${clinicalPhrases.length + medicamentos.length}`,
    },
  ];
  const isConsultaWorkspace = workspacePainel === "consulta";
  const isExamesWorkspace = workspacePainel === "exames";
  const isPrescricaoWorkspace = workspacePainel === "prescricao";
  const isDocumentosWorkspace = workspacePainel === "documentos";
  const isBibliotecasWorkspace = workspacePainel === "bibliotecas";
  const uploadGeralEmAndamento = uploadingAttachmentKey === "geral";
  const progressoUploadGeral = uploadProgressByKey["geral"] ?? null;
  const showClinicalRadarAside = isConsultaWorkspace || isDocumentosWorkspace;
  const consultaEditorEtapas = useMemo(
    () =>
      CONSULTA_EDITOR_ETAPAS.map((etapa) => {
        const preenchidos = etapa.campos.filter((campo) => (clinicalFieldValues[campo] || "").trim().length > 0).length;
        const total = etapa.campos.length;
        const percentual = total > 0 ? Math.round((preenchidos / total) * 100) : 0;
        return {
          ...etapa,
          preenchidos,
          total,
          percentual,
          concluidaAuto: total > 0 && preenchidos === total,
        };
      }),
    [clinicalFieldValues]
  );
  const consultaEtapasCompletas = useMemo(
    () => consultaEditorEtapas.length > 0 && consultaEditorEtapas.every((etapa) => etapa.concluidaAuto),
    [consultaEditorEtapas]
  );
  const consultaEditorCamposVisiveis = useMemo(() => {
    const etapaAtiva = CONSULTA_EDITOR_ETAPAS.find((etapa) => etapa.key === consultaEditorEtapa) || CONSULTA_EDITOR_ETAPAS[0];
    const camposPermitidos = new Set(etapaAtiva.campos);
    return clinicalFieldConfigs.filter((config) => camposPermitidos.has(config.key));
  }, [consultaEditorEtapa, clinicalFieldConfigs]);
  const consultaCampoAtivoConfig = useMemo(
    () =>
      consultaEditorCamposVisiveis.find((config) => config.key === consultaCampoAtivo) ||
      consultaEditorCamposVisiveis[0] ||
      null,
    [consultaCampoAtivo, consultaEditorCamposVisiveis]
  );
  const consultaCampoAtivoIndex = useMemo(
    () => consultaEditorCamposVisiveis.findIndex((item) => item.key === consultaCampoAtivo),
    [consultaCampoAtivo, consultaEditorCamposVisiveis]
  );
  const workspaceGridClass = isBibliotecasWorkspace
    ? "grid gap-6 grid-cols-1"
    : isExamesWorkspace
      ? "grid gap-6 grid-cols-1"
    : isPrescricaoWorkspace
      ? prescricaoModoFoco
        ? "grid gap-6 xl:grid-cols-[minmax(0,1fr),340px] 2xl:grid-cols-[minmax(0,1fr),360px]"
        : "grid gap-6 xl:grid-cols-[minmax(0,1fr),380px] 2xl:grid-cols-[minmax(0,1fr),400px]"
      : "grid gap-6 xl:grid-cols-[minmax(0,1fr),380px] 2xl:grid-cols-[minmax(0,1fr),400px]";
  const goToConsultaCampoAnterior = () => {
    if (consultaCampoAtivoIndex <= 0) return;
    setConsultaCampoAtivo(consultaEditorCamposVisiveis[consultaCampoAtivoIndex - 1].key);
  };
  const goToConsultaCampoProximo = () => {
    if (consultaCampoAtivoIndex < 0 || consultaCampoAtivoIndex >= consultaEditorCamposVisiveis.length - 1) return;
    setConsultaCampoAtivo(consultaEditorCamposVisiveis[consultaCampoAtivoIndex + 1].key);
  };
  const handleConsultaTextareaKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    if (event.shiftKey) {
      goToConsultaCampoAnterior();
      return;
    }
    goToConsultaCampoProximo();
  };

  useEffect(() => {
    if (!consultaEditorCamposVisiveis.length) return;
    const campoAindaVisivel = consultaEditorCamposVisiveis.some((config) => config.key === consultaCampoAtivo);
    if (!campoAindaVisivel) {
      setConsultaCampoAtivo(consultaEditorCamposVisiveis[0].key);
    }
  }, [consultaCampoAtivo, consultaEditorCamposVisiveis]);

  useEffect(() => {
    const valorEsperado = consultaEtapasCompletas ? 1 : 0;
    setForm((prev) => (prev.consulta_concluida === valorEsperado ? prev : { ...prev, consulta_concluida: valorEsperado }));
  }, [consultaEtapasCompletas]);

  useEffect(() => {
    if (!isConsultaWorkspace || !consultaCampoAtivoConfig) return;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const target = clinicalTextareaRefs.current[consultaCampoAtivoConfig.key];
      if (!target) return;
      target.focus();
      const cursor = target.value.length;
      target.setSelectionRange(cursor, cursor);
    });
  }, [isConsultaWorkspace, consultaCampoAtivoConfig]);

  useEffect(() => {
    if (!isConsultaWorkspace) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.altKey && event.shiftKey)) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (event.key === "ArrowLeft") {
        goToConsultaCampoAnterior();
      } else {
        goToConsultaCampoProximo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToConsultaCampoAnterior, goToConsultaCampoProximo, isConsultaWorkspace]);

  useEffect(() => {
    setExamesExpandidos((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= 0 && index < form.exames.length) {
          next[index] = value;
        }
      });
      if (!Object.keys(next).length && form.exames.length > 0) {
        next[0] = true;
      }
      return next;
    });
  }, [form.exames.length]);

  useEffect(() => {
    if (workspacePainel === "prescricao") {
      setPrescricaoModoFoco(true);
    }
  }, [workspacePainel]);

  useEffect(() => {
    if (protocoloPrescricaoSelecionado) return;
    if (!protocoloPrescricaoRecomendado) return;
    setProtocoloPrescricaoSelecionado(protocoloPrescricaoRecomendado.key);
  }, [protocoloPrescricaoRecomendado, protocoloPrescricaoSelecionado]);

  useEffect(() => {
    if (prescricaoValidacaoAtual.total === 0 && prescricaoErrosCount > 0) {
      setPrescricaoValidationErrors({});
    }
  }, [prescricaoErrosCount, prescricaoValidacaoAtual.total]);

  useEffect(() => {
    if (prescricaoErrosCount === 0) return;
    setPrescricaoValidationErrors(prescricaoValidacaoAtual.errors);
  }, [prescricaoErrosCount, prescricaoValidacaoAtual.errors]);

  const expandirTodosExames = () => {
    const next = examesVisiveis.reduce<Record<number, boolean>>((acc, item) => {
      acc[item.index] = true;
      return acc;
    }, {});
    setExamesExpandidos(next);
  };

  const colapsarTodosExames = () => {
    const next = examesVisiveis.reduce<Record<number, boolean>>((acc, item) => {
      acc[item.index] = false;
      return acc;
    }, {});
    setExamesExpandidos(next);
  };

  const removerExamesVazios = () => {
    const next = form.exames.filter((item) => {
      if ((item.tipo_exame || "").trim()) return true;
      if ((item.observacoes || "").trim()) return true;
      if ((item.resultado || "").trim()) return true;
      if ((item.preparo || "").trim()) return true;
      if (item.catalogo_exame_id || item.painel_exame_id) return true;
      if ((item.anexos_resultado || []).length > 0) return true;
      return false;
    });
    clearExamUploadDrafts();
    const finalList = next.length > 0 ? next : [emptyExam()];
    setField("exames", finalList);
    setExamesExpandidos({ 0: true });
  };

  const atendimentosVisiveis = filtered.slice(0, 12);
  const timelineGrupos = historicoPaciente?.timeline || [];
  const alertasAtivos = historicoPaciente?.alertas || [];
  const medicamentosCardiologicos = medicamentosCardiologiaLista.length;
  const itensPrescricaoAtivos = form.prescricao_itens.filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim());
  const autosaveLabel = useMemo(() => {
    if (autosaveState === "saving") return "Autosave em andamento";
    if (autosaveState === "dirty") return "Alteracoes pendentes";
    if (autosaveState === "local") {
      return autosaveAt ? `Rascunho local · ${formatDate(autosaveAt)}` : "Rascunho local";
    }
    if (autosaveState === "saved") {
      return autosaveAt ? `Sincronizado · ${formatDate(autosaveAt)}` : "Sincronizado";
    }
    if (autosaveState === "error") return "Falha no autosave";
    return selecionado ? "Aguardando edicao" : "Novo caso";
  }, [autosaveAt, autosaveState, selecionado]);

  const autosaveBadgeClass = useMemo(() => {
    if (autosaveState === "saving") return "border-sky-300/30 bg-sky-400/10 text-sky-100";
    if (autosaveState === "dirty") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
    if (autosaveState === "local") return "border-violet-300/30 bg-violet-400/10 text-violet-100";
    if (autosaveState === "saved") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
    if (autosaveState === "error") return "border-red-300/30 bg-red-400/10 text-red-100";
    return "border-white/10 bg-white/5 text-slate-200";
  }, [autosaveState]);
  const clinicalSectionLabels = useMemo(
    () =>
      CLINICAL_SECTION_OPTIONS.reduce<Record<string, string>>((acc, item) => {
        acc[item.key] = item.label;
        return acc;
      }, {}),
    []
  );
  const preenchimentoConsultaLabel =
    clinicalSummary.completeness >= 75
      ? "Consulta bem estruturada"
      : clinicalSummary.completeness >= 40
        ? "Consulta em consolidacao"
        : "Consulta em abertura";
  const mostrarResultadosBuscaPrescricao = Boolean(prescricaoEntradaModo || prescricaoBuscaRapida.trim());
  const removerItemPrescricao = (idx: number) => {
    if (form.prescricao_itens.length === 1) {
      // Limpa o único item em vez de remover
      setField("prescricao_itens", [emptyPrescriptionItem()]);
    } else {
      setField(
        "prescricao_itens",
        form.prescricao_itens.filter((_, itemIndex) => itemIndex !== idx)
      );
    }
  };
  const prescricaoTemRascunhoInicial =
    form.prescricao_itens.length === 1 &&
    isPrescriptionItemEmpty(form.prescricao_itens[0]);
  const renderPrescricaoItemCard = (item: PrescricaoItem, idx: number) => {
    const itemErrors = prescricaoValidationErrors[idx] || {};
    const sugestao = prescricaoSupport.itens[idx];
    const calculo = prescricaoCalculos[idx];
    const isUnico = form.prescricao_itens.length === 1;
    const medicamentoSelecionado =
      item.medicamento_id != null
        ? medicamentos.find((entry) => entry.id === item.medicamento_id) || null
        : null;
    const apresentacoesDisponiveis = sugestao?.apresentacoes || [];
    const sugestaoApresentacao = sugestao?.sugestaoApresentacao || null;
    const alertasItem = (sugestao?.alertas || []).map((alerta) => alerta.trim()).filter((alerta) => alerta.length > 0);
    const formulaManipulada = /(formula manipulada)/i.test(item.medicamento_nome || "");
    const ativo = Boolean(item.medicamento_id || (item.medicamento_nome || "").trim());
    const inputClass = (campo?: PrescricaoCampoObrigatorio) =>
      `w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100 ${
        campo && itemErrors[campo] ? "border-rose-300 ring-4 ring-rose-100" : "border-slate-200"
      }`;
    const resumoApresentacao =
      item.apresentacao_selecionada ||
      (apresentacoesDisponiveis.length > 0 ? `${apresentacoesDisponiveis.length} opcao(oes) disponivel(is)` : "Sem apresentacao estruturada");

    return (
      <article
        key={`${idx}-${item.id || "novo"}`}
        className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.32)]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                Item {idx + 1}
              </span>
              {formulaManipulada ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                  Formula manipulada
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                  Produto industrializado
                </span>
              )}
              {medicamentoSelecionado?.parametrizado ? (
                <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-medium text-teal-800">
                  Parametrizado
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {item.medicamento_nome || "Novo item de prescricao"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {medicamentoSelecionado?.classe_terapeutica || "Classe nao informada"}
              {medicamentoSelecionado?.principio_ativo ? ` · ${medicamentoSelecionado.principio_ativo}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ativo && Object.keys(itemErrors).length > 0 ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                {Object.keys(itemErrors).length} pendencia(s)
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                {ativo ? "Pronto para revisar" : "Aguardando definicao"}
              </span>
            )}
            <button
              type="button"
              onClick={() => removerItemPrescricao(idx)}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              {isUnico ? "Limpar" : "Remover"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1.7fr),320px]">
          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Medicamento da biblioteca
                </label>
                <select
                  value={item.medicamento_id || ""}
                  onChange={(e) => aplicarMedicamentoNaPrescricao(idx, e.target.value ? Number(e.target.value) : null)}
                  className={inputClass("medicamento_nome")}
                >
                  <option value="">Selecionar medicamento</option>
                  {medicamentos.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Nome exibido na receita
                </label>
                <input
                  value={item.medicamento_nome}
                  onChange={(e) => updatePrescricaoItem(idx, { medicamento_nome: e.target.value })}
                  placeholder="Ex.: Pimobendan, Vetmedin ou formula personalizada"
                  className={inputClass("medicamento_nome")}
                />
                {itemErrors.medicamento_nome ? <p className="mt-1.5 text-xs text-rose-600">{itemErrors.medicamento_nome}</p> : null}
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Apresentacao e concentracao
                </label>
                {medicamentoSelecionado ? (
                  apresentacoesDisponiveis.length > 0 ? (
                    <select
                      value={item.apresentacao_selecionada || ""}
                      onChange={(e) => updatePrescricaoItem(idx, { apresentacao_selecionada: e.target.value })}
                      className={inputClass()}
                    >
                      <option value="">Selecionar apresentacao comercial</option>
                      {apresentacoesDisponiveis.map((apresentacao) => (
                        <option key={apresentacao.key} value={apresentacao.label}>
                          {apresentacao.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Este cadastro ainda nao tem apresentacoes estruturadas para sugestao comercial.
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Selecione um medicamento para habilitar as apresentacoes disponiveis.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleFormulaManipuladaPrescricao(idx)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                  formulaManipulada
                    ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Pill className="h-4 w-4" />
                {formulaManipulada ? "Voltar para apresentacao comercial" : "Marcar como formula manipulada"}
              </button>
              {item.medicamento_id ? (
                <button
                  type="button"
                  onClick={() => {
                    if (medicamentoSelecionado) duplicarMedicamentoManipulado(medicamentoSelecionado);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <Save className="h-4 w-4" />
                  Salvar formula na biblioteca
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Dose</label>
                <input
                  value={item.dose}
                  onChange={(e) => updatePrescricaoItem(idx, { dose: e.target.value })}
                  placeholder="Ex.: 1/2 comprimido ou 3,5 mg"
                  className={inputClass("dose")}
                />
                {itemErrors.dose ? <p className="mt-1.5 text-xs text-rose-600">{itemErrors.dose}</p> : null}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Frequencia</label>
                <input
                  value={item.frequencia}
                  onChange={(e) => updatePrescricaoItem(idx, { frequencia: e.target.value })}
                  placeholder="Ex.: a cada 12h"
                  className={inputClass("frequencia")}
                />
                {itemErrors.frequencia ? <p className="mt-1.5 text-xs text-rose-600">{itemErrors.frequencia}</p> : null}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Duracao</label>
                <input
                  value={item.duracao}
                  onChange={(e) => updatePrescricaoItem(idx, { duracao: e.target.value })}
                  placeholder="Opcional"
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Via</label>
                <input
                  value={item.via}
                  onChange={(e) => updatePrescricaoItem(idx, { via: e.target.value })}
                  placeholder="Ex.: Oral"
                  className={inputClass("via")}
                />
                {itemErrors.via ? <p className="mt-1.5 text-xs text-rose-600">{itemErrors.via}</p> : null}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Instrucoes especificas
              </label>
              <textarea
                value={item.instrucoes}
                onChange={(e) => updatePrescricaoItem(idx, { instrucoes: e.target.value })}
                placeholder="Observacoes adicionais para tutor, farmacia ou revisao interna."
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Resumo tecnico</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Principio ativo</p>
                  <p className="mt-1 font-medium text-slate-900">{medicamentoSelecionado?.principio_ativo || "Nao informado"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Apresentacao</p>
                  <p className="mt-1 font-medium text-slate-900">{resumoApresentacao}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Via</p>
                    <p className="mt-1 font-medium text-slate-900">{item.via || medicamentoSelecionado?.via_padrao || "Nao definida"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Frequencia</p>
                    <p className="mt-1 font-medium text-slate-900">{item.frequencia || "Em aberto"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-teal-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Calculo guiado da dose</p>
              </div>
              <div className="mt-4 grid gap-2">
                <input
                  value={item.dose_mg_kg || ""}
                  onChange={(e) => updatePrescricaoItem(idx, { dose_mg_kg: e.target.value })}
                  placeholder="Dose mg/kg"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100"
                />
                <input
                  value={item.peso_referencia_kg || ""}
                  onChange={(e) => updatePrescricaoItem(idx, { peso_referencia_kg: e.target.value })}
                  placeholder={`Peso kg (${form.triagem.peso || "-"})`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100"
                />
                <select
                  value={item.unidade_dose_calculo || "mg"}
                  onChange={(e) =>
                    updatePrescricaoItem(idx, {
                      unidade_dose_calculo: e.target.value as "mg" | "ml" | "comprimido",
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100"
                >
                  <option value="mg">mg</option>
                  <option value="ml">mL</option>
                  <option value="comprimido">comprimido</option>
                </select>
                <input
                  value={item.concentracao_personalizada || ""}
                  onChange={(e) => updatePrescricaoItem(idx, { concentracao_personalizada: e.target.value })}
                  disabled={(item.unidade_dose_calculo || "mg") === "mg"}
                  placeholder={
                    (item.unidade_dose_calculo || "mg") === "ml"
                      ? "Concentracao mg/mL"
                      : (item.unidade_dose_calculo || "mg") === "comprimido"
                        ? "Concentracao mg/comprimido"
                        : "Sem concentracao"
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="mt-4 rounded-[20px] border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                {calculo.doseTotalMg ? (
                  <>
                    <p>
                      Resultado: <span className="font-semibold">{calculo.doseTotalMg.toFixed(2)} mg por dose</span>
                      {calculo.unidade === "ml" && calculo.volumeMl ? ` · ${calculo.volumeMl.toFixed(2)} mL` : ""}
                      {calculo.unidade === "comprimido" && calculo.comprimidos ? ` · ${calculo.comprimidos.toFixed(2)} comprimido(s)` : ""}
                    </p>
                    <p className="mt-1 text-xs text-teal-700">
                      Base: {calculo.doseMgKg?.toFixed(3)} mg/kg · {calculo.pesoKg?.toFixed(2)} kg
                      {calculo.concentracao ? ` · concentracao ${calculo.concentracao}` : ""}
                    </p>
                  </>
                ) : (
                  <p>Informe dose e peso para habilitar o calculo automatico.</p>
                )}
                <button
                  type="button"
                  onClick={() => aplicarCalculoNaDose(idx, calculo)}
                  disabled={!calculo.doseTotalMg}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aplicar calculo
                </button>
              </div>
            </div>

            {sugestao?.doseSugerida ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                <p className="font-semibold">Dose sugerida automatica</p>
                <p className="mt-1">{sugestao.doseSugerida}</p>
                {sugestao.detalhe ? <p className="mt-1 text-xs text-emerald-700">{sugestao.detalhe}</p> : null}
                <button
                  type="button"
                  onClick={() =>
                    updatePrescricaoItem(idx, {
                      dose: item.dose || sugestao.doseSugerida,
                    })
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  Aplicar dose sugerida
                </button>
              </div>
            ) : null}

            {sugestaoApresentacao ? (
              <div
                className={`rounded-[24px] border px-4 py-4 text-sm ${
                  sugestaoApresentacao.requerManipulacao
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-sky-200 bg-sky-50 text-sky-900"
                }`}
              >
                <p className="font-semibold">
                  {sugestaoApresentacao.requerManipulacao ? "Apresentacao comercial nao viavel" : "Apresentacao sugerida"}
                </p>
                <p className="mt-1">{sugestaoApresentacao.resumo}</p>
                {sugestaoApresentacao.detalhe ? (
                  <p className="mt-1 text-xs text-current/80">{sugestaoApresentacao.detalhe}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => aplicarSugestaoApresentacaoNaPrescricao(idx, sugestaoApresentacao)}
                  className={`mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white transition ${
                    sugestaoApresentacao.requerManipulacao ? "bg-amber-600 hover:bg-amber-700" : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  {sugestaoApresentacao.requerManipulacao ? "Usar formula manipulada" : "Aplicar apresentacao"}
                </button>
              </div>
            ) : null}

            {alertasItem.length > 0 ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">Alertas clinicos do item</p>
                <div className="mt-3 space-y-2">
                  {alertasItem.map((alerta) => (
                    <p
                      key={alerta}
                      className={`rounded-xl border px-3 py-2 ${getAlertaPrescricaoClass(classificarAlertaPrescricao(alerta))}`}
                    >
                      {alerta}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {item.historico_ajustes && item.historico_ajustes.length > 0 ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Historico de ajustes</p>
                </div>
                <div className="mt-3 space-y-2">
                  {item.historico_ajustes.slice(0, 4).map((ajuste) => (
                    <div key={ajuste.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 capitalize">{ajuste.campo}</span>
                        <span className="text-slate-400">{formatDate(ajuste.created_at)}</span>
                      </div>
                      <div className="mt-1 text-slate-500">
                        {ajuste.valor_anterior || "-"} <span className="mx-1 text-slate-400">→</span> {ajuste.valor_novo || "-"}
                      </div>
                      {(ajuste.responsavel_nome || ajuste.motivo) && (
                        <div className="mt-1 text-slate-400">
                          {ajuste.responsavel_nome && <span>{ajuste.responsavel_nome}</span>}
                          {ajuste.responsavel_nome && ajuste.motivo && <span className="mx-1">·</span>}
                          {ajuste.motivo && <span>{ajuste.motivo}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {ativo && Object.keys(itemErrors).length > 0 ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Corrija os campos obrigatorios deste item para liberar a receita.
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const dismissErrorPopup = () => {
    if (typeof window !== "undefined" && erroPopupTimeoutRef.current) {
      window.clearTimeout(erroPopupTimeoutRef.current);
      erroPopupTimeoutRef.current = null;
    }
    setErroPopup(null);
    setErro("");
  };

  const dismissSuccessPopup = () => {
    if (typeof window !== "undefined" && sucessoPopupTimeoutRef.current) {
      window.clearTimeout(sucessoPopupTimeoutRef.current);
      sucessoPopupTimeoutRef.current = null;
    }
    setSucessoPopup(null);
    setSucesso("");
  };

  if (loading) {
    return <DashboardLayout><div className="p-6 text-gray-600">Carregando modulo de atendimento...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 bg-slate-50 p-6">
        <div className="fixed right-4 top-4 z-[90] flex max-w-md flex-col gap-2">
          {erroPopup ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-xl">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 font-medium leading-5">{erroPopup}</p>
              <button
                type="button"
                onClick={dismissErrorPopup}
                className="rounded-md border border-red-200 bg-white px-1.5 py-1 text-red-600 transition hover:bg-red-100"
                aria-label="Fechar aviso de erro"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {sucessoPopup ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-xl">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 font-medium leading-5">{sucessoPopup}</p>
              <button
                type="button"
                onClick={dismissSuccessPopup}
                className="rounded-md border border-emerald-200 bg-white px-1.5 py-1 text-emerald-600 transition hover:bg-emerald-100"
                aria-label="Fechar aviso de sucesso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        <section className="overflow-visible rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 px-6 py-6 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                    <ClipboardPlus className="h-7 w-7 text-teal-200" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-teal-200/80">Prontuario FortCordis</p>
                    <h1 className="text-3xl font-semibold tracking-tight">Atendimento Clinico</h1>
                  </div>
                </div>
                <p className="text-sm text-slate-200/80">
                  Fluxo clinico continuo com contexto do paciente, timeline lateral e prescricao assistida em destaque.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className={`rounded-2xl border px-4 py-2 text-xs font-medium ${autosaveBadgeClass}`}>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    {autosaveLabel}
                  </span>
                </div>
                <button onClick={novoAtendimento} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
                  <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Novo caso</span>
                </button>
                <button
                  onClick={() =>
                    goLaudo({
                      id: selecionado,
                      paciente_id: Number(form.paciente_id || 0),
                      clinica_id: Number(form.clinica_id || 0),
                      agendamento_id: form.agendamento_id ? Number(form.agendamento_id) : null,
                    })
                  }
                  className="rounded-2xl bg-sky-400/20 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/30"
                >
                  <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />Laudar</span>
                </button>
                <button
                  onClick={() => void saveAtendimento()}
                  disabled={salvando}
                  className="rounded-2xl bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2"><Save className="h-4 w-4" />{salvando ? "Salvando..." : "Salvar atendimento"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-300">Paciente</p>
                <p className="mt-2 text-sm font-medium text-white">{pacienteSelecionado?.nome || "Nao selecionado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-300">Tutor</p>
                <p className="mt-2 text-sm font-medium text-white">{pacienteSelecionado?.tutor || "Nao informado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-300">Peso clinico</p>
                <p className="mt-2 text-sm font-medium text-white">{form.triagem.peso ? `${form.triagem.peso} kg` : "Nao medido"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-300">Alertas ativos</p>
                <p className="mt-2 text-sm font-medium text-white">{alertasAtivos.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Navegacao do atendimento</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Fluxo por area clinica</h2>
            </div>
            <p className="text-sm text-slate-500">Mostrando: <span className="font-semibold text-slate-700">{workspaceCards.find((item) => item.key === workspacePainel)?.titulo}</span></p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            {workspaceCards.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setWorkspacePainel(item.key)}
                className={`rounded-[20px] border px-4 py-3 text-left transition ${
                  workspacePainel === item.key
                    ? "border-teal-300 bg-teal-50 shadow-sm"
                    : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.resumo}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    workspacePainel === item.key ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {item.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className={isPrescricaoWorkspace ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 gap-6 xl:grid-cols-12"}>
          {!isPrescricaoWorkspace ? (
          <div className="self-start xl:col-span-3">
            <div className="space-y-6 xl:sticky xl:top-6">
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Painel de casos</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">Atendimentos recentes</h2>
                  </div>
                  <button onClick={carregarLista} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200">
                    <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Atualizar</span>
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar atendimento..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900" />
                  </div>
                  <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                    <option value="">Todos os status</option>
                    {STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>

                <div className="mt-4 max-h-[380px] space-y-3 overflow-auto pr-1">
                  {atendimentosVisiveis.map((item) => (
                    <div key={item.id} className={`rounded-[22px] border p-4 transition ${selecionado === item.id ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50/80 hover:bg-white"}`}>
                      <button onClick={() => abrirAtendimento(item.id)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">#{item.id} · {item.paciente_nome || "Paciente"}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.tutor_nome || "Tutor nao informado"}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getBadgeStatusClass(item.status)}`}>{item.status}</span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{formatDate(item.data_atendimento)}</p>
                        <p className="mt-1 text-sm text-slate-700">{item.diagnostico || item.queixa_principal || "Sem resumo clinico"}</p>
                      </button>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => goLaudo({ ...item, atendimento_id: item.id })} className="rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-200">Laudar</button>
                        <button onClick={() => deleteAtendimento(item.id)} className="rounded-xl bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-200">Excluir</button>
                      </div>
                    </div>
                  ))}
                  {atendimentosVisiveis.length === 0 ? <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">Nenhum atendimento encontrado.</div> : null}
                </div>
              </section>

              {isConsultaWorkspace || isDocumentosWorkspace ? (
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-teal-600" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Prontuario longitudinal</p>
                    <h2 className="text-lg font-semibold text-slate-900">Linha do tempo</h2>
                  </div>
                </div>
                {timelineGrupos.length > 0 ? (
                  <div className="mt-5 max-h-[520px] space-y-6 overflow-auto pr-1">
                    {timelineGrupos.map((grupo) => (
                      <div key={grupo.ano} className="relative pl-6">
                        <div className="absolute left-[10px] top-0 h-full w-px bg-slate-200" />
                        <div className="absolute left-0 top-1 h-5 w-5 rounded-full border-4 border-teal-100 bg-teal-500" />
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">{grupo.ano}</p>
                        <div className="mt-3 space-y-3">
                          {grupo.eventos.map((evento) => (
                            <div key={`${grupo.ano}-${evento.tipo}-${evento.referencia_id}`} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{evento.titulo}</p>
                                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{evento.tipo}</p>
                                </div>
                                <span className="text-[11px] text-slate-500">{formatDate(evento.data)}</span>
                              </div>
                              <p className="mt-2 text-sm text-slate-700">{evento.descricao}</p>
                              {evento.status ? <p className="mt-2 text-xs text-slate-500">Status: {evento.status}</p> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                    A linha do tempo sera montada assim que houver historico clinico para o paciente.
                  </div>
                )}
              </section>
              ) : null}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Monitoramento clinico</p>
                    <h2 className="text-lg font-semibold text-slate-900">Dinamica de peso</h2>
                  </div>
                </div>
                {pesoSerie.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Peso atual</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {pesoAtualPonto ? `${pesoAtualPonto.peso.toFixed(2)} kg` : "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Variacao</p>
                        <p
                          className={`mt-1 text-lg font-semibold ${
                            pesoDelta === null
                              ? "text-slate-700"
                              : pesoDelta > 0
                                ? "text-amber-700"
                                : pesoDelta < 0
                                  ? "text-emerald-700"
                                  : "text-slate-700"
                          }`}
                        >
                          {pesoDelta === null ? "-" : `${pesoDelta > 0 ? "+" : ""}${pesoDelta.toFixed(2)} kg`}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">Evolucao</p>
                        <p className="text-[11px] text-slate-500">{pesoSerie.length} registro(s)</p>
                      </div>
                      <svg viewBox="0 0 100 60" className="mt-2 h-20 w-full">
                        <rect x="0" y="0" width="100" height="60" rx="8" className="fill-white" />
                        <polyline
                          points={pesoSparkline}
                          fill="none"
                          stroke="rgb(16 185 129)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {pesoSparkline ? (
                          <circle
                            cx={pesoSerie.length === 1 ? 50 : 100}
                            cy={(() => {
                              const valores = pesoSerie.map((item) => item.peso);
                              const min = Math.min(...valores);
                              const max = Math.max(...valores);
                              const range = max - min || 1;
                              const atual = pesoSerie[pesoSerie.length - 1].peso;
                              return 56 - ((atual - min) / range) * 44;
                            })()}
                            r="2.5"
                            fill="rgb(5 150 105)"
                          />
                        ) : null}
                      </svg>
                    </div>

                    <div className="space-y-2">
                      {pesoSerie
                        .slice()
                        .reverse()
                        .slice(0, 4)
                        .map((item) => (
                          <div key={`${item.atendimento_id}-${item.data_atendimento}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{item.peso.toFixed(2)} kg</p>
                            <p className="text-xs text-slate-500">{formatDate(item.data_atendimento)}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                    Registre o peso na triagem para iniciar a curva de acompanhamento.
                  </div>
                )}
              </section>
            </div>
          </div>
          ) : null}

          <div className={isPrescricaoWorkspace ? "" : "xl:col-span-9"}>
            <div className={workspaceGridClass}>
              <div className="space-y-6">
                {!isPrescricaoWorkspace ? (
                <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-teal-50 p-3">
                        <User className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Contexto do paciente</p>
                        <h2 className="text-lg font-semibold text-slate-900">Cabecalho clinico</h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="relative md:col-span-2">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={pacienteBusca}
                          onChange={(e) => {
                            setPacienteBusca(e.target.value);
                            const nextValue = e.target.value;
                            setMostrarPacientes(nextValue.trim().length >= 2);
                            if (!nextValue.trim()) {
                              setField("paciente_id", "");
                              setMostrarPacientes(false);
                            }
                          }}
                          onFocus={() => {
                            if (pacienteDropdownBlurTimeoutRef.current) {
                              window.clearTimeout(pacienteDropdownBlurTimeoutRef.current);
                            }
                            if (pacienteBusca.trim().length >= 2) {
                              setMostrarPacientes(true);
                            }
                          }}
                          onBlur={() => {
                            if (pacienteDropdownBlurTimeoutRef.current) {
                              window.clearTimeout(pacienteDropdownBlurTimeoutRef.current);
                            }
                            pacienteDropdownBlurTimeoutRef.current = window.setTimeout(() => {
                              setMostrarPacientes(false);
                            }, 120);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setMostrarPacientes(false);
                            }
                          }}
                          placeholder="Buscar paciente ou tutor..."
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm text-slate-900"
                        />
                        {pacienteDropdownAberto ? (
                          <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                            {pacientesFiltrados.map((paciente) => (
                              <button
                                key={paciente.id}
                                type="button"
                                onClick={() => selecionarPaciente(paciente)}
                                className={`w-full rounded-2xl px-3 py-3 text-left transition hover:bg-teal-50 ${
                                  String(paciente.id) === form.paciente_id ? "bg-teal-50" : ""
                                }`}
                              >
                                <span className="block text-sm font-medium text-slate-900">{paciente.nome}</span>
                                <span className="block text-xs text-slate-500">{paciente.tutor || "Tutor nao informado"}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">Digite pelo menos 2 letras para buscar pacientes e tutores.</p>
                      </div>
                      <select value={form.clinica_id} onChange={(e) => setField("clinica_id", e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"><option value="">Clinica</option>{clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                      <input type="datetime-local" value={form.data_atendimento} onChange={(e) => setField("data_atendimento", e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                      <input value={form.agendamento_id} onChange={(e) => setField("agendamento_id", e.target.value)} placeholder="Agendamento ID" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400" />
                      <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">{STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Paciente</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{pacienteSelecionado?.nome || "Nao selecionado"}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Tutor</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{pacienteSelecionado?.tutor || "Nao informado"}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Especie / raca</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{historicoPaciente ? `${historicoPaciente.paciente.especie || "-"} · ${historicoPaciente.paciente.raca || "-"}` : "Nao informadas"}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Status do caso</p>
                        <p className="mt-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getBadgeStatusClass(form.status)}`}>{form.status || "Triagem"}</span></p>
                      </div>
                    </div>
                  </div>
                </section>
                ) : null}

                {!isPrescricaoWorkspace ? (
                <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-rose-50 p-3">
                      <Heart className="h-5 w-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Fluxo clinico</p>
                      <h2 className="text-lg font-semibold text-slate-900">Jornada do atendimento</h2>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {fluxoClinico.map((etapa, index) => (
                      <button
                        key={etapa.id}
                        type="button"
                        onClick={() => setWorkspacePainel(etapa.id === "exames" ? "exames" : etapa.id === "prescricao" ? "prescricao" : "consulta")}
                        className={`rounded-[22px] border px-4 py-4 text-left transition ${etapa.concluido ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Etapa {index + 1}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${etapa.concluido ? "bg-emerald-200 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                            {etapa.concluido ? "Concluida" : "Em aberto"}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-slate-900">{etapa.titulo}</p>
                        <p className="mt-1 text-sm text-slate-600">{etapa.descricao}</p>
                      </button>
                    ))}
                  </div>
                </section>
                ) : null}

            {isConsultaWorkspace ? (
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Thermometer className="w-4 h-4 text-blue-600" />Triagem - Sinais Vitais</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTriagemExpandida((prev) => !prev)}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                    >
                      {triagemExpandida ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.triagem_concluida === 1} onChange={(e) => setField("triagem_concluida", e.target.checked ? 1 : 0)} className="w-4 h-4" />
                      Triagem Concluida
                    </label>
                  </div>
                </div>
                {triagemExpandida ? (
                <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Peso (kg)</label>
                    <input type="number" step="0.1" value={form.triagem.peso ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, peso: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Temperatura (°C)</label>
                    <input type="number" step="0.1" value={form.triagem.temperatura ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, temperatura: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">FC (bpm)</label>
                    <input type="number" value={form.triagem.frequencia_cardiaca ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, frequencia_cardiaca: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Batimentos" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">FR (mpm)</label>
                    <input type="number" value={form.triagem.frequencia_respiratoria ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, frequencia_respiratoria: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Movimentos" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Pressao Arterial</label>
                    <input value={form.triagem.pressao_arterial} onChange={(e) => setField("triagem", { ...form.triagem, pressao_arterial: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="mmHg" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">SpO2 (%)</label>
                    <input type="number" value={form.triagem.saturacao_oxigenio ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, saturacao_oxigenio: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="%" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Escore Condicao Corporal</label>
                    <select value={form.triagem.escore_condicion_corpo ?? ""} onChange={(e) => setField("triagem", { ...form.triagem, escore_condicion_corpo: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">Selecione</option>
                      {ESCALA_ECC.map((e) => <option key={e} value={e}>{e} - {e <= 3 ? "Magro" : e <= 5 ? "Ideal" : "Obeso"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Mucosas</label>
                    <select value={form.triagem.mucosas} onChange={(e) => setField("triagem", { ...form.triagem, mucosas: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">Selecione</option>
                      {MUCOSAS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hidratacao</label>
                    <select value={form.triagem.hidratacao} onChange={(e) => setField("triagem", { ...form.triagem, hidratacao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">Selecione</option>
                      {HIDRATACAO.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Observacoes da Triagem</label>
                  <textarea value={form.triagem.triagem_observacoes} onChange={(e) => setField("triagem", { ...form.triagem, triagem_observacoes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Observacoes adicionais da triagem..." />
                </div>
                </>
                ) : (
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Peso {form.triagem.peso ?? "-"} kg · FC {form.triagem.frequencia_cardiaca ?? "-"} bpm · FR {form.triagem.frequencia_respiratoria ?? "-"} mpm · PA {form.triagem.pressao_arterial || "-"}
                  </div>
                )}
            </section>
            ) : null}

            {isConsultaWorkspace ? (
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-teal-50 p-3">
                        <Stethoscope className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Editor clinico guiado</p>
                        <h3 className="text-lg font-semibold text-slate-900">Consulta medica</h3>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Estado da edicao</p>
                        <p className="mt-1 font-medium text-slate-900">{autosaveLabel}</p>
                      </div>
                      <label className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.consulta_concluida === 1}
                          onChange={(e) => setField("consulta_concluida", e.target.checked ? 1 : 0)}
                          className="h-4 w-4"
                        />
                        Consulta concluida
                      </label>
                      {consultaEtapasCompletas ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          Marcacao automatica ativa (etapas 100%)
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-12">
                    <div className="xl:col-span-8 rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Resumo automatico do caso</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{clinicalSummary.headline}</p>
                      {clinicalSummary.highlights.length > 0 ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {clinicalSummary.highlights.slice(0, 4).map((item) => (
                            <div key={item.label} className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
                              <p className="mt-2 text-sm text-slate-700">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="xl:col-span-4 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Fechamento clinico</p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Prognostico</label>
                          <select
                            value={form.diagnostico.prognostico}
                            onChange={(e) => setField("diagnostico", { ...form.diagnostico, prognostico: e.target.value })}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                          >
                            <option value="">Selecione</option>
                            {PROGNOSTICO.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Cobertura do prontuario</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{clinicalSummary.completeness}%</p>
                          <p className="mt-1 text-sm text-slate-600">do editor clinico preenchido</p>
                        </div>

                        {clinicalSummary.pending.length > 0 ? (
                          <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700">Pendencias</p>
                            <div className="mt-3 space-y-2 text-sm text-amber-900">
                              {clinicalSummary.pending.map((item) => (
                                <p key={item}>{item}</p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            Consulta bem estruturada. O prontuario ja tem base suficiente para historico e retorno.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Etapas do editor clinico</p>
                        <p className="mt-1 text-sm text-slate-700">Mostrando um bloco por vez para reduzir rolagem.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {consultaEditorEtapas.find((etapa) => etapa.key === consultaEditorEtapa)?.titulo || "Anamnese e exame"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {consultaEditorEtapas.map((etapa) => {
                        const ativa = consultaEditorEtapa === etapa.key;
                        const restante = Math.max(etapa.total - etapa.preenchidos, 0);
                        return (
                          <button
                            key={etapa.key}
                            type="button"
                            onClick={() => setConsultaEditorEtapa(etapa.key)}
                            className={`rounded-2xl border px-3 py-3 text-left transition ${
                              etapa.concluidaAuto
                                ? ativa
                                  ? "border-emerald-400 bg-emerald-100/80"
                                  : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70"
                                : ativa
                                  ? "border-teal-300 bg-teal-50"
                                  : "border-slate-200 bg-white hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{etapa.titulo}</p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  etapa.concluidaAuto
                                    ? "bg-emerald-600 text-white"
                                    : ativa
                                      ? "bg-teal-600 text-white"
                                      : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {etapa.percentual}%
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{etapa.descricao}</p>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  etapa.concluidaAuto ? "bg-emerald-500" : "bg-teal-500"
                                }`}
                                style={{ width: `${etapa.percentual}%` }}
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <p className="text-[11px] font-medium text-slate-600">
                                {etapa.preenchidos}/{etapa.total} campos
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                                  etapa.concluidaAuto
                                    ? "bg-emerald-200 text-emerald-800"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {etapa.concluidaAuto ? "Concluida" : `${restante} pendente(s)`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Campos da etapa</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {consultaCampoAtivoConfig?.title || "Selecione um campo"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Atalhos: Alt + Shift + esquerda/direita para navegar e Ctrl/Cmd + Enter para avancar. Campo com texto = concluido automaticamente.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={goToConsultaCampoAnterior}
                          disabled={consultaCampoAtivoIndex <= 0}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Campo anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {Math.max(consultaCampoAtivoIndex + 1, 1)}/
                          {Math.max(consultaEditorCamposVisiveis.length, 1)}
                        </span>
                        <button
                          type="button"
                          onClick={goToConsultaCampoProximo}
                          disabled={consultaCampoAtivoIndex >= consultaEditorCamposVisiveis.length - 1}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Proximo campo"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {consultaEditorCamposVisiveis.map((config) => {
                        const value = getClinicalFieldValue(config.key);
                        const linhas = value.trim() ? value.split("\n").length : 0;
                        const concluido = linhas > 0;
                        const ativo = consultaCampoAtivoConfig?.key === config.key;
                        return (
                          <button
                            key={config.key}
                            type="button"
                            onClick={() => setConsultaCampoAtivo(config.key)}
                            className={`rounded-xl border px-3 py-2 text-left transition ${
                              ativo
                                ? concluido
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : "border-teal-300 bg-teal-50 text-teal-900"
                                : concluido
                                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {concluido ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                              {config.title}
                            </span>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                concluido
                                  ? "bg-emerald-200 text-emerald-800"
                                  : ativo
                                    ? "bg-teal-200 text-teal-800"
                                    : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {concluido ? `Concluido · ${linhas} linha(s)` : "Em aberto"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {consultaCampoAtivoConfig ? (
                    <ClinicalFieldCard
                      key={consultaCampoAtivoConfig.key}
                      config={consultaCampoAtivoConfig}
                      value={getClinicalFieldValue(consultaCampoAtivoConfig.key)}
                      onChange={(value) => setClinicalFieldValue(consultaCampoAtivoConfig.key, value)}
                      onInsertPhrase={(text) => injectClinicalSnippet(consultaCampoAtivoConfig.key, text)}
                      onInsertScaffold={(text) => injectClinicalSnippet(consultaCampoAtivoConfig.key, text)}
                      onClear={() => setClinicalFieldValue(consultaCampoAtivoConfig.key, "")}
                      textareaRef={registerClinicalTextarea(consultaCampoAtivoConfig.key)}
                      onTextareaKeyDown={handleConsultaTextareaKeyDown}
                      className="w-full"
                    />
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                      Nenhum campo clinico disponivel para a etapa selecionada.
                    </div>
                  )}
                </div>
            </section>
            ) : null}

            {isExamesWorkspace ? (
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" />Solicitacao de exames</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={imprimirSolicitacaoExames} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Printer className="w-4 h-4" />Imprimir</button>
                  <button type="button" onClick={() => baixarPdfAtendimento("exames")} disabled={!hasExamRequest || salvando || Boolean(gerandoPdfTipo)} className="text-sm px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"><Download className="w-4 h-4" />{gerandoPdfTipo === "exames" ? "Gerando..." : "Gerar PDF"}</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Solicitados</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{resumoExamesFluxo.solicitados}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">Sem arquivo</p>
                  <p className="mt-1 text-lg font-semibold text-amber-900">{resumoExamesFluxo.aguardando_arquivo}</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-sky-700">Com arquivo</p>
                  <p className="mt-1 text-lg font-semibold text-sky-900">{resumoExamesFluxo.arquivo_anexado}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">Interpretados</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-900">{resumoExamesFluxo.interpretado}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {EXAME_FILTRO_OPCOES.map((filtro) => {
                    const ativo = exameFiltroRapido === filtro.key;
                    return (
                      <button
                        key={filtro.key}
                        type="button"
                        onClick={() => setExameFiltroRapido(filtro.key)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                          ativo ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {filtro.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={expandirTodosExames}
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Expandir todos
                  </button>
                  <button
                    type="button"
                    onClick={colapsarTodosExames}
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Colapsar todos
                  </button>
                  <button
                    type="button"
                    onClick={removerExamesVazios}
                    className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200"
                  >
                    Remover vazios
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr),260px,auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={exameBusca}
                      onChange={(e) => setExameBusca(e.target.value)}
                      placeholder="Buscar exame por nome, categoria ou sinonimo..."
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-3 text-sm text-slate-900"
                    />
                    {exameBusca.trim() && examesCatalogoFiltrados.length > 0 ? (
                      <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {examesCatalogoFiltrados.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => adicionarExameDoCatalogo(item)}
                            className="w-full rounded-2xl px-3 py-3 text-left transition hover:bg-sky-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{item.nome}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.categoria}{item.subcategoria ? ` · ${item.subcategoria}` : ""}</p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">Catalogo</span>
                            </div>
                            {item.preparo ? <p className="mt-2 text-xs text-slate-500">Preparo: {item.preparo}</p> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <select
                    value={painelExameSelecionado}
                    onChange={(e) => setPainelExameSelecionado(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    <option value="">Selecionar painel de exames</option>
                    {paineisExames.map((painel) => (
                      <option key={painel.id} value={painel.id}>{painel.nome}</option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={aplicarPainelExames}
                      disabled={!painelExameAtual}
                      className="text-sm px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Aplicar painel
                    </button>
                    <button
                      onClick={() => {
                        const nextIndex = form.exames.length;
                        setExameFiltroRapido("todos");
                        setField("exames", [...form.exames, emptyExam()]);
                        setExamesExpandidos((prev) => ({ ...prev, [nextIndex]: true }));
                      }}
                      className="text-sm px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />Exame manual
                    </button>
                  </div>
                </div>

                {painelExameAtual ? (
                  <div className="mt-3 rounded-[20px] border border-blue-200 bg-blue-50 px-4 py-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-blue-900">{painelExameAtual.nome}</p>
                        <p className="text-xs text-blue-700">{painelExameAtual.observacoes || `${painelExameAtual.itens.length} exame(s) parametrizados.`}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700">{painelExameAtual.itens.length} itens</span>
                    </div>
                  </div>
                ) : null}
              </div>

                <div className="space-y-3">
                {examesVisiveis.map(({ exame, index, anexosResultado, flowStatus }) => {
                  const exameExpandido = examesExpandidos[index] ?? index === 0;
                  const exameUploadKey = `exame-${index}`;
                  const exameEmUpload = uploadingAttachmentKey === exameUploadKey;
                  const exameUploadProgress = uploadProgressByKey[exameUploadKey] ?? null;
                  const examDropzoneId = `exame-upload-${index}`;
                  const uploadDraft = examUploadDrafts[index] || null;
                  const dropAtivo = examDropActive[index] || false;
                  const flowMeta = EXAME_STATUS_META[flowStatus];
                  return (
                    <div key={`${index}-${exame.id || "novo"}`} className={`rounded-[22px] border p-4 ${flowMeta.cardClass}`}>
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex flex-wrap gap-2">
                            {exame.categoria_exame ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">{exame.categoria_exame}</span> : null}
                            {exame.painel_exame_nome ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700">{exame.painel_exame_nome}</span> : null}
                            {exame.catalogo_exame_id ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Catalogo</span> : null}
                            {exame.data_solicitacao ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">Solicitado em {formatDate(exame.data_solicitacao)}</span> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExamesExpandidos((prev) => {
                                  const atual = prev[index] ?? index === 0;
                                  return { ...prev, [index]: !atual };
                                })
                              }
                              className="self-start rounded-xl bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                            >
                              {exameExpandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${flowMeta.chipClass}`}>
                              {flowMeta.label}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                goLaudo({
                                  id: selecionado,
                                  paciente_id: Number(form.paciente_id || 0),
                                  clinica_id: Number(form.clinica_id || 0),
                                  agendamento_id: form.agendamento_id ? Number(form.agendamento_id) : null,
                                })
                              }
                              disabled={!form.paciente_id}
                              className="self-start rounded-xl bg-sky-100 px-3 py-2 text-sky-700 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" />Laudar</span>
                            </button>
                            <button
                              onClick={() => {
                                clearExamUploadDraft(index);
                                clearExamDropState(index);
                                const nextExames = form.exames.length === 1 ? form.exames : form.exames.filter((_, i) => i !== index);
                                setField("exames", nextExames);
                                setExamesExpandidos(() => ({ 0: true }));
                              }}
                              className="self-start rounded-xl bg-red-100 px-3 py-2 text-red-700 hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {!exameExpandido ? (
                          <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            {exame.tipo_exame || "Exame sem nome"} · {anexosResultado.length} arquivo(s) · {exame.resultado?.trim() ? "com interpretacao" : "sem interpretacao"}
                          </div>
                        ) : null}

                        {exameExpandido ? (
                        <>
                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
                          <input
                            value={exame.tipo_exame}
                            onChange={(e) => atualizarExame(index, { tipo_exame: e.target.value })}
                            placeholder="Tipo de exame"
                            className="lg:col-span-3 px-3 py-2 border rounded-lg text-sm"
                          />
                          <input
                            value={exame.observacoes || ""}
                            onChange={(e) => atualizarExame(index, { observacoes: e.target.value })}
                            placeholder="Observacoes complementares da solicitacao (opcional)"
                            className="lg:col-span-2 px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>

                        <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          Data da solicitacao registrada automaticamente no atendimento.
                          {exame.data_solicitacao ? ` Solicitado em ${formatDate(exame.data_solicitacao)}.` : ""}
                        </div>

                        <textarea
                          value={exame.resultado || ""}
                          onChange={(e) => atualizarExame(index, { resultado: e.target.value })}
                          rows={3}
                          placeholder="Interpretacao resumida do resultado (opcional)..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />

                        {exame.preparo ? (
                          <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <span className="font-medium">Preparo sugerido:</span> {exame.preparo}
                          </div>
                        ) : null}

                        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Arquivos do exame</p>
                              <p className="text-xs text-slate-500">PDF, JPG, JPEG, PNG e WEBP entram no prontuario e na timeline.</p>
                            </div>
                          </div>

                          <div
                            onDragEnter={(event) => {
                              event.preventDefault();
                              setExamDropActive((prev) => ({ ...prev, [index]: true }));
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setExamDropActive((prev) => ({ ...prev, [index]: true }));
                            }}
                            onDragLeave={(event) => {
                              event.preventDefault();
                              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                              clearExamDropState(index);
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              clearExamDropState(index);
                              const file = event.dataTransfer.files?.[0];
                              if (file) {
                                setExamUploadDraftFile(index, file);
                              }
                            }}
                            className={`mt-3 rounded-2xl border-2 border-dashed p-4 transition ${
                              dropAtivo
                                ? "border-blue-300 bg-blue-50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <input
                              id={examDropzoneId}
                              type="file"
                              accept={ATENDIMENTO_ATTACHMENT_ACCEPT}
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  setExamUploadDraftFile(index, file);
                                }
                                event.target.value = "";
                              }}
                            />
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-900">Arraste e solte o arquivo aqui</p>
                                <p className="text-xs text-slate-500">Ou selecione manualmente. Ao enviar, o exame e o atendimento sao salvos automaticamente se necessario.</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <label
                                  htmlFor={examDropzoneId}
                                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                                >
                                  <FileUp className="h-4 w-4" />
                                  Selecionar arquivo
                                </label>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!uploadDraft) return;
                                    await uploadArquivoResultadoExame(index, uploadDraft.file);
                                  }}
                                  disabled={!uploadDraft || exameEmUpload || !form.paciente_id}
                                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {exameEmUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                  {exameEmUpload
                                    ? typeof exameUploadProgress === "number"
                                      ? `Enviando ${exameUploadProgress}%`
                                      : "Enviando..."
                                    : "Enviar agora"}
                                </button>
                                {exameEmUpload ? (
                                  <button
                                    type="button"
                                    onClick={() => cancelarUploadAnexo(exameUploadKey)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                                  >
                                    <X className="h-4 w-4" />
                                    Cancelar upload
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {exameEmUpload ? (
                              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={`h-full rounded-full bg-slate-900 transition-[width] duration-200 ${
                                      typeof exameUploadProgress === "number" ? "" : "animate-pulse"
                                    }`}
                                    style={{ width: `${typeof exameUploadProgress === "number" ? exameUploadProgress : 35}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-slate-600">
                                  {typeof exameUploadProgress === "number"
                                    ? `Upload do exame em andamento (${exameUploadProgress}%).`
                                    : "Upload do exame em andamento..."}
                                </p>
                              </div>
                            ) : null}

                            {uploadDraft ? (
                              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-3">
                                  {uploadDraft.kind === "image" && uploadDraft.previewUrl ? (
                                    <img src={uploadDraft.previewUrl} alt={uploadDraft.file.name} className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white">
                                      {uploadDraft.kind === "pdf" ? <FileText className="h-5 w-5 text-red-500" /> : <Paperclip className="h-5 w-5 text-slate-500" />}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900">{uploadDraft.file.name}</p>
                                    <p className="text-xs text-slate-500">{formatBytes(uploadDraft.file.size)}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => clearExamUploadDraft(index)}
                                  disabled={exameEmUpload}
                                  className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Remover
                                </button>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-slate-500">Nenhum arquivo selecionado para envio.</p>
                            )}
                          </div>

                          {!form.paciente_id ? (
                            <p className="mt-3 text-xs text-amber-700">Selecione um paciente para habilitar o envio do arquivo.</p>
                          ) : null}

                          {anexosResultado.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              {anexosResultado.map((anexo) => (
                                <div key={anexo.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                                      {resolvePreviewKind(anexo) === "image" ? (
                                        <ImageIcon className="h-4 w-4 text-emerald-600" />
                                      ) : resolvePreviewKind(anexo) === "pdf" ? (
                                        <FileText className="h-4 w-4 text-red-500" />
                                      ) : (
                                        <Paperclip className="h-4 w-4 text-slate-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-slate-900">{anexo.nome_original || anexo.tipo}</p>
                                      <p className="mt-1 text-xs text-slate-500">{formatBytes(anexo.tamanho)}{anexo.created_at ? ` · ${formatDate(anexo.created_at)}` : ""}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button onClick={() => abrirAnexo(anexo, "preview")} className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">
                                      {openingAttachmentId === anexo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                      Visualizar
                                    </button>
                                    <button onClick={() => abrirAnexo(anexo, "download")} className="inline-flex items-center gap-1 rounded-xl bg-blue-100 px-3 py-2 text-sm text-blue-700 hover:bg-blue-200">
                                      <Download className="h-4 w-4" />
                                      Baixar
                                    </button>
                                    <button onClick={() => excluirAnexo(anexo)} className="inline-flex items-center gap-1 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200">
                                      <Trash2 className="h-4 w-4" />
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">Nenhum arquivo enviado para este exame.</p>
                          )}
                        </div>
                        </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {examesVisiveis.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum exame encontrado para o filtro atual.
                  </div>
                ) : null}
              </div>
            </section>
            ) : null}

            {isDocumentosWorkspace ? (
            <>
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-600" />Evolucao Clinica</h2>
                {form.evolucoes.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h3 className="font-medium text-sm text-gray-600">Historico de evolucoes</h3>
                    {form.evolucoes.map((evo) => (
                      <div key={evo.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-500">{formatDate(evo.data_evolucao)} - {evo.responsavel_nome}</span>
                        </div>
                        <p className="text-sm mt-1">{evo.descricao}</p>
                        {evo.sinais_vitais && <p className="text-xs text-gray-500 mt-1">Sinais vitais: {evo.sinais_vitais}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Nova evolucao</h3>
                  <textarea value={evolucaoForm.descricao} onChange={(e) => setEvolucaoForm({ ...evolucaoForm, descricao: e.target.value })} placeholder="Descricao da evolucao..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                  <textarea value={evolucaoForm.sinais_vitais} onChange={(e) => setEvolucaoForm({ ...evolucaoForm, sinais_vitais: e.target.value })} placeholder="Sinais vitais (opcional)..." rows={2} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                  <button onClick={async () => {
                    if (!selecionado || !evolucaoForm.descricao.trim()) return;
                    try {
                      await api.post(`/atendimentos/${selecionado}/evolucoes`, evolucaoForm);
                      setEvolucaoForm({ descricao: "", sinais_vitais: "" });
                      await abrirAtendimento(selecionado);
                      setSucesso("Evolucao registrada com sucesso.");
                    } catch { setErro("Erro ao registrar evolucao."); }
                  }} disabled={!selecionado || !evolucaoForm.descricao.trim()} className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />Registrar Evolucao</button>
                </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Paperclip className="w-4 h-4 text-orange-600" />Anexos e Imagens</h2>
                {anexosGerais.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {anexosGerais.map((anexo) => (
                      <div key={anexo.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="break-all text-sm font-medium text-slate-900">{anexo.nome_original || anexo.tipo}</p>
                            <p className="mt-1 text-xs text-slate-500">{anexo.descricao || anexo.tipo}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatBytes(anexo.tamanho)}{anexo.created_at ? ` · ${formatDate(anexo.created_at)}` : ""}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 md:w-32 md:flex-col md:items-stretch">
                            <button onClick={() => abrirAnexo(anexo, "preview")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">
                              {openingAttachmentId === anexo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                              Visualizar
                            </button>
                            <button onClick={() => abrirAnexo(anexo, "download")} className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-100 px-3 py-2 text-sm text-blue-700 hover:bg-blue-200">
                              <Download className="h-4 w-4" />
                              Baixar
                            </button>
                            <button onClick={() => excluirAnexo(anexo)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200">
                              <Trash2 className="h-4 w-4" />
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhum anexo geral registrado neste atendimento.
                  </div>
                )}
                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-medium text-sm text-gray-700">Novo anexo</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <select value={anexoForm.tipo} onChange={(e) => setAnexoForm({ ...anexoForm, tipo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                      <option value="imagem">Imagem</option>
                      <option value="radiografia">Radiografia</option>
                      <option value="ultrassom">Ultrassom</option>
                      <option value="documento">Documento</option>
                      <option value="outro">Outro</option>
                    </select>
                    <input value={anexoForm.descricao} onChange={(e) => setAnexoForm({ ...anexoForm, descricao: e.target.value })} placeholder="Descricao" className="px-3 py-2 border rounded-lg text-sm" />
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <FileUp className="h-4 w-4 text-slate-400" />
                      <input
                        key={anexoArquivo ? `${anexoArquivo.name}-${anexoArquivo.lastModified}` : "anexo-vazio"}
                        type="file"
                        accept={ATENDIMENTO_ATTACHMENT_ACCEPT}
                        onChange={(e) => setAnexoArquivo(e.target.files?.[0] || null)}
                        className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        if (!anexoArquivo) return;
                        await uploadAnexoArquivo(anexoArquivo, {
                          tipo: anexoForm.tipo,
                          descricao: anexoForm.descricao,
                        });
                      }}
                      disabled={!selecionado || !anexoArquivo || uploadGeralEmAndamento}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {uploadGeralEmAndamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                      {uploadGeralEmAndamento
                        ? typeof progressoUploadGeral === "number"
                          ? `Enviando ${progressoUploadGeral}%`
                          : "Enviando..."
                        : "Enviar arquivo"}
                    </button>
                    {uploadGeralEmAndamento ? (
                      <button
                        type="button"
                        onClick={() => cancelarUploadAnexo("geral")}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200"
                      >
                        <X className="h-4 w-4" />
                        Cancelar upload
                      </button>
                    ) : null}
                    {anexoArquivo ? (
                      <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                        {anexoArquivo.name} · {formatBytes(anexoArquivo.size)}
                      </span>
                    ) : null}
                  </div>

                  {uploadGeralEmAndamento ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full bg-orange-600 transition-[width] duration-200 ${
                            typeof progressoUploadGeral === "number" ? "" : "animate-pulse"
                          }`}
                          style={{ width: `${typeof progressoUploadGeral === "number" ? progressoUploadGeral : 35}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {typeof progressoUploadGeral === "number"
                          ? `Upload geral em andamento (${progressoUploadGeral}%).`
                          : "Upload geral em andamento..."}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">Adicionar link externo</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr),auto]">
                      <input value={anexoForm.url} onChange={(e) => setAnexoForm({ ...anexoForm, url: e.target.value })} placeholder="URL do arquivo" className="px-3 py-2 border rounded-lg text-sm" />
                      <button onClick={adicionarLinkAnexo} disabled={!selecionado || !anexoForm.url.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-50">
                        <Link2 className="h-4 w-4" />
                        Adicionar link
                      </button>
                    </div>
                  </div>
                </div>
            </section>
            </>
            ) : null}

            {isPrescricaoWorkspace ? (
              <section className="space-y-6">
                <section className="overflow-hidden rounded-[30px] border border-teal-100 bg-gradient-to-br from-white via-teal-50/60 to-sky-50 p-6 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Prescricao FortCordis</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">Monte a receita em um fluxo unico e mais legivel</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Inspirado no fluxo de prontuario da Vetsmart: escolha o tipo do item, busque o medicamento, ajuste a apresentacao e revise a dose sem depender de um painel lateral carregado.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${autosaveBadgeClass}`}>
                        {autosaveLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const willHide = prescricaoPreviewAtivo;
                          setPrescricaoPreviewAtivo((prev) => !prev);
                          if (willHide) {
                            // Liberar blob URL ao esconder
                            if (prescricaoPreviewPdf && prescricaoPreviewPdf.startsWith("blob:")) {
                              URL.revokeObjectURL(prescricaoPreviewPdf);
                            }
                            setPrescricaoPreviewPdf(null);
                            setPrescricaoPreviewErro(null);
                          } else {
                            setTimeout(() => gerarPreviewPdf(), 100);
                          }
                        }}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                          prescricaoPreviewAtivo
                            ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                        {prescricaoPreviewAtivo ? "Ocultar preview" : "Preview PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrescricaoModoFoco((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {prescricaoModoFoco ? "Lateral compacta" : "Expandir editor"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Paciente</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{pacienteSelecionado?.nome || "Sem paciente"}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {pacienteSelecionado ? (
                          especieExibicao ? (
                            `${especieExibicao}${pacienteSelecionado.raca ? ` · ${pacienteSelecionado.raca}` : ""}`
                          ) : (
                            <span className="text-amber-600">Espécie não informada</span>
                          )
                        ) : (
                          "Selecione um paciente"
                        )}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Itens ativos</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{itensPrescricaoAtivos.length}</p>
                      <p className="mt-1 text-sm text-slate-500">{medicamentosCardiologicos} item(ns) cardiologicos na biblioteca</p>
                    </div>
                    <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Validacao</p>
                      <p className={`mt-2 text-lg font-semibold ${prescricaoErrosCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {prescricaoErrosCount > 0 ? `${prescricaoErrosCount} pendencia(s)` : "Sem pendencias"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Campos obrigatorios: medicamento, dose, frequencia e via.</p>
                    </div>
                    <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Peso de referencia</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{form.triagem.peso ? `${form.triagem.peso} kg` : "Nao informado"}</p>
                      <p className="mt-1 text-sm text-slate-500">Base para calculo automatico e sugestao de apresentacao.</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPrescricaoEntradaModo("manipulado")}
                    className="group rounded-[28px] border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Entrada rapida</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">Adicionar formula manipulada</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Crie um item livre ou use um medicamento da biblioteca como base, com possibilidade de salvar a formula depois.
                        </p>
                      </div>
                      <span className="rounded-2xl bg-amber-100 p-3 text-amber-700 transition group-hover:bg-amber-200">
                        <Pill className="h-5 w-5" />
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrescricaoEntradaModo("industrializado")}
                    className="group rounded-[28px] border border-teal-200 bg-gradient-to-br from-white to-teal-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Entrada rapida</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">Adicionar produto industrializado</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Busque na biblioteca, escolha a apresentacao e leve a recomendacao de dose direto para o item da receita.
                        </p>
                      </div>
                      <span className="rounded-2xl bg-teal-100 p-3 text-teal-700 transition group-hover:bg-teal-200">
                        <Search className="h-5 w-5" />
                      </span>
                    </div>
                  </button>
                </section>

                <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Busca guiada</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">
                        {prescricaoEntradaModo === "manipulado"
                          ? "Selecionar base para formula manipulada"
                          : prescricaoEntradaModo === "industrializado"
                            ? "Selecionar produto industrializado"
                            : "Buscar medicamento ou iniciar um item manual"}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => adicionarItemPrescricaoEmBranco()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                        Item manual
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrescricaoEntradaModo(null)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" />
                        Fechar busca
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr),280px]">
                    <div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={prescricaoBuscaRapida}
                          onChange={(e) => setPrescricaoBuscaRapida(e.target.value)}
                          placeholder="Buscar medicamento, principio ativo, classe ou categoria..."
                          className="w-full rounded-[22px] border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-100"
                        />
                      </div>

                      <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
                        {mostrarResultadosBuscaPrescricao ? (
                          prescricaoBuscaResultados.length > 0 ? (
                          prescricaoBuscaResultados.map((med) => (
                            <div key={med.id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-slate-950">{med.nome}</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {med.classe_terapeutica || med.categoria || "Sem classificacao"}
                                    {med.principio_ativo ? ` · ${med.principio_ativo}` : ""}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                    {med.forma_farmaceutica ? (
                                      <span className="rounded-full bg-white px-2.5 py-1">{med.forma_farmaceutica}</span>
                                    ) : null}
                                    {med.especie_alvo ? (
                                      <span className="rounded-full bg-white px-2.5 py-1">{med.especie_alvo}</span>
                                    ) : null}
                                    {med.parametrizado ? (
                                      <span className="rounded-full bg-teal-100 px-2.5 py-1 text-teal-700">Parametrizado</span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => abrirMedicamentoBuscaRapida(med)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Ver cadastro
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => selecionarMedicamentoBuscaRapida(med, prescricaoEntradaModo === "manipulado")}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
                                  >
                                    <Plus className="h-4 w-4" />
                                    {prescricaoEntradaModo === "manipulado" ? "Usar como formula" : "Selecionar"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Nenhum medicamento encontrado para esta busca.
                          </div>
                          )
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Escolha um tipo de entrada acima para abrir a busca sem poluir a tela inicial da receita.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Atalhos do fluxo</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <p>1. Escolha o tipo do item.</p>
                        <p>2. Busque o medicamento ou abra um item manual.</p>
                        <p>3. Defina apresentacao, dose, frequencia e via.</p>
                        <p>4. Revise as sugestoes e gere o PDF.</p>
                      </div>
                      {prescricaoEntradaModo === "manipulado" ? (
                        <button
                          type="button"
                          onClick={() => adicionarItemPrescricaoEmBranco({ manipulado: true })}
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                        >
                          <Plus className="h-4 w-4" />
                          Nova formula em branco
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr),minmax(300px,0.95fr)]">
                  <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Instrucoes gerais do tratamento</p>
                    <textarea
                      value={form.prescricao_orientacoes}
                      onChange={(e) => setField("prescricao_orientacoes", e.target.value)}
                      placeholder="Resumo para o tutor, cuidados, horarios, retornos e observacoes gerais."
                      rows={5}
                      className="mt-4 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-100"
                    />
                  </section>

                  <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Contexto da prescricao</p>
                        <p className="mt-1 text-sm text-slate-600">Data base, retorno e protocolos rapidos para acelerar a emissao.</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {form.data_atendimento ? formatDate(form.data_atendimento) : formatDate(new Date().toISOString())}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Retorno (dias)</p>
                        <input
                          type="number"
                          value={form.prescricao_retorno_dias}
                          onChange={(e) => setField("prescricao_retorno_dias", e.target.value)}
                          placeholder="Ex.: 7"
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-100"
                        />
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Protocolo recomendado</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {protocoloPrescricaoRecomendado?.label || "Nenhum protocolo automatico"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {protocoloPrescricaoSelecionadoDetalhe?.descricao || "Voce pode aplicar um protocolo rapido abaixo."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {PROTOCOLOS_PRESCRICAO.map((protocolo) => (
                        <button
                          key={protocolo.key}
                          type="button"
                          onClick={() => aplicarProtocoloPrescricao(protocolo)}
                          className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                            protocoloPrescricaoRecomendado?.key === protocolo.key || protocoloPrescricaoSelecionado === protocolo.key
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {protocolo.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                {prescricaoSupport.alertasGerais.length > 0 ? (
                  <section className="rounded-[30px] border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-amber-100 p-3">
                        <AlertTriangle className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Alertas de interacao</p>
                        <h3 className="mt-1 text-lg font-semibold text-amber-950">Revise antes de fechar o receituario</h3>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {prescricaoSupport.alertasGerais.map((alerta) => (
                        <p
                          key={alerta}
                          className={`rounded-2xl border px-4 py-3 text-sm ${getAlertaPrescricaoClass(classificarAlertaPrescricao(alerta))}`}
                        >
                          {alerta}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Itens da receita</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">Configure cada medicamento com mais contexto visual</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => adicionarItemPrescricaoEmBranco()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar item manual
                    </button>
                  </div>

                  {prescricaoTemRascunhoInicial ? (
                    <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-teal-100 text-teal-700">
                        <ClipboardPlus className="h-6 w-6" />
                      </div>
                      <h4 className="mt-4 text-xl font-semibold text-slate-950">A receita ainda esta vazia</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Comece pelos cards de entrada rapida acima ou crie um item manual para preencher do seu jeito.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPrescricaoEntradaModo("industrializado")}
                          className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                        >
                          <Search className="h-4 w-4" />
                          Buscar industrializado
                        </button>
                        <button
                          type="button"
                          onClick={() => adicionarItemPrescricaoEmBranco({ manipulado: true })}
                          className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          <Pill className="h-4 w-4" />
                          Criar formula manipulada
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {form.prescricao_itens.map((item, idx) => renderPrescricaoItemCard(item, idx))}
                    </div>
                  )}
                </section>
              </section>
            ) : null}
          </div>

          {prescricaoPreviewAtivo && (
            <section className="overflow-hidden rounded-[24px] border border-teal-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-teal-100 bg-teal-50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-600" />
                  <p className="text-sm font-semibold text-teal-700">Preview da receita</p>
                </div>
                {prescricaoPreviewLoading && (
                  <div className="flex items-center gap-2 text-xs text-teal-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Gerando...
                  </div>
                )}
              </div>
              <div className="bg-slate-100" style={{ height: "500px" }}>
                {prescricaoPreviewPdf ? (
                  <iframe
                    src={prescricaoPreviewPdf}
                    title="Preview da prescricao"
                    className="h-full w-full"
                    style={{ border: "none" }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      {form.prescricao_itens.every((item) => !(item.medicamento_nome || "").trim()) ? (
                        <>
                          <ClipboardPlus className="mx-auto h-10 w-10 text-slate-300" />
                          <p className="mt-3 text-sm text-slate-400">Adicione medicamentos para ver o preview</p>
                        </>
                      ) : prescricaoPreviewLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                          <p className="text-sm text-slate-400">Gerando preview...</p>
                        </div>
                      ) : prescricaoPreviewErro ? (
                        <div className="flex flex-col items-center gap-3 px-6">
                          <AlertTriangle className="h-10 w-10 text-red-400" />
                          <p className="text-sm font-medium text-red-600">{prescricaoPreviewErro}</p>
                          <button
                            type="button"
                            onClick={() => gerarPreviewPdf()}
                            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : (
                        <>
                          <FileX className="mx-auto h-10 w-10 text-slate-300" />
                          <p className="mt-3 text-sm text-slate-400">Preview nao disponivel</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {(isPrescricaoWorkspace || showClinicalRadarAside) ? (
          <aside
            className={`self-start space-y-6 xl:sticky xl:max-h-[calc(100vh-2rem)] xl:overflow-auto xl:pr-1 ${
              isPrescricaoWorkspace && prescricaoModoFoco ? "xl:top-3" : "xl:top-6"
            }`}
          >
            {showClinicalRadarAside ? (
              <>
            <section className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-50 p-3">
                  <FileText className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Radar do caso</p>
                  <h2 className="text-lg font-semibold text-slate-900">Status rapido</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Preenchimento</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{clinicalSummary.completeness}%</p>
                  <p className="mt-1 text-sm text-slate-600">{preenchimentoConsultaLabel}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Sincronizacao</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{autosaveLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selecionado ? "Atendimento salvo em edicao continua." : "Rascunho local ate o primeiro salvamento."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Fluxo clinico</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>Queixa e anamnese: {form.queixa_principal.trim() || form.anamnese.trim() ? "em andamento" : "pendente"}</p>
                    <p>Plano e retorno: {form.plano_terapeutico.trim() || form.retorno_recomendado.trim() ? "em andamento" : "pendente"}</p>
                    <p>Exames solicitados: {form.exames.filter((item) => (item.tipo_exame || "").trim()).length}</p>
                    <p>Itens prescritos: {form.prescricao_itens.filter((item) => item.medicamento_id || item.medicamento_nome.trim()).length}</p>
                  </div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Fechamento</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>Status: {form.status || "Triagem"}</p>
                    <p>Prognostico: {form.diagnostico.prognostico || "Nao definido"}</p>
                    <p>Paciente: {pacienteSelecionado?.nome || "Nao selecionado"}</p>
                    <p>Alertas ativos: {alertasAtivos.length}</p>
                  </div>
                </div>
              </div>

              {clinicalSummary.pending.length > 0 ? (
                <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Pendencias mais proximas</p>
                  <div className="mt-3 space-y-2 text-sm text-amber-900">
                    {clinicalSummary.pending.slice(0, 3).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                  O caso ja tem base suficiente para seguir para exames, prescricao e fechamento.
                </div>
              )}
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Leitura rapida</p>
                  <h2 className="text-lg font-semibold text-slate-900">Alertas e historico</h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {alertasAtivos.length > 0 ? (
                  alertasAtivos.map((alerta) => (
                    <div key={alerta.id} className={`rounded-[20px] border px-4 py-3 ${getGravidadeClass(alerta.gravidade)}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{alerta.titulo}</p>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em]">
                          {alerta.gravidade}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{alerta.descricao}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum alerta ativo para o paciente selecionado.
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Ultimos contatos</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">Historico recente</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {historicoPaciente?.atendimentos.length || 0} registros
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {historicoPaciente?.atendimentos.slice(0, 4).map((atendimento) => (
                    <div key={atendimento.id} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">#{atendimento.id}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getBadgeStatusClass(atendimento.status)}`}>
                          {atendimento.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{formatDate(atendimento.data_atendimento)}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {atendimento.diagnostico_principal || atendimento.queixa_principal || "Sem resumo clinico"}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>{atendimento.veterinario || "Veterinario nao informado"}</span>
                      </div>
                    </div>
                  ))}
                  {!historicoPaciente?.atendimentos.length ? (
                    <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      O historico do paciente aparecera aqui conforme novos atendimentos forem salvos.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
              </>
            ) : null}

            {isPrescricaoWorkspace ? (
            <div className="space-y-4">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-teal-50 p-3">
                    <FileText className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Salvar e conferir</p>
                    <h2 className="text-lg font-semibold text-slate-950">Saida da prescricao</h2>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void saveAtendimento()}
                    disabled={salvando}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {salvando ? "Salvando..." : "Salvar atendimento"}
                  </button>
                  <button
                    type="button"
                    onClick={imprimirPrescricao}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={() => baixarPdfAtendimento("prescricao")}
                    disabled={!hasPrescriptionItems || salvando || Boolean(gerandoPdfTipo)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {gerandoPdfTipo === "prescricao" ? "Gerando PDF..." : "Baixar PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrescricaoModoFoco((prev) => !prev)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {prescricaoModoFoco ? "Desocupar lateral" : "Modo revisao"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Itens prontos</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{itensPrescricaoAtivos.length}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Pendencias</p>
                    <p className={`mt-1 text-lg font-semibold ${prescricaoErrosCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {prescricaoErrosCount}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Alertas gerais</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{prescricaoSupport.alertasGerais.length}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Retorno</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{form.prescricao_retorno_dias || "Em aberto"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3">
                    <Pill className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Resumo para o documento</p>
                    <h3 className="text-lg font-semibold text-slate-950">Conferencia rapida</h3>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {itensPrescricaoAtivos.length > 0 ? (
                    itensPrescricaoAtivos.map((item, idx) => (
                      <div key={`${idx}-${item.id || item.medicamento_nome}`} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950">{item.medicamento_nome || `Item ${idx + 1}`}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.apresentacao_selecionada || (/(formula manipulada)/i.test(item.medicamento_nome || "") ? "Formula manipulada" : "Apresentacao em aberto")}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {item.via || "Via em aberto"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>{item.dose || "Dose em aberto"}</p>
                          <p>{item.frequencia || "Frequencia em aberto"}</p>
                          <p>{item.duracao || "Duracao livre"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      Os itens ativos aparecerao aqui conforme forem configurados na coluna principal.
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Orientacoes gerais</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {form.prescricao_orientacoes.trim() || "Nenhuma orientacao geral adicionada ainda."}
                  </p>
                </div>
              </section>

              {prescricaoSupport.alertasGerais.length > 0 ? (
                <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Atencao antes do PDF</p>
                      <h3 className="text-sm font-semibold text-amber-950">Interacoes e observacoes gerais</h3>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {prescricaoSupport.alertasGerais.map((alerta) => (
                      <p
                        key={alerta}
                        className={`rounded-2xl border px-3 py-2 text-sm ${getAlertaPrescricaoClass(classificarAlertaPrescricao(alerta))}`}
                      >
                        {alerta}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
            ) : null}

            {false ? (
            <section className="rounded-[26px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.95)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <Pill className="h-5 w-5 text-teal-200" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Receituario guiado</p>
                    <h2 className="text-lg font-semibold text-white">Prescricao assistida</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setField("prescricao_itens", [...form.prescricao_itens, emptyPrescriptionItem()])}
                  className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
                >
                  <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Item</span>
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={imprimirPrescricao} className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20">
                  <span className="inline-flex items-center gap-2"><Printer className="h-4 w-4" />Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => baixarPdfAtendimento("prescricao")}
                  disabled={!hasPrescriptionItems || salvando || Boolean(gerandoPdfTipo)}
                  className="rounded-2xl bg-teal-400/20 px-3 py-2 text-xs font-medium text-teal-100 transition hover:bg-teal-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />{gerandoPdfTipo === "prescricao" ? "Gerando..." : "PDF"}</span>
                </button>
              </div>

              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Protocolos rapidos por diagnostico</p>
                  {protocoloPrescricaoRecomendado ? (
                    <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                      Recomendado: {protocoloPrescricaoRecomendado?.label}
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">
                      Sem sugestao automatica
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
                  <select
                    value={protocoloPrescricaoSelecionado}
                    onChange={(e) => setProtocoloPrescricaoSelecionado(e.target.value)}
                    className="prescricao-select-dark w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecionar protocolo</option>
                    {PROTOCOLOS_PRESCRICAO.map((protocolo) => (
                      <option key={protocolo.key} value={protocolo.key}>
                        {protocolo.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={aplicarProtocoloSelecionado}
                    disabled={!protocoloPrescricaoSelecionado}
                    className="rounded-xl bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar protocolo
                  </button>
                </div>
                {protocoloPrescricaoSelecionadoDetalhe ? (
                  <p className="mt-2 text-xs text-slate-300">
                    {protocoloPrescricaoSelecionadoDetalhe?.descricao}
                    {(protocoloPrescricaoSelecionadoDetalhe?.itens.length || 0) > 0
                      ? ` · ${protocoloPrescricaoSelecionadoDetalhe?.itens.length || 0} item(ns)`
                      : " · sem medicacao fixa"}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROTOCOLOS_PRESCRICAO.map((protocolo) => (
                    <button
                      key={protocolo.key}
                      type="button"
                      onClick={() => aplicarProtocoloPrescricao(protocolo)}
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-medium transition ${
                        protocoloPrescricaoRecomendado?.key === protocolo.key
                          ? "bg-emerald-300/20 text-emerald-200"
                          : "bg-white/10 text-slate-200 hover:bg-white/20"
                      }`}
                    >
                      {protocolo.label}
                    </button>
                  ))}
                </div>
              </div>

              {prescricaoErrosCount > 0 ? (
                <div className="mt-4 rounded-[20px] border border-rose-300/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  <p className="font-semibold">Validacao clinica pendente</p>
                  <p className="mt-1">
                    Existem {prescricaoErrosCount} campo(s) obrigatorio(s) em aberto. Corrija para salvar e gerar PDF.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                  <p className="min-w-0 text-[10px] uppercase tracking-[0.2em] text-slate-400">Peso</p>
                  <p className="shrink-0 text-sm font-semibold text-white">{form.triagem.peso ? `${form.triagem.peso} kg` : "Nao informado"}</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                  <p className="min-w-0 text-[10px] uppercase tracking-[0.2em] text-slate-400">Biblioteca cardiologica</p>
                  <p className="shrink-0 text-sm font-semibold text-white">{medicamentosCardiologicos} itens</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                  <p className="min-w-0 text-[10px] uppercase tracking-[0.2em] text-slate-400">Alertas de interacao</p>
                  <p className="shrink-0 text-sm font-semibold text-white">{prescricaoSupport.alertasGerais.length}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Orientacoes gerais</label>
                  <textarea
                    value={form.prescricao_orientacoes}
                    onChange={(e) => setField("prescricao_orientacoes", e.target.value)}
                    placeholder="Resumo para o tutor, cuidados, horarios e retornos."
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Retorno (dias)</label>
                  <input
                    type="number"
                    value={form.prescricao_retorno_dias}
                    onChange={(e) => setField("prescricao_retorno_dias", e.target.value)}
                    placeholder="Ex.: 7"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {prescricaoSupport.alertasGerais.length > 0 ? (
                <div className="mt-5 rounded-[22px] border border-amber-300/30 bg-amber-400/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-amber-200">Alertas de interacao</p>
                  <div className="mt-3 space-y-2 text-sm text-amber-100">
                    {prescricaoSupport.alertasGerais.map((alerta) => (
                      <p
                        key={alerta}
                        className={`rounded-xl border px-3 py-2 ${getAlertaPrescricaoClass(classificarAlertaPrescricao(alerta))}`}
                      >
                        {alerta}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {form.prescricao_itens.map((item, idx) => {
                  const itemErrors = prescricaoValidationErrors[idx] || {};
                  const sugestao = prescricaoSupport.itens[idx];
                  const calculo = prescricaoCalculos[idx];
                  const isUnico = form.prescricao_itens.length === 1;
                  const medicamentoSelecionado =
                    item.medicamento_id != null
                      ? medicamentos.find((entry) => entry.id === item.medicamento_id) || null
                      : null;
                  const apresentacoesDisponiveis = sugestao?.apresentacoes || [];
                  const sugestaoApresentacao = sugestao?.sugestaoApresentacao || null;
                  const inputClass = (campo?: PrescricaoCampoObrigatorio) =>
                    `w-full rounded-2xl border px-4 py-3 text-sm text-white placeholder:text-slate-500 ${
                      campo && itemErrors[campo]
                        ? "border-rose-300/60 bg-rose-400/10"
                        : "border-white/10 bg-white/5"
                    }`;
                  const ativo = Boolean(item.medicamento_id || (item.medicamento_nome || "").trim());
                  return (
                    <div key={`${idx}-${item.id || "novo"}`} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Item {idx + 1}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{item.medicamento_nome || "Medicamento em definicao"}</p>
                        </div>
                        <button
                          onClick={() => removerItemPrescricao(idx)}
                          className="rounded-xl bg-red-400/15 p-2 text-red-100 transition hover:bg-red-400/25"
                          title={isUnico ? "Limpar item" : "Remover item"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        <select
                          value={item.medicamento_id || ""}
                          onChange={(e) => aplicarMedicamentoNaPrescricao(idx, e.target.value ? Number(e.target.value) : null)}
                          className={`${inputClass("medicamento_nome")} prescricao-select-dark`}
                        >
                          <option value="">Selecionar medicamento</option>
                          {medicamentos.map((med) => <option key={med.id} value={med.id}>{med.nome}</option>)}
                        </select>
                        <input
                          value={item.medicamento_nome}
                          onChange={(e) => updatePrescricaoItem(idx, { medicamento_nome: e.target.value })}
                          placeholder="Nome livre do medicamento"
                          className={inputClass("medicamento_nome")}
                        />
                        {medicamentoSelecionado ? (
                          apresentacoesDisponiveis.length > 0 ? (
                            <select
                              value={item.apresentacao_selecionada || ""}
                              onChange={(e) => updatePrescricaoItem(idx, { apresentacao_selecionada: e.target.value })}
                              className="prescricao-select-dark w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
                            >
                              <option value="">Selecionar apresentacao comercial</option>
                              {apresentacoesDisponiveis.map((apresentacao) => (
                                <option key={apresentacao.key} value={apresentacao.label}>
                                  {apresentacao.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
                              Sem apresentacoes comerciais estruturadas no cadastro deste medicamento.
                            </div>
                          )
                        ) : null}
                        {itemErrors.medicamento_nome ? <p className="text-xs text-rose-300">{itemErrors.medicamento_nome}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFormulaManipuladaPrescricao(idx)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                          >
                            {/(formula manipulada)/i.test(item.medicamento_nome || "") ? "Remover formula manipulada" : "Marcar como formula manipulada"}
                          </button>
                          {item.medicamento_id ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (medicamentoSelecionado) duplicarMedicamentoManipulado(medicamentoSelecionado);
                              }}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                            >
                              Salvar formula na biblioteca
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <input
                            value={item.dose}
                            onChange={(e) => updatePrescricaoItem(idx, { dose: e.target.value })}
                            placeholder="Dose"
                            className={inputClass("dose")}
                          />
                          {itemErrors.dose ? <p className="mt-1 text-xs text-rose-300">{itemErrors.dose}</p> : null}
                        </div>
                        <div>
                          <input
                            value={item.frequencia}
                            onChange={(e) => updatePrescricaoItem(idx, { frequencia: e.target.value })}
                            placeholder="Frequencia"
                            className={inputClass("frequencia")}
                          />
                          {itemErrors.frequencia ? <p className="mt-1 text-xs text-rose-300">{itemErrors.frequencia}</p> : null}
                        </div>
                        <div>
                          <input
                            value={item.duracao}
                            onChange={(e) => updatePrescricaoItem(idx, { duracao: e.target.value })}
                            placeholder="Duracao (opcional)"
                            className={inputClass()}
                          />
                        </div>
                        <div>
                          <input
                            value={item.via}
                            onChange={(e) => updatePrescricaoItem(idx, { via: e.target.value })}
                            placeholder="Via"
                            className={inputClass("via")}
                          />
                          {itemErrors.via ? <p className="mt-1 text-xs text-rose-300">{itemErrors.via}</p> : null}
                        </div>
                      </div>

                      <div className="mt-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Calculo guiado da dose</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <input
                            value={item.dose_mg_kg || ""}
                            onChange={(e) => updatePrescricaoItem(idx, { dose_mg_kg: e.target.value })}
                            placeholder="Dose mg/kg"
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                          />
                          <input
                            value={item.peso_referencia_kg || ""}
                            onChange={(e) => updatePrescricaoItem(idx, { peso_referencia_kg: e.target.value })}
                            placeholder={`Peso kg (${form.triagem.peso || "-"})`}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                          />
                          <select
                            value={item.unidade_dose_calculo || "mg"}
                            onChange={(e) =>
                              updatePrescricaoItem(idx, {
                                unidade_dose_calculo: e.target.value as "mg" | "ml" | "comprimido",
                              })
                            }
                            className="prescricao-select-dark w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                          >
                            <option value="mg">mg</option>
                            <option value="ml">mL</option>
                            <option value="comprimido">comprimido</option>
                          </select>
                          <input
                            value={item.concentracao_personalizada || ""}
                            onChange={(e) => updatePrescricaoItem(idx, { concentracao_personalizada: e.target.value })}
                            disabled={(item.unidade_dose_calculo || "mg") === "mg"}
                            placeholder={
                              (item.unidade_dose_calculo || "mg") === "ml"
                                ? "Concentracao mg/mL"
                                : (item.unidade_dose_calculo || "mg") === "comprimido"
                                  ? "Concentracao mg/comprimido"
                                  : "Sem concentracao"
                            }
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 disabled:opacity-40"
                          />
                        </div>

                        <div className="mt-3 rounded-xl border border-teal-300/30 bg-teal-400/10 px-3 py-2 text-xs text-teal-100">
                          {calculo.doseTotalMg ? (
                            <>
                              <p>
                                Resultado: <span className="font-semibold">{calculo.doseTotalMg.toFixed(2)} mg por dose</span>
                                {calculo.unidade === "ml" && calculo.volumeMl ? ` · ${calculo.volumeMl.toFixed(2)} mL` : ""}
                                {calculo.unidade === "comprimido" && calculo.comprimidos ? ` · ${calculo.comprimidos.toFixed(2)} comprimido(s)` : ""}
                              </p>
                              <p className="mt-1 text-teal-200">
                                Base: {calculo.doseMgKg?.toFixed(3)} mg/kg · {calculo.pesoKg?.toFixed(2)} kg
                                {calculo.concentracao ? ` · concentracao ${calculo.concentracao}` : ""}
                              </p>
                            </>
                          ) : (
                            <p>Informe dose (mg/kg) e peso para habilitar o calculo automatico.</p>
                          )}
                          <button
                            type="button"
                            onClick={() => aplicarCalculoNaDose(idx, calculo)}
                            disabled={!calculo.doseTotalMg}
                            className="mt-2 rounded-lg bg-teal-400 px-2.5 py-1.5 text-[11px] font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Aplicar calculo na dose
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={item.instrucoes}
                        onChange={(e) => updatePrescricaoItem(idx, { instrucoes: e.target.value })}
                        placeholder="Instrucoes especificas do item"
                        rows={2}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                      />

                      {sugestao?.doseSugerida ? (
                        <div className="mt-3 rounded-[20px] border border-teal-300/30 bg-teal-400/10 px-4 py-3 text-sm text-teal-100">
                          <p className="font-semibold">Dose sugerida automatica</p>
                          <p className="mt-1">{sugestao.doseSugerida}</p>
                          {sugestao.detalhe ? <p className="mt-1 text-xs text-teal-200">{sugestao.detalhe}</p> : null}
                          <button
                            type="button"
                            onClick={() =>
                              updatePrescricaoItem(idx, {
                                dose: item.dose || sugestao.doseSugerida,
                              })
                            }
                            className="mt-3 rounded-xl bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-teal-300"
                          >
                            Aplicar dose sugerida
                          </button>
                        </div>
                      ) : null}

                      {sugestaoApresentacao ? (
                        <div
                          className={`mt-3 rounded-[20px] border px-4 py-3 text-sm ${
                            sugestaoApresentacao.requerManipulacao
                              ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
                              : "border-sky-300/30 bg-sky-400/10 text-sky-100"
                          }`}
                        >
                          <p className="font-semibold">
                            {sugestaoApresentacao.requerManipulacao ? "Apresentacao comercial nao viavel" : "Apresentacao sugerida"}
                          </p>
                          <p className="mt-1">{sugestaoApresentacao.resumo}</p>
                          {sugestaoApresentacao.detalhe ? (
                            <p className="mt-1 text-xs text-current/80">{sugestaoApresentacao.detalhe}</p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => aplicarSugestaoApresentacaoNaPrescricao(idx, sugestaoApresentacao)}
                            className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                              sugestaoApresentacao.requerManipulacao
                                ? "bg-amber-300 text-slate-950 hover:bg-amber-200"
                                : "bg-sky-300 text-slate-950 hover:bg-sky-200"
                            }`}
                          >
                            {sugestaoApresentacao.requerManipulacao ? "Usar formula manipulada" : "Aplicar apresentacao sugerida"}
                          </button>
                        </div>
                      ) : null}

                      {sugestao?.alertas?.length ? (
                        <div className="mt-3 rounded-[20px] border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                          {sugestao.alertas.map((alerta) => (
                            <p
                              key={alerta}
                              className={`mb-1 rounded-xl border px-3 py-2 last:mb-0 ${getAlertaPrescricaoClass(classificarAlertaPrescricao(alerta))}`}
                            >
                              {alerta}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {item.historico_ajustes && item.historico_ajustes.length > 0 ? (
                        <div className="mt-3 rounded-[20px] border border-white/10 bg-slate-900/50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Historico de ajustes</p>
                          <div className="mt-3 space-y-2">
                            {item.historico_ajustes.slice(0, 4).map((ajuste) => (
                              <div key={ajuste.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium capitalize text-white">{ajuste.campo}</span>
                                  <span className="text-slate-500">{formatDate(ajuste.created_at)}</span>
                                </div>
                                <div className="mt-1 text-slate-300">
                                  {ajuste.valor_anterior || "-"} <span className="mx-1 text-slate-500">→</span> {ajuste.valor_novo || "-"}
                                </div>
                                {(ajuste.responsavel_nome || ajuste.motivo) && (
                                  <div className="mt-1 text-slate-500">
                                    {ajuste.responsavel_nome && <span>{ajuste.responsavel_nome}</span>}
                                    {ajuste.responsavel_nome && ajuste.motivo && <span className="mx-1">·</span>}
                                    {ajuste.motivo && <span>{ajuste.motivo}</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {ativo && Object.keys(itemErrors).length > 0 ? (
                        <div className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                          Corrija os campos obrigatorios deste item para finalizar a prescricao.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
            ) : null}
          </aside>
          ) : null}
        </div>
          </div>
        </div>

        {isBibliotecasWorkspace ? (
        <>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <button
              type="button"
              onClick={() => setShowPhraseBank((prev) => !prev)}
              className="flex items-center gap-3 text-left"
            >
              <div className="rounded-2xl bg-teal-50 p-3">
                <ClipboardPlus className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Banco configuravel</p>
                <h2 className="text-lg font-semibold text-slate-900">Frases clinicas do atendimento</h2>
              </div>
              {showPhraseBank ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void carregarFrasesClinicas()}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar banco
                </span>
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {clinicalPhrases.length} frase(s)
              </span>
            </div>
          </div>

          {showPhraseBank ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Secao</label>
                  <select
                    value={clinicalPhraseForm.secao}
                    onChange={(e) =>
                      setClinicalPhraseForm((prev) => ({
                        ...prev,
                        secao: e.target.value as ClinicalFieldKey,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    {CLINICAL_SECTION_OPTIONS.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Ordem</label>
                  <input
                    value={clinicalPhraseForm.ordem}
                    onChange={(e) =>
                      setClinicalPhraseForm((prev) => ({
                        ...prev,
                        ordem: e.target.value,
                      }))
                    }
                    placeholder="10"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Titulo</label>
                <input
                  value={clinicalPhraseForm.titulo}
                  onChange={(e) =>
                    setClinicalPhraseForm((prev) => ({
                      ...prev,
                      titulo: e.target.value,
                    }))
                  }
                  placeholder="Ex.: Endocardiose mitral B1"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Texto</label>
                <textarea
                  value={clinicalPhraseForm.texto}
                  onChange={(e) =>
                    setClinicalPhraseForm((prev) => ({
                      ...prev,
                      texto: e.target.value,
                    }))
                  }
                  rows={7}
                  placeholder="Texto da frase clinica."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={clinicalPhraseForm.ativo === 1}
                  onChange={(e) =>
                    setClinicalPhraseForm((prev) => ({
                      ...prev,
                      ativo: e.target.checked ? 1 : 0,
                    }))
                  }
                  className="h-4 w-4"
                />
                Frase ativa
              </label>

              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                As frases cadastradas aqui alimentam os atalhos do editor clinico por secao.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveClinicalPhrase}
                  disabled={savingClinicalPhrase}
                  className="rounded-2xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {savingClinicalPhrase ? "Salvando..." : clinicalPhraseForm.id ? "Atualizar frase" : "Salvar frase"}
                  </span>
                </button>
                <button
                  onClick={resetClinicalPhraseForm}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nova frase
                  </span>
                </button>
              </div>
            </div>

            <div className="xl:col-span-2 rounded-[22px] border border-slate-200 bg-white">
              <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(0,1fr),240px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={clinicalPhraseSearch}
                    onChange={(e) => setClinicalPhraseSearch(e.target.value)}
                    placeholder="Buscar frase clinica..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm text-slate-900"
                  />
                </div>
                <select
                  value={clinicalPhraseSectionFilter}
                  onChange={(e) => setClinicalPhraseSectionFilter((e.target.value || "") as ClinicalFieldKey | "")}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                >
                  <option value="">Todas as secoes</option>
                  {CLINICAL_SECTION_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-[420px] overflow-auto p-4">
                <div className="space-y-3">
                  {clinicalPhrasesFiltered.map((item) => (
                    <div key={item.id} className={`rounded-[22px] border px-4 py-4 ${Number(item.ativo ?? 1) === 1 ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-slate-100/70 opacity-80"}`}>
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {clinicalSectionLabels[item.secao] || item.secao}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${Number(item.ativo ?? 1) === 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                              {Number(item.ativo ?? 1) === 1 ? "Ativa" : "Inativa"}
                            </span>
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                              {item.parametrizacao_origem || "manual"}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.texto}</p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            onClick={() => editarFraseClinica(item)}
                            className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-200"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => void toggleClinicalPhrase(item)}
                            className={`rounded-xl px-3 py-2 text-xs font-medium transition ${Number(item.ativo ?? 1) === 1 ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                          >
                            {Number(item.ativo ?? 1) === 1 ? "Desativar" : "Reativar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {clinicalPhrasesFiltered.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                      Nenhuma frase clinica encontrada para os filtros atuais.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Abra este painel para cadastrar, editar e ativar frases do editor clinico.
            </div>
          )}
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <button
              type="button"
              onClick={() => setShowMedicationBank((prev) => !prev)}
              className="flex items-center gap-3 text-left"
            >
              <div className="rounded-2xl bg-teal-50 p-3">
                <Pill className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Banco configuravel</p>
                <h2 className="font-semibold text-gray-900">Banco de medicamentos</h2>
              </div>
              {showMedicationBank ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {medicamentos.length} medicamento(s)
            </span>
          </div>

          {showMedicationBank ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {medForm.id ? "Editando medicamento" : "Novo medicamento"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Os campos importados do HTML ficam explicitos aqui e podem ser editados antes da prescricao.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                    {formatarOrigemMedicamento(medForm.parametrizacao_origem)}
                  </span>
                  <button
                    type="button"
                    onClick={resetMedicationForm}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Novo
                  </button>
                </div>
              </div>

              {medForm.parametrizacao_origem === "vetsmart_html" ? (
                <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                  Este registro veio de HTML salvo da Vetsmart. Apresentacoes, indicacoes, interacoes e frequencia podem ser ajustadas manualmente aqui.
                </p>
              ) : (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                  Use esta ficha para cadastrar um medicamento proprio, ou criar uma versao reutilizavel de formula manipulada.
                </p>
              )}

              <input
                value={medForm.nome}
                onChange={(e) => setMedForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do medicamento"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
              <input
                value={medForm.principio_ativo}
                onChange={(e) => setMedForm((p) => ({ ...p, principio_ativo: e.target.value }))}
                placeholder="Principio ativo"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Apresentacoes / concentracao</label>
                <textarea
                  value={medForm.concentracao}
                  onChange={(e) => setMedForm((p) => ({ ...p, concentracao: e.target.value }))}
                  placeholder="Uma apresentacao por linha. Ex.: Pimobendan 5 mg, capsula"
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input value={medForm.forma_farmaceutica} onChange={(e) => setMedForm((p) => ({ ...p, forma_farmaceutica: e.target.value }))} placeholder="Forma farmaceutica" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.classe_terapeutica} onChange={(e) => setMedForm((p) => ({ ...p, classe_terapeutica: e.target.value }))} placeholder="Classe terapeutica" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.especie_alvo} onChange={(e) => setMedForm((p) => ({ ...p, especie_alvo: e.target.value }))} placeholder="Especie alvo" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.categoria} onChange={(e) => setMedForm((p) => ({ ...p, categoria: e.target.value }))} placeholder="Categoria" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.dose_min_mg_kg} onChange={(e) => setMedForm((p) => ({ ...p, dose_min_mg_kg: e.target.value }))} placeholder="Dose min (mg/kg)" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.dose_max_mg_kg} onChange={(e) => setMedForm((p) => ({ ...p, dose_max_mg_kg: e.target.value }))} placeholder="Dose max (mg/kg)" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.dose_intervalo_horas} onChange={(e) => setMedForm((p) => ({ ...p, dose_intervalo_horas: e.target.value }))} placeholder="Intervalo/frequencia (h)" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.via_padrao} onChange={(e) => setMedForm((p) => ({ ...p, via_padrao: e.target.value }))} placeholder="Via padrao" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.duracao_padrao} onChange={(e) => setMedForm((p) => ({ ...p, duracao_padrao: e.target.value }))} placeholder="Duracao padrao (opcional)" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.concentracao_mg_ml} onChange={(e) => setMedForm((p) => ({ ...p, concentracao_mg_ml: e.target.value }))} placeholder="Concentracao mg/mL" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                <input value={medForm.concentracao_mg_comprimido} onChange={(e) => setMedForm((p) => ({ ...p, concentracao_mg_comprimido: e.target.value }))} placeholder="Concentracao mg/comprimido" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Indicacoes</label>
                <textarea value={medForm.indicacoes} onChange={(e) => setMedForm((p) => ({ ...p, indicacoes: e.target.value }))} placeholder="Indicacoes clinicas importadas ou manuais" rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Contraindicacoes</label>
                <textarea value={medForm.contraindicacoes} onChange={(e) => setMedForm((p) => ({ ...p, contraindicacoes: e.target.value }))} placeholder="Contraindicacoes e precaucoes" rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Interacoes medicamentosas</label>
                <textarea value={medForm.interacoes} onChange={(e) => setMedForm((p) => ({ ...p, interacoes: e.target.value }))} placeholder="Uma interacao por linha" rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Observacao de seguranca</label>
                <textarea value={medForm.observacao_seguranca} onChange={(e) => setMedForm((p) => ({ ...p, observacao_seguranca: e.target.value }))} placeholder="Alertas, cuidados e avisos" rows={3} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Observacoes tecnicas</label>
                <textarea value={medForm.observacoes} onChange={(e) => setMedForm((p) => ({ ...p, observacoes: e.target.value }))} placeholder="Fonte, monitoramento, receita e notas adicionais" rows={5} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              </div>

              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Parametrize dose, interacoes e regras clinicas antes de automatizar receituarios em producao.
              </p>

              <div className="flex flex-wrap gap-2">
                <button onClick={saveMedicamento} className="rounded-2xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700">
                  <span className="inline-flex items-center gap-2"><Save className="w-4 h-4" />{medForm.id ? "Atualizar medicamento" : "Salvar medicamento"}</span>
                </button>
                <button
                  type="button"
                  onClick={resetMedicationForm}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Limpar ficha
                </button>
              </div>
            </div>

            <div className="xl:col-span-2 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              <div className="grid gap-3 border-b border-slate-200 p-3 md:grid-cols-[minmax(0,1fr),auto]">
                <input value={medBusca} onChange={(e) => setMedBusca(e.target.value)} placeholder="Buscar medicamento..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
                <button
                  type="button"
                  onClick={() => void carregarMedicamentosBanco()}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  Atualizar lista
                </button>
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-3 text-left">Nome</th>
                      <th className="px-3 py-3 text-left">Classe / origem</th>
                      <th className="px-3 py-3 text-left">Dose base</th>
                      <th className="px-3 py-3 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medFiltrados.map((med) => (
                      <tr
                        key={med.id}
                        onClick={() => editarMedicamento(med)}
                        className={`border-t transition ${medForm.id === med.id ? "bg-teal-50" : "cursor-pointer hover:bg-slate-50"}`}
                      >
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              editarMedicamento(med);
                            }}
                            className="text-left"
                          >
                            <p className="font-medium text-slate-900">{med.nome}</p>
                            <p className="text-xs text-slate-500">{med.principio_ativo || "-"}</p>
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-slate-800">{med.classe_terapeutica || med.categoria || "-"}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {formatarOrigemMedicamento(med.parametrizacao_origem)}
                            </span>
                            {med.parametrizado ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                Parametrizado
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-slate-800">
                            {med.dose_min_mg_kg || med.dose_max_mg_kg
                              ? `${med.dose_min_mg_kg ?? med.dose_max_mg_kg} a ${med.dose_max_mg_kg ?? med.dose_min_mg_kg} ${med.dose_unidade || "mg/kg"}`
                              : "Nao parametrizada"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {med.dose_intervalo_horas ? `a cada ${med.dose_intervalo_horas}h` : "Frequencia em aberto"}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                editarMedicamento(med);
                              }}
                              className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicarMedicamentoManipulado(med);
                              }}
                              className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-200"
                            >
                              Duplicar formula
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                adicionarMedicamentoNaPrescricao(med);
                              }}
                              className="rounded-xl bg-teal-100 px-3 py-2 text-xs font-medium text-teal-700 transition hover:bg-teal-200"
                            >
                              Prescrever
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                adicionarMedicamentoNaPrescricao(med, { manipulado: true });
                              }}
                              className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-200"
                            >
                              Presc. formula
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void desativarMedicamento(med);
                              }}
                              className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-200"
                            >
                              Desativar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {medFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                          Nenhum medicamento encontrado para a busca atual.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Abra este painel quando precisar parametrizar a biblioteca farmacologica.
            </div>
          )}
        </div>
        </>
        ) : null}
      </div>
      {attachmentPreview ? (
        <div
          data-fortcordis-overlay-safe="1"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-6"
        >
          <button
            type="button"
            aria-label="Fechar preview"
            onClick={closeAttachmentPreview}
            className="absolute inset-0 cursor-default"
          />
          <div
            data-fortcordis-overlay-safe="1"
            className="relative z-[121] flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Preview do anexo</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{attachmentPreview.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{attachmentPreview.anexo.descricao || attachmentPreview.anexo.tipo}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => abrirAnexo(attachmentPreview.anexo, "download")}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </button>
                {attachmentPreview.url ? (
                  <button
                    type="button"
                    onClick={() => window.open(attachmentPreview.url, "_blank", "noopener,noreferrer")}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Nova aba
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeAttachmentPreview}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                  Fechar
                </button>
              </div>
            </div>
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              {attachmentPreview.kind === "image" ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Imagem
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      Zoom {Math.round(attachmentImageZoom * 100)}%
                    </span>
                    {attachmentPreview.anexo.created_at ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {formatDate(attachmentPreview.anexo.created_at)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={zoomOutAttachmentImage}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Minus className="h-4 w-4" />
                      Reduzir
                    </button>
                    <button
                      type="button"
                      onClick={resetAttachmentImageView}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Ajustar
                    </button>
                    <button
                      type="button"
                      onClick={zoomInAttachmentImage}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                      Ampliar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      PDF
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      Pagina {attachmentPdfPage}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      Zoom {attachmentPdfZoom}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAttachmentPdfPage((current) => Math.max(1, current - 1))}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={attachmentPdfPage}
                      onChange={(event) => {
                        const nextPage = Number(event.target.value);
                        setAttachmentPdfPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1);
                      }}
                      className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachmentPdfPage((current) => current + 1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Proxima
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachmentPdfZoom((current) => Math.max(60, current - 10))}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Minus className="h-4 w-4" />
                      Zoom
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentPdfPage(1);
                        setAttachmentPdfZoom(110);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Resetar
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachmentPdfZoom((current) => Math.min(220, current + 10))}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                      Zoom
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-auto bg-slate-100 p-4 md:p-6">
              {attachmentPreview.kind === "image" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 px-1 text-xs font-medium text-slate-500">
                    <span className="rounded-full bg-white px-3 py-1">
                      {attachmentImageZoom > 1 ? "Arraste a imagem para explorar o detalhe." : "Amplie para habilitar o arraste."}
                    </span>
                    {attachmentImageZoom > 1 ? (
                      <button
                        type="button"
                        onClick={() => setAttachmentImageOffset({ x: 0, y: 0 })}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-600 hover:bg-slate-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Centralizar
                      </button>
                    ) : null}
                  </div>
                  <div
                    onPointerDown={handleAttachmentImagePointerDown}
                    onPointerMove={handleAttachmentImagePointerMove}
                    onPointerUp={handleAttachmentImagePointerUp}
                    onPointerCancel={handleAttachmentImagePointerUp}
                    className={`flex min-h-[60vh] items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 select-none touch-none ${
                      attachmentImageZoom > 1
                        ? attachmentImageDragging
                          ? "cursor-grabbing"
                          : "cursor-grab"
                        : "cursor-default"
                    }`}
                  >
                    <img
                      src={attachmentPreview.url}
                      alt={attachmentPreview.title}
                      draggable={false}
                      className="max-h-none w-auto max-w-none rounded-2xl object-contain transition-transform duration-150"
                      style={{
                        transform: `translate(${attachmentImageOffset.x}px, ${attachmentImageOffset.y}px) scale(${attachmentImageZoom})`,
                        transformOrigin: "center center",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="overflow-auto rounded-[24px] border border-slate-200 bg-slate-100 p-3">
                  <div
                    className="min-w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm"
                    style={{
                      width: `${Math.max(attachmentPdfZoom, 60)}%`,
                    }}
                  >
                    <iframe
                      key={`${attachmentPreview.url}-${attachmentPdfPage}`}
                      src={buildPdfPreviewUrl(attachmentPreview)}
                      title={attachmentPreview.title}
                      className="h-[72vh] w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
