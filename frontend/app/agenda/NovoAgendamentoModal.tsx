"use client";

import { useEffect, useRef, useState } from "react";
import { X, User, Building, Calendar, Clock, Sparkles, Search, ChevronDown, Check } from "lucide-react";
import api from "@/lib/axios";
import { useFortinho } from "@/components/fortinho/FortinhoProvider";
import { consultarSaldoCreditoCliente } from "@/lib/credito-cliente";
import {
  AgendaExcecaoConfig,
  AgendaFeriadoConfig,
  AgendaSemanalConfig,
  validarHorarioAgendamento,
} from "@/lib/agenda-config";

const TABELA_PRECO_PADRAO = [
  { id: 1, nome: "Fortaleza" },
  { id: 2, nome: "Regiao Metropolitana" },
  { id: 3, nome: "Domiciliar" },
  { id: 4, nome: "Personalizado" },
];
const LIMITE_MINUTOS_PROXIMIDADE = 25;
const LIMITE_ESTENDIDO_EXTRA_MIN = 15;
const COOLDOWN_POPUP_PROXIMIDADE_MS = 60_000;

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agendamentoCriado?: { data?: string | null }) => void | Promise<void>;
  agendamento?: any;
  defaultDate?: string;
  defaultTime?: string;
  agendaSemanal: AgendaSemanalConfig;
  agendaFeriados: AgendaFeriadoConfig[];
  agendaExcecoes: AgendaExcecaoConfig[];
  intervaloSlotMinutos?: number;
  isAdmin?: boolean;
}

interface SugestaoHorarioVizinho {
  agendamento_id: number;
  clinica_id: number;
  clinica: string;
  inicio?: string;
  fim?: string;
  duracao_deslocamento_min: number;
  folga_min: number | null;
  margem_min: number | null;
  fonte: string;
}

interface SugestaoHorarioItem {
  inicio: string;
  fim: string;
  score: number;
  risco: number;
  tempo_deslocamento_total_min: number;
  ociosidade_min: number;
  anterior: SugestaoHorarioVizinho | null;
  proximo: SugestaoHorarioVizinho | null;
}

interface SugestoesHorarioResponse {
  ok: boolean;
  data: string;
  clinica_id: number;
  duracao_minutos: number;
  perfil_deslocamento: string;
  intervalo_minutos?: number;
  motivo?: string;
  itens_ignorados_janela?: number;
  total_encontrados: number;
  items: SugestaoHorarioItem[];
}

type AssistenteDecisao = "pendente" | "aceito" | "sem_opcao";

type EtapaWizardNovo = {
  id: "preparo" | "ofertas" | "desfecho";
  titulo: string;
  descricao: string;
};

const ETAPAS_WIZARD_NOVO: EtapaWizardNovo[] = [
  {
    id: "preparo",
    titulo: "Preparar dados",
    descricao: "Selecionar clinica, servico e data.",
  },
  {
    id: "ofertas",
    titulo: "Panorama de ofertas",
    descricao: "Visualizar todas as opcoes sugeridas pelo assistente.",
  },
  {
    id: "desfecho",
    titulo: "Desfecho",
    descricao: "Registrar aceite ou recusa com justificativa para fluxo de excecao.",
  },
];

const resolverIndiceEtapaWizardNovo = (
  prontoParaSugerir: boolean,
  decisao: AssistenteDecisao
): number => {
  if (decisao === "aceito" || decisao === "sem_opcao") {
    return 2;
  }
  if (!prontoParaSugerir) {
    return 0;
  }
  return 1;
};

interface ConflitoDeslocamentoDetail {
  codigo?: string;
  mensagem?: string;
  duracao_min?: number;
  folga_min?: number;
  confirmavel?: boolean;
  desvio_insercao_min?: number;
  limite_desvio_min?: number;
}

interface SugestaoProximidadeResponse {
  ok: boolean;
  sugerir: boolean;
  mensagem: string;
  limite_minutos?: number;
  acima_do_limite?: boolean;
  politica_oferta?: {
    data_contato?: string;
    datas_preferenciais?: string[];
    distante_base?: boolean;
    baixa_frequencia?: boolean;
    ancora_d2?: boolean;
  };
  item?: {
    agendamento_id: number;
    clinica_id: number;
    clinica: string;
    data?: string | null;
    inicio?: string | null;
    fim?: string | null;
    duracao_deslocamento_min: number;
    tempo_deslocamento_total_min?: number;
    duracao_deslocamento_anterior_min?: number;
    duracao_deslocamento_proximo_min?: number;
    fonte_deslocamento?: string;
    status?: string;
    data_preferencial?: boolean;
  } | null;
}

interface AssistenteOfertaResponse {
  ok: boolean;
  clinica_id: number;
  data_referencia: string;
  data_contato?: string;
  data_base: string;
  origem_data_automatica: "manual" | "proximidade" | "politica" | "progressao_dias";
  politica_oferta?: SugestaoProximidadeResponse["politica_oferta"];
  sugestao_proximidade?: SugestaoProximidadeResponse | null;
  panorama_ofertas?: SugestoesHorarioResponse | null;
  mensagem_panorama?: string;
}

interface TutorOption {
  id: number;
  nome: string;
  telefone?: string | null;
}

interface PacienteOption {
  id: number;
  nome: string;
  tutor_id?: number | null;
  tutor?: string;
  especie?: string;
  raca?: string;
}

interface ClinicaOption {
  id: number;
  nome: string;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  clearLabel?: string;
  disabled?: boolean;
  showSelectedDescription?: boolean;
}

interface FormDataAgenda {
  tutor_id: string;
  paciente_id: string;
  clinica_id: string;
  clinica_nova_nome: string;
  clinica_nova_razao_social: string;
  clinica_nova_tabela_preco_id: string;
  servico_id: string;
  data: string;
  hora: string;
  marcar_como_reserva: boolean;
  observacoes: string;
}

interface NovoTutorForm {
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
}

interface NovoAnimalForm {
  tutor_id: string;
  nome: string;
  especie: string;
  raca: string;
  sexo: string;
  peso_kg: string;
  data_nascimento: string;
  microchip: string;
  observacoes: string;
}

const buildInitialFormData = (defaultDate?: string, defaultTime?: string): FormDataAgenda => ({
  tutor_id: "",
  paciente_id: "",
  clinica_id: "",
  clinica_nova_nome: "",
  clinica_nova_razao_social: "",
  clinica_nova_tabela_preco_id: "1",
  servico_id: "",
  data: defaultDate || "",
  hora: defaultTime || "",
  marcar_como_reserva: false,
  observacoes: "",
});

const buildInitialTutorForm = (): NovoTutorForm => ({
  nome: "",
  telefone: "",
  whatsapp: "",
  email: "",
});

const buildInitialAnimalForm = (tutorId = ""): NovoAnimalForm => ({
  tutor_id: tutorId,
  nome: "",
  especie: "Canina",
  raca: "",
  sexo: "Macho",
  peso_kg: "",
  data_nascimento: "",
  microchip: "",
  observacoes: "",
});

const normalizeSearchText = (value?: string | null): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const matchesSearch = (value: string, query: string): boolean => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedValue = normalizeSearchText(value);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.every((token) => normalizedValue.includes(token));
};

const formatarEnderecoClinica = (clinica?: ClinicaOption | null): string => {
  if (!clinica) return "";

  const enderecoLinha = [
    clinica.endereco,
    clinica.numero,
    clinica.complemento,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");

  const regiaoLinha = [
    clinica.bairro,
    [clinica.cidade, clinica.estado].map((item) => String(item || "").trim()).filter(Boolean).join("/"),
    clinica.cep,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" - ");

  return [enderecoLinha, regiaoLinha].filter(Boolean).join(" - ");
};

const formatarResumoPaciente = (paciente: PacienteOption): string => {
  const detalhes = [
    paciente.tutor ? `Tutor: ${paciente.tutor}` : "",
    paciente.especie || "",
    paciente.raca || "",
  ].filter(Boolean);

  return detalhes.join(" - ");
};

const formatarMoedaBRL = (valor: number): string => {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

const rotularFonteDeslocamento = (fonte?: string | null): string => {
  const valor = String(fonte || "").trim().toLowerCase();
  if (!valor) return "Fonte nao informada";
  if (valor.startsWith("google_")) return "Google Maps";
  if (valor.startsWith("heuristica")) return "Heuristica local";
  if (valor === "mesma_clinica") return "Mesma clinica";
  if (valor === "clinica_indefinida") return "Clinica indefinida";
  if (valor === "sem_matriz") return "Sem matriz";
  return valor.replaceAll("_", " ");
};

const detalharComposicaoDeslocamento = (
  totalMinutos?: number | null,
  anteriorMinutos?: number | null,
  proximoMinutos?: number | null
): string => {
  const total = Number.isFinite(Number(totalMinutos)) ? Math.max(0, Number(totalMinutos)) : 0;
  const anterior = Number.isFinite(Number(anteriorMinutos)) ? Math.max(0, Number(anteriorMinutos)) : 0;
  const proximo = Number.isFinite(Number(proximoMinutos)) ? Math.max(0, Number(proximoMinutos)) : 0;

  if (anterior <= 0 && proximo <= 0) {
    return `${total} min (sem deslocamento com agendamentos vizinhos)`;
  }
  return `${anterior} min (trecho anterior) + ${proximo} min (trecho posterior) = ${total} min`;
};

const resumirDeslocamentoSugestao = (item: SugestaoHorarioItem): string => {
  const fontes = [item.anterior?.fonte, item.proximo?.fonte].filter(Boolean) as string[];
  const detalheComposicao = detalharComposicaoDeslocamento(
    item.tempo_deslocamento_total_min,
    item.anterior?.duracao_deslocamento_min,
    item.proximo?.duracao_deslocamento_min
  );
  if (fontes.length === 0) {
    return `Composicao do deslocamento: ${detalheComposicao}.`;
  }

  const fontesUnicas = Array.from(new Set(fontes.map((fonte) => rotularFonteDeslocamento(fonte))));
  return `Composicao do deslocamento: ${detalheComposicao}. Fonte do deslocamento: ${fontesUnicas.join(" + ")}.`;
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel = "Selecione...",
  disabled = false,
  showSelectedDescription = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = options.find((option) => option.value === value) || null;
  const filteredOptions = options.filter((option) =>
    matchesSearch(
      [option.label, option.description || "", option.searchText || ""].filter(Boolean).join(" "),
      search
    )
  );

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  const selecionar = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled ? "cursor-not-allowed bg-gray-100 text-gray-400" : "hover:border-gray-400"
        }`}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${selectedOption ? "text-gray-900" : "text-gray-500"}`}>
            {selectedOption?.label || placeholder}
          </span>
          {showSelectedDescription && selectedOption?.description ? (
            <span className="mt-0.5 block truncate text-xs text-gray-500">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                autoComplete="off"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (filteredOptions.length === 1) {
                      selecionar(filteredOptions[0].value);
                    }
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => selecionar("")}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-blue-50 ${
                !value ? "bg-blue-50 text-blue-700" : "text-gray-700"
              }`}
            >
              <span className="truncate">{clearLabel}</span>
              {!value ? <Check className="h-4 w-4 shrink-0" /> : null}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selecionar(option.value)}
                    className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-blue-50 ${
                      isSelected ? "bg-blue-50 text-blue-700" : "text-gray-900"
                    }`}
                    title={option.description || option.label}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{option.label}</span>
                      {option.description ? (
                        <span className={`mt-0.5 block text-xs leading-4 ${isSelected ? "text-blue-600" : "text-gray-500"}`}>
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NovoAgendamentoModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  agendamento,
  defaultDate,
  defaultTime,
  agendaSemanal,
  agendaFeriados,
  agendaExcecoes,
  intervaloSlotMinutos = 30,
  isAdmin = false,
}: NovoAgendamentoModalProps) {
  const fortinho = useFortinho();
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState<PacienteOption[]>([]);
  const [tutores, setTutores] = useState<TutorOption[]>([]);
  const [clinicas, setClinicas] = useState<ClinicaOption[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [tabelasPreco, setTabelasPreco] = useState<{ id: number; nome: string }[]>(TABELA_PRECO_PADRAO);
  const [tutorSelecionado, setTutorSelecionado] = useState<string>("");
  const [erroCarregamento, setErroCarregamento] = useState<string>("");
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [sugestoesHorario, setSugestoesHorario] = useState<SugestaoHorarioItem[]>([]);
  const [ofertasPanoramicasConsultadas, setOfertasPanoramicasConsultadas] = useState(false);
  const [erroSugestoes, setErroSugestoes] = useState<string>("");
  const [mensagemSugestoes, setMensagemSugestoes] = useState<string>("");
  const [indiceSugestaoAtual, setIndiceSugestaoAtual] = useState(0);
  const [decisaoAssistente, setDecisaoAssistente] = useState<AssistenteDecisao>("pendente");
  const [motivoSemOpcao, setMotivoSemOpcao] = useState("");
  const [excecaoConcedida, setExcecaoConcedida] = useState(false);
  const [registrandoEncerramento, setRegistrandoEncerramento] = useState(false);
  const [itensIgnoradosJanela, setItensIgnoradosJanela] = useState(0);
  const [mensagemProximidade, setMensagemProximidade] = useState<string>("");
  const [sugestaoProximidade, setSugestaoProximidade] = useState<SugestaoProximidadeResponse | null>(null);
  const [dataContatoAssistente, setDataContatoAssistente] = useState<string>("");
  const [interacaoProximidade, setInteracaoProximidade] = useState({
    clinica: false,
    servico: false,
    data: false,
  });
  const popupProximidadeHistoricoRef = useRef<Record<string, number>>({});
  const sequenciaConsultaProximidadeRef = useRef(0);
  const [modalTutorAberto, setModalTutorAberto] = useState(false);
  const [modalAnimalAberto, setModalAnimalAberto] = useState(false);
  const [salvandoTutor, setSalvandoTutor] = useState(false);
  const [salvandoAnimal, setSalvandoAnimal] = useState(false);
  const [novoTutor, setNovoTutor] = useState<NovoTutorForm>(buildInitialTutorForm());
  const [novoAnimal, setNovoAnimal] = useState<NovoAnimalForm>(buildInitialAnimalForm());
  const [saldoCreditoCliente, setSaldoCreditoCliente] = useState(0);
  const [carregandoCreditoCliente, setCarregandoCreditoCliente] = useState(false);
  const [erroCreditoCliente, setErroCreditoCliente] = useState("");
  const intervaloSugestaoMinutos = Number.isFinite(intervaloSlotMinutos)
    ? Math.max(5, Math.min(120, Math.round(intervaloSlotMinutos)))
    : 30;

  const [formData, setFormData] = useState<FormDataAgenda>(
    buildInitialFormData(defaultDate, defaultTime)
  );

  const isEditando = !!agendamento;
  const statusFormulario = isEditando
    ? (agendamento?.status || "Agendado")
    : (formData.marcar_como_reserva ? "Reservado" : "Agendado");
  const permiteSemPacienteTutor = statusFormulario === "Reservado";

  const parseApiDateTime = (value?: string): Date | null => {
    if (!value) return null;

    const match = value
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, ano, mes, dia, hora, minuto, segundo = "0"] = match;
      const local = new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hora),
        Number(minuto),
        Number(segundo),
        0
      );
      if (!Number.isNaN(local.getTime())) {
        return local;
      }
    }

    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseAgendamentoInicio = (ag: any): Date | null => {
    if (ag?.data && ag?.hora) {
      const [ano, mes, dia] = String(ag.data).split("-").map(Number);
      const [hora, minuto] = String(ag.hora).split(":").map(Number);
      if (
        Number.isFinite(ano) &&
        Number.isFinite(mes) &&
        Number.isFinite(dia) &&
        Number.isFinite(hora) &&
        Number.isFinite(minuto)
      ) {
        const local = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
        if (!Number.isNaN(local.getTime())) {
          return local;
        }
      }
    }

    return parseApiDateTime(ag?.inicio);
  };

  const toInputDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const hojeLocalIso = (): string => {
    const agora = new Date();
    return toInputDate(agora);
  };

  const toBrDate = (isoDate?: string): string => {
    const match = String(isoDate || "")
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(isoDate || "").trim();
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  };

  const isDataPassada = (isoDate?: string): boolean => {
    const match = String(isoDate || "")
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const [, year, month, day] = match;
    const dataSelecionada = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
    if (Number.isNaN(dataSelecionada.getTime())) return false;
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    return dataSelecionada.getTime() < hoje.getTime();
  };

  const getDiaRelativo = (isoDate?: string): string => {
    const match = String(isoDate || "")
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";

    const [, year, month, day] = match;
    const dataReferencia = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
    if (Number.isNaN(dataReferencia.getTime())) return "";

    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const diffDias = Math.round((dataReferencia.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDias === 0) return "hoje";
    if (diffDias === 1) return "amanhã";
    if (diffDias === 2) return "depois de amanhã";
    return "";
  };

  const toInputTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const toApiDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  // Inicializa formulario ao abrir no modo "novo" sem resetar quando pacientes/tutores atualizam.
  useEffect(() => {
    if (!isOpen || isEditando) return;
    setFormData(buildInitialFormData(defaultDate, defaultTime));
    setDataContatoAssistente((atual) => atual || hojeLocalIso());
    setTutorSelecionado("");
    setSugestoesHorario([]);
    setOfertasPanoramicasConsultadas(false);
    setIndiceSugestaoAtual(0);
    setDecisaoAssistente("pendente");
    setMotivoSemOpcao("");
    setExcecaoConcedida(false);
    setRegistrandoEncerramento(false);
    setItensIgnoradosJanela(0);
    setErroSugestoes("");
    setMensagemSugestoes("");
    setMensagemProximidade("");
    setSugestaoProximidade(null);
    setInteracaoProximidade({ clinica: false, servico: false, data: false });
    popupProximidadeHistoricoRef.current = {};
    sequenciaConsultaProximidadeRef.current = 0;
  }, [defaultDate, defaultTime, isEditando, isOpen]);

  // Preenche formulario ao abrir/atualizar no modo de edicao.
  useEffect(() => {
    if (!isOpen || !isEditando || !agendamento) return;
    setDataContatoAssistente("");

    const inicio = parseAgendamentoInicio(agendamento);
    const data = inicio ? toInputDate(inicio) : "";
    const hora = inicio ? toInputTime(inicio) : "";
    const pacienteSelecionado =
      agendamento.paciente_id && agendamento.paciente_id > 0
        ? pacientes.find((p) => p.id === agendamento.paciente_id)
        : null;

    setFormData({
      tutor_id:
        pacienteSelecionado?.tutor_id !== null &&
        pacienteSelecionado?.tutor_id !== undefined
          ? pacienteSelecionado.tutor_id.toString()
          : "",
      paciente_id:
        agendamento.paciente_id && agendamento.paciente_id > 0
          ? agendamento.paciente_id.toString()
          : "",
      clinica_id: agendamento.clinica_id?.toString() || "",
      clinica_nova_nome: "",
      clinica_nova_razao_social: "",
      clinica_nova_tabela_preco_id: "1",
      servico_id: agendamento.servico_id?.toString() || "",
      data,
      hora,
      marcar_como_reserva: agendamento.status === "Reservado",
      observacoes: agendamento.observacoes || "",
    });

    setTutorSelecionado(pacienteSelecionado?.tutor || "");
    setSugestoesHorario([]);
    setOfertasPanoramicasConsultadas(false);
    setIndiceSugestaoAtual(0);
    setDecisaoAssistente("pendente");
    setMotivoSemOpcao("");
    setExcecaoConcedida(false);
    setRegistrandoEncerramento(false);
    setItensIgnoradosJanela(0);
    setErroSugestoes("");
    setMensagemSugestoes("");
    setInteracaoProximidade({ clinica: false, servico: false, data: false });
    popupProximidadeHistoricoRef.current = {};
    sequenciaConsultaProximidadeRef.current = 0;
  }, [agendamento, isEditando, isOpen, pacientes]);

  // Carregar dados dos selects
  useEffect(() => {
    if (isOpen) {
      carregarDados();
      return;
    }

    setModalTutorAberto(false);
    setModalAnimalAberto(false);
    setSalvandoTutor(false);
    setSalvandoAnimal(false);
    setNovoTutor(buildInitialTutorForm());
    setNovoAnimal(buildInitialAnimalForm());
    setFormData(buildInitialFormData(defaultDate, defaultTime));
    setTutorSelecionado("");
    setSugestoesHorario([]);
    setOfertasPanoramicasConsultadas(false);
    setIndiceSugestaoAtual(0);
    setDecisaoAssistente("pendente");
    setMotivoSemOpcao("");
    setExcecaoConcedida(false);
    setRegistrandoEncerramento(false);
    setItensIgnoradosJanela(0);
    setErroSugestoes("");
    setMensagemSugestoes("");
    setMensagemProximidade("");
    setSugestaoProximidade(null);
    setDataContatoAssistente("");
    setSaldoCreditoCliente(0);
    setCarregandoCreditoCliente(false);
    setErroCreditoCliente("");
    setInteracaoProximidade({ clinica: false, servico: false, data: false });
    popupProximidadeHistoricoRef.current = {};
    sequenciaConsultaProximidadeRef.current = 0;
  }, [defaultDate, defaultTime, isOpen]);

  useEffect(() => {
    if (!isOpen || isEditando) {
      setSaldoCreditoCliente(0);
      setCarregandoCreditoCliente(false);
      setErroCreditoCliente("");
      return;
    }

    const tutorId = Number.parseInt(formData.tutor_id || "", 10);
    const pacienteId = Number.parseInt(formData.paciente_id || "", 10);
    const tutorValido = Number.isFinite(tutorId) && tutorId > 0;
    const pacienteValido = Number.isFinite(pacienteId) && pacienteId > 0;

    if (!tutorValido && !pacienteValido) {
      setSaldoCreditoCliente(0);
      setCarregandoCreditoCliente(false);
      setErroCreditoCliente("");
      return;
    }

    let ativo = true;
    setCarregandoCreditoCliente(true);
    setErroCreditoCliente("");

    (async () => {
      try {
        const saldo = await consultarSaldoCreditoCliente({
          tutorId: tutorValido ? tutorId : null,
          pacienteId: pacienteValido ? pacienteId : null,
        });
        if (!ativo) return;
        setSaldoCreditoCliente(saldo > 0 ? saldo : 0);
      } catch (error) {
        console.error("Erro ao consultar saldo de credito do cliente:", error);
        if (!ativo) return;
        setSaldoCreditoCliente(0);
        setErroCreditoCliente("Nao foi possivel consultar o credito do cliente no momento.");
      } finally {
        if (!ativo) return;
        setCarregandoCreditoCliente(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [formData.paciente_id, formData.tutor_id, isEditando, isOpen]);

  const carregarDados = async () => {
    const extrairItems = (payload: any): any[] => {
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload)) return payload;
      return [];
    };

    const resultados = await Promise.allSettled([
      api.get("/pacientes?limit=1000"),
      api.get("/tutores?limit=1000"),
      api.get("/clinicas?limit=1000"),
      api.get("/clinicas/tabelas-preco/opcoes"),
      api.get("/servicos?limit=1000"),
    ]);

    const falhas: string[] = [];

    const pacientesResp = resultados[0];
    if (pacientesResp.status === "fulfilled") {
      setPacientes(extrairItems(pacientesResp.value?.data) as PacienteOption[]);
    } else {
      setPacientes([]);
      falhas.push("pacientes");
    }

    const tutoresResp = resultados[1];
    if (tutoresResp.status === "fulfilled") {
      setTutores(extrairItems(tutoresResp.value?.data) as TutorOption[]);
    } else {
      setTutores([]);
      falhas.push("tutores");
    }

    const clinicasResp = resultados[2];
    if (clinicasResp.status === "fulfilled") {
      setClinicas(extrairItems(clinicasResp.value?.data));
    } else {
      setClinicas([]);
      falhas.push("clinicas");
    }

    const tabelasResp = resultados[3];
    if (tabelasResp.status === "fulfilled") {
      const itens = extrairItems(tabelasResp.value?.data);
      if (itens.length > 0) {
        setTabelasPreco(itens);
      } else {
        setTabelasPreco(TABELA_PRECO_PADRAO);
      }
    } else {
      setTabelasPreco(TABELA_PRECO_PADRAO);
      falhas.push("tabelas de preco");
    }

    const servicosResp = resultados[4];
    if (servicosResp.status === "fulfilled") {
      setServicos(extrairItems(servicosResp.value?.data));
    } else {
      setServicos([]);
      falhas.push("servicos");
    }

    if (falhas.length > 0) {
      setErroCarregamento(
        `Falha ao carregar ${falhas.join(", ")}. Atualize a pagina e tente novamente.`
      );
    } else {
      setErroCarregamento("");
    }
  };

  const resetFluxoAssistente = (preservarMensagemProximidade = true) => {
    setSugestoesHorario([]);
    setOfertasPanoramicasConsultadas(false);
    setIndiceSugestaoAtual(0);
    setDecisaoAssistente("pendente");
    setMotivoSemOpcao("");
    setExcecaoConcedida(false);
    setItensIgnoradosJanela(0);
    setErroSugestoes("");
    setMensagemSugestoes("");
    if (!preservarMensagemProximidade) {
      setMensagemProximidade("");
      setSugestaoProximidade(null);
    }
  };

  const handleTutorChange = (tutorId: string) => {
    const tutor = tutores.find((t) => t.id.toString() === tutorId);
    setTutorSelecionado(tutor?.nome || "");
    setFormData((prev) => ({
      ...prev,
      tutor_id: tutorId,
      paciente_id: "",
    }));
  };

  const handlePacienteChange = (pacienteId: string) => {
    const paciente = pacientes.find((p) => p.id.toString() === pacienteId);
    setTutorSelecionado(paciente?.tutor || "");
    setFormData((prev) => ({
      ...prev,
      paciente_id: pacienteId,
      tutor_id:
        paciente?.tutor_id !== null && paciente?.tutor_id !== undefined
          ? paciente.tutor_id.toString()
          : prev.tutor_id,
    }));
  };

  const buscarSugestaoProximidade = async (clinicaId: string, dataISO: string) => {
    const clinicaIdNum = Number.parseInt(clinicaId, 10);
    if (!Number.isFinite(clinicaIdNum)) {
      setMensagemProximidade("");
      setSugestaoProximidade(null);
      return;
    }
    if (!dataISO) {
      setMensagemProximidade("Selecione a data para ativar o assistente inteligente de proximidade.");
      setSugestaoProximidade(null);
      return;
    }
    const consultaId = ++sequenciaConsultaProximidadeRef.current;

    try {
      const dataContato = !isEditando ? (dataContatoAssistente || hojeLocalIso()) : undefined;
      const response = await api.post<SugestaoProximidadeResponse>("/agenda/sugestao-proximidade", {
        clinica_id: clinicaIdNum,
        data: dataISO,
        data_contato: dataContato,
        servico_id: formData.servico_id ? Number.parseInt(formData.servico_id, 10) : null,
        duracao_minutos: obterDuracaoServicoSelecionado(),
        intervalo_minutos: intervaloSugestaoMinutos,
        limite_sugestoes_operacionais: 8,
        perfil_deslocamento: "comercial",
        limite_minutos: LIMITE_MINUTOS_PROXIMIDADE,
        ignorar_agendamento_id: isEditando ? agendamento?.id : null,
      });
      if (consultaId !== sequenciaConsultaProximidadeRef.current) {
        return;
      }

      const data = response?.data || null;
      setSugestaoProximidade(data);
      const mensagem = String(data?.mensagem || "").trim();

      const item = data?.item;
      if (!data?.sugerir || !item) {
        setMensagemProximidade(mensagem || "Assistente inteligente sem sugestao para os dados atuais.");
        return;
      }

      const limiteBase = Number(data?.limite_minutos || LIMITE_MINUTOS_PROXIMIDADE);
      const duracao = Number(item?.duracao_deslocamento_min || 0);
      const duracaoAnterior = Number(item?.duracao_deslocamento_anterior_min || 0);
      const duracaoProximo = Number(item?.duracao_deslocamento_proximo_min || 0);
      const detalheComposicao = detalharComposicaoDeslocamento(duracao, duracaoAnterior, duracaoProximo);

      const dataSugerida = String(item?.data || dataISO || "").trim();
      const horaSugerida = String(item?.inicio || "").trim();
      const clinicaSugerida = String(item?.clinica || "").trim();
      const clinicaDestino = String(
        clinicas.find((c) => String(c?.id || "") === String(clinicaIdNum))?.nome || ""
      ).trim();
      const mesmoDestino = !!clinicaDestino && clinicaDestino === clinicaSugerida;
      const detalheHora = horaSugerida ? ` às ${horaSugerida}` : "";
      const dataSugeridaBr = toBrDate(dataSugerida) || dataSugerida;
      const diaRelativo = getDiaRelativo(dataSugerida);
      const dataSugeridaContexto = diaRelativo ? `${dataSugeridaBr} (${diaRelativo})` : dataSugeridaBr;
      const resumoHorario = `${dataSugeridaContexto}${detalheHora}`.trim() || "a data e o horário sugeridos";
      const acimaDoLimite = duracao > limiteBase || Boolean(data?.acima_do_limite);
      const politicaDistanteBaixa =
        Boolean(data?.politica_oferta?.distante_base) &&
        Boolean(data?.politica_oferta?.baixa_frequencia);
      const dataPreferencial = Boolean(item?.data_preferencial);
      const textoDeslocamento =
        clinicaDestino && !mesmoDestino
          ? `e a composicao do deslocamento para ${clinicaDestino} é de ${detalheComposicao}`
          : `com composicao estimada de deslocamento em ${detalheComposicao}`;
      const textoBase = `Encontramos uma opção melhor de horário para reduzir deslocamento. Temos um atendimento ${
        clinicaSugerida ? `na ${clinicaSugerida}` : "próximo"
      } no dia ${resumoHorario} ${textoDeslocamento}.`;
      const mensagemAssistente = acimaDoLimite
        ? `${textoBase} (limite configurado: ${limiteBase} min).`
        : `${textoBase} Esse deslocamento está dentro do limite configurado de ${limiteBase} min.`;
      const mensagemFinal = mensagem || mensagemAssistente;
      setMensagemProximidade(mensagemFinal);

      if (politicaDistanteBaixa && !dataPreferencial) {
        return;
      }

      const limiteEstendido = limiteBase + LIMITE_ESTENDIDO_EXTRA_MIN;
      if (!Number.isFinite(duracao) || duracao <= 0 || duracao > limiteEstendido) {
        return;
      }

      const chavePopup = [
        String(clinicaIdNum),
        String(formData.servico_id || ""),
        String(item?.agendamento_id || ""),
        String(item?.data || ""),
        String(item?.inicio || ""),
      ].join("|");
      const agora = Date.now();
      const ultimo = popupProximidadeHistoricoRef.current[chavePopup] || 0;
      if (agora - ultimo < COOLDOWN_POPUP_PROXIMIDADE_MS) {
        return;
      }
      popupProximidadeHistoricoRef.current[chavePopup] = agora;

      const mensagemPopup = acimaDoLimite
        ? [
            "Sugestão de proximidade acima do limite:",
            "",
            mensagemFinal,
            "",
            "Posso aplicar esse horário?",
          ].join("\n")
        : [
            "Sugestão inteligente de proximidade:",
            "",
            mensagemFinal,
            "",
            "Posso aplicar esse horário?",
          ].join("\n");
      const confirmou = await fortinho.confirm({
        title: acimaDoLimite
          ? "Sugestao de proximidade acima do limite"
          : "Sugestao inteligente de proximidade",
        message: mensagemPopup,
        confirmLabel: "Aplicar horario",
        cancelLabel: "Manter como esta",
        mood: acimaDoLimite ? "alert" : "thinking",
        gesture: "point-right",
      });

      if (confirmou && dataSugerida) {
        try {
          const { items, itensIgnorados } = await buscarSugestoesOperacionais(dataSugerida, clinicaIdNum);
          setItensIgnoradosJanela(itensIgnorados);
          setSugestoesHorario(items);
          setOfertasPanoramicasConsultadas(true);
          setIndiceSugestaoAtual(0);
          setMotivoSemOpcao("");
          setExcecaoConcedida(false);
          if (items.length === 0) {
            setDecisaoAssistente("pendente");
            setMensagemSugestoes(
              "Sem ofertas aderentes para a data sugerida por proximidade. Ajuste os filtros e gere novas ofertas antes de registrar recusa."
            );
            return;
          }
          setDecisaoAssistente("pendente");

          const candidatosRelacionados = items.filter(
            (cand) => Number(cand?.anterior?.agendamento_id || 0) === Number(item?.agendamento_id || 0)
          );

          const origemBusca = (candidatosRelacionados.length > 0 ? candidatosRelacionados : items).slice();

          const itemAlternativo = origemBusca.find((cand) => {
            const [dataCand, horaCand] = String(cand?.inicio || "").split(" ");
            if (!dataCand || !horaCand) return false;
            return dataCand !== dataSugerida || horaCand !== horaSugerida;
          });

          if (itemAlternativo?.inicio) {
            const [dataAplicacao, horaAplicacao] = String(itemAlternativo.inicio || "").split(" ");
            if (dataAplicacao && horaAplicacao) {
              setFormData((prev) => ({
                ...prev,
                data: dataAplicacao,
                hora: horaAplicacao,
              }));
              setErroSugestoes("");
              setMensagemSugestoes(
                `Horario operacional aplicado automaticamente: ${horaAplicacao}. Revise o panorama de ofertas antes de registrar aceite ou recusa.`
              );
              return;
            }
          }

          setFormData((prev) => ({
            ...prev,
            data: dataSugerida,
            hora: "",
          }));
          setErroSugestoes("");
          setMensagemSugestoes(
            items.length > 0
              ? "Data de proximidade aplicada. Revise o panorama completo de ofertas e registre aceite ou recusa."
              : "Data de proximidade aplicada. Clique em Sugerir horarios para encontrar um horario operacional."
          );
        } catch {
          setFormData((prev) => ({
            ...prev,
            data: dataSugerida,
            hora: "",
          }));
          setErroSugestoes("");
          setMensagemSugestoes(
            "Data de proximidade aplicada. Nao foi possivel aplicar horario automaticamente agora."
          );
        }
      }
    } catch {
      if (consultaId !== sequenciaConsultaProximidadeRef.current) {
        return;
      }
      setMensagemProximidade("Nao foi possivel consultar sugestoes de proximidade agora.");
      setSugestaoProximidade(null);
    }
  };

  const handleClinicaChange = (clinicaId: string) => {
    setInteracaoProximidade((prev) => ({ ...prev, clinica: true }));
    if (!isEditando) {
      resetFluxoAssistente(false);
    }
    setFormData((prev) => ({
      ...prev,
      clinica_id: clinicaId,
      clinica_nova_nome: clinicaId ? "" : prev.clinica_nova_nome,
      clinica_nova_razao_social: clinicaId ? "" : prev.clinica_nova_razao_social,
    }));
  };

  const handleServicoChange = (servicoId: string) => {
    setInteracaoProximidade((prev) => ({ ...prev, servico: true }));
    if (!isEditando) {
      resetFluxoAssistente();
    }
    setFormData((prev) => ({
      ...prev,
      servico_id: servicoId,
    }));
  };

  const handleDataChange = (data: string) => {
    setInteracaoProximidade((prev) => ({ ...prev, data: true }));
    if (!isEditando) {
      resetFluxoAssistente();
    }
    setFormData((prev) => ({
      ...prev,
      data,
    }));
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!formData.clinica_id) {
      setMensagemProximidade("");
      setSugestaoProximidade(null);
      return;
    }
    if (!formData.servico_id) {
      setMensagemProximidade("Selecione o servico para ativar o assistente inteligente de proximidade.");
      setSugestaoProximidade(null);
      return;
    }
    if (!interacaoProximidade.clinica || !interacaoProximidade.servico) {
      return;
    }
    void buscarSugestaoProximidade(formData.clinica_id, formData.data);
  }, [
    isOpen,
    formData.clinica_id,
    formData.servico_id,
    formData.data,
    interacaoProximidade.clinica,
    interacaoProximidade.servico,
  ]);

  const pacientesFiltradosPorTutor = formData.tutor_id
    ? pacientes.filter((paciente) => String(paciente.tutor_id || "") === formData.tutor_id)
    : pacientes;

  const tutorOptions: SearchableSelectOption[] = tutores.map((tutor) => ({
    value: tutor.id.toString(),
    label: tutor.nome,
    description: tutor.telefone ? `Telefone: ${tutor.telefone}` : undefined,
    searchText: [tutor.nome, tutor.telefone || ""].filter(Boolean).join(" "),
  }));

  const pacienteOptions: SearchableSelectOption[] = pacientesFiltradosPorTutor.map((paciente) => ({
    value: paciente.id.toString(),
    label: paciente.nome,
    description: formatarResumoPaciente(paciente) || undefined,
    searchText: [paciente.nome, paciente.tutor || "", paciente.especie || "", paciente.raca || ""]
      .filter(Boolean)
      .join(" "),
  }));

  const clinicaOptions: SearchableSelectOption[] = clinicas.map((clinica) => {
    const endereco = formatarEnderecoClinica(clinica) || "Endereco nao cadastrado";

    return {
      value: clinica.id.toString(),
      label: clinica.nome,
      description: endereco,
      searchText: [clinica.nome, endereco].filter(Boolean).join(" "),
    };
  });

  const obterDuracaoServicoSelecionado = (): number => {
    const servicoSelecionado = servicos.find((s) => s.id?.toString() === formData.servico_id);
    const duracaoMinutos = Number.parseInt(
      `${servicoSelecionado?.duracao_minutos ?? ""}`,
      10
    );
    return Number.isFinite(duracaoMinutos) && duracaoMinutos > 0 ? duracaoMinutos : 30;
  };

  const buscarSugestoesOperacionais = async (
    dataBaseBusca: string,
    clinicaId: number
  ): Promise<{ items: SugestaoHorarioItem[]; motivo: string; itensIgnorados: number }> => {
    const payload = {
      data: dataBaseBusca,
      clinica_id: clinicaId,
      servico_id: formData.servico_id ? parseInt(formData.servico_id, 10) : null,
      duracao_minutos: obterDuracaoServicoSelecionado(),
      intervalo_minutos: intervaloSugestaoMinutos,
      limite: 8,
      perfil_deslocamento: "comercial",
      ignorar_agendamento_id: isEditando ? agendamento?.id : null,
    };

    const response = await api.post<SugestoesHorarioResponse>("/agenda/sugestoes-horario", payload);
    const items = Array.isArray(response?.data?.items) ? response.data.items : [];
    const motivo = String(response?.data?.motivo || "").trim();
    const itensIgnorados = Number(response?.data?.itens_ignorados_janela || 0);
    return { items, motivo, itensIgnorados };
  };

  const aplicarSugestaoHorario = (item: SugestaoHorarioItem) => {
    const [data, hora] = String(item.inicio || "").split(" ");
    if (!data || !hora) {
      setErroSugestoes("Nao foi possivel aplicar o horario sugerido.");
      return;
    }

    setFormData((prev) => ({ ...prev, data, hora }));
    setMensagemSugestoes(`Horario sugerido aplicado: ${hora}.`);
    setErroSugestoes("");
  };

  const confirmarAceiteSugestao = (item: SugestaoHorarioItem, indice: number) => {
    setIndiceSugestaoAtual(indice);
    aplicarSugestaoHorario(item);
    setDecisaoAssistente("aceito");
    setMotivoSemOpcao("");
    setExcecaoConcedida(false);
    setErroSugestoes("");
    setMensagemSugestoes("Cliente aceitou o horario sugerido pelo assistente.");
  };

  const liberarFluxoManual = () => {
    if (!ofertasPanoramicasConsultadas) {
      setErroSugestoes("Gere e visualize as ofertas do assistente antes de registrar recusa.");
      return;
    }
    if (totalSugestoes < 1) {
      setErroSugestoes("Nao e possivel registrar recusa sem ao menos 1 oferta exibida no panorama.");
      return;
    }
    setDecisaoAssistente("sem_opcao");
    setExcecaoConcedida(false);
    setErroSugestoes("");
    setMensagemSugestoes(
      isAdmin
        ? "Nenhuma oferta panoramica atendeu. Registre o motivo e conceda excecao para liberar data/hora manual."
        : "Nenhuma oferta panoramica atendeu. Registre o motivo e solicite excecao ao administrador."
    );
  };

  const liberarFluxoRetroativoAdmin = () => {
    if (!isAdmin) {
      setErroSugestoes("Apenas administradores podem registrar agendamento retroativo.");
      return;
    }
    if (!ofertasPanoramicasConsultadas) {
      setErroSugestoes("Gere as ofertas primeiro para registrar a tentativa do assistente.");
      return;
    }
    if (!isDataPassada(formData.data)) {
      setErroSugestoes("Fluxo retroativo disponivel apenas para datas passadas.");
      return;
    }
    setDecisaoAssistente("sem_opcao");
    setExcecaoConcedida(true);
    if (!(motivoSemOpcao || "").trim()) {
      setMotivoSemOpcao("Registro retroativo: atendimento realizado e lancado apos a data original.");
    }
    setErroSugestoes("");
    setMensagemSugestoes(
      "Modo retroativo liberado por admin. Revise data/hora, confirme o motivo e salve o agendamento."
    );
  };

  const registrarDesfechoSemAgendamento = async (
    tipo: "solicitacao_excecao" | "encerramento_sem_agendamento"
  ) => {
    const motivo = String(motivoSemOpcao || "").trim();
    if (!motivo) {
      setErroSugestoes("Registre o motivo antes de concluir sem agendamento.");
      return;
    }

    try {
      setRegistrandoEncerramento(true);
      const clinicaId = Number.parseInt(formData.clinica_id || "", 10);
      const servicoId = Number.parseInt(formData.servico_id || "", 10);
      await api.post("/agenda/assistente/encerramento", {
        tipo,
        motivo,
        clinica_id: Number.isFinite(clinicaId) ? clinicaId : null,
        servico_id: Number.isFinite(servicoId) ? servicoId : null,
        data_referencia: String(formData.data || "").trim() || null,
        data_contato: String(dataContatoAssistente || "").trim() || null,
        contexto: {
          total_sugestoes: totalSugestoes,
          indice_sugestao_atual: indiceSugestaoAtual + 1,
          decisao_assistente: decisaoAssistente,
          perfil: isAdmin ? "admin" : "nao_admin",
        },
      });

      fortinho.notify({
        title: tipo === "solicitacao_excecao" ? "Solicitacao registrada" : "Encerramento registrado",
        message:
          tipo === "solicitacao_excecao"
            ? "Solicitacao de excecao enviada para administracao. Atendimento encerrado sem agendamento."
            : "Atendimento encerrado sem agendamento com motivo registrado.",
        mood: "happy",
        gesture: "wave",
      });
      onClose();
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      setErroSugestoes(extrairMensagemErro(detail, "Nao foi possivel registrar este desfecho agora."));
    } finally {
      setRegistrandoEncerramento(false);
    }
  };

  const concederExcecaoAdmin = () => {
    if (!isAdmin) {
      setErroSugestoes("Apenas administradores podem conceder excecao de horario.");
      return;
    }
    if (!(motivoSemOpcao || "").trim()) {
      setErroSugestoes("Registre o motivo antes de conceder excecao.");
      return;
    }
    setExcecaoConcedida(true);
    setMensagemSugestoes(
      "Excecao concedida por admin. Ajuste data/hora manualmente e conclua o agendamento."
    );
    setErroSugestoes("");
  };

  const revogarExcecaoAdmin = () => {
    setExcecaoConcedida(false);
    setMensagemSugestoes(
      "Excecao revogada. O fluxo voltou para bloqueio de data/hora manual."
    );
  };

  const extrairHoraDataHora = (value: string): string => {
    const [, hora] = String(value || "").split(" ");
    return hora || value;
  };

  const buscarSugestoesHorario = async () => {
    setMensagemSugestoes("");
    setErroSugestoes("");
    setSugestoesHorario([]);
    setOfertasPanoramicasConsultadas(false);

    const clinicaId = Number.parseInt(formData.clinica_id || "", 10);
    if (!Number.isFinite(clinicaId)) {
      setErroSugestoes("Selecione uma clinica cadastrada para sugerir horarios.");
      return;
    }
    if (!formData.servico_id) {
      setErroSugestoes("Selecione o servico para sugerir horarios operacionais com duracao correta.");
      return;
    }

    const dataSelecionada = String(formData.data || "").trim();

    try {
      setCarregandoSugestoes(true);
      const dataContato = !isEditando ? (dataContatoAssistente || hojeLocalIso()) : undefined;
      const response = await api.post<AssistenteOfertaResponse>("/agenda/assistente/ofertas", {
        clinica_id: clinicaId,
        data: dataSelecionada || null,
        data_contato: dataContato,
        servico_id: formData.servico_id ? parseInt(formData.servico_id, 10) : null,
        duracao_minutos: obterDuracaoServicoSelecionado(),
        intervalo_minutos: intervaloSugestaoMinutos,
        limite: 8,
        perfil_deslocamento: "comercial",
        limite_minutos: LIMITE_MINUTOS_PROXIMIDADE,
        ignorar_agendamento_id: isEditando ? agendamento?.id : null,
      });

      const dados = response?.data || null;
      const panorama = dados?.panorama_ofertas || null;
      const items = Array.isArray(panorama?.items) ? panorama.items : [];
      const motivo = String(panorama?.motivo || "").trim();
      const itensIgnorados = Number(panorama?.itens_ignorados_janela || 0);
      setItensIgnoradosJanela(itensIgnorados);
      setSugestoesHorario(items);
      setOfertasPanoramicasConsultadas(true);
      setIndiceSugestaoAtual(0);
      setDecisaoAssistente("pendente");
      setMotivoSemOpcao("");
      if (dados?.sugestao_proximidade) {
        setSugestaoProximidade(dados.sugestao_proximidade);
      }

      const mensagemOrquestrada = String(dados?.mensagem_panorama || "").trim();
      if (items.length === 0) {
        setDecisaoAssistente("pendente");
        setMensagemSugestoes(
          mensagemOrquestrada ||
            motivo ||
            "Nenhum horario operacional encontrado para essa data. Ajuste os filtros e gere novas ofertas antes de registrar recusa."
        );
      } else if (items.every((item) => !item.anterior && !item.proximo)) {
        setMensagemSugestoes(
          mensagemOrquestrada ||
            "Nao ha agendamentos vizinhos nesta data; por isso o deslocamento pode aparecer como 0 min."
        );
      } else if (mensagemOrquestrada) {
        setMensagemSugestoes(mensagemOrquestrada);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setErroSugestoes(typeof detail === "string" ? detail : "Falha ao buscar sugestoes de horario.");
    } finally {
      setCarregandoSugestoes(false);
    }
  };

  const extrairMensagemErro = (detail: any, fallback = "Falha inesperada."): string => {
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail && typeof detail === "object") {
      if (typeof detail.mensagem === "string" && detail.mensagem.trim()) return detail.mensagem;
      if (typeof detail.message === "string" && detail.message.trim()) return detail.message;
      if (typeof detail.detail === "string" && detail.detail.trim()) return detail.detail;
    }
    return fallback;
  };

  const extrairConflitoDeslocamento = (error: any): ConflitoDeslocamentoDetail | null => {
    if (error?.response?.status !== 409) return null;
    const detail = error?.response?.data?.detail;
    if (detail && typeof detail === "object" && detail.codigo === "CONFLITO_DESLOCAMENTO") {
      return detail as ConflitoDeslocamentoDetail;
    }

    const detailStr = String(detail || "");
    if (detailStr.toLowerCase().includes("deslocamento")) {
      return { mensagem: detailStr, confirmavel: false };
    }
    return null;
  };

  const confirmarExcecaoConflitoAdmin = async (conflito: ConflitoDeslocamentoDetail): Promise<boolean> => {
    if (!isAdmin) return false;

    const mensagemConflito = extrairMensagemErro(
      conflito,
      "Conflito operacional de deslocamento detectado para este horario."
    );
    return fortinho.confirm({
      title: "Conflito operacional",
      message:
        `${mensagemConflito}\n\nComo admin, deseja conceder excecao para concluir o agendamento neste horario?`,
      mood: "alert",
      gesture: "open-arms",
      confirmLabel: "Conceder excecao",
      cancelLabel: "Cancelar",
    });
  };

  const abrirModalTutor = () => {
    setNovoTutor(buildInitialTutorForm());
    setModalTutorAberto(true);
  };

  const abrirModalAnimal = () => {
    setNovoAnimal(buildInitialAnimalForm(formData.tutor_id));
    setModalAnimalAberto(true);
  };

  const salvarNovoTutor = async () => {
    const nome = novoTutor.nome.trim();
    if (!nome) {
      fortinho.notify({
        title: "Cadastro de tutor",
        message: "Informe o nome do tutor.",
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
      return;
    }

    try {
      setSalvandoTutor(true);
      const response = await api.post("/tutores", {
        nome,
        telefone: novoTutor.telefone || null,
        whatsapp: novoTutor.whatsapp || novoTutor.telefone || null,
        email: novoTutor.email || null,
      });

      const tutorId = response?.data?.id;
      const tutorNome = response?.data?.nome || nome;
      if (!tutorId) {
        throw new Error("Nao foi possivel salvar o tutor.");
      }

      setTutores((prev) => {
        const tutorNormalizado: TutorOption = {
          id: Number(tutorId),
          nome: tutorNome,
          telefone: novoTutor.telefone || null,
        };
        const restantes = prev.filter((item) => item.id !== Number(tutorId));
        return [...restantes, tutorNormalizado].sort((a, b) => a.nome.localeCompare(b.nome));
      });

      setFormData((prev) => ({
        ...prev,
        tutor_id: String(tutorId),
        paciente_id: "",
      }));
      setTutorSelecionado(tutorNome);
      setModalTutorAberto(false);
      setNovoTutor(buildInitialTutorForm());
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      fortinho.notify({
        title: "Erro ao salvar tutor",
        message: extrairMensagemErro(detail),
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
    } finally {
      setSalvandoTutor(false);
    }
  };

  const salvarNovoAnimal = async () => {
    const nomeAnimal = novoAnimal.nome.trim();
    if (!nomeAnimal) {
      fortinho.notify({
        title: "Cadastro de animal",
        message: "Informe o nome do animal.",
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
      return;
    }

    const tutorId = Number.parseInt(novoAnimal.tutor_id || "", 10);
    if (!Number.isFinite(tutorId)) {
      fortinho.notify({
        title: "Cadastro de animal",
        message: "Selecione um tutor para cadastrar o animal.",
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
      return;
    }

    const tutor = tutores.find((item) => item.id === tutorId);
    if (!tutor?.nome) {
      fortinho.notify({
        title: "Cadastro de animal",
        message: "Tutor selecionado nao encontrado.",
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
      return;
    }

    const pesoInformado = (novoAnimal.peso_kg || "").trim().replace(",", ".");
    const pesoKg = pesoInformado ? Number.parseFloat(pesoInformado) : NaN;

    try {
      setSalvandoAnimal(true);
      const response = await api.post("/pacientes", {
        nome: nomeAnimal,
        tutor: tutor.nome,
        especie: (novoAnimal.especie || "").trim() || "Canina",
        raca: novoAnimal.raca || "",
        sexo: novoAnimal.sexo || "Macho",
        peso_kg: Number.isFinite(pesoKg) ? pesoKg : null,
        data_nascimento: novoAnimal.data_nascimento || null,
        microchip: novoAnimal.microchip || "",
        observacoes: novoAnimal.observacoes || "Cadastro via modal de animal na agenda",
      });

      const novoPacienteId = response?.data?.id;
      if (!novoPacienteId) {
        throw new Error("Nao foi possivel salvar o animal.");
      }

      const pacienteCriado: PacienteOption = {
        id: Number(novoPacienteId),
        nome: response?.data?.nome || nomeAnimal,
        tutor: tutor.nome,
        tutor_id: tutor.id,
        especie: response?.data?.especie || novoAnimal.especie || "Canina",
        raca: response?.data?.raca || novoAnimal.raca || "",
      };

      setPacientes((prev) => {
        const restantes = prev.filter((item) => item.id !== pacienteCriado.id);
        return [...restantes, pacienteCriado].sort((a, b) => a.nome.localeCompare(b.nome));
      });
      setFormData((prev) => ({
        ...prev,
        tutor_id: String(tutor.id),
        paciente_id: String(pacienteCriado.id),
      }));
      setTutorSelecionado(tutor.nome);
      setModalAnimalAberto(false);
      setNovoAnimal(buildInitialAnimalForm(String(tutor.id)));
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      fortinho.notify({
        title: "Erro ao salvar animal",
        message: extrairMensagemErro(detail),
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
    } finally {
      setSalvandoAnimal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!isEditando) {
        if (!formData.servico_id) {
          throw new Error("Selecione o servico antes de concluir o agendamento guiado.");
        }
        if (!formData.clinica_id && !(formData.clinica_nova_nome || "").trim()) {
          throw new Error("Informe a clinica para iniciar o assistente de agendamento.");
        }
        if (decisaoAssistente === "pendente") {
          throw new Error(
            "Conclua o assistente guiado: confirme aceite do cliente ou marque que nenhuma opcao atendeu."
          );
        }
        if (decisaoAssistente === "sem_opcao" && !(motivoSemOpcao || "").trim()) {
          throw new Error("Descreva o motivo da recusa das sugestoes para seguir com horario manual.");
        }
        if (decisaoAssistente === "sem_opcao" && (!isAdmin || !excecaoConcedida)) {
          if (isAdmin) {
            throw new Error("Conceda excecao de horario ou encerre sem agendamento antes de salvar.");
          }
          throw new Error(
            "Seu perfil nao pode liberar horario manual. Solicite excecao ao administrador ou encerre sem agendamento."
          );
        }
      }

      const inicio = new Date(`${formData.data}T${formData.hora}:00`);
      if (Number.isNaN(inicio.getTime())) {
        throw new Error("Data ou hora invalida.");
      }

      const duracaoEfetiva = obterDuracaoServicoSelecionado();
      const fim = new Date(inicio.getTime() + duracaoEfetiva * 60000);

      const validacaoHorario = validarHorarioAgendamento(
        inicio,
        fim,
        agendaSemanal,
        agendaFeriados,
        agendaExcecoes
      );
      if (!validacaoHorario.valido) {
        throw new Error(validacaoHorario.motivo);
      }

      let pacienteId = formData.paciente_id ? parseInt(formData.paciente_id, 10) : NaN;

      if (!Number.isFinite(pacienteId) && !permiteSemPacienteTutor) {
        if (formData.tutor_id) {
          throw new Error("Selecione um animal do tutor escolhido ou cadastre um novo animal.");
        }
        throw new Error("Selecione um animal para o agendamento.");
      }

      let clinicaId = formData.clinica_id ? parseInt(formData.clinica_id, 10) : NaN;
      if (!Number.isFinite(clinicaId) && (formData.clinica_nova_nome || "").trim()) {
        const respostaClinica = await api.post("/clinicas", {
          nome: (formData.clinica_nova_nome || "").trim(),
          razao_social: (formData.clinica_nova_razao_social || "").trim(),
          cnpj: "",
          telefone: "",
          email: "",
          endereco: "",
          cidade: "",
          estado: "",
          cep: "",
          observacoes: "",
          tabela_preco_id: parseInt(formData.clinica_nova_tabela_preco_id || "1", 10),
          preco_personalizado_km: 0,
          preco_personalizado_base: 0,
          observacoes_preco: "Cadastro rapido via agenda panoramica",
        });

        clinicaId = respostaClinica?.data?.id;
        if (!clinicaId) {
          throw new Error("Nao foi possivel criar a clinica rapidamente.");
        }
      }

      const observacoesOriginais = String(formData.observacoes || "").trim();
      const observacoesAssistente: string[] = [];
      if (!isEditando) {
        if (decisaoAssistente === "aceito") {
          const sugestaoAceita = sugestoesHorario[indiceSugestaoAtual];
          observacoesAssistente.push(
            `[Assistente agenda] sugestao aceita (${indiceSugestaoAtual + 1}/${Math.max(1, sugestoesHorario.length)})`
          );
          if (sugestaoAceita?.inicio) {
            observacoesAssistente.push(
              `[Assistente agenda] horario ofertado: ${String(sugestaoAceita.inicio)}`
            );
          }
        } else if (decisaoAssistente === "sem_opcao") {
          observacoesAssistente.push("[Assistente agenda] sem opcao aderente para o cliente.");
          observacoesAssistente.push(
            `[Assistente agenda] motivo informado: ${String(motivoSemOpcao || "").trim()}`
          );
          if (isAdmin && excecaoConcedida) {
            observacoesAssistente.push("[Assistente agenda] excecao manual concedida por admin.");
          }
        }
      }
      const observacoesFinal = [observacoesOriginais, ...observacoesAssistente]
        .filter((item) => String(item || "").trim().length > 0)
        .join("\n");

      const payloadBase = {
        paciente_id: Number.isFinite(pacienteId) ? pacienteId : null,
        clinica_id: Number.isFinite(clinicaId) ? clinicaId : null,
        servico_id: formData.servico_id ? parseInt(formData.servico_id, 10) : null,
        inicio: toApiDateTime(inicio),
        fim: toApiDateTime(fim),
        status: statusFormulario,
        observacoes: observacoesFinal,
        excecao_operacional_concedida:
          !isEditando && decisaoAssistente === "sem_opcao" && isAdmin && excecaoConcedida,
        motivo_excecao_operacional:
          !isEditando && decisaoAssistente === "sem_opcao" && isAdmin && excecaoConcedida
            ? String(motivoSemOpcao || "").trim()
            : null,
      };

      const enviarAgendamento = async (confirmarConflitoDeslocamento = false) => {
        const payload = {
          ...payloadBase,
          confirmar_conflito_deslocamento: confirmarConflitoDeslocamento,
        };
        if (isEditando) {
          return api.put(`/agenda/${agendamento.id}`, payload);
        }
        return api.post("/agenda", payload);
      };

      let response;
      try {
        response = await enviarAgendamento(false);
      } catch (error: any) {
        const conflito = extrairConflitoDeslocamento(error);
        if (conflito) {
          if (!isAdmin) {
            throw new Error(
              extrairMensagemErro(
                conflito,
                "Conflito operacional de deslocamento. Ajuste o horario ou escolha outra clinica."
              )
            );
          }

          const confirmouExcecao = await confirmarExcecaoConflitoAdmin(conflito);
          if (!confirmouExcecao) {
            throw new Error(
              extrairMensagemErro(
                conflito,
                "Conflito operacional de deslocamento. Ajuste o horario ou escolha outra clinica."
              )
            );
          }

          try {
            response = await enviarAgendamento(true);
          } catch (errorOverride: any) {
            const conflitoOverride = extrairConflitoDeslocamento(errorOverride);
            if (conflitoOverride) {
              throw new Error(
                extrairMensagemErro(
                  conflitoOverride,
                  "Nao foi possivel concluir mesmo com excecao. Ajuste o horario ou escolha outra clinica."
                )
              );
            }
            throw errorOverride;
          }
        } else {
          throw error;
        }
      }

      await onSuccess(response?.data);
      onClose();
      setFormData(buildInitialFormData(defaultDate, defaultTime));
      setTutorSelecionado("");
      setSugestoesHorario([]);
      setOfertasPanoramicasConsultadas(false);
      setIndiceSugestaoAtual(0);
      setDecisaoAssistente("pendente");
      setMotivoSemOpcao("");
      setExcecaoConcedida(false);
      setRegistrandoEncerramento(false);
      setItensIgnoradosJanela(0);
      setErroSugestoes("");
      setMensagemSugestoes("");
      setMensagemProximidade("");
      setSugestaoProximidade(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      const detailStr = extrairMensagemErro(detail);
      fortinho.notify({
        title: `Erro ao ${isEditando ? "editar" : "criar"} agendamento`,
        message: detailStr,
        mood: "alert",
        gesture: "idle",
        sticky: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const clinicaInformada = Boolean(formData.clinica_id) || Boolean((formData.clinica_nova_nome || "").trim());
  const assistenteProntoParaSugerir = clinicaInformada && Boolean(formData.servico_id) && Boolean(formData.data);
  const totalSugestoes = sugestoesHorario.length;
  const indiceEtapaWizardNovo = resolverIndiceEtapaWizardNovo(
    assistenteProntoParaSugerir,
    decisaoAssistente
  );
  const etapaWizardAtual = !isEditando ? ETAPAS_WIZARD_NOVO[indiceEtapaWizardNovo] : null;
  const excecaoManualLiberada = !isEditando && decisaoAssistente === "sem_opcao" && isAdmin && excecaoConcedida;
  const bloqueioManualAssistenteAtivo = !isEditando && !excecaoManualLiberada;
  const bloquearDataManual = bloqueioManualAssistenteAtivo && assistenteProntoParaSugerir;
  const bloquearHoraManual = bloqueioManualAssistenteAtivo;
  const semOpcaoSemExcecao = !isEditando && decisaoAssistente === "sem_opcao" && !excecaoManualLiberada;
  const dataSelecionadaPassada = !isEditando && isDataPassada(formData.data);
  const clienteComCredito = !isEditando && saldoCreditoCliente > 0;
  const bloquearSalvarNovo =
    !isEditando &&
    (
      decisaoAssistente === "pendente" ||
      (decisaoAssistente === "sem_opcao" && (!(motivoSemOpcao || "").trim() || semOpcaoSemExcecao))
    );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEditando ? "Editar Agendamento" : "Novo Agendamento"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erroCarregamento && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erroCarregamento}
            </div>
          )}

          {/* Tutor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Tutor {permiteSemPacienteTutor ? "(opcional para reserva)" : "*"}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <SearchableSelect
                value={formData.tutor_id}
                onChange={handleTutorChange}
                options={tutorOptions}
                placeholder="Selecione..."
                searchPlaceholder="Buscar tutor por nome ou telefone..."
                emptyText="Nenhum tutor encontrado."
                clearLabel="Selecione..."
              />
              <button
                type="button"
                onClick={abrirModalTutor}
                className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                Novo tutor
              </button>
            </div>
          </div>

          {/* Animal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              {permiteSemPacienteTutor ? "Animal (opcional para reserva)" : "Animal *"}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <SearchableSelect
                value={formData.paciente_id}
                onChange={handlePacienteChange}
                options={pacienteOptions}
                placeholder="Selecione..."
                searchPlaceholder="Buscar animal ou tutor..."
                emptyText={
                  formData.tutor_id
                    ? "Nenhum animal encontrado para este tutor."
                    : "Nenhum animal encontrado."
                }
                clearLabel="Selecione..."
              />
              <button
                type="button"
                onClick={abrirModalAnimal}
                className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                Novo animal
              </button>
            </div>

            {tutorSelecionado && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg">
                <User className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Tutor selecionado:</span>
                <span>{tutorSelecionado}</span>
              </div>
            )}
          </div>

          {/* Clínica */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building className="w-4 h-4 inline mr-1" />
              Clínica
            </label>
            <SearchableSelect
              value={formData.clinica_id}
              onChange={handleClinicaChange}
              options={clinicaOptions}
              placeholder="Selecione..."
              searchPlaceholder="Buscar clinica ou endereco..."
              emptyText="Nenhuma clinica encontrada."
              clearLabel="Selecione..."
              showSelectedDescription
            />
            {mensagemProximidade && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <strong>Assistente inteligente:</strong> {mensagemProximidade}
                {!isEditando && (
                  <div className="mt-1 text-xs text-amber-900">
                    Proximo passo: gerar melhor oferta para visualizar o panorama completo antes de confirmar com o cliente.
                  </div>
                )}
              </div>
            )}

            {!formData.clinica_id && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={formData.clinica_nova_nome}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome fantasia (cadastro rápido)"
                />
                <input
                  type="text"
                  value={formData.clinica_nova_razao_social}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_razao_social: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Razão social"
                />
                <select
                  value={formData.clinica_nova_tabela_preco_id}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_tabela_preco_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {tabelasPreco.map((opcao) => (
                    <option key={opcao.id} value={opcao.id.toString()}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serviço
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.servico_id}
              onChange={(e) => handleServicoChange(e.target.value)}
            >
              <option value="">Selecione...</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id.toString()}>
                  {s.nome}
                </option>
              ))}
            </select>
            {formData.servico_id && (
              <p className="mt-1 text-xs text-gray-500">
                Duração estimada: {
                  (() => {
                    const servicoSelecionado = servicos.find((s) => s.id?.toString() === formData.servico_id);
                    const duracaoMinutos = Number.parseInt(`${servicoSelecionado?.duracao_minutos ?? ""}`, 10);
                    return Number.isFinite(duracaoMinutos) && duracaoMinutos > 0 ? `${duracaoMinutos} min` : "30 min";
                  })()
                }
              </p>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data *
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.data}
                onChange={(e) => handleDataChange(e.target.value)}
                disabled={bloquearDataManual}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Hora *
              </label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.hora}
                onChange={(e) => setFormData({...formData, hora: e.target.value})}
                disabled={bloquearHoraManual}
              />
            </div>
          </div>
          {!isEditando && bloqueioManualAssistenteAtivo && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {decisaoAssistente !== "sem_opcao" && (
                <span>
                  Data/hora manuais ficam bloqueadas enquanto o assistente guiado estiver ativo. Se nenhuma oferta atender,
                  marque a recusa para seguir o fluxo de excecao.
                </span>
              )}
              {decisaoAssistente === "sem_opcao" && isAdmin && !excecaoConcedida && (
                <span>
                  Como admin, registre o motivo e clique em <strong>Conceder excecao</strong> para liberar ajuste manual.
                </span>
              )}
              {decisaoAssistente === "sem_opcao" && !isAdmin && (
                <span>
                  Seu perfil nao pode liberar horario manual. Registre o motivo e solicite excecao ao administrador.
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {isEditando ? "Sugerir horarios operacionais" : "Assistente guiado de agendamento"}
              </div>
              <button
                type="button"
                onClick={buscarSugestoesHorario}
                disabled={carregandoSugestoes || (!isEditando && !assistenteProntoParaSugerir)}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {carregandoSugestoes ? "Buscando..." : (isEditando ? "Sugerir horarios" : "Gerar melhor oferta")}
              </button>
            </div>

            <p className="text-xs text-blue-800">
              {isEditando
                ? "Considera conflitos de agenda e tempo de deslocamento entre clinicas."
                : "Fluxo obrigatorio: selecionar clinica/servico, oferecer sugestao, registrar aceite ou recusa do cliente."}
            </p>

            {!isEditando && etapaWizardAtual && (
              <div className="rounded-md border border-blue-200 bg-white px-2 py-2 space-y-2">
                <div className="text-xs font-semibold text-blue-900">
                  Etapa atual: {indiceEtapaWizardNovo + 1}/{ETAPAS_WIZARD_NOVO.length} - {etapaWizardAtual.titulo}
                </div>
                <div className="text-[11px] text-blue-700">
                  {etapaWizardAtual.descricao}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ETAPAS_WIZARD_NOVO.map((etapa, idx) => {
                    const concluida = idx < indiceEtapaWizardNovo;
                    const ativa = idx === indiceEtapaWizardNovo;
                    const className = ativa
                      ? "rounded-md border border-blue-300 bg-blue-50 px-2 py-1"
                      : concluida
                        ? "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1"
                        : "rounded-md border border-gray-200 bg-gray-50 px-2 py-1";
                    const tituloClass = ativa
                      ? "text-[11px] font-semibold text-blue-900"
                      : concluida
                        ? "text-[11px] font-semibold text-emerald-900"
                        : "text-[11px] font-semibold text-gray-600";
                    const descClass = ativa
                      ? "text-[11px] text-blue-700"
                      : concluida
                        ? "text-[11px] text-emerald-700"
                        : "text-[11px] text-gray-500";

                    return (
                      <div key={etapa.id} className={className}>
                        <div className={tituloClass}>Etapa {idx + 1}: {etapa.titulo}</div>
                        <div className={descClass}>{etapa.descricao}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!isEditando && !assistenteProntoParaSugerir && (
              <div className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700">
                Preencha clinica, servico e data para iniciar o assistente guiado.
              </div>
            )}

            {itensIgnoradosJanela > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {itensIgnoradosJanela} opcao(oes) foram ignoradas por estarem fora da janela operacional/agenda fechada.
              </div>
            )}

            {erroSugestoes && (
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                {erroSugestoes}
              </div>
            )}

            {mensagemSugestoes && !erroSugestoes && (
              <div className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700">
                {mensagemSugestoes}
              </div>
            )}

            {!isEditando && assistenteProntoParaSugerir && ofertasPanoramicasConsultadas && totalSugestoes === 0 && dataSelecionadaPassada && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 space-y-2">
                <div className="text-xs text-amber-900">
                  Data passada detectada sem oferta operacional. Para lancamento retroativo, e obrigatorio registrar justificativa.
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={liberarFluxoRetroativoAdmin}
                    className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs hover:bg-amber-700"
                  >
                    Liberar lancamento retroativo (admin)
                  </button>
                ) : (
                  <div className="text-xs text-amber-800">
                    Seu perfil nao pode liberar lancamento retroativo. Solicite um administrador.
                  </div>
                )}
              </div>
            )}

            {!isEditando && totalSugestoes > 0 && (
              <div className="rounded-md border border-blue-300 bg-white px-3 py-3 space-y-2">
                <div className="text-xs font-semibold text-blue-900">
                  Panorama de ofertas: {totalSugestoes} opcao(oes) sugerida(s)
                </div>
                <div className="space-y-2">
                  {sugestoesHorario.map((item, idx) => (
                    <div
                      key={`${item.inicio}-${idx}`}
                      className="rounded-md border border-blue-100 bg-blue-50/30 px-2 py-2"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        Oferta {idx + 1}: {toBrDate(String(item.inicio || "").split(" ")[0])} - {extrairHoraDataHora(item.inicio)} a{" "}
                        {extrairHoraDataHora(item.fim)}
                      </div>
                      <div className="text-xs text-gray-600">
                        Deslocamento total: {item.tempo_deslocamento_total_min} min | Risco: {item.risco}
                      </div>
                      <div className="text-xs text-gray-500">
                        {resumirDeslocamentoSugestao(item)}
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => confirmarAceiteSugestao(item, idx)}
                          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                        >
                          Cliente aceitou esta oferta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isEditando && assistenteProntoParaSugerir && ofertasPanoramicasConsultadas && totalSugestoes > 0 && decisaoAssistente === "pendente" && (
              <button
                type="button"
                onClick={liberarFluxoManual}
                className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 text-xs hover:bg-amber-50"
              >
                Nenhuma oferta atende a necessidade do cliente (recusar todas)
              </button>
            )}

            {!isEditando && decisaoAssistente === "aceito" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                Aceite do cliente registrado. Agora basta salvar o agendamento.
              </div>
            )}

            {!isEditando && carregandoCreditoCliente && (
              <div className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs text-cyan-800">
                Verificando se o cliente possui credito disponivel...
              </div>
            )}

            {!isEditando && erroCreditoCliente && !carregandoCreditoCliente && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {erroCreditoCliente}
              </div>
            )}

            {clienteComCredito && !carregandoCreditoCliente && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Cliente com credito ativo: <strong>{formatarMoedaBRL(saldoCreditoCliente)}</strong>. Confirme com
                o cliente se deseja abater esse valor neste novo agendamento.
              </div>
            )}

            {!isEditando && decisaoAssistente === "sem_opcao" && (
              <div className="rounded-md border border-amber-300 bg-white px-3 py-2 space-y-2">
                <div className="text-xs font-medium text-amber-800">
                  Nenhuma oferta panoramica atendeu. Registre o motivo para concluir o desfecho.
                </div>
                <textarea
                  rows={2}
                  value={motivoSemOpcao}
                  onChange={(e) => setMotivoSemOpcao(e.target.value)}
                  placeholder="Ex.: cliente so pode no turno da manha por urgencia clinica."
                  className="w-full px-2 py-1 border border-amber-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <>
                      {!excecaoConcedida ? (
                        <button
                          type="button"
                          onClick={concederExcecaoAdmin}
                          disabled={registrandoEncerramento}
                          className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-60"
                        >
                          Conceder excecao e liberar horario manual
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={revogarExcecaoAdmin}
                          disabled={registrandoEncerramento}
                          className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 text-xs hover:bg-amber-50 disabled:opacity-60"
                        >
                          Revogar excecao
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void registrarDesfechoSemAgendamento("solicitacao_excecao")}
                      disabled={registrandoEncerramento}
                      className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-60"
                    >
                      {registrandoEncerramento
                        ? "Registrando..."
                        : "Solicitar excecao ao admin e encerrar"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void registrarDesfechoSemAgendamento("encerramento_sem_agendamento")}
                    disabled={registrandoEncerramento}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-60"
                  >
                    Encerrar sem agendamento
                  </button>
                </div>
                {isAdmin && excecaoConcedida && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                    Excecao concedida por admin. Data/hora manual liberadas para concluir o agendamento.
                  </div>
                )}
              </div>
            )}

            {isEditando && sugestoesHorario.length > 0 && (
              <div className="space-y-2">
                {sugestoesHorario.map((item, idx) => (
                  <button
                    key={`${item.inicio}-${idx}`}
                    type="button"
                    onClick={() => aplicarSugestaoHorario(item)}
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-left hover:border-blue-400"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {extrairHoraDataHora(item.inicio)} - {extrairHoraDataHora(item.fim)}
                    </div>
                    <div className="text-xs text-gray-600">
                      Deslocamento total: {item.tempo_deslocamento_total_min} min | Risco: {item.risco}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {resumirDeslocamentoSugestao(item)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isEditando && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={formData.marcar_como_reserva}
                onChange={(e) => setFormData({ ...formData, marcar_como_reserva: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                Marcar como <strong>reserva de horário</strong> (bloqueia o slot como pendente de confirmação).
              </span>
            </label>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Observações sobre o agendamento..."
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
            />
          </div>

          {/* Botões */}
          {!isEditando && bloquearSalvarNovo && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Conclua o assistente guiado para habilitar o salvamento do agendamento.
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || bloquearSalvarNovo || registrandoEncerramento}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading 
                ? (isEditando ? "Salvando..." : "Criando...") 
                : (isEditando ? "Salvar Alterações" : "Salvar Agendamento")
              }
            </button>
          </div>
        </form>
      </div>

      {modalTutorAberto && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Cadastrar Tutor</h3>
              <button
                type="button"
                onClick={() => setModalTutorAberto(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={salvandoTutor}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={novoTutor.nome}
                  onChange={(e) => setNovoTutor((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do tutor"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={novoTutor.telefone}
                    onChange={(e) => setNovoTutor((prev) => ({ ...prev, telefone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={novoTutor.whatsapp}
                    onChange={(e) => setNovoTutor((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={novoTutor.email}
                  onChange={(e) => setNovoTutor((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setModalTutorAberto(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={salvandoTutor}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovoTutor}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={salvandoTutor}
              >
                {salvandoTutor ? "Salvando..." : "Salvar Tutor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAnimalAberto && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Cadastrar Animal</h3>
              <button
                type="button"
                onClick={() => setModalAnimalAberto(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={salvandoAnimal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutor *</label>
                <select
                  value={novoAnimal.tutor_id}
                  onChange={(e) => setNovoAnimal((prev) => ({ ...prev, tutor_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {tutores.map((tutor) => (
                    <option key={tutor.id} value={tutor.id.toString()}>
                      {tutor.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Animal *</label>
                  <input
                    type="text"
                    value={novoAnimal.nome}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do animal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especie</label>
                  <select
                    value={novoAnimal.especie}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, especie: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {["Canina", "Felina", "Equina", "Outra"].map((especie) => (
                      <option key={especie} value={especie}>
                        {especie}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raca</label>
                  <input
                    type="text"
                    value={novoAnimal.raca}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, raca: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Raca"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                  <select
                    value={novoAnimal.sexo}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, sexo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {["Macho", "Femea"].map((sexo) => (
                      <option key={sexo} value={sexo}>
                        {sexo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                  <input
                    type="text"
                    value={novoAnimal.peso_kg}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, peso_kg: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 12.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={novoAnimal.data_nascimento}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, data_nascimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Microchip</label>
                  <input
                    type="text"
                    value={novoAnimal.microchip}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, microchip: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Codigo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                <textarea
                  rows={3}
                  value={novoAnimal.observacoes}
                  onChange={(e) => setNovoAnimal((prev) => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Informacoes adicionais"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setModalAnimalAberto(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={salvandoAnimal}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovoAnimal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={salvandoAnimal}
              >
                {salvandoAnimal ? "Salvando..." : "Salvar Animal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
