"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { extractApiErrorMessage, extractApiErrorMessageSync } from "@/lib/api-error";
import { extrairIdadePaciente } from "@/lib/paciente";
import {
  ATENDIMENTOS_LIST_LIMIT,
  PRESCRICAO_PRESETS_STORAGE_KEY,
  calcularDataNascimentoEstimadaPorIdade,
  formatarCepVisual,
  formatarCpfVisual,
  normalizarCep,
  normalizarCpf,
} from "@/lib/atendimento-cadastro";
import {
  PROTOCOLOS_PRESCRICAO,
  type ProtocoloPrescricao,
  type ProtocoloPrescricaoItem,
} from "@/lib/atendimento-prescricao-protocolos";
import {
  addRacaCustomPorEspecie,
  getRacaOptions,
  loadRacasCustomPorEspecie,
  saveRacasCustomPorEspecie,
} from "@/lib/racas";
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
  Loader2,
  Paperclip,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  User,
  X,
} from "lucide-react";

const AtendimentoBibliotecasSection = dynamic(() => import("./components/AtendimentoBibliotecasSection"));
const AtendimentoCadastroComplementarSection = dynamic(() => import("./components/AtendimentoCadastroComplementarSection"));
const AtendimentoConsultaOverviewSection = dynamic(() => import("./components/AtendimentoConsultaOverviewSection"));
const AtendimentoConsultaEditorSection = dynamic(() => import("./components/AtendimentoConsultaEditorSection"));
const AtendimentoClinicalRadarAside = dynamic(() => import("./components/AtendimentoClinicalRadarAside"));
const AtendimentoDocumentosSection = dynamic(() => import("./components/AtendimentoDocumentosSection"));
const AtendimentoExamesSection = dynamic(() => import("./components/AtendimentoExamesSection"));
const AtendimentoPrescricaoAside = dynamic(() => import("./components/AtendimentoPrescricaoAside"));
const AtendimentoPrescricaoPreview = dynamic(() => import("./components/AtendimentoPrescricaoPreview"));
const AtendimentoPrescricaoWorkspace = dynamic(() => import("./components/AtendimentoPrescricaoWorkspace"));
const AtendimentoTriagemSection = dynamic(() => import("./components/AtendimentoTriagemSection"));
const AttachmentPreviewModal = dynamic(() => import("./components/AttachmentPreviewModal"), { ssr: false });
const PainelExamesModal = dynamic(() => import("./components/PainelExamesModal"), { ssr: false });

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

type DocumentoAtendimentoTemplate = {
  id: number;
  nome: string;
  tipo: string;
  titulo_padrao: string;
  corpo_template: string;
  ativo: number;
  ordem: number;
  criado_por_nome?: string;
  created_at?: string;
  updated_at?: string;
};

type DocumentoAtendimento = {
  id: number;
  atendimento_id: number;
  template_id?: number | null;
  titulo: string;
  corpo: string;
  status: string;
  criado_por_nome?: string;
  emitido_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DocumentoAtendimentoForm = {
  id: number | null;
  template_id: number | null;
  titulo: string;
  corpo: string;
  status: string;
};

type DocumentoTemplateForm = {
  id: number | null;
  nome: string;
  tipo: string;
  titulo_padrao: string;
  corpo_template: string;
  ordem: string;
  ativo: number;
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

type PacienteDetalhe = {
  id?: number | null;
  nome: string;
  tutor_id?: number | null;
  tutor?: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  peso_kg?: number | null;
  idade?: string;
  data_nascimento?: string | null;
  microchip?: string;
  observacoes?: string;
};

type TutorDetalhe = {
  id?: number | null;
  nome: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cpf?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

type CadastroComplementar = {
  paciente: PacienteDetalhe;
  tutor: TutorDetalhe;
};

type PrescricaoPreset = {
  id: string;
  nome: string;
  created_at: string;
  orientacoes_gerais: string;
  retorno_dias: string;
  itens: PrescricaoItem[];
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
  documentos: DocumentoAtendimento[];
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

const emptyPacienteDetalhe = (): PacienteDetalhe => ({
  id: null,
  nome: "",
  tutor_id: null,
  tutor: "",
  especie: "",
  raca: "",
  sexo: "",
  peso_kg: null,
  idade: "",
  data_nascimento: "",
  microchip: "",
  observacoes: "",
});

const emptyTutorDetalhe = (): TutorDetalhe => ({
  id: null,
  nome: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cpf: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
});

const emptyCadastroComplementar = (): CadastroComplementar => ({
  paciente: emptyPacienteDetalhe(),
  tutor: emptyTutorDetalhe(),
});

const normalizePacienteDetalhe = (item?: Partial<PacienteDetalhe> | null): PacienteDetalhe => ({
  ...emptyPacienteDetalhe(),
  ...(item || {}),
  nome: item?.nome || "",
  tutor: item?.tutor || "",
  especie: item?.especie || "",
  raca: item?.raca || "",
  sexo: item?.sexo || "",
  peso_kg: item?.peso_kg ?? null,
  idade: item?.idade || "",
  data_nascimento: item?.data_nascimento || "",
  microchip: item?.microchip || "",
  observacoes: item?.observacoes || "",
});

const normalizeTutorDetalhe = (item?: Partial<TutorDetalhe> | null): TutorDetalhe => ({
  ...emptyTutorDetalhe(),
  ...(item || {}),
  nome: item?.nome || "",
  telefone: item?.telefone || "",
  whatsapp: item?.whatsapp || "",
  email: item?.email || "",
  cpf: item?.cpf || "",
  cep: item?.cep || "",
  endereco: item?.endereco || "",
  numero: item?.numero || "",
  complemento: item?.complemento || "",
  bairro: item?.bairro || "",
  cidade: item?.cidade || "",
  estado: item?.estado || "",
});

const readLocalPresets = <T,>(storageKey: string): T[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistLocalPresets = (storageKey: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

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

const emptyDocumentoAtendimentoForm = (): DocumentoAtendimentoForm => ({
  id: null,
  template_id: null,
  titulo: "",
  corpo: "",
  status: "rascunho",
});

const emptyDocumentoTemplateForm = (): DocumentoTemplateForm => ({
  id: null,
  nome: "",
  tipo: "documento",
  titulo_padrao: "",
  corpo_template: "",
  ordem: "",
  ativo: 1,
});

const hydrateDocumentoForm = (item?: Partial<DocumentoAtendimento> | null): DocumentoAtendimentoForm => ({
  id: item?.id ?? null,
  template_id: item?.template_id ?? null,
  titulo: item?.titulo || "",
  corpo: item?.corpo || "",
  status: item?.status || "rascunho",
});

const hydrateDocumentoTemplateForm = (item?: Partial<DocumentoAtendimentoTemplate> | null): DocumentoTemplateForm => ({
  id: item?.id ?? null,
  nome: item?.nome || "",
  tipo: item?.tipo || "documento",
  titulo_padrao: item?.titulo_padrao || "",
  corpo_template: item?.corpo_template || "",
  ordem: item?.ordem != null ? String(item.ordem) : "",
  ativo: Number(item?.ativo ?? 1),
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
  documentos: [],
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
  documentos: d.documentos || [],
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
  documentos: raw?.documentos || [],
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
  const [FuseLib, setFuseLib] = useState<null | typeof import("fuse.js").default>(null);
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
  const [documentTemplates, setDocumentTemplates] = useState<DocumentoAtendimentoTemplate[]>([]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [clinicaFiltro, setClinicaFiltro] = useState("");
  const [dataInicioFiltro, setDataInicioFiltro] = useState("");
  const [dataFimFiltro, setDataFimFiltro] = useState("");
  const [paginaLista, setPaginaLista] = useState(1);
  const [totalLista, setTotalLista] = useState(0);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [form, setForm] = useState<AtendimentoForm>(emptyForm());
  const [pacienteBusca, setPacienteBusca] = useState("");
  const [exameBusca, setExameBusca] = useState("");
  const [exameFiltroRapido, setExameFiltroRapido] = useState<ExameFiltroRapido>("todos");
  const [painelExameSelecionado, setPainelExameSelecionado] = useState("");
  const [cadastroComplementar, setCadastroComplementar] = useState<CadastroComplementar>(emptyCadastroComplementar());
  const [carregandoCadastroComplementar, setCarregandoCadastroComplementar] = useState(false);
  const [salvandoCadastroComplementar, setSalvandoCadastroComplementar] = useState(false);
  const [customPaineis, setCustomPaineis] = useState<PainelExame[]>([]);
  const [painelModalOpen, setPainelModalOpen] = useState(false);
  const [painelModalMode, setPainelModalMode] = useState<"list" | "create" | "edit">("list");
  const [painelEmEdicao, setPainelEmEdicao] = useState<PainelExame | null>(null);
  const [painelFormNome, setPainelFormNome] = useState("");
  const [painelFormCategoria, setPainelFormCategoria] = useState("");
  const [painelFormItens, setPainelFormItens] = useState<number[]>([]);
  const [painelFormSearch, setPainelFormSearch] = useState("");
  const [painelFormErro, setPainelFormErro] = useState("");
  const [prescriptionPresets, setPrescriptionPresets] = useState<PrescricaoPreset[]>([]);
  const [nomeNovoPresetPrescricao, setNomeNovoPresetPrescricao] = useState("");
  const [presetPrescricaoEmEdicaoId, setPresetPrescricaoEmEdicaoId] = useState<string | null>(null);
  const [novaRacaCadastro, setNovaRacaCadastro] = useState("");
  const [racasCustomPorEspecie, setRacasCustomPorEspecie] = useState<Record<string, string[]>>({});
  const [racasLoaded, setRacasLoaded] = useState(false);
  const [buscandoCepTutor, setBuscandoCepTutor] = useState(false);
  const [statusCepTutor, setStatusCepTutor] = useState("");

  const [historicoPaciente, setHistoricoPaciente] = useState<HistoricoPaciente | null>(null);
  const [evolucaoForm, setEvolucaoForm] = useState({ descricao: "", sinais_vitais: "" });
  const [anexoForm, setAnexoForm] = useState({ tipo: "imagem", descricao: "", url: "" });
  const [anexoArquivo, setAnexoArquivo] = useState<File | null>(null);
  const [documentoTemplateSelecionado, setDocumentoTemplateSelecionado] = useState("");
  const [documentoClinicoForm, setDocumentoClinicoForm] = useState<DocumentoAtendimentoForm>(emptyDocumentoAtendimentoForm());
  const [documentoTemplateForm, setDocumentoTemplateForm] = useState<DocumentoTemplateForm>(emptyDocumentoTemplateForm());
  const [showDocumentoTemplateEditor, setShowDocumentoTemplateEditor] = useState(false);
  const [salvandoDocumentoClinico, setSalvandoDocumentoClinico] = useState(false);
  const [salvandoDocumentoTemplate, setSalvandoDocumentoTemplate] = useState(false);
  const [gerandoDocumentoPdfId, setGerandoDocumentoPdfId] = useState<number | null>(null);
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
  const [prescricaoEditorManualAberto, setPrescricaoEditorManualAberto] = useState(false);
  const [prescricaoBuscaRapida, setPrescricaoBuscaRapida] = useState("");
  const [prescricaoPreviewAtivo, setPrescricaoPreviewAtivo] = useState(false);
  const [prescricaoPreviewPdf, setPrescricaoPreviewPdf] = useState<string | null>(null);
  const [prescricaoPreviewLoading, setPrescricaoPreviewLoading] = useState(false);
  const [prescricaoPreviewErro, setPrescricaoPreviewErro] = useState<string | null>(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    carregarCustomPaineis();
    carregarDocumentoTemplates();
    setPrescriptionPresets(readLocalPresets<PrescricaoPreset>(PRESCRICAO_PRESETS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    setRacasCustomPorEspecie(loadRacasCustomPorEspecie());
    setRacasLoaded(true);
  }, []);

  useEffect(() => {
    persistLocalPresets(PRESCRICAO_PRESETS_STORAGE_KEY, prescriptionPresets);
  }, [prescriptionPresets]);

  useEffect(() => {
    if (!racasLoaded) return;
    saveRacasCustomPorEspecie(racasCustomPorEspecie);
  }, [racasCustomPorEspecie, racasLoaded]);

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

  const aplicarCadastroComplementar = (
    pacienteData?: Partial<PacienteDetalhe> | null,
    tutorData?: Partial<TutorDetalhe> | null
  ) => {
    setNovaRacaCadastro("");
    setStatusCepTutor("");
    setCadastroComplementar({
      paciente: normalizePacienteDetalhe(pacienteData),
      tutor: normalizeTutorDetalhe(tutorData),
    });
  };

  const carregarCadastroComplementar = async (pacienteId: string | number) => {
    const normalized = Number(pacienteId || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      aplicarCadastroComplementar();
      return;
    }

    try {
      setCarregandoCadastroComplementar(true);
      const pacienteResponse = await api.get(`/pacientes/${normalized}`);
      const pacienteData = pacienteResponse.data || {};
      let tutorData = null;
      const tutorId = Number(pacienteData?.tutor_id || 0);
      if (Number.isFinite(tutorId) && tutorId > 0) {
        try {
          const tutorResponse = await api.get(`/tutores/${tutorId}`);
          tutorData = tutorResponse.data || null;
        } catch {
          tutorData = null;
        }
      }
      if (!tutorData) {
        try {
          const tutorResponse = await api.get(`/pacientes/${normalized}/tutor`);
          tutorData = tutorResponse.data || null;
        } catch {
          tutorData = {
            id: pacienteData?.tutor_id || null,
            nome: pacienteData?.tutor || pacienteSelecionado?.tutor || "",
          };
        }
      }
      aplicarCadastroComplementar(
        {
          ...pacienteData,
          tutor: pacienteData?.tutor || pacienteSelecionado?.tutor || "",
        },
        tutorData
      );
    } finally {
      setCarregandoCadastroComplementar(false);
    }
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

  const atendimentoCombinaComContexto = (
    atendimentoResumo:
      | Pick<AtendimentoResumo, "paciente_id" | "clinica_id" | "agendamento_id">
      | null
      | undefined,
    contexto:
      | { paciente_id?: number | string | null; clinica_id?: number | string | null; agendamento_id?: number | string | null }
      | null
      | undefined
  ) => {
    const campoCompativel = (atendimentoValor?: number | string | null, contextoValor?: number | string | null) => {
      const atendimentoNormalizado = String(atendimentoValor || "").trim();
      const contextoNormalizado = String(contextoValor || "").trim();
      return !atendimentoNormalizado || !contextoNormalizado || atendimentoNormalizado === contextoNormalizado;
    };

    return (
      campoCompativel(atendimentoResumo?.agendamento_id, contexto?.agendamento_id) &&
      campoCompativel(atendimentoResumo?.paciente_id, contexto?.paciente_id) &&
      campoCompativel(atendimentoResumo?.clinica_id, contexto?.clinica_id)
    );
  };

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
        let contexto: any = null;

        try {
          const response = await api.get(`/atendimentos/contexto?agendamento_id=${agendamentoId}`);
          contexto = response.data || {};
        } catch (e: any) {
          setErro(extractApiErrorMessageSync(e, "Erro ao carregar contexto do agendamento."));
          setContextoAplicado(true);
          return;
        }

        try {
          const existentes = await api.get(`/atendimentos?agendamento_id=${agendamentoId}&limit=10`);
          const itensExistentes = Array.isArray(existentes.data?.items) ? existentes.data.items : [];
          const atendimentoExistente = itensExistentes.find((item: AtendimentoResumo) =>
            atendimentoCombinaComContexto(item, contexto)
          );
          if (atendimentoExistente?.id) {
            await abrirAtendimento(atendimentoExistente.id);
            setSucesso(`Atendimento #${atendimentoExistente.id} carregado a partir da agenda.`);
            setContextoAplicado(true);
            return;
          }
          if (itensExistentes.length > 0) {
            setSucesso("Contexto do agendamento carregado. Um atendimento antigo inconsistente foi ignorado.");
          }
        } catch {
          // segue com a abertura a partir do contexto do agendamento
        }

        setForm((prev) => ({
          ...prev,
          paciente_id: contexto.paciente_id ? String(contexto.paciente_id) : prev.paciente_id,
          especie: contexto.especie || prev.especie,
          clinica_id: contexto.clinica_id ? String(contexto.clinica_id) : prev.clinica_id,
          agendamento_id: String(agendamentoId),
        }));
        aplicarCadastroComplementar(contexto.paciente, contexto.tutor);
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

  useEffect(() => {
    let active = true;

    import("fuse.js")
      .then((module) => {
        if (active) {
          setFuseLib(() => module.default);
        }
      })
      .catch(() => {
        if (active) {
          setFuseLib(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
      await carregarLista(1);
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao carregar dados de atendimento."));
    } finally {
      setLoading(false);
    }
  };

  const carregarLista = async (
    page: number = paginaLista,
    filtrosOverride?: {
      busca?: string;
      status?: string;
      clinicaId?: string;
      dataInicio?: string;
      dataFim?: string;
    }
  ) => {
    try {
      const params = new URLSearchParams();
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const buscaAtual = filtrosOverride?.busca ?? busca;
      const statusAtual = filtrosOverride?.status ?? statusFiltro;
      const clinicaAtual = filtrosOverride?.clinicaId ?? clinicaFiltro;
      const dataInicioAtual = filtrosOverride?.dataInicio ?? dataInicioFiltro;
      const dataFimAtual = filtrosOverride?.dataFim ?? dataFimFiltro;
      params.append("limit", String(ATENDIMENTOS_LIST_LIMIT));
      params.append("skip", String((safePage - 1) * ATENDIMENTOS_LIST_LIMIT));
      if (statusAtual) params.append("status", statusAtual);
      if (buscaAtual.trim()) params.append("search", buscaAtual.trim());
      if (clinicaAtual) params.append("clinica_id", clinicaAtual);
      if (dataInicioAtual) params.append("data_inicio", `${dataInicioAtual}T00:00:00`);
      if (dataFimAtual) params.append("data_fim", `${dataFimAtual}T23:59:59`);
      const response = await api.get(`/atendimentos?${params.toString()}`);
      setLista(response.data?.items || []);
      setTotalLista(Number(response.data?.total || 0));
      setPaginaLista(safePage);
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao listar atendimentos."));
    }
  };

  const filtered = useMemo(() => lista, [lista]);
  const totalPaginasLista = Math.max(1, Math.ceil(totalLista / ATENDIMENTOS_LIST_LIMIT));

  const aplicarFiltrosLista = async () => {
    await carregarLista(1);
  };

  const limparFiltrosLista = async () => {
    const vazio = "";
    setBusca(vazio);
    setStatusFiltro(vazio);
    setClinicaFiltro(vazio);
    setDataInicioFiltro(vazio);
    setDataFimFiltro(vazio);
    await carregarLista(1, {
      busca: vazio,
      status: vazio,
      clinicaId: vazio,
      dataInicio: vazio,
      dataFim: vazio,
    });
  };

  const pacientesFuse = useMemo(
    () =>
      FuseLib
        ? new FuseLib(pacientes, {
            keys: ["nome", "tutor"],
            threshold: 0.35,
            ignoreLocation: true,
          })
        : null,
    [FuseLib, pacientes]
  );

  const medicamentosFuse = useMemo(
    () =>
      FuseLib
        ? new FuseLib(medicamentos, {
            keys: ["nome", "principio_ativo", "categoria", "classe_terapeutica"],
            threshold: 0.3,
            ignoreLocation: true,
          })
        : null,
    [FuseLib, medicamentos]
  );

  const catalogoExamesFuse = useMemo(
    () =>
      FuseLib
        ? new FuseLib(catalogoExames, {
            keys: ["nome", "codigo", "categoria", "subcategoria", "sinonimos"],
            threshold: 0.3,
            ignoreLocation: true,
          })
        : null,
    [FuseLib, catalogoExames]
  );

  const pacientesFiltrados = useMemo(() => {
    const term = pacienteBusca.trim();
    if (term.length < 2) return [];
    if (!pacientesFuse) {
      const normalizedTerm = term.toLowerCase();
      return pacientes
        .filter((paciente) =>
          [paciente.nome, paciente.tutor].some((value) =>
            String(value || "").toLowerCase().includes(normalizedTerm)
          )
        )
        .slice(0, 8);
    }
    return pacientesFuse.search(term).map((entry) => entry.item).slice(0, 8);
  }, [pacienteBusca, pacientes, pacientesFuse]);

  const medFiltrados = useMemo(() => {
    const term = medBusca.trim();
    if (!term) return medicamentos;
    if (!medicamentosFuse) {
      const normalizedTerm = term.toLowerCase();
      return medicamentos.filter((item) =>
        [item.nome, item.principio_ativo, item.categoria, item.classe_terapeutica].some((value) =>
          String(value || "").toLowerCase().includes(normalizedTerm)
        )
      );
    }
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
    if (!medicamentosFuse) {
      const normalizedTerm = term.toLowerCase();
      return medicamentosCardiologiaLista
        .filter((item) =>
          [item.nome, item.principio_ativo, item.categoria, item.classe_terapeutica].some((value) =>
            String(value || "").toLowerCase().includes(normalizedTerm)
          )
        )
        .slice(0, 8);
    }
    return medicamentosFuse.search(term).map((entry) => entry.item).slice(0, 8);
  }, [medicamentosCardiologiaLista, medicamentosFuse, prescricaoBuscaRapida]);

  const examesCatalogoFiltrados = useMemo(() => {
    const term = exameBusca.trim();
    if (!term) return catalogoExames.slice(0, 8);
    if (!catalogoExamesFuse) {
      const normalizedTerm = term.toLowerCase();
      return catalogoExames
        .filter((item) =>
          [item.nome, item.codigo, item.categoria, item.subcategoria].some((value) =>
            String(value || "").toLowerCase().includes(normalizedTerm)
          ) ||
          (Array.isArray(item.sinonimos)
            ? item.sinonimos.some((value) => String(value || "").toLowerCase().includes(normalizedTerm))
            : String(item.sinonimos || "").toLowerCase().includes(normalizedTerm))
        )
        .slice(0, 8);
    }
    return catalogoExamesFuse.search(term).map((entry) => entry.item).slice(0, 8);
  }, [catalogoExames, exameBusca, catalogoExamesFuse]);

  const pacienteSelecionado = useMemo(() => {
    return pacientes.find((p) => String(p.id) === form.paciente_id) || null;
  }, [pacientes, form.paciente_id]);

  // Especie unificada: prioriza form.especie (do banco) com fallback para pacienteSelecionado
  const especieExibicao = useMemo(() => {
    if (form.especie) return form.especie;
    if (pacienteSelecionado?.especie) return pacienteSelecionado.especie;
    return null;
  }, [form.especie, pacienteSelecionado?.especie]);

  const pacienteNomeExibicao = cadastroComplementar.paciente.nome || pacienteSelecionado?.nome || "";
  const tutorNomeExibicao = cadastroComplementar.tutor.nome || pacienteSelecionado?.tutor || "";
  const especieRacaExibicao = [
    cadastroComplementar.paciente.especie || especieExibicao || "",
    cadastroComplementar.paciente.raca || pacienteSelecionado?.raca || "",
  ]
    .filter(Boolean)
    .join(" - ");
  const idadePacienteExibicao = extrairIdadePaciente({
    idade: cadastroComplementar.paciente.idade,
    data_nascimento: cadastroComplementar.paciente.data_nascimento,
    observacoes: cadastroComplementar.paciente.observacoes,
  });
  const especieCadastroAtual = cadastroComplementar.paciente.especie || especieExibicao || "";
  const opcoesRacaCadastro = useMemo(() => {
    if (!especieCadastroAtual) return [];
    return getRacaOptions(
      especieCadastroAtual,
      cadastroComplementar.paciente.raca,
      racasCustomPorEspecie[especieCadastroAtual] || [],
    );
  }, [cadastroComplementar.paciente.raca, especieCadastroAtual, racasCustomPorEspecie]);
  const cadastroComplementarPendencias = useMemo(() => {
    const pendencias: string[] = [];
    if (!cadastroComplementar.paciente.especie) pendencias.push("especie");
    if (!cadastroComplementar.paciente.raca) pendencias.push("raca");
    if (!cadastroComplementar.paciente.data_nascimento) pendencias.push("data de nascimento");
    if (cadastroComplementar.paciente.peso_kg == null) pendencias.push("peso cadastral");
    if (!cadastroComplementar.tutor.whatsapp) pendencias.push("whatsapp");
    if (!cadastroComplementar.tutor.email) pendencias.push("email");
    if (!cadastroComplementar.tutor.cpf) pendencias.push("cpf");
    if (!cadastroComplementar.tutor.endereco) pendencias.push("endereco");
    if (!cadastroComplementar.tutor.cidade) pendencias.push("cidade");
    if (!cadastroComplementar.tutor.estado) pendencias.push("estado");
    return pendencias;
  }, [cadastroComplementar]);

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
      aplicarCadastroComplementar();
      return;
    }
    void carregarHistoricoPaciente(form.paciente_id);
    void carregarCadastroComplementar(form.paciente_id);
  }, [form.paciente_id]);

  const abrirAtendimento = async (id: number) => {
    try {
      const response = await api.get(`/atendimentos/${id}`);
      const d = response.data;
      const hydrated = hydrateFormFromDetail(d);
      setSelecionado(id);
      clearDraftStorage();
      draftRestoreRef.current = true;

      // Carregar historico do paciente
      if (d.paciente_id) {
        await carregarHistoricoPaciente(d.paciente_id);
      }
      aplicarCadastroComplementar(d.paciente, d.tutor);
      hydratingFormRef.current = true;
      setForm(hydrated);
      setProtocoloPrescricaoSelecionado("");
      setPrescricaoEditorManualAberto(false);
      setPrescricaoEntradaModo(null);
      setPrescricaoBuscaRapida("");
      setDocumentoTemplateSelecionado("");
      setDocumentoClinicoForm(emptyDocumentoAtendimentoForm());
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
      setErro(extractApiErrorMessageSync(e, "Erro ao abrir atendimento."));
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
    setPrescricaoEditorManualAberto(false);
    setPrescricaoEntradaModo(null);
    setPrescricaoBuscaRapida("");
    setDocumentoTemplateSelecionado("");
    setDocumentoClinicoForm(emptyDocumentoAtendimentoForm());
    setAnexoArquivo(null);
    clearExamUploadDrafts();
    setHistoricoPaciente(null);
    aplicarCadastroComplementar();
    setNovaRacaCadastro("");
    setStatusCepTutor("");
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
    setNovaRacaCadastro("");
    setStatusCepTutor("");
    aplicarCadastroComplementar(
      {
        id: paciente.id,
        nome: paciente.nome,
        tutor_id: paciente.tutor_id || null,
        tutor: paciente.tutor || "",
        especie: paciente.especie || "",
        raca: paciente.raca || "",
      },
      {
        id: paciente.tutor_id || null,
        nome: paciente.tutor || "",
      }
    );
    setMostrarPacientes(false);
  };

  const setCadastroPacienteField = (field: keyof PacienteDetalhe, value: string | number | null) => {
    setCadastroComplementar((prev) => ({
      ...prev,
      paciente: {
        ...prev.paciente,
        ...(field === "idade"
          ? {
              idade: String(value ?? ""),
              data_nascimento:
                calcularDataNascimentoEstimadaPorIdade(String(value ?? "")) ||
                prev.paciente.data_nascimento ||
                "",
            }
          : { [field]: value }),
      },
    }));
  };

  const setCadastroTutorField = (field: keyof TutorDetalhe, value: string | number | null) => {
    setCadastroComplementar((prev) => ({
      ...prev,
      tutor: {
        ...prev.tutor,
        ...(field === "cpf" ? { cpf: formatarCpfVisual(String(value ?? "")) } : { [field]: value }),
      },
    }));
  };

  const handleAdicionarRacaCadastro = () => {
    const especieAtual = (especieCadastroAtual || "").trim();
    const racaDigitada = novaRacaCadastro.trim();
    if (!especieAtual) {
      setErro("Selecione a especie antes de cadastrar uma nova raca.");
      return;
    }
    if (!racaDigitada) return;

    const racaExistente =
      opcoesRacaCadastro.find((item) => item.toLowerCase() === racaDigitada.toLowerCase()) || racaDigitada;

    setRacasCustomPorEspecie((prev) => addRacaCustomPorEspecie(prev, especieAtual, racaDigitada));
    setCadastroPacienteField("raca", racaExistente);
    setNovaRacaCadastro("");
    setErro("");
  };

  const consultarCepTutor = async () => {
    const cep = normalizarCep(cadastroComplementar.tutor.cep || "");
    if (cep.length !== 8) return;

    try {
      setBuscandoCepTutor(true);
      const response = await api.get(`/clinicas/cep/${cep}`);
      const item = response?.data?.item || {};
      setCadastroComplementar((prev) => ({
        ...prev,
        tutor: {
          ...prev.tutor,
          cep: formatarCepVisual(item.cep || cep),
          endereco: item.logradouro || prev.tutor.endereco || "",
          complemento: prev.tutor.complemento || item.complemento || "",
          bairro: item.bairro || prev.tutor.bairro || "",
          cidade: item.cidade || prev.tutor.cidade || "",
          estado: item.estado || prev.tutor.estado || "",
        },
      }));
      setStatusCepTutor(
        item?.bairro_origem === "aprendizado"
          ? "CEP preenchido com bairro aprendido."
          : "CEP preenchido pelo ViaCEP."
      );
    } catch (error: any) {
      const detail = extractApiErrorMessageSync(error, "Falha ao consultar CEP.");
      setStatusCepTutor(String(detail));
    } finally {
      setBuscandoCepTutor(false);
    }
  };

  const sincronizarPesoCadastroNaTriagem = () => {
    const pesoCadastral = cadastroComplementar.paciente.peso_kg;
    if (pesoCadastral == null || !Number.isFinite(Number(pesoCadastral))) {
      setErro("Informe um peso cadastral valido antes de sincronizar.");
      return;
    }
    setField("triagem", { ...form.triagem, peso: Number(pesoCadastral) });
    setSucesso("Peso cadastral copiado para a triagem.");
    setErro("");
  };

  const salvarCadastroComplementarAtual = async () => {
    if (!form.paciente_id) {
      setErro("Selecione um paciente para complementar o cadastro.");
      return;
    }

    try {
      setSalvandoCadastroComplementar(true);
      const pacienteId = Number(form.paciente_id);
      const pacientePayload = {
        nome: cadastroComplementar.paciente.nome.trim(),
        tutor: cadastroComplementar.tutor.nome.trim() || undefined,
        especie: cadastroComplementar.paciente.especie || null,
        raca: cadastroComplementar.paciente.raca || null,
        data_nascimento: cadastroComplementar.paciente.data_nascimento || null,
        peso_kg:
          cadastroComplementar.paciente.peso_kg == null || Number.isNaN(Number(cadastroComplementar.paciente.peso_kg))
            ? null
            : Number(cadastroComplementar.paciente.peso_kg),
      };

      await api.put(`/pacientes/${pacienteId}`, pacientePayload);
      const pacienteAtualizado = await api.get(`/pacientes/${pacienteId}`);
      let tutorId = Number(pacienteAtualizado.data?.tutor_id || cadastroComplementar.tutor.id || 0);
      if (!Number.isFinite(tutorId) || tutorId <= 0) {
        try {
          const tutorAtual = await api.get(`/pacientes/${pacienteId}/tutor`);
          tutorId = Number(tutorAtual.data?.id || 0);
        } catch {
          tutorId = 0;
        }
      }

      if (Number.isFinite(tutorId) && tutorId > 0) {
        try {
          await api.put(`/tutores/${tutorId}`, {
            nome: cadastroComplementar.tutor.nome.trim() || undefined,
            telefone: cadastroComplementar.tutor.telefone || "",
            whatsapp: cadastroComplementar.tutor.whatsapp || "",
            email: cadastroComplementar.tutor.email || "",
            cpf: normalizarCpf(cadastroComplementar.tutor.cpf || ""),
            cep: cadastroComplementar.tutor.cep || "",
            endereco: cadastroComplementar.tutor.endereco || "",
            numero: cadastroComplementar.tutor.numero || "",
            complemento: cadastroComplementar.tutor.complemento || "",
            bairro: cadastroComplementar.tutor.bairro || "",
            cidade: cadastroComplementar.tutor.cidade || "",
            estado: cadastroComplementar.tutor.estado || "",
          });
        } catch (tutorError) {
          console.error("Falha ao atualizar tutor no cadastro complementar", tutorError);
        }
      }

      await carregarCadastroComplementar(pacienteId);
      setField("especie", pacientePayload.especie || "");
      setPacienteBusca(pacientePayload.nome || pacienteBusca);
      setPacientes((prev) =>
        prev.map((item) =>
          item.id === pacienteId
            ? {
                ...item,
                nome: pacientePayload.nome || item.nome,
                tutor: cadastroComplementar.tutor.nome || item.tutor,
                tutor_id: tutorId || item.tutor_id,
                especie: pacientePayload.especie || item.especie,
                raca: pacientePayload.raca || item.raca,
              }
            : item
        )
      );
      setSucesso("Cadastro complementar salvo com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao salvar cadastro complementar."));
    } finally {
      setSalvandoCadastroComplementar(false);
    }
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
    setPrescricaoEditorManualAberto(true);
    setWorkspacePainel("prescricao");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("prescricao-itens")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
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
        paciente_nome: pacienteNomeExibicao || "",
        paciente_especie: especieExibicao || "",
        paciente_raca: cadastroComplementar.paciente.raca || pacienteSelecionado?.raca || "",
        paciente_peso: form.triagem.peso || null,
        paciente_sexo: "",
        paciente_idade: idadePacienteExibicao || "",
        tutor_nome: tutorNomeExibicao || "",
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
        setPrescricaoPreviewErro("Resposta invalida do servidor.");
        return;
      }
      // data URL direto no iframe funciona na maioria dos navegadores
      setPrescricaoPreviewPdf(`data:application/pdf;base64,${pdfB64}`);
    } catch (err: any) {
      console.error("Erro ao gerar preview PDF:", err);
      setPrescricaoPreviewPdf(null);
      const msg = extractApiErrorMessageSync(err, "Erro ao gerar preview.");
      setPrescricaoPreviewErro(msg);
    } finally {
      setPrescricaoPreviewLoading(false);
    }
  }, [cadastroComplementar.paciente.raca, especieExibicao, form, idadePacienteExibicao, pacienteNomeExibicao, pacienteSelecionado?.raca, tutorNomeExibicao]);

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

  const carregarCustomPaineis = async () => {
    try {
      const response = await api.get<PainelExame[]>("/atendimentos/paineis");
      setCustomPaineis(response.data || []);
    } catch {
      setErro("Erro ao carregar paineis customizados.");
    }
  };

  const salvarPainelExame = async (formMode: "create" | "edit" = "create") => {
    const nome = painelFormNome.trim();
    if (!nome) {
      setPainelFormErro("Informe um nome para o painel.");
      return;
    }

    const examesSelecionados = painelFormItens
      .map((exameId) => {
        const found = catalogoExames.find((e) => e.id === exameId);
        return found || null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (formMode === "create") {
      try {
        const payload = {
          nome,
          categoria: painelFormCategoria,
          especie_alvo: "",
          observacoes: "",
          itens: examesSelecionados.map((e) => ({ catalogo_exame_id: e.id, ordem: 0 })),
        };
        await api.post("/atendimentos/paineis", payload);
        setSucesso(`Painel "${nome}" criado com sucesso.`);
        await carregarCustomPaineis();
        setPainelModalMode("list");
        setPainelFormNome("");
        setPainelFormCategoria("");
        setPainelFormItens([]);
        setPainelFormErro("");
      } catch (error: any) {
        setPainelFormErro(await extractApiErrorMessage(error, "Erro ao criar painel. Tente novamente."));
      }
    } else if (formMode === "edit" && painelEmEdicao) {
      try {
        const payload = {
          nome,
          categoria: painelFormCategoria,
          especie_alvo: "",
          observacoes: "",
          ativo: 1,
          itens: examesSelecionados.map((e) => ({ catalogo_exame_id: e.id, ordem: 0 })),
        };
        await api.put(`/atendimentos/paineis/${painelEmEdicao.id}`, payload);
        setSucesso(`Painel "${nome}" atualizado com sucesso.`);
        await carregarCustomPaineis();
        setPainelModalMode("list");
        setPainelFormNome("");
        setPainelFormCategoria("");
        setPainelFormItens([]);
        setPainelFormErro("");
        setPainelEmEdicao(null);
      } catch (error: any) {
        setPainelFormErro(await extractApiErrorMessage(error, "Erro ao atualizar painel. Tente novamente."));
      }
    }
  };

  const excluirPainelExame = async (painelId: number) => {
    if (!confirm("Tem certeza que deseja excluir este painel?")) return;
    try {
      await api.delete(`/atendimentos/paineis/${painelId}`);
      setSucesso("Painel removido com sucesso.");
      await carregarCustomPaineis();
    } catch {
      setErro("Erro ao excluir painel. Tente novamente.");
    }
  };

  const editarPainelExame = (painel: PainelExame) => {
    setPainelEmEdicao(painel);
    setPainelFormNome(painel.nome);
    setPainelFormCategoria(painel.categoria || "");
    setPainelFormItens(painel.itens.map((i: any) => i.catalogo_exame_id));
    setPainelFormSearch("");
    setPainelFormErro("");
    setPainelModalMode("edit");
  };

  const aplicarPainel = (painel: PainelExame) => {
    if (!painel.itens?.length) {
      setErro(`O painel "${painel.nome}" nao tem exames definidos.`);
      return;
    }
    const existentes = new Set(
      form.exames
        .filter((item) => (item.tipo_exame || "").trim())
        .map((item) =>
          [
            item.catalogo_exame_id || "",
            (item.tipo_exame || "").trim().toLowerCase(),
            item.painel_exame_id || "",
            item.prioridade || "",
          ].join("|")
        )
    );

    const novosExames = painel.itens
      .map((item: any) =>
        buildExamFromCatalog(
          {
            id: item.catalogo_exame_id,
            codigo: item.codigo || "",
            nome: item.nome || "",
            categoria: item.categoria || "",
            subcategoria: item.subcategoria || "",
            especie_alvo: "",
            prioridade_padrao: item.prioridade_padrao || "Rotina",
            valor_padrao: item.valor_padrao || 0,
            preparo: item.preparo || "",
            observacoes_padrao: item.observacoes_padrao || "",
            sinonimos: [],
            ativo: 1,
          },
          painel
        )
      )
      .filter((item) => {
        const identity = [
          item.catalogo_exame_id || "",
          (item.tipo_exame || "").trim().toLowerCase(),
          item.painel_exame_id || "",
          item.prioridade || "",
        ].join("|");
        return !existentes.has(identity);
      });

    if (!novosExames.length) {
      setSucesso(`Todos os exames do painel "${painel.nome}" ja estao na solicitacao.`);
      setErro("");
      return;
    }

    mergeExamesNoFormulario(novosExames);
    setSucesso(`Painel "${painel.nome}" aplicado com ${novosExames.length} item(ns).`);
    setErro("");
  };

  const salvarPresetPrescricaoAtual = () => {
    const nome = nomeNovoPresetPrescricao.trim();
    const itens = form.prescricao_itens
      .filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim())
      .map((item) => ({
        ...hydratePrescriptionItem(item),
        id: undefined,
        historico_ajustes: [],
      }));

    if (!nome) {
      setErro("Informe um nome para o preset de prescricao.");
      return;
    }
    if (!itens.length) {
      setErro("Adicione pelo menos um item na prescricao antes de salvar o preset.");
      return;
    }

    const presetAnterior = presetPrescricaoEmEdicaoId
      ? prescriptionPresets.find((item) => item.id === presetPrescricaoEmEdicaoId)
      : null;
    const preset: PrescricaoPreset = {
      id: presetAnterior?.id || `prescription-preset-${Date.now()}`,
      nome,
      created_at: presetAnterior?.created_at || new Date().toISOString(),
      orientacoes_gerais: form.prescricao_orientacoes || "",
      retorno_dias: form.prescricao_retorno_dias || "",
      itens,
    };
    const nomeNormalizado = normalizarTokenPrescricao(nome);
    setPrescriptionPresets((prev) => [
      preset,
      ...prev.filter(
        (item) => item.id !== preset.id && normalizarTokenPrescricao(item.nome) !== nomeNormalizado
      ),
    ]);
    setPresetPrescricaoEmEdicaoId(null);
    setNomeNovoPresetPrescricao("");
    setSucesso(
      presetAnterior
        ? `Preset de prescricao "${nome}" atualizado.`
        : `Preset de prescricao "${nome}" salvo.`
    );
    setErro("");
  };

  const aplicarPresetPrescricao = (preset: PrescricaoPreset) => {
    const pesoReferencia = normalizePeso(form.triagem.peso);
    const itensGerados = preset.itens.map((item) => {
      const hydrated = hydratePrescriptionItem({ ...item, id: undefined, historico_ajustes: [] });
      const med = hydrated.medicamento_id ? medicamentos.find((entry) => entry.id === hydrated.medicamento_id) || null : null;
      const nextItem = {
        ...hydrated,
        peso_referencia_kg: pesoReferencia ? String(pesoReferencia) : hydrated.peso_referencia_kg,
      };
      if (pesoReferencia) {
        const presentationSuggestion =
          med && !(nextItem.medicamento_nome || "").toLowerCase().includes("formula manipulada")
            ? suggestMedicationPresentation(pesoReferencia, med)
            : null;
        const calculo = calcularDosePrescricaoItem(nextItem, med, pesoReferencia);
        const doseCalculada = formatarDoseTextoCalculada(calculo);
        return {
          ...nextItem,
          apresentacao_selecionada:
            presentationSuggestion && !presentationSuggestion.requerManipulacao
              ? presentationSuggestion.presentationLabel
              : nextItem.apresentacao_selecionada,
          dose:
            presentationSuggestion && !presentationSuggestion.requerManipulacao && presentationSuggestion.doseAplicada
              ? presentationSuggestion.doseAplicada
              : (doseCalculada || nextItem.dose),
        };
      }
      return nextItem;
    });

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

    const orientacaoPreset = (preset.orientacoes_gerais || "").trim();
    const orientacoesAtuais = (form.prescricao_orientacoes || "").trim();
    const orientacoesFinais = orientacaoPreset
      ? orientacoesAtuais
        ? orientacoesAtuais.includes(orientacaoPreset)
          ? orientacoesAtuais
          : `${orientacoesAtuais}\n\n${orientacaoPreset}`
        : orientacaoPreset
      : orientacoesAtuais;

    setField("prescricao_itens", itensFinais.length ? itensFinais : [emptyPrescriptionItem()]);
    setField("prescricao_orientacoes", orientacoesFinais);
    if (!form.prescricao_retorno_dias && preset.retorno_dias) {
      setField("prescricao_retorno_dias", preset.retorno_dias);
    }
    setPrescricaoValidationErrors({});
    setSucesso(`Preset de prescricao "${preset.nome}" aplicado.`);
    setErro("");
  };

  const editarPresetPrescricao = (preset: PrescricaoPreset) => {
    const itens = preset.itens.length
      ? preset.itens.map((item) => hydratePrescriptionItem({ ...item, id: undefined, historico_ajustes: [] }))
      : [emptyPrescriptionItem()];
    setField("prescricao_itens", itens);
    setField("prescricao_orientacoes", preset.orientacoes_gerais || "");
    setField("prescricao_retorno_dias", preset.retorno_dias || "");
    setPrescricaoValidationErrors({});
    setNomeNovoPresetPrescricao(preset.nome);
    setPresetPrescricaoEmEdicaoId(preset.id);
    setWorkspacePainel("prescricao");
    setSucesso(`Preset de prescricao "${preset.nome}" carregado para edicao.`);
    setErro("");
  };

  const cancelarEdicaoPresetPrescricao = () => {
    setPresetPrescricaoEmEdicaoId(null);
    setNomeNovoPresetPrescricao("");
  };

  const removerPresetPrescricao = (presetId: string) => {
    setPrescriptionPresets((prev) => prev.filter((item) => item.id !== presetId));
    if (presetPrescricaoEmEdicaoId === presetId) {
      setPresetPrescricaoEmEdicaoId(null);
      setNomeNovoPresetPrescricao("");
    }
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
        await carregarLista(paginaLista);
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
        setErro(extractApiErrorMessageSync(e, "Erro ao salvar atendimento."));
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
      await carregarLista(paginaLista);
      setSucesso("Atendimento excluido com sucesso.");
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao excluir atendimento."));
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

  const uploadArquivosResultadoExame = async (index: number, files: File[]) => {
    const arquivosValidos = files.filter(Boolean);
    if (arquivosValidos.length === 0) return;
    const examAtual = formRef.current.exames[index];
    if (!examAtual) return;
    if (!(examAtual.tipo_exame || "").trim()) {
      setErro("Informe o nome do exame antes de anexar os arquivos.");
      return;
    }

    const exameId = await resolveExamIdForUpload(index);
    if (!exameId) {
      setErro("Nao foi possivel salvar o exame para anexar os arquivos.");
      return;
    }

    for (const file of arquivosValidos) {
      const uploadConcluido = await uploadAnexoArquivo(file, {
        exameId,
        tipo: "resultado_exame",
        descricao: `Arquivo de resultado: ${examAtual.tipo_exame || "Exame"}`,
        uploadKey: `exame-${index}`,
      });
      if (!uploadConcluido) {
        break;
      }
    }
    clearExamUploadDraft(index);
    clearExamDropState(index);
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
      setErro(extractApiErrorMessageSync(e, "Erro ao enviar arquivo."));
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
      setErro(extractApiErrorMessageSync(e, "Erro ao adicionar link do anexo."));
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
        setErro(extractApiErrorMessageSync(e, "Erro ao abrir anexo."));
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
      setErro(extractApiErrorMessageSync(e, "Erro ao excluir anexo."));
    }
  };

  const carregarDocumentoTemplates = async () => {
    try {
      const response = await api.get("/atendimentos/documentos/templates?include_inactive=1");
      setDocumentTemplates(response.data?.templates || []);
      return response.data?.templates || [];
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao carregar templates de documentos."));
      return [];
    }
  };

  const mergeDocumentoClinico = (documento: DocumentoAtendimento) => {
    setForm((current) => ({
      ...current,
      documentos: [documento, ...current.documentos.filter((item) => item.id !== documento.id)],
    }));
  };

  const recarregarDocumentosAtendimento = async (atendimentoId: number) => {
    const response = await api.get(`/atendimentos/${atendimentoId}/documentos`);
    const documentos = (response.data?.documentos || []) as DocumentoAtendimento[];
    setForm((current) => ({ ...current, documentos }));
    return documentos;
  };

  const obterAtendimentoIdParaDocumento = async () => {
    const currentSnapshot = serializeAtendimentoSnapshot(formRef.current);
    let atendimentoId = selecionado;
    if (!atendimentoId || currentSnapshot !== lastPersistedSnapshotRef.current || autosaveState === "error") {
      atendimentoId = await saveAtendimento("manual");
    }
    return atendimentoId;
  };

  const selecionarDocumentoClinico = (documento: DocumentoAtendimento) => {
    setDocumentoClinicoForm(hydrateDocumentoForm(documento));
    setDocumentoTemplateSelecionado(documento.template_id ? String(documento.template_id) : "");
    setErro("");
  };

  const novoDocumentoClinicoLivre = () => {
    setDocumentoClinicoForm(emptyDocumentoAtendimentoForm());
    setDocumentoTemplateSelecionado("");
    setErro("");
  };

  const criarDocumentoClinicoDeTemplate = async () => {
    if (!documentoTemplateSelecionado) {
      setErro("Selecione um template de documento.");
      return null;
    }

    const atendimentoId = await obterAtendimentoIdParaDocumento();
    if (!atendimentoId) return null;

    try {
      setSalvandoDocumentoClinico(true);
      const response = await api.post(`/atendimentos/${atendimentoId}/documentos`, {
        template_id: Number(documentoTemplateSelecionado),
      });
      const documento = response.data as DocumentoAtendimento;
      mergeDocumentoClinico(documento);
      const documentosAtualizados = await recarregarDocumentosAtendimento(atendimentoId);
      const documentoPersistido = documentosAtualizados.find((item) => item.id === documento.id) || documento;
      setDocumentoClinicoForm(hydrateDocumentoForm(documentoPersistido));
      setSucesso("Documento criado a partir do template.");
      setErro("");
      return documentoPersistido;
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao criar documento."));
      return null;
    } finally {
      setSalvandoDocumentoClinico(false);
    }
  };

  const salvarDocumentoClinico = async (options?: { quiet?: boolean }) => {
    const titulo = documentoClinicoForm.titulo.trim();
    const corpo = documentoClinicoForm.corpo.trim();
    if (!titulo || !corpo) {
      setErro("Preencha titulo e corpo do documento.");
      return null;
    }

    const atendimentoId = await obterAtendimentoIdParaDocumento();
    if (!atendimentoId) return null;

    try {
      setSalvandoDocumentoClinico(true);
      const payload = {
        template_id: documentoClinicoForm.template_id || undefined,
        titulo,
        corpo,
        status: documentoClinicoForm.status || "rascunho",
      };
      const response = documentoClinicoForm.id
        ? await api.put(`/atendimentos/${atendimentoId}/documentos/${documentoClinicoForm.id}`, payload)
        : await api.post(`/atendimentos/${atendimentoId}/documentos`, payload);
      const documento = response.data as DocumentoAtendimento;
      mergeDocumentoClinico(documento);
      const documentosAtualizados = await recarregarDocumentosAtendimento(atendimentoId);
      const documentoPersistido = documentosAtualizados.find((item) => item.id === documento.id) || documento;
      setDocumentoClinicoForm(hydrateDocumentoForm(documentoPersistido));
      if (!options?.quiet) {
        setSucesso("Documento salvo com sucesso.");
      }
      setErro("");
      return documentoPersistido;
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao salvar documento."));
      return null;
    } finally {
      setSalvandoDocumentoClinico(false);
    }
  };

  const baixarPdfDocumentoClinico = async (documento?: DocumentoAtendimento) => {
    let documentoParaPdf: DocumentoAtendimento | null = documento || null;
    const editandoMesmoDocumento = documentoParaPdf && documentoClinicoForm.id === documentoParaPdf.id;
    if (!documentoParaPdf || editandoMesmoDocumento) {
      documentoParaPdf = await salvarDocumentoClinico({ quiet: true });
    }
    if (!documentoParaPdf?.id) return;

    try {
      setGerandoDocumentoPdfId(documentoParaPdf.id);
      const response = await api.get(
        `/atendimentos/${documentoParaPdf.atendimento_id}/documentos/${documentoParaPdf.id}/pdf`,
        { responseType: "blob" }
      );
      const filename = parseDownloadFilename(
        response.headers?.["content-disposition"],
        `documento_atendimento_${documentoParaPdf.atendimento_id}_${documentoParaPdf.id}.pdf`
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      const emitido = {
        ...documentoParaPdf,
        status: "emitido",
        emitido_at: new Date().toISOString(),
      };
      mergeDocumentoClinico(emitido);
      const documentosAtualizados = await recarregarDocumentosAtendimento(documentoParaPdf.atendimento_id);
      const documentoPersistido = documentosAtualizados.find((item) => item.id === documentoParaPdf.id) || emitido;
      if (documentoClinicoForm.id === documentoParaPdf.id) {
        setDocumentoClinicoForm(hydrateDocumentoForm(documentoPersistido));
      }
      setSucesso("PDF do documento gerado com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(await extractApiErrorMessage(e, "Falha ao gerar o PDF do documento."));
    } finally {
      setGerandoDocumentoPdfId(null);
    }
  };

  const excluirDocumentoClinico = async (documento: DocumentoAtendimento) => {
    if (!confirm(`Remover o documento "${documento.titulo}"?`)) return;
    try {
      await api.delete(`/atendimentos/${documento.atendimento_id}/documentos/${documento.id}`);
      await recarregarDocumentosAtendimento(documento.atendimento_id);
      if (documentoClinicoForm.id === documento.id) {
        setDocumentoClinicoForm(emptyDocumentoAtendimentoForm());
      }
      setSucesso("Documento removido com sucesso.");
      setErro("");
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao remover documento."));
    }
  };

  const editarDocumentoTemplate = (template: DocumentoAtendimentoTemplate) => {
    setDocumentoTemplateForm(hydrateDocumentoTemplateForm(template));
    setShowDocumentoTemplateEditor(true);
  };

  const resetDocumentoTemplateForm = () => {
    setDocumentoTemplateForm(emptyDocumentoTemplateForm());
  };

  const salvarDocumentoTemplate = async () => {
    if (!documentoTemplateForm.nome.trim() || !documentoTemplateForm.titulo_padrao.trim() || !documentoTemplateForm.corpo_template.trim()) {
      setErro("Preencha nome, titulo e corpo do template.");
      return;
    }

    try {
      setSalvandoDocumentoTemplate(true);
      const payload = {
        nome: documentoTemplateForm.nome,
        tipo: documentoTemplateForm.tipo || "documento",
        titulo_padrao: documentoTemplateForm.titulo_padrao,
        corpo_template: documentoTemplateForm.corpo_template,
        ordem: documentoTemplateForm.ordem ? Number(documentoTemplateForm.ordem) : 0,
        ativo: documentoTemplateForm.ativo,
      };
      if (documentoTemplateForm.id) {
        await api.put(`/atendimentos/documentos/templates/${documentoTemplateForm.id}`, payload);
        setSucesso("Template de documento atualizado.");
      } else {
        await api.post("/atendimentos/documentos/templates", payload);
        setSucesso("Template de documento criado.");
      }
      await carregarDocumentoTemplates();
      resetDocumentoTemplateForm();
      setErro("");
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao salvar template de documento."));
    } finally {
      setSalvandoDocumentoTemplate(false);
    }
  };

  const toggleDocumentoTemplate = async (template: DocumentoAtendimentoTemplate) => {
    try {
      if (Number(template.ativo ?? 1) === 1) {
        await api.delete(`/atendimentos/documentos/templates/${template.id}`);
        setSucesso("Template de documento desativado.");
      } else {
        await api.post(`/atendimentos/documentos/templates/${template.id}/restaurar`);
        setSucesso("Template de documento reativado.");
      }
      await carregarDocumentoTemplates();
      setErro("");
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao alterar template de documento."));
    }
  };

  const carregarMedicamentosBanco = async () => {
    try {
      const response = await api.get("/atendimentos/medicamentos/banco?limit=500");
      const items = response.data?.items || [];
      setMedicamentos(items);
      return items;
    } catch (e: any) {
      setErro(extractApiErrorMessageSync(e, "Erro ao atualizar banco de medicamentos."));
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
      setErro(extractApiErrorMessageSync(e, "Erro ao desativar medicamento."));
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
      setErro(extractApiErrorMessageSync(e, "Erro ao salvar medicamento."));
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
      setErro(extractApiErrorMessageSync(e, "Erro ao salvar frase clinica."));
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
      setErro(extractApiErrorMessageSync(e, "Erro ao atualizar status da frase clinica."));
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
  const totalAnexosDocumento = anexosGerais.length + totalAnexosExame + form.documentos.length;
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
      resumo: "Modelos, evolucao e anexos",
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

  const atendimentosVisiveis = filtered;
  const timelineGrupos = historicoPaciente?.timeline || [];
  const alertasAtivos = historicoPaciente?.alertas || [];
  const medicamentosCardiologicos = medicamentosCardiologiaLista.length;
  const itensPrescricaoAtivos = form.prescricao_itens.filter((item) => item.medicamento_id || (item.medicamento_nome || "").trim());
  const autosaveLabel = useMemo(() => {
    if (autosaveState === "saving") return "Autosave em andamento";
    if (autosaveState === "dirty") return "Alteracoes pendentes";
    if (autosaveState === "local") {
      return autosaveAt ? `Rascunho local - ${formatDate(autosaveAt)}` : "Rascunho local";
    }
    if (autosaveState === "saved") {
      return autosaveAt ? `Sincronizado - ${formatDate(autosaveAt)}` : "Sincronizado";
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
      // Limpa o unico item em vez de remover
      setPrescricaoEditorManualAberto(false);
      setField("prescricao_itens", [emptyPrescriptionItem()]);
    } else {
      setField(
        "prescricao_itens",
        form.prescricao_itens.filter((_, itemIndex) => itemIndex !== idx)
      );
    }
  };
  const prescricaoTemRascunhoInicial =
    !prescricaoEditorManualAberto &&
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
              {medicamentoSelecionado?.principio_ativo ? ` - ${medicamentoSelecionado.principio_ativo}` : ""}
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
                      {calculo.unidade === "ml" && calculo.volumeMl ? ` - ${calculo.volumeMl.toFixed(2)} mL` : ""}
                      {calculo.unidade === "comprimido" && calculo.comprimidos ? ` - ${calculo.comprimidos.toFixed(2)} comprimido(s)` : ""}
                    </p>
                    <p className="mt-1 text-xs text-teal-700">
                      Base: {calculo.doseMgKg?.toFixed(3)} mg/kg - {calculo.pesoKg?.toFixed(2)} kg
                      {calculo.concentracao ? ` - concentracao ${calculo.concentracao}` : ""}
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
                        {ajuste.valor_anterior || "-"} <span className="mx-1 text-slate-400">?</span> {ajuste.valor_novo || "-"}
                      </div>
                      {(ajuste.responsavel_nome || ajuste.motivo) && (
                        <div className="mt-1 text-slate-400">
                          {ajuste.responsavel_nome && <span>{ajuste.responsavel_nome}</span>}
                          {ajuste.responsavel_nome && ajuste.motivo && <span className="mx-1">-</span>}
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
                <p className="mt-2 text-sm font-medium text-white">{pacienteNomeExibicao || "Nao selecionado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-300">Tutor</p>
                <p className="mt-2 text-sm font-medium text-white">{tutorNomeExibicao || "Nao informado"}</p>
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

        <div className={isPrescricaoWorkspace || isBibliotecasWorkspace ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 gap-6 xl:grid-cols-12"}>
          {!isPrescricaoWorkspace && !isBibliotecasWorkspace ? (
          <div className="self-start xl:col-span-3">
            <div className="space-y-6 xl:sticky xl:top-6">
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Painel de casos</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">Atendimentos recentes</h2>
                  </div>
                  <button onClick={() => carregarLista(paginaLista)} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200">
                    <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Atualizar</span>
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={dataInicioFiltro}
                      onChange={(e) => setDataInicioFiltro(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                    />
                    <input
                      type="date"
                      value={dataFimFiltro}
                      onChange={(e) => setDataFimFiltro(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void aplicarFiltrosLista();
                        }
                      }}
                      placeholder="Buscar animal, tutor, clinica ou diagnostico..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select value={clinicaFiltro} onChange={(e) => setClinicaFiltro(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                      <option value="">Todas as clinicas</option>
                      {clinicas.map((item) => (
                        <option key={item.id} value={String(item.id)}>{item.nome}</option>
                      ))}
                    </select>
                    <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                      <option value="">Todos os status</option>
                      {STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void aplicarFiltrosLista()}
                      className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Aplicar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => void limparFiltrosLista()}
                      className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      Limpar
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {totalLista} atendimento(s) encontrado(s) | Pagina {paginaLista} de {totalPaginasLista}
                  </p>
                </div>

                <div className="mt-4 max-h-[380px] space-y-3 overflow-auto pr-1">
                  {atendimentosVisiveis.map((item) => (
                    <div key={item.id} className={`rounded-[22px] border p-4 transition ${selecionado === item.id ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50/80 hover:bg-white"}`}>
                      <button onClick={() => abrirAtendimento(item.id)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">#{item.id} - {item.paciente_nome || "Paciente"}</p>
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void carregarLista(paginaLista - 1)}
                    disabled={paginaLista <= 1}
                    className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2"><ChevronLeft className="h-4 w-4" />Pagina anterior</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void carregarLista(paginaLista + 1)}
                    disabled={paginaLista >= totalPaginasLista}
                    className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">Proxima pagina<ChevronRight className="h-4 w-4" /></span>
                  </button>
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

          <div className={isPrescricaoWorkspace || isBibliotecasWorkspace ? "" : "xl:col-span-9"}>
            <div className={workspaceGridClass}>
              <div className="space-y-6">
                {!isPrescricaoWorkspace ? (
                  <AtendimentoConsultaOverviewSection
                    clinicas={clinicas}
                    fluxoClinico={fluxoClinico}
                    form={form}
                    getBadgeStatusClass={getBadgeStatusClass}
                    pacienteBusca={pacienteBusca}
                    pacienteDropdownAberto={pacienteDropdownAberto}
                    pacienteDropdownBlurTimeoutRef={pacienteDropdownBlurTimeoutRef}
                    pacienteNomeExibicao={pacienteNomeExibicao}
                    pacientesFiltrados={pacientesFiltrados}
                    selecionarPaciente={selecionarPaciente}
                    setField={setField}
                    setMostrarPacientes={setMostrarPacientes}
                    setPacienteBusca={setPacienteBusca}
                    setWorkspacePainel={setWorkspacePainel}
                    STATUS_ATENDIMENTO={STATUS_ATENDIMENTO}
                    especieRacaExibicao={especieRacaExibicao}
                    tutorNomeExibicao={tutorNomeExibicao}
                  />
                ) : null}

                {isConsultaWorkspace ? (
                  <AtendimentoCadastroComplementarSection
                    buscandoCepTutor={buscandoCepTutor}
                    cadastroComplementar={cadastroComplementar}
                    cadastroComplementarPendencias={cadastroComplementarPendencias}
                    carregandoCadastroComplementar={carregandoCadastroComplementar}
                    especieCadastroAtual={especieCadastroAtual}
                    especieRacaExibicao={especieRacaExibicao}
                    form={form}
                    formatarCepVisual={formatarCepVisual}
                    handleAdicionarRacaCadastro={handleAdicionarRacaCadastro}
                    idadePacienteExibicao={idadePacienteExibicao}
                    consultarCepTutor={consultarCepTutor}
                    novaRacaCadastro={novaRacaCadastro}
                    opcoesRacaCadastro={opcoesRacaCadastro}
                    salvandoCadastroComplementar={salvandoCadastroComplementar}
                    salvarCadastroComplementarAtual={salvarCadastroComplementarAtual}
                    setCadastroPacienteField={setCadastroPacienteField}
                    setCadastroTutorField={setCadastroTutorField}
                    setNovaRacaCadastro={setNovaRacaCadastro}
                    setStatusCepTutor={setStatusCepTutor}
                    sincronizarPesoCadastroNaTriagem={sincronizarPesoCadastroNaTriagem}
                    statusCepTutor={statusCepTutor}
                  />
                ) : null}

                {isConsultaWorkspace ? (
                  <AtendimentoTriagemSection
                    ESCALA_ECC={ESCALA_ECC}
                    form={form}
                    HIDRATACAO={HIDRATACAO}
                    MUCOSAS={MUCOSAS}
                    setField={setField}
                    setTriagemExpandida={setTriagemExpandida}
                    triagemExpandida={triagemExpandida}
                  />
                ) : null}

                {isConsultaWorkspace ? (
                  <AtendimentoConsultaEditorSection
                    autosaveLabel={autosaveLabel}
                    clinicalSummary={clinicalSummary}
                    consultaCampoAtivoConfig={consultaCampoAtivoConfig}
                    consultaCampoAtivoIndex={consultaCampoAtivoIndex}
                    consultaEditorCamposVisiveis={consultaEditorCamposVisiveis}
                    consultaEditorEtapa={consultaEditorEtapa}
                    consultaEditorEtapas={consultaEditorEtapas}
                    consultaEtapasCompletas={consultaEtapasCompletas}
                    form={form}
                    getClinicalFieldValue={getClinicalFieldValue}
                    goToConsultaCampoAnterior={goToConsultaCampoAnterior}
                    goToConsultaCampoProximo={goToConsultaCampoProximo}
                    handleConsultaTextareaKeyDown={handleConsultaTextareaKeyDown}
                    injectClinicalSnippet={injectClinicalSnippet}
                    PROGNOSTICO={PROGNOSTICO}
                    registerClinicalTextarea={registerClinicalTextarea}
                    setClinicalFieldValue={setClinicalFieldValue}
                    setConsultaCampoAtivo={setConsultaCampoAtivo}
                    setConsultaEditorEtapa={setConsultaEditorEtapa}
                    setField={setField}
                  />
                ) : null}

                {isExamesWorkspace ? (
                  <AtendimentoExamesSection
                    adicionarExameDoCatalogo={adicionarExameDoCatalogo}
                    aplicarPainel={aplicarPainel}
                    aplicarPainelExames={aplicarPainelExames}
                    ATENDIMENTO_ATTACHMENT_ACCEPT={ATENDIMENTO_ATTACHMENT_ACCEPT}
                    atualizarExame={atualizarExame}
                    baixarPdfAtendimento={baixarPdfAtendimento}
                    cancelarUploadAnexo={cancelarUploadAnexo}
                    catalogoExames={catalogoExames}
                    clearExamDropState={clearExamDropState}
                    clearExamUploadDraft={clearExamUploadDraft}
                    colapsarTodosExames={colapsarTodosExames}
                    customPaineis={customPaineis}
                    editarPainelExame={editarPainelExame}
                    emptyExam={emptyExam}
                    exameBusca={exameBusca}
                    exameFiltroRapido={exameFiltroRapido}
                    examDropActive={examDropActive}
                    examUploadDrafts={examUploadDrafts}
                    examesCatalogoFiltrados={examesCatalogoFiltrados}
                    examesExpandidos={examesExpandidos}
                    examesVisiveis={examesVisiveis}
                    excluirAnexo={excluirAnexo}
                    excluirPainelExame={excluirPainelExame}
                    expandirTodosExames={expandirTodosExames}
                    EXAME_FILTRO_OPCOES={EXAME_FILTRO_OPCOES}
                    EXAME_STATUS_META={EXAME_STATUS_META}
                    form={form}
                    formatBytes={formatBytes}
                    formatDate={formatDate}
                    gerandoPdfTipo={gerandoPdfTipo}
                    goLaudo={goLaudo}
                    hasExamRequest={hasExamRequest}
                    imprimirSolicitacaoExames={imprimirSolicitacaoExames}
                    openingAttachmentId={openingAttachmentId}
                    painelEmEdicao={painelEmEdicao}
                    painelExameAtual={painelExameAtual}
                    painelExameSelecionado={painelExameSelecionado}
                    painelFormCategoria={painelFormCategoria}
                    painelFormErro={painelFormErro}
                    painelFormItens={painelFormItens}
                    painelFormNome={painelFormNome}
                    painelFormSearch={painelFormSearch}
                    painelModalMode={painelModalMode}
                    painelModalOpen={painelModalOpen}
                    paineisExames={paineisExames}
                    removerExamesVazios={removerExamesVazios}
                    resolvePreviewKind={resolvePreviewKind}
                    resumoExamesFluxo={resumoExamesFluxo}
                    salvando={salvando}
                    salvarPainelExame={salvarPainelExame}
                    selecionado={selecionado}
                    setExamDropActive={setExamDropActive}
                    setExamUploadDraftFile={setExamUploadDraftFile}
                    setExameFiltroRapido={setExameFiltroRapido}
                    setExameBusca={setExameBusca}
                    setExamesExpandidos={setExamesExpandidos}
                    setField={setField}
                    setPainelEmEdicao={setPainelEmEdicao}
                    setPainelExameSelecionado={setPainelExameSelecionado}
                    setPainelFormCategoria={setPainelFormCategoria}
                    setPainelFormErro={setPainelFormErro}
                    setPainelFormItens={setPainelFormItens}
                    setPainelFormNome={setPainelFormNome}
                    setPainelFormSearch={setPainelFormSearch}
                    setPainelModalMode={setPainelModalMode}
                    setPainelModalOpen={setPainelModalOpen}
                    abrirAnexo={abrirAnexo}
                    uploadArquivoResultadoExame={uploadArquivoResultadoExame}
                    uploadArquivosResultadoExame={uploadArquivosResultadoExame}
                    uploadingAttachmentKey={uploadingAttachmentKey}
                    uploadProgressByKey={uploadProgressByKey}
                  />
                ) : null}

                {isDocumentosWorkspace ? (
                  <AtendimentoDocumentosSection
                    ATENDIMENTO_ATTACHMENT_ACCEPT={ATENDIMENTO_ATTACHMENT_ACCEPT}
                    adicionarLinkAnexo={adicionarLinkAnexo}
                    anexosGerais={anexosGerais}
                    anexoArquivo={anexoArquivo}
                    anexoForm={anexoForm}
                    abrirAnexo={abrirAnexo}
                    cancelarUploadAnexo={cancelarUploadAnexo}
                    baixarPdfDocumentoClinico={baixarPdfDocumentoClinico}
                    criarDocumentoClinicoDeTemplate={criarDocumentoClinicoDeTemplate}
                    documentTemplates={documentTemplates}
                    documentoClinicoForm={documentoClinicoForm}
                    documentoTemplateForm={documentoTemplateForm}
                    documentoTemplateSelecionado={documentoTemplateSelecionado}
                    editarDocumentoTemplate={editarDocumentoTemplate}
                    evolucaoForm={evolucaoForm}
                    excluirDocumentoClinico={excluirDocumentoClinico}
                    excluirAnexo={excluirAnexo}
                    formatBytes={formatBytes}
                    formatDate={formatDate}
                    gerandoDocumentoPdfId={gerandoDocumentoPdfId}
                    novoDocumentoClinicoLivre={novoDocumentoClinicoLivre}
                    openingAttachmentId={openingAttachmentId}
                    progressoUploadGeral={progressoUploadGeral}
                    selecionado={selecionado}
                    setAnexoArquivo={setAnexoArquivo}
                    setAnexoForm={setAnexoForm}
                    setDocumentoClinicoForm={setDocumentoClinicoForm}
                    setDocumentoTemplateForm={setDocumentoTemplateForm}
                    setDocumentoTemplateSelecionado={setDocumentoTemplateSelecionado}
                    setErro={setErro}
                    setEvolucaoForm={setEvolucaoForm}
                    setShowDocumentoTemplateEditor={setShowDocumentoTemplateEditor}
                    setSucesso={setSucesso}
                    showDocumentoTemplateEditor={showDocumentoTemplateEditor}
                    salvandoDocumentoClinico={salvandoDocumentoClinico}
                    salvandoDocumentoTemplate={salvandoDocumentoTemplate}
                    salvarDocumentoClinico={salvarDocumentoClinico}
                    salvarDocumentoTemplate={salvarDocumentoTemplate}
                    selecionarDocumentoClinico={selecionarDocumentoClinico}
                    toggleDocumentoTemplate={toggleDocumentoTemplate}
                    uploadAnexoArquivo={uploadAnexoArquivo}
                    uploadGeralEmAndamento={uploadGeralEmAndamento}
                    abrirAtendimento={abrirAtendimento}
                    api={api}
                    form={form}
                  />
                ) : null}

                {isPrescricaoWorkspace ? (
                  <AtendimentoPrescricaoWorkspace
                    abrirMedicamentoBuscaRapida={abrirMedicamentoBuscaRapida}
                    adicionarItemPrescricaoEmBranco={adicionarItemPrescricaoEmBranco}
                    aplicarPresetPrescricao={aplicarPresetPrescricao}
                    aplicarProtocoloPrescricao={aplicarProtocoloPrescricao}
                    autosaveBadgeClass={autosaveBadgeClass}
                    autosaveLabel={autosaveLabel}
                    cancelarEdicaoPresetPrescricao={cancelarEdicaoPresetPrescricao}
                    classificarAlertaPrescricao={classificarAlertaPrescricao}
                    editarPresetPrescricao={editarPresetPrescricao}
                    especieRacaExibicao={especieRacaExibicao}
                    form={form}
                    formatDate={formatDate}
                    gerarPreviewPdf={gerarPreviewPdf}
                    getAlertaPrescricaoClass={getAlertaPrescricaoClass}
                    itensPrescricaoAtivos={itensPrescricaoAtivos}
                    medicamentosCardiologicos={medicamentosCardiologicos}
                    mostrarResultadosBuscaPrescricao={mostrarResultadosBuscaPrescricao}
                    nomeNovoPresetPrescricao={nomeNovoPresetPrescricao}
                    pacienteNomeExibicao={pacienteNomeExibicao}
                    presetPrescricaoEmEdicaoId={presetPrescricaoEmEdicaoId}
                    prescricaoBuscaRapida={prescricaoBuscaRapida}
                    prescricaoBuscaResultados={prescricaoBuscaResultados}
                    prescricaoEntradaModo={prescricaoEntradaModo}
                    prescricaoErrosCount={prescricaoErrosCount}
                    prescricaoModoFoco={prescricaoModoFoco}
                    prescricaoPreviewAtivo={prescricaoPreviewAtivo}
                    prescricaoPreviewPdf={prescricaoPreviewPdf}
                    prescricaoSupport={prescricaoSupport}
                    prescricaoTemRascunhoInicial={prescricaoTemRascunhoInicial}
                    prescriptionPresets={prescriptionPresets}
                    PROTOCOLOS_PRESCRICAO={PROTOCOLOS_PRESCRICAO}
                    protocoloPrescricaoRecomendado={protocoloPrescricaoRecomendado}
                    protocoloPrescricaoSelecionado={protocoloPrescricaoSelecionado}
                    protocoloPrescricaoSelecionadoDetalhe={protocoloPrescricaoSelecionadoDetalhe}
                    removerPresetPrescricao={removerPresetPrescricao}
                    renderPrescricaoItemCard={renderPrescricaoItemCard}
                    salvarPresetPrescricaoAtual={salvarPresetPrescricaoAtual}
                    selecionarMedicamentoBuscaRapida={selecionarMedicamentoBuscaRapida}
                    setField={setField}
                    setNomeNovoPresetPrescricao={setNomeNovoPresetPrescricao}
                    setPrescricaoBuscaRapida={setPrescricaoBuscaRapida}
                    setPrescricaoEntradaModo={setPrescricaoEntradaModo}
                    setPrescricaoModoFoco={setPrescricaoModoFoco}
                    setPrescricaoPreviewAtivo={setPrescricaoPreviewAtivo}
                    setPrescricaoPreviewErro={setPrescricaoPreviewErro}
                    setPrescricaoPreviewPdf={setPrescricaoPreviewPdf}
                  />
                ) : null}
              </div>

              {prescricaoPreviewAtivo && (
                <AtendimentoPrescricaoPreview
                  form={form}
                  gerarPreviewPdf={gerarPreviewPdf}
                  prescricaoPreviewErro={prescricaoPreviewErro}
                  prescricaoPreviewLoading={prescricaoPreviewLoading}
                  prescricaoPreviewPdf={prescricaoPreviewPdf}
                />
              )}

              {(isPrescricaoWorkspace || showClinicalRadarAside) ? (
                <aside
                  className={`self-start space-y-6 xl:sticky xl:max-h-[calc(100vh-2rem)] xl:overflow-auto xl:pr-1 ${
                    isPrescricaoWorkspace && prescricaoModoFoco ? "xl:top-3" : "xl:top-6"
                  }`}
                >
                  {showClinicalRadarAside ? (
                    <AtendimentoClinicalRadarAside
                      alertasAtivos={alertasAtivos}
                      autosaveLabel={autosaveLabel}
                      clinicalSummary={clinicalSummary}
                      formatDate={formatDate}
                      form={form}
                      getBadgeStatusClass={getBadgeStatusClass}
                      getGravidadeClass={getGravidadeClass}
                      historicoPaciente={historicoPaciente}
                      pacienteNomeExibicao={pacienteNomeExibicao}
                      preenchimentoConsultaLabel={preenchimentoConsultaLabel}
                      selecionado={selecionado}
                    />
                  ) : null}

                  {isPrescricaoWorkspace ? (
                    <AtendimentoPrescricaoAside
                      baixarPdfAtendimento={baixarPdfAtendimento}
                      classificarAlertaPrescricao={classificarAlertaPrescricao}
                      form={form}
                      gerandoPdfTipo={gerandoPdfTipo}
                      getAlertaPrescricaoClass={getAlertaPrescricaoClass}
                      hasPrescriptionItems={hasPrescriptionItems}
                      imprimirPrescricao={imprimirPrescricao}
                      itensPrescricaoAtivos={itensPrescricaoAtivos}
                      prescricaoErrosCount={prescricaoErrosCount}
                      prescricaoModoFoco={prescricaoModoFoco}
                      prescricaoSupport={prescricaoSupport}
                      salvando={salvando}
                      saveAtendimento={saveAtendimento}
                      setPrescricaoModoFoco={setPrescricaoModoFoco}
                    />
                  ) : null}
                </aside>
              ) : null}
            </div>
          </div>

        {isBibliotecasWorkspace ? (
          <AtendimentoBibliotecasSection
            CLINICAL_SECTION_OPTIONS={CLINICAL_SECTION_OPTIONS}
            adicionarMedicamentoNaPrescricao={adicionarMedicamentoNaPrescricao}
            carregarFrasesClinicas={carregarFrasesClinicas}
            carregarMedicamentosBanco={carregarMedicamentosBanco}
            clinicalPhraseForm={clinicalPhraseForm}
            clinicalPhraseSearch={clinicalPhraseSearch}
            clinicalPhraseSectionFilter={clinicalPhraseSectionFilter}
            clinicalPhrases={clinicalPhrases}
            clinicalPhrasesFiltered={clinicalPhrasesFiltered}
            clinicalSectionLabels={clinicalSectionLabels}
            desativarMedicamento={desativarMedicamento}
            duplicarMedicamentoManipulado={duplicarMedicamentoManipulado}
            editarFraseClinica={editarFraseClinica}
            editarMedicamento={editarMedicamento}
            formatarOrigemMedicamento={formatarOrigemMedicamento}
            medBusca={medBusca}
            medFiltrados={medFiltrados}
            medForm={medForm}
            medicamentos={medicamentos}
            resetClinicalPhraseForm={resetClinicalPhraseForm}
            resetMedicationForm={resetMedicationForm}
            saveClinicalPhrase={saveClinicalPhrase}
            saveMedicamento={saveMedicamento}
            savingClinicalPhrase={savingClinicalPhrase}
            setClinicalPhraseForm={setClinicalPhraseForm}
            setClinicalPhraseSearch={setClinicalPhraseSearch}
            setClinicalPhraseSectionFilter={setClinicalPhraseSectionFilter}
            setMedBusca={setMedBusca}
            setMedForm={setMedForm}
            setShowMedicationBank={setShowMedicationBank}
            setShowPhraseBank={setShowPhraseBank}
            showMedicationBank={showMedicationBank}
            showPhraseBank={showPhraseBank}
            toggleClinicalPhrase={toggleClinicalPhrase}
          />
        ) : null}
      </div>
      {attachmentPreview ? (
        <AttachmentPreviewModal
          attachmentImageDragging={attachmentImageDragging}
          attachmentImageOffset={attachmentImageOffset}
          attachmentImageZoom={attachmentImageZoom}
          attachmentPdfPage={attachmentPdfPage}
          attachmentPdfZoom={attachmentPdfZoom}
          attachmentPreview={attachmentPreview}
          abrirAnexo={abrirAnexo}
          buildPdfPreviewUrl={buildPdfPreviewUrl}
          closeAttachmentPreview={closeAttachmentPreview}
          formatDate={formatDate}
          handleAttachmentImagePointerDown={handleAttachmentImagePointerDown}
          handleAttachmentImagePointerMove={handleAttachmentImagePointerMove}
          handleAttachmentImagePointerUp={handleAttachmentImagePointerUp}
          resetAttachmentImageView={resetAttachmentImageView}
          setAttachmentImageOffset={setAttachmentImageOffset}
          setAttachmentPdfPage={setAttachmentPdfPage}
          setAttachmentPdfZoom={setAttachmentPdfZoom}
          zoomInAttachmentImage={zoomInAttachmentImage}
          zoomOutAttachmentImage={zoomOutAttachmentImage}
        />
      ) : null}
      </div>
    </DashboardLayout>
  );
}
