"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import XmlUploader from "../components/XmlUploader";
import ImageUploader from "../components/ImageUploader";
import FraseModal from "../components/FraseModal";
import { Save, ArrowLeft, Heart, User, Activity, BookOpen, Settings, Image as ImageIcon, Minus, Plus } from "lucide-react";
import { ReferenciaComparison } from "../components/ReferenciaComparison";

// Componente de input de medida com botões +/-
interface MedidaInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  reference?: string;
  readOnly?: boolean;
}
function MedidaInput({ label, value, onChange, reference, readOnly = false }: MedidaInputProps) {
  const handleDecrement = () => {
    if (readOnly) return;
    const numValue = parseFloat(value) || 0;
    if (numValue > 0) {
      onChange((numValue - 0.01).toFixed(2));
    }
  };

  const handleIncrement = () => {
    if (readOnly) return;
    const numValue = parseFloat(value) || 0;
    onChange((numValue + 0.01).toFixed(2));
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-600 leading-tight">
        {label}
      </label>
      {reference && (
        <span className="text-[10px] text-gray-400">{reference}</span>
      )}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (!readOnly) onChange(e.target.value);
          }}
          readOnly={readOnly}
          className="flex-1 px-2 py-1.5 bg-blue-50 border-0 rounded text-sm text-gray-700 focus:ring-1 focus:ring-teal-500"
          placeholder="0,00"
        />
        {!readOnly && (
          <>
            <button
              onClick={handleDecrement}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              type="button"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={handleIncrement}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              type="button"
            >
              <Plus className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const parseNumero = (valor?: string): number | null => {
  if (!valor) return null;
  const numero = Number(valor.toString().replace(",", ".").trim());
  return Number.isFinite(numero) ? numero : null;
};

const parseInteiroPositivo = (valor?: string): number | null => {
  if (!valor) return null;
  const numero = Number(valor.toString().replace(",", ".").trim());
  if (!Number.isFinite(numero)) return null;
  const inteiro = Math.round(numero);
  return inteiro > 0 ? inteiro : null;
};

const formatar2Casas = (valor: number): string => valor.toFixed(2);

const OPCOES_MANGUITO = [
  "Manguito 01",
  "Manguito 02",
  "Manguito 03",
  "Manguito 04",
  "Manguito 05",
  "Manguito 06",
  "Outro",
];

const OPCOES_MEMBRO = [
  "Membro anterior direito",
  "Membro anterior esquerdo",
  "Membro posterior direito",
  "Membro posterior esquerdo",
  "Cauda",
  "Outro",
];

const OPCOES_DECUBITO = [
  "Decubito lateral direito",
  "Decubito lateral esquerdo",
  "Decubito esternal",
  "Decubito dorsal",
  "Em estacao",
  "Outro",
];

interface DadosPaciente {
  id?: number;
  nome: string;
  tutor: string;
  raca: string;
  especie: string;
  peso: string;
  idade: string;
  sexo: string;
  telefone: string;
  data_exame: string;
}

interface Clinica {
  id: number;
  nome: string;
}

interface DadosExame {
  paciente: DadosPaciente;
  medidas: Record<string, number>;
  clinica: string | { id: number; nome: string };
  veterinario_solicitante: string;
  fc: string;
}

interface FraseQualitativa {
  id: number;
  chave: string;
  patologia: string;
  grau: string;
  valvas: string;
  camaras: string;
  funcao: string;
  pericardio: string;
  vasos: string;
  ad_vd: string;
  conclusao: string;
  layout?: string;
}

// Parâmetros ecocardiográficos
const PARAMETROS_MEDIDAS = [
  { key: "Ao", label: "Ao (mm)", categoria: "Câmaras" },
  { key: "LA", label: "LA (mm)", categoria: "Câmaras" },
  { key: "LA_Ao", label: "LA/Ao", categoria: "Razões" },
  { key: "IVSd", label: "IVSd (mm)", categoria: "Paredes" },
  { key: "LVIDd", label: "LVIDd (mm)", categoria: "Câmaras" },
  { key: "LVPWd", label: "LVPWd (mm)", categoria: "Paredes" },
  { key: "IVSs", label: "IVSs (mm)", categoria: "Paredes" },
  { key: "LVIDs", label: "LVIDs (mm)", categoria: "Câmaras" },
  { key: "LVPWs", label: "LVPWs (mm)", categoria: "Paredes" },
  { key: "EDV", label: "EDV (ml)", categoria: "Volumes" },
  { key: "ESV", label: "ESV (ml)", categoria: "Volumes" },
  { key: "EF", label: "EF (%)", categoria: "Função" },
  { key: "FS", label: "FS (%)", categoria: "Função" },
  { key: "MAPSE", label: "MAPSE (mm)", categoria: "Função" },
  { key: "TAPSE", label: "TAPSE (mm)", categoria: "Função" },
  { key: "Vmax_Ao", label: "Vmax Ao (m/s)", categoria: "Fluxos" },
  { key: "Grad_Ao", label: "Grad Ao (mmHg)", categoria: "Gradientes" },
  { key: "Vmax_Pulm", label: "Vmax Pulm (m/s)", categoria: "Fluxos" },
  { key: "Grad_Pulm", label: "Grad Pulm (mmHg)", categoria: "Gradientes" },
  { key: "MV_E", label: "MV E (m/s)", categoria: "Mitral" },
  { key: "MV_A", label: "MV A (m/s)", categoria: "Mitral" },
  { key: "MV_E_A", label: "MV E/A", categoria: "Mitral" },
  { key: "MV_DT", label: "MV DT (ms)", categoria: "Mitral" },
  { key: "IVRT", label: "IVRT (ms)", categoria: "Tempos" },
  { key: "MR_Vmax", label: "MR Vmax (m/s)", categoria: "Regurgitação" },
  { key: "TR_Vmax", label: "TR Vmax (m/s)", categoria: "Regurgitação" },
];

// Campos da qualitativa detalhada
const CAMPOS_QUALITATIVA = [
  { key: "valvas", label: "Válvulas", placeholder: "Descreva o estado das válvulas cardíacas..." },
  { key: "camaras", label: "Câmaras", placeholder: "Descreva as cavidades cardíacas..." },
  { key: "funcao", label: "Função", placeholder: "Descreva a função cardíaca..." },
  { key: "pericardio", label: "Pericárdio", placeholder: "Descreva o pericárdio..." },
  { key: "vasos", label: "Vasos", placeholder: "Descreva os grandes vasos..." },
  { key: "ad_vd", label: "AD/VD", placeholder: "Descreva as câmaras direitas..." },
];

// Subcampos para o layout detalhado
const SUBCAMPOS_DETALHADO: Record<string, { key: string; label: string }[]> = {
  valvas: [
    { key: "mitral", label: "Mitral" },
    { key: "tricuspide", label: "Tricúspide" },
    { key: "aortica", label: "Aórtica" },
    { key: "pulmonar", label: "Pulmonar" },
  ],
  camaras: [
    { key: "ae", label: "Átrio Esquerdo" },
    { key: "ad", label: "Átrio Direito" },
    { key: "ve", label: "Ventrículo Esquerdo" },
    { key: "vd", label: "Ventrículo Direito" },
  ],
  funcao: [
    { key: "sistolica_ve", label: "Sistólica VE" },
    { key: "sistolica_vd", label: "Sistólica VD" },
    { key: "diastolica", label: "Diastólica" },
    { key: "sincronia", label: "Sincronia" },
  ],
  pericardio: [
    { key: "efusao", label: "Efusão" },
    { key: "espessamento", label: "Espessamento" },
    { key: "tamponamento", label: "Tamponamento" },
  ],
  vasos: [
    { key: "aorta", label: "Aorta" },
    { key: "art_pulmonar", label: "Art. Pulmonar" },
    { key: "veias_pulmonares", label: "Veias Pulmonares" },
    { key: "cava_hepaticas", label: "Cava/Hepáticas" },
  ],
};

type DetalhadoState = Record<string, Record<string, string>>;

export default function NovoLaudoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState<"paciente" | "medidas" | "qualitativa" | "imagens" | "pressao" | "frases" | "referencias">("paciente");
  
  // Dados do paciente
  const [paciente, setPaciente] = useState({
    id: undefined as number | undefined,
    nome: "",
    tutor: "",
    raca: "",
    especie: "Canina",
    peso: "",
    idade: "",
    sexo: "Macho",
    telefone: "",
    data_exame: "",
  });
  
  // Medidas
  const [medidas, setMedidas] = useState<Record<string, string>>({});
  
  // Qualitativa
  const [qualitativa, setQualitativa] = useState({
    valvas: "",
    camaras: "",
    funcao: "",
    pericardio: "",
    vasos: "",
    ad_vd: "",
  });
  
  // Conteúdo do laudo
  const [conteudo, setConteudo] = useState({
    descricao: "",
    conclusao: "",
    observacoes: "",
  });

  const [pressaoArterial, setPressaoArterial] = useState({
    pas_1: "",
    pas_2: "",
    pas_3: "",
    manguito_select: "Manguito 02",
    manguito_outro: "",
    membro_select: "Membro anterior esquerdo",
    membro_outro: "",
    decubito_select: "Decubito lateral direito",
    decubito_outro: "",
    obs_extra: "",
    salvar_como_laudo_pressao: false,
  });
  
  // Clinica
  const [clinicaId, setClinicaId] = useState<string>("");
  const [clinicaNome, setClinicaNome] = useState<string>("");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [veterinario, setVeterinario] = useState("");
  const [agendamentoVinculadoId, setAgendamentoVinculadoId] = useState<number | null>(null);
  
  // Mensagem de sucesso
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  
  // Sidebar - Frases
  const [patologias, setPatologias] = useState<string[]>([]);
  const [patologiaSelecionada, setPatologiaSelecionada] = useState("Normal");
  const [graus, setGraus] = useState<string[]>(["Leve", "Moderada", "Importante"]);
  const [grauSelecionado, setGrauSelecionado] = useState("Leve");
  const [layoutQualitativa, setLayoutQualitativa] = useState<"detalhado" | "enxuto">("detalhado");
  const [aplicandoFrase, setAplicandoFrase] = useState(false);
  const [salvandoFraseQualitativa, setSalvandoFraseQualitativa] = useState(false);
  const [fraseAplicadaId, setFraseAplicadaId] = useState<number | null>(null);
  
  // Lista de frases (para aba Frases)
  const [frases, setFrases] = useState<FraseQualitativa[]>([]);
  const [fraseEditando, setFraseEditando] = useState<FraseQualitativa | null>(null);
const [modalFraseOpen, setModalFraseOpen] = useState(false);
  
  // Imagens do laudo
  const [imagens, setImagens] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const isInitialMount = useRef(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    // Inicializar valores dinâmicos no cliente para evitar hydration mismatch
    setPaciente(prev => ({ ...prev, data_exame: prev.data_exame || new Date().toISOString().split('T')[0] }));
    setSessionId(Math.random().toString(36).substring(2, 15));
    carregarFrases();
    carregarClinicas();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const params = new URLSearchParams(window.location.search);
    const clinicaParam = params.get("clinica_id");
    if (clinicaParam) {
      const clinicaId = Number(clinicaParam);
      if (Number.isFinite(clinicaId) && clinicaId > 0) {
        setClinicaId(String(clinicaId));
      }
    }

    const agendamentoParam = params.get("agendamento_id");
    const atendimentoParam = params.get("atendimento_id");

    if (atendimentoParam) {
      const atendimentoId = Number(atendimentoParam);
      if (Number.isFinite(atendimentoId) && atendimentoId > 0) {
        preencherDadosDoAtendimento(atendimentoId);
        return;
      }
    }

    if (agendamentoParam) {
      const agendamentoId = Number(agendamentoParam);
      if (!Number.isFinite(agendamentoId) || agendamentoId <= 0) return;
      setAgendamentoVinculadoId(agendamentoId);
      preencherDadosDoAgendamento(agendamentoId);
      return;
    }

    const pacienteParam = params.get("paciente_id");
    if (!pacienteParam) return;
    const pacienteId = Number(pacienteParam);
    if (!Number.isFinite(pacienteId) || pacienteId <= 0) return;
    preencherDadosDoPaciente(pacienteId);
  }, []);

  useEffect(() => {
    const aorta = parseNumero(medidas["Aorta"]);
    const atrioEsquerdo = parseNumero(medidas["Atrio_esquerdo"]);
    const divedMm = parseNumero(medidas["DIVEd"]);
    const peso = parseNumero(paciente.peso);

    const aeAoCalculado =
      aorta !== null && aorta > 0 && atrioEsquerdo !== null && atrioEsquerdo > 0
        ? formatar2Casas(atrioEsquerdo / aorta)
        : "";

    const divedNormalizadoCalculado =
      divedMm !== null && divedMm > 0 && peso !== null && peso > 0
        ? formatar2Casas((divedMm / 10) / Math.pow(peso, 0.234))
        : "";

    if (
      medidas["AE_Ao"] !== aeAoCalculado ||
      medidas["DIVEd_normalizado"] !== divedNormalizadoCalculado
    ) {
      setMedidas((prev) => ({
        ...prev,
        AE_Ao: aeAoCalculado,
        DIVEd_normalizado: divedNormalizadoCalculado,
      }));
    }
  }, [medidas["Aorta"], medidas["Atrio_esquerdo"], medidas["DIVEd"], paciente.peso]);

  // Fix 4: Carregar graus dinamicamente quando a patologia muda
  useEffect(() => {
    const carregarGraus = async () => {
      try {
        const response = await api.get(`/frases/graus?patologia=${encodeURIComponent(patologiaSelecionada)}`);
        if (response.data && response.data.length > 0) {
          setGraus(response.data);
          // Se o grau atual não existe na nova lista, selecionar o primeiro
          if (!response.data.includes(grauSelecionado)) {
            setGrauSelecionado(response.data[0]);
          }
        } else {
          setGraus(["Normal", "Leve", "Moderada", "Importante", "Grave"]);
          setGrauSelecionado("Normal");
        }
      } catch (error) {
        console.error("Erro ao carregar graus:", error);
        setGraus(["Normal", "Leve", "Moderada", "Importante", "Grave"]);
      }
    };
    if (patologiaSelecionada) {
      carregarGraus();
    }
  }, [patologiaSelecionada]);

  // Fix 2: Auto-gerar texto quando grau, patologia ou layout muda (não na montagem inicial)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (patologiaSelecionada && grauSelecionado) {
      handleGerarTexto();
    }
  }, [grauSelecionado, patologiaSelecionada, layoutQualitativa]);

  const carregarClinicas = async () => {
    try {
      const response = await api.get("/clinicas");
      setClinicas(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    }
  };

  const preencherDadosDoAtendimento = async (atendimentoId: number) => {
    try {
      const respAtendimento = await api.get(`/atendimentos/${atendimentoId}`);
      const atendimento = respAtendimento.data || {};

      if (atendimento.paciente_id) {
        await preencherDadosDoPaciente(Number(atendimento.paciente_id));
      }

      if (atendimento.clinica_id) {
        setClinicaId(String(atendimento.clinica_id));
      }
      if (atendimento.clinica_nome) {
        setClinicaNome(atendimento.clinica_nome);
      }

      if (atendimento.agendamento_id) {
        setAgendamentoVinculadoId(Number(atendimento.agendamento_id));
      }

      if (atendimento.observacoes || atendimento.dados_clinicos || atendimento.diagnostico) {
        setConteudo((prev) => ({
          ...prev,
          descricao: prev.descricao || atendimento.dados_clinicos || "",
          conclusao: prev.conclusao || atendimento.diagnostico || "",
          observacoes: prev.observacoes || atendimento.observacoes || "",
        }));
      }

      setMensagemSucesso(`Atendimento #${atendimentoId} vinculado ao laudo.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (error) {
      console.error("Erro ao carregar atendimento para laudo:", error);
    }
  };

  const preencherDadosDoAgendamento = async (agendamentoId: number) => {
    try {
      const respAgendamento = await api.get(`/agenda/${agendamentoId}`);
      const agendamento = respAgendamento.data || {};

      let dadosPaciente: any = null;
      if (agendamento.paciente_id) {
        try {
          const respPaciente = await api.get(`/pacientes/${agendamento.paciente_id}`);
          dadosPaciente = respPaciente.data;
        } catch (error) {
          console.warn("Nao foi possivel carregar detalhes do paciente vinculado:", error);
        }
      }

      setPaciente((prev) => ({
        ...prev,
        id: agendamento.paciente_id || prev.id,
        nome: dadosPaciente?.nome || agendamento.paciente || prev.nome,
        tutor: dadosPaciente?.tutor || agendamento.tutor || prev.tutor,
        raca: dadosPaciente?.raca || prev.raca,
        especie: dadosPaciente?.especie || prev.especie || "Canina",
        peso:
          dadosPaciente?.peso_kg !== null && dadosPaciente?.peso_kg !== undefined
            ? String(dadosPaciente.peso_kg)
            : prev.peso,
        sexo: dadosPaciente?.sexo || prev.sexo || "Macho",
        telefone: agendamento.telefone || prev.telefone,
        data_exame: agendamento.data || prev.data_exame || new Date().toISOString().split("T")[0],
      }));

      if (agendamento.clinica_id) {
        setClinicaId(String(agendamento.clinica_id));
      }
      if (agendamento.clinica) {
        setClinicaNome(agendamento.clinica);
      }

      if (agendamento.observacoes) {
        setConteudo((prev) => ({
          ...prev,
          observacoes: prev.observacoes || agendamento.observacoes,
        }));
      }

      setMensagemSucesso(`Agendamento #${agendamentoId} vinculado ao laudo.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (error) {
      console.error("Erro ao carregar agendamento para laudo:", error);
    }
  };

  const preencherDadosDoPaciente = async (pacienteId: number) => {
    try {
      const respPaciente = await api.get(`/pacientes/${pacienteId}`);
      const dadosPaciente = respPaciente.data || {};

      setPaciente((prev) => ({
        ...prev,
        id: pacienteId,
        nome: dadosPaciente?.nome || prev.nome,
        tutor: dadosPaciente?.tutor || prev.tutor,
        raca: dadosPaciente?.raca || prev.raca,
        especie: dadosPaciente?.especie || prev.especie || "Canina",
        peso:
          dadosPaciente?.peso_kg !== null && dadosPaciente?.peso_kg !== undefined
            ? String(dadosPaciente.peso_kg)
            : prev.peso,
        sexo: dadosPaciente?.sexo || prev.sexo || "Macho",
        data_exame: prev.data_exame || new Date().toISOString().split("T")[0],
      }));

      setMensagemSucesso(`Paciente #${pacienteId} carregado para novo laudo.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (error) {
      console.error("Erro ao carregar paciente para laudo:", error);
    }
  };

  const PATOLOGIAS_FALLBACK = [
    "Normal",
    "Endocardiose Mitral",
    "Cardiomiopatia Dilatada",
    "Estenose Aortica",
    "Estenose Pulmonar",
  ];

  const sincronizarPatologiasComFrases = (items: FraseQualitativa[]) => {
    const lista = Array.from(
      new Set(
        items
          .map((f) => (f.patologia || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const patologiasAtualizadas = lista.length > 0 ? lista : PATOLOGIAS_FALLBACK;
    setPatologias(patologiasAtualizadas);
    setPatologiaSelecionada((prev) =>
      patologiasAtualizadas.includes(prev) ? prev : patologiasAtualizadas[0]
    );
  };

  const carregarFrases = async () => {
    try {
      const response = await api.get("/frases?limit=1000");
      const items = response.data.items || [];
      setFrases(items);
      sincronizarPatologiasComFrases(items);
    } catch (error) {
      console.error("Erro ao carregar frases:", error);
      setFrases([]);
      sincronizarPatologiasComFrases([]);
    }
  };

  const handleEditarFrase = (frase: FraseQualitativa) => {
    setFraseEditando(frase);
    setModalFraseOpen(true);
  };

  const handleNovaFrase = () => {
    setFraseEditando(null);
    setModalFraseOpen(true);
  };

  const handleExcluirFrase = async (fraseId: number) => {
    if (!confirm("Tem certeza que deseja excluir esta frase?")) {
      return;
    }
    try {
      await api.delete(`/frases/${fraseId}`);
      await carregarFrases();
      setMensagemSucesso("Frase excluída com sucesso!");
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (error) {
      console.error("Erro ao excluir frase:", error);
      alert("Erro ao excluir frase");
    }
  };

  const handleFraseSalva = () => {
    carregarFrases();
    setMensagemSucesso(fraseEditando ? "Frase atualizada com sucesso!" : "Frase criada com sucesso!");
    setTimeout(() => setMensagemSucesso(null), 3000);
  };

  const normalizarGrauSidebar = (grau: string | null | undefined) => {
    const valor = (grau || "").trim();
    return graus.includes(valor) ? valor : graus[0];
  };

  const obterGrauEfetivo = () =>
    patologiaSelecionada.trim().toLowerCase() === "normal"
      ? "Normal"
      : normalizarGrauSidebar(grauSelecionado);

  const gerarChaveFrase = (patologia: string, grau: string) => {
    if (patologia === "Normal") return "Normal (Normal)";
    return `${patologia} (${grau})`;
  };

  const montarPayloadFrase = (patologia: string, grau: string) => ({
    chave: gerarChaveFrase(patologia, grau),
    patologia,
    grau,
    valvas: qualitativa.valvas || "",
    camaras: qualitativa.camaras || "",
    funcao: qualitativa.funcao || "",
    pericardio: qualitativa.pericardio || "",
    vasos: qualitativa.vasos || "",
    ad_vd: qualitativa.ad_vd || "",
    conclusao: conteudo.conclusao || "",
    layout: layoutQualitativa,
  });

  const encontrarFraseAtual = () => {
    const grauBusca = obterGrauEfetivo();
    const frasePorPatologiaEGrau = frases.find(
      (frase) =>
        (frase.patologia || "").trim().toLowerCase() === patologiaSelecionada.trim().toLowerCase() &&
        (frase.grau || "").trim().toLowerCase() === grauBusca.trim().toLowerCase()
    );
    if (frasePorPatologiaEGrau) return frasePorPatologiaEGrau;
    if (fraseAplicadaId) {
      return frases.find((frase) => frase.id === fraseAplicadaId) || null;
    }
    return null;
  };

  const handleGerarTexto = async () => {
    setAplicandoFrase(true);
    try {
      const grauEfetivo = obterGrauEfetivo();
      const request = {
        patologia: patologiaSelecionada,
        grau_refluxo: patologiaSelecionada === "Endocardiose Mitral" ? grauEfetivo : undefined,
        grau_geral: patologiaSelecionada !== "Endocardiose Mitral" ? grauEfetivo : undefined,
        layout: layoutQualitativa,
      };

      const response = await api.post("/frases/aplicar", request);

      if (response.data.success && response.data.dados) {
        const dados = response.data.dados;
        setFraseAplicadaId(response.data?.frase?.id ?? null);
        
        if (layoutQualitativa === "enxuto") {
          setQualitativa({
            valvas: dados.valvas || "",
            camaras: dados.camaras || "",
            funcao: dados.funcao || "",
            pericardio: dados.pericardio || "",
            vasos: dados.vasos || "",
            ad_vd: dados.ad_vd || "",
          });
        } else {
          // Layout detalhado
          setQualitativa({
            valvas: dados.valvas || "",
            camaras: dados.camaras || "",
            funcao: dados.funcao || "",
            pericardio: dados.pericardio || "",
            vasos: dados.vasos || "",
            ad_vd: dados.ad_vd || "",
          });
        }

        setConteudo(prev => ({
          ...prev,
          conclusao: dados.conclusao || prev.conclusao,
        }));

        setMensagemSucesso("Texto gerado com sucesso!");
        setTimeout(() => setMensagemSucesso(null), 3000);
      } else {
        alert("Frase não encontrada para esta patologia/grau.");
      }
    } catch (error) {
      console.error("Erro ao gerar texto:", error);
      alert("Erro ao gerar texto qualitativo.");
    } finally {
      setAplicandoFrase(false);
    }
  };

  const handleSalvarComoNovaPatologia = async () => {
    const patologiaInformada = window.prompt(
      "Nome da nova patologia:",
      patologiaSelecionada === "Normal" ? "" : patologiaSelecionada
    );
    if (patologiaInformada === null) return;

    const patologia = patologiaInformada.trim();
    if (!patologia) {
      alert("Informe um nome de patologia.");
      return;
    }

    const sugestaoGrau = patologia === "Normal" ? "Normal" : grauSelecionado;
    const grauInformado = window.prompt("Grau da patologia:", sugestaoGrau);
    if (grauInformado === null) return;

    const grau = patologia === "Normal" ? "Normal" : (grauInformado.trim() || sugestaoGrau);
    const payload = montarPayloadFrase(patologia, grau);

    setSalvandoFraseQualitativa(true);
    try {
      const response = await api.post("/frases", payload);
      await carregarFrases();
      setPatologiaSelecionada(patologia);
      setGrauSelecionado(normalizarGrauSidebar(grau));
      setFraseAplicadaId(response.data?.id ?? null);
      setMensagemSucesso("Nova patologia salva no banco de frases.");
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || "Erro ao salvar nova patologia.";
      console.error("Erro ao salvar nova patologia:", error);
      alert(detail);
    } finally {
      setSalvandoFraseQualitativa(false);
    }
  };

  const handleAtualizarPatologia = async () => {
    const fraseAtual = encontrarFraseAtual();
    if (!fraseAtual?.id) {
      alert("Nenhuma patologia encontrada para atualizar. Gere o texto ou selecione uma patologia existente.");
      return;
    }

    const patologia = patologiaSelecionada.trim() || fraseAtual.patologia || "Normal";
    const grau = patologia === "Normal" ? "Normal" : (grauSelecionado.trim() || fraseAtual.grau || "Leve");
    const payload = {
      patologia,
      grau,
      valvas: qualitativa.valvas || "",
      camaras: qualitativa.camaras || "",
      funcao: qualitativa.funcao || "",
      pericardio: qualitativa.pericardio || "",
      vasos: qualitativa.vasos || "",
      ad_vd: qualitativa.ad_vd || "",
      conclusao: conteudo.conclusao || "",
      layout: layoutQualitativa,
    };

    setSalvandoFraseQualitativa(true);
    try {
      const response = await api.put(`/frases/${fraseAtual.id}`, payload);
      await carregarFrases();
      setPatologiaSelecionada(patologia);
      setGrauSelecionado(normalizarGrauSidebar(grau));
      setFraseAplicadaId(response.data?.id ?? fraseAtual.id);
      setMensagemSucesso("Patologia atualizada no banco de frases.");
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || "Erro ao atualizar patologia.";
      console.error("Erro ao atualizar patologia:", error);
      alert(detail);
    } finally {
      setSalvandoFraseQualitativa(false);
    }
  };

  // Mapeamento de campos antigos para novos (compatibilidade com XMLs)
  const mapearCamposMedidas = (medidasOriginais: Record<string, number>): Record<string, string> => {
    const mapeamento: Record<string, string> = {
      // Campos em inglês (XML cru) -> nomes em português
      "LVIDd": "DIVEd",
      "LVIDs": "DIVES",
      "IVSd": "SIVd",
      "IVSs": "SIVs",
      "LVPWd": "PLVEd",
      "LVPWs": "PLVES",
      "EDV": "VDF",
      "ESV": "VSF",
      "EF": "FE_Teicholz",
      "FS": "DeltaD_FS",
      "LA": "Atrio_esquerdo",
      "Ao": "Aorta",
      "LA_Ao": "AE_Ao",
      "MV_E": "Onda_E",
      "MV_A": "Onda_A",
      "MV_E_A": "E_A",
      "MV_DT": "TD",
      "IVRT": "TRIV",
      "TDI_e": "e_doppler",
      "TDI_a": "a_doppler",
      "EEp": "E_E_linha",
      "Vmax_Ao": "Vmax_aorta",
      "Grad_Ao": "Grad_aorta",
      "Vmax_Pulm": "Vmax_pulmonar",
      "Grad_Pulm": "Grad_pulmonar",
      "MR_Vmax": "IM_Vmax",
      "TR_Vmax": "IT_Vmax",
      "AR_Vmax": "IA_Vmax",
      "PR_Vmax": "IP_Vmax",
      "DIVdN": "DIVEd_normalizado",
      // Campos já em português (XML já processado pelo backend) -> mesmos nomes
      "DIVEd": "DIVEd",
      "DIVES": "DIVES",
      "SIVd": "SIVd",
      "SIVs": "SIVs",
      "PLVEd": "PLVEd",
      "PLVES": "PLVES",
      "VDF": "VDF",
      "VSF": "VSF",
      "FE_Teicholz": "FE_Teicholz",
      "DeltaD_FS": "DeltaD_FS",
      "Atrio_esquerdo": "Atrio_esquerdo",
      "Aorta": "Aorta",
      "AE_Ao": "AE_Ao",
      "Onda_E": "Onda_E",
      "Onda_A": "Onda_A",
      "E_A": "E_A",
      "TD": "TD",
      "TRIV": "TRIV",
      "e_doppler": "e_doppler",
      "a_doppler": "a_doppler",
      "E_E_linha": "E_E_linha",
      "Vmax_aorta": "Vmax_aorta",
      "Grad_aorta": "Grad_aorta",
      "Vmax_pulmonar": "Vmax_pulmonar",
      "Grad_pulmonar": "Grad_pulmonar",
      "IM_Vmax": "IM_Vmax",
      "IT_Vmax": "IT_Vmax",
      "IA_Vmax": "IA_Vmax",
      "IP_Vmax": "IP_Vmax",
      "DIVEd_normalizado": "DIVEd_normalizado",
      "TAPSE": "TAPSE",
      "MAPSE": "MAPSE",
      "Ao_nivel_AP": "Ao_nivel_AP",
      "AP": "AP",
      "AP_Ao": "AP_Ao",
      "MR_dp_dt": "MR_dp_dt",
      "doppler_tecidual_relacao": "doppler_tecidual_relacao",
    };

    const medidasFormatadas: Record<string, string> = {};
    
    Object.entries(medidasOriginais).forEach(([key, value]) => {
      // Se o valor for válido
      if (value !== null && value !== undefined && !isNaN(value)) {
        // Usa o nome mapeado se existir, senão usa o nome original
        const novoNome = mapeamento[key] || key;
        medidasFormatadas[novoNome] = value.toString();
      }
    });
    
    return medidasFormatadas;
  };

  const handleDadosImportados = (dados: DadosExame) => {
    console.log("Dados recebidos do XML:", dados);
    console.log("Medidas brutas do XML:", dados.medidas);
    
    if (dados.paciente) {
      const novoPaciente = {
        id: undefined as number | undefined,
        nome: dados.paciente.nome || "",
        tutor: dados.paciente.tutor || "",
        raca: dados.paciente.raca || "",
        especie: dados.paciente.especie || "Canina",
        peso: dados.paciente.peso || "",
        idade: dados.paciente.idade || "",
        sexo: dados.paciente.sexo || "Macho",
        telefone: dados.paciente.telefone || "",
        data_exame: dados.paciente.data_exame 
          ? dados.paciente.data_exame.substring(0, 10) 
          : new Date().toISOString().split('T')[0],
      };
      setPaciente(novoPaciente);
    }
    
    if (dados.medidas) {
      console.log("Processando medidas...");
      const medidasFormatadas = mapearCamposMedidas(dados.medidas);
      console.log("Medidas formatadas:", medidasFormatadas);
      setMedidas(medidasFormatadas);
      console.log("Medidas setadas no estado");
    } else {
      console.log("Nenhuma medida encontrada nos dados");
    }
    
    if (dados.clinica) {
      // Se vier como string, usa direto; se vier como objeto, extrai o id
      if (typeof dados.clinica === 'string') {
        // Buscar clínica pelo nome
        const clinicaEncontrada = clinicas.find(c => c.nome === dados.clinica);
        if (clinicaEncontrada) {
          setClinicaId(clinicaEncontrada.id.toString());
          setClinicaNome(clinicaEncontrada.nome);
        } else {
          setClinicaNome(dados.clinica);
        }
      } else if (dados.clinica && typeof dados.clinica === 'object') {
        setClinicaId(dados.clinica.id?.toString() || "");
        setClinicaNome(dados.clinica.nome || "");
      }
    }
    
    setMensagemSucesso("Dados do XML importados com sucesso!");
    setTimeout(() => setMensagemSucesso(null), 5000);
  };

  const pasValores = [
    parseInteiroPositivo(pressaoArterial.pas_1),
    parseInteiroPositivo(pressaoArterial.pas_2),
    parseInteiroPositivo(pressaoArterial.pas_3),
  ].filter((v): v is number => v !== null);

  const pasMediaCalculada = pasValores.length
    ? Math.round(pasValores.reduce((acc, item) => acc + item, 0) / pasValores.length)
    : null;

  const manguitoFinal =
    pressaoArterial.manguito_select === "Outro"
      ? pressaoArterial.manguito_outro.trim()
      : pressaoArterial.manguito_select;
  const membroFinal =
    pressaoArterial.membro_select === "Outro"
      ? pressaoArterial.membro_outro.trim()
      : pressaoArterial.membro_select;
  const decubitoFinal =
    pressaoArterial.decubito_select === "Outro"
      ? pressaoArterial.decubito_outro.trim()
      : pressaoArterial.decubito_select;

  const pressaoPreenchida = Boolean(
    pasValores.length || (pasMediaCalculada !== null && pasMediaCalculada > 0)
  );

  const montarPayloadPressao = () => {
    if (!pressaoPreenchida) return null;
    return {
      pas_1: parseInteiroPositivo(pressaoArterial.pas_1),
      pas_2: parseInteiroPositivo(pressaoArterial.pas_2),
      pas_3: parseInteiroPositivo(pressaoArterial.pas_3),
      pas_media: pasMediaCalculada,
      metodo: "Doppler",
      manguito: manguitoFinal,
      membro: membroFinal,
      decubito: decubitoFinal,
      obs_extra: pressaoArterial.obs_extra.trim(),
    };
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
      const pacienteNome = (paciente.nome || "").trim();
      if (!pacienteNome) {
        alert("Nome do paciente é obrigatório.");
        return;
      }

      // Enviar clínica como objeto com id ou nome
      const clinicaPayload = clinicaId 
        ? { id: parseInt(clinicaId), nome: clinicaNome }
        : clinicaNome;

      const pressaoPayload = montarPayloadPressao();
      const tipoLaudo = pressaoArterial.salvar_como_laudo_pressao ? "pressao_arterial" : "ecocardiograma";
      if (tipoLaudo === "pressao_arterial" && !pressaoPayload) {
        alert("Preencha pelo menos uma afericao de pressao para salvar como laudo de pressao arterial.");
        return;
      }
      
      const payload = {
        paciente,
        medidas,
        qualitativa,
        conteudo,
        agendamento_id: agendamentoVinculadoId,
        clinica: clinicaPayload,
        veterinario: { nome: veterinario },
        data_exame: paciente.data_exame,
        tipo_laudo: tipoLaudo,
        pressao_arterial: pressaoPayload,
      };
      
      const response = await api.post("/laudos", payload);
      const laudoId = response.data.id;
      
      // Associar imagens ao laudo se houver imagens enviadas
      if (imagens.length > 0 && imagens.some(img => img.uploaded)) {
        try {
          await api.post(`/imagens/associar/${laudoId}?session_id=${sessionId}`);
        } catch (imgError) {
          console.error("Erro ao associar imagens:", imgError);
        }
      }
      
      alert("Laudo salvo com sucesso!");
      router.push("/laudos");
    } catch (error) {
      console.error("Erro ao salvar laudo:", error);
      const detail = (error as any)?.response?.data?.detail;
      alert(typeof detail === "string" && detail.trim() ? detail : "Erro ao salvar laudo");
    } finally {
      setLoading(false);
    }
  };

  const handleMedidaChange = (key: string, value: string) => {
    setMedidas(prev => ({ ...prev, [key]: value }));
  };

  const handleQualitativaChange = (key: string, value: string) => {
    setQualitativa(prev => ({ ...prev, [key]: value }));
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/laudos")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Novo Laudo</h1>
              <p className="text-gray-500">Importe XML ou preencha manualmente</p>
              {agendamentoVinculadoId && (
                <p className="text-sm text-teal-700 font-medium mt-1">
                  Agendamento vinculado: #{agendamentoVinculadoId}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSalvar}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? "Salvando..." : "Salvar Laudo"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna Esquerda - Upload XML e Suspeita */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload XML */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                Importar XML
              </h2>
              
              {mensagemSucesso && (
                <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-lg text-sm">
                  {mensagemSucesso}
                </div>
              )}
              
              <XmlUploader onDadosImportados={handleDadosImportados} />
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Dica:</strong> Arraste o arquivo XML exportado do aparelho de ecocardiograma (Vivid IQ) para preencher automaticamente os dados do paciente e medidas.
                </p>
              </div>
            </div>

            {/* Suspeita - Sidebar */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-600" />
                Suspeita
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patologia
                  </label>
                  <select
                    value={patologiaSelecionada}
                    onChange={(e) => setPatologiaSelecionada(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  >
                    {patologias.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grau
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={graus.length - 1}
                    step={1}
                    value={Math.max(0, graus.indexOf(grauSelecionado))}
                    onChange={(e) => {
                      const idx = Number.parseInt(e.target.value, 10);
                      setGrauSelecionado(graus[idx] || graus[0]);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    {graus.map((g) => (
                      <span key={g} className={grauSelecionado === g ? "font-bold text-teal-600" : ""}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Layout
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLayoutQualitativa("detalhado")}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                        layoutQualitativa === "detalhado"
                          ? "bg-teal-100 border-teal-300 text-teal-800"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      Detalhado
                    </button>
                    <button
                      onClick={() => setLayoutQualitativa("enxuto")}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                        layoutQualitativa === "enxuto"
                          ? "bg-teal-100 border-teal-300 text-teal-800"
                          : "bg-white border-gray-300 text-gray-700"
                      }`}
                    >
                      Enxuto
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={handleGerarTexto}
                  disabled={aplicandoFrase}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  <BookOpen className="w-4 h-4" />
                  {aplicandoFrase ? "Gerando..." : "Gerar Texto"}
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Formulário */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Abas */}
              <div className="flex border-b overflow-x-auto">
                <button
                  onClick={() => setAba("paciente")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "paciente"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Paciente
                </button>
                <button
                  onClick={() => setAba("medidas")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "medidas"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Medidas
                </button>
                <button
                  onClick={() => setAba("qualitativa")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "qualitativa"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Qualitativa
                </button>
                <button
                  onClick={() => setAba("imagens")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "imagens"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Imagens
                </button>
                <button
                  onClick={() => setAba("pressao")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "pressao"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  Pressao
                </button>
                <button
                  onClick={() => setAba("frases")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "frases"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Frases
                </button>
                <button
                  onClick={() => setAba("referencias")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "referencias"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Referências
                </button>
              </div>

              {/* Conteúdo das Abas */}
              <div className="p-6">
                {aba === "paciente" && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 mb-4">Dados do Paciente</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome do Paciente
                        </label>
                        <input
                          type="text"
                          value={paciente.nome}
                          onChange={(e) => setPaciente({...paciente, nome: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tutor
                        </label>
                        <input
                          type="text"
                          value={paciente.tutor}
                          onChange={(e) => setPaciente({...paciente, tutor: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Espécie
                        </label>
                        <select
                          value={paciente.especie}
                          onChange={(e) => setPaciente({...paciente, especie: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="Canina">Canina</option>
                          <option value="Felina">Felina</option>
                          <option value="Equina">Equina</option>
                          <option value="Outra">Outra</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Raça
                        </label>
                        <input
                          type="text"
                          value={paciente.raca}
                          onChange={(e) => setPaciente({...paciente, raca: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sexo
                        </label>
                        <select
                          value={paciente.sexo}
                          onChange={(e) => setPaciente({...paciente, sexo: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="Macho">Macho</option>
                          <option value="Fêmea">Fêmea</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Idade
                        </label>
                        <input
                          type="text"
                          value={paciente.idade}
                          onChange={(e) => setPaciente({...paciente, idade: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="Ex: 5 anos"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Peso (kg)
                        </label>
                        <input
                          type="text"
                          value={paciente.peso}
                          onChange={(e) => setPaciente({...paciente, peso: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="Ex: 10.5"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data do Exame
                        </label>
                        <input
                          type="date"
                          value={paciente.data_exame}
                          onChange={(e) => setPaciente({...paciente, data_exame: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium text-gray-900 mb-4">Informações da Clínica</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Clínica
                          </label>
                          <select
                            value={clinicaId}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              setClinicaId(selectedId);
                              const selectedClinica = clinicas.find(c => c.id.toString() === selectedId);
                              setClinicaNome(selectedClinica?.nome || "");
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="">Selecione uma clínica</option>
                            {clinicas.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Veterinário Solicitante
                          </label>
                          <input
                            type="text"
                            value={veterinario}
                            onChange={(e) => setVeterinario(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {aba === "medidas" && (
                  <div className="space-y-6">
                    {/* Grid principal com 3 colunas */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Coluna 1: VE - Modo M */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 text-sm">VE - Modo M</h4>
                        
                        <MedidaInput 
                          label="DIVEd (mm - Diâmetro interno do VE em diástole)"
                          value={medidas["DIVEd"] || ""}
                          onChange={(v) => handleMedidaChange("DIVEd", v)}
                        />
                        <MedidaInput 
                          label="DIVEd normalizado (DIVEd [cm] / peso^0,234)"
                          value={medidas["DIVEd_normalizado"] || ""}
                          onChange={(v) => handleMedidaChange("DIVEd_normalizado", v)}
                          readOnly
                          reference="Ref.: 1.27-1.85"
                        />
                        <MedidaInput 
                          label="SIVd (mm - Septo interventricular em diástole)"
                          value={medidas["SIVd"] || ""}
                          onChange={(v) => handleMedidaChange("SIVd", v)}
                        />
                        <MedidaInput 
                          label="PLVEd (mm - Parede livre do VE em diástole)"
                          value={medidas["PLVEd"] || ""}
                          onChange={(v) => handleMedidaChange("PLVEd", v)}
                        />
                        <MedidaInput 
                          label="DIVÉs (mm - Diâmetro interno do VE em sístole)"
                          value={medidas["DIVES"] || ""}
                          onChange={(v) => handleMedidaChange("DIVES", v)}
                        />
                        <MedidaInput 
                          label="SIVs (mm - Septo interventricular em sístole)"
                          value={medidas["SIVs"] || ""}
                          onChange={(v) => handleMedidaChange("SIVs", v)}
                        />
                        <MedidaInput 
                          label="PLVÉs (mm - Parede livre do VE em sístole)"
                          value={medidas["PLVES"] || ""}
                          onChange={(v) => handleMedidaChange("PLVES", v)}
                        />
                        <MedidaInput 
                          label="VDF (Teicholz)"
                          value={medidas["VDF"] || ""}
                          onChange={(v) => handleMedidaChange("VDF", v)}
                        />
                        <MedidaInput 
                          label="VSF (Teicholz)"
                          value={medidas["VSF"] || ""}
                          onChange={(v) => handleMedidaChange("VSF", v)}
                        />
                        <MedidaInput 
                          label="FE (Teicholz)"
                          value={medidas["FE_Teicholz"] || ""}
                          onChange={(v) => handleMedidaChange("FE_Teicholz", v)}
                        />
                        <MedidaInput 
                          label="Delta D / %FS"
                          value={medidas["DeltaD_FS"] || ""}
                          onChange={(v) => handleMedidaChange("DeltaD_FS", v)}
                        />
                        <MedidaInput 
                          label="TAPSE (mm - excursão sistólica do plano anular tricúspide)"
                          value={medidas["TAPSE"] || ""}
                          onChange={(v) => handleMedidaChange("TAPSE", v)}
                        />
                        <MedidaInput 
                          label="MAPSE (mm - excursão sistólica do plano anular mitral)"
                          value={medidas["MAPSE"] || ""}
                          onChange={(v) => handleMedidaChange("MAPSE", v)}
                        />
                      </div>

                      {/* Coluna 2: Átrio esquerdo/Aorta e Diastólica */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 text-sm">Átrio esquerdo/ Aorta</h4>
                        
                        <MedidaInput 
                          label="Aorta (mm)"
                          value={medidas["Aorta"] || ""}
                          onChange={(v) => handleMedidaChange("Aorta", v)}
                        />
                        <MedidaInput 
                          label="Átrio esquerdo (mm)"
                          value={medidas["Atrio_esquerdo"] || ""}
                          onChange={(v) => handleMedidaChange("Atrio_esquerdo", v)}
                        />
                        <MedidaInput 
                          label="AE/Ao (Átrio esquerdo/Aorta)"
                          value={medidas["AE_Ao"] || ""}
                          onChange={(v) => handleMedidaChange("AE_Ao", v)}
                          readOnly
                        />

                        {paciente.especie === "Felina" && (
                          <>
                            <MedidaInput
                              label="Fração de encurtamento do AE (átrio esquerdo)"
                              value={medidas["Fracao_encurtamento_AE"] ?? ""}
                              onChange={(v) => handleMedidaChange("Fracao_encurtamento_AE", v)}
                              reference="Ref.: 21 - 25%"
                            />
                            <MedidaInput
                              label="Fluxo auricular"
                              value={medidas["Fluxo_auricular"] ?? ""}
                              onChange={(v) => handleMedidaChange("Fluxo_auricular", v)}
                              reference="Ref.: >0,25 m/s"
                            />
                          </>
                        )}

                        <hr className="border-gray-200 my-4" />

                        <h4 className="font-semibold text-gray-900 text-sm">Diastólica</h4>
                        
                        <MedidaInput 
                          label="Onda E"
                          value={medidas["Onda_E"] || ""}
                          onChange={(v) => handleMedidaChange("Onda_E", v)}
                        />
                        <MedidaInput 
                          label="Onda A"
                          value={medidas["Onda_A"] || ""}
                          onChange={(v) => handleMedidaChange("Onda_A", v)}
                        />
                        <MedidaInput 
                          label="E/A (relação E/A)"
                          value={medidas["E_A"] || ""}
                          onChange={(v) => handleMedidaChange("E_A", v)}
                        />
                        <MedidaInput 
                          label="TD (tempo desaceleração)"
                          value={medidas["TD"] || ""}
                          onChange={(v) => handleMedidaChange("TD", v)}
                        />
                        <MedidaInput 
                          label="TRIV (tempo relaxamento isovolumétrico)"
                          value={medidas["TRIV"] || ""}
                          onChange={(v) => handleMedidaChange("TRIV", v)}
                        />
                        <MedidaInput 
                          label="MR dp/dt"
                          value={medidas["MR_dp_dt"] || ""}
                          onChange={(v) => handleMedidaChange("MR_dp_dt", v)}
                        />
                        <MedidaInput 
                          label="e' (Doppler tecidual)"
                          value={medidas["e_doppler"] || ""}
                          onChange={(v) => handleMedidaChange("e_doppler", v)}
                        />
                        <MedidaInput 
                          label="a' (Doppler tecidual)"
                          value={medidas["a_doppler"] || ""}
                          onChange={(v) => handleMedidaChange("a_doppler", v)}
                        />
                        <MedidaInput 
                          label="Doppler tecidual (Relação e'/a')"
                          value={medidas["doppler_tecidual_relacao"] || ""}
                          onChange={(v) => handleMedidaChange("doppler_tecidual_relacao", v)}
                        />
                        <MedidaInput 
                          label="E/E'"
                          value={medidas["E_E_linha"] || ""}
                          onChange={(v) => handleMedidaChange("E_E_linha", v)}
                          reference="Ref.: <12"
                        />
                      </div>

                      {/* Coluna 3: Artéria pulmonar/Aorta e Regurgitações */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 text-sm">Artéria pulmonar/ Aorta</h4>
                        
                        <MedidaInput 
                          label="AP (mm - Artéria pulmonar)"
                          value={medidas["AP"] || ""}
                          onChange={(v) => handleMedidaChange("AP", v)}
                        />
                        <MedidaInput 
                          label="Ao (mm - Aorta - nível AP)"
                          value={medidas["Ao_nivel_AP"] || ""}
                          onChange={(v) => handleMedidaChange("Ao_nivel_AP", v)}
                        />
                        <MedidaInput 
                          label="AP/Ao (Artéria pulmonar/Aorta)"
                          value={medidas["AP_Ao"] || ""}
                          onChange={(v) => handleMedidaChange("AP_Ao", v)}
                        />

                        <hr className="border-gray-200 my-4" />

                        <h4 className="font-semibold text-gray-900 text-sm">Regurgitações</h4>
                        
                        <MedidaInput 
                          label="IM (insuficiência mitral) Vmax"
                          value={medidas["IM_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IM_Vmax", v)}
                        />
                        <MedidaInput 
                          label="IT (insuficiência tricúspide) Vmax"
                          value={medidas["IT_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IT_Vmax", v)}
                        />
                        <MedidaInput 
                          label="IA (insuficiência aórtica) Vmax"
                          value={medidas["IA_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IA_Vmax", v)}
                        />
                        <MedidaInput 
                          label="IP (insuficiência pulmonar) Vmax"
                          value={medidas["IP_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IP_Vmax", v)}
                        />
                      </div>
                    </div>

                    {/* Linha inferior: Doppler - Saídas */}
                    <div className="border-t pt-6 mt-6">
                      <h4 className="font-semibold text-gray-900 text-sm mb-4">Doppler - Saídas</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MedidaInput 
                          label="Vmax aorta"
                          value={medidas["Vmax_aorta"] || ""}
                          onChange={(v) => handleMedidaChange("Vmax_aorta", v)}
                        />
                        <MedidaInput 
                          label="Gradiente aorta"
                          value={medidas["Grad_aorta"] || ""}
                          onChange={(v) => handleMedidaChange("Grad_aorta", v)}
                        />
                        <MedidaInput 
                          label="Vmax pulmonar"
                          value={medidas["Vmax_pulmonar"] || ""}
                          onChange={(v) => handleMedidaChange("Vmax_pulmonar", v)}
                        />
                        <MedidaInput 
                          label="Gradiente pulmonar"
                          value={medidas["Grad_pulmonar"] || ""}
                          onChange={(v) => handleMedidaChange("Grad_pulmonar", v)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {aba === "qualitativa" && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">Qualitativa Detalhada</h3>
                        <span className="text-sm text-gray-500">
                          Use a barra lateral para gerar texto automaticamente
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleSalvarComoNovaPatologia}
                          disabled={aplicandoFrase || salvandoFraseQualitativa}
                          className="px-3 py-2 text-sm rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                        >
                          Salvar como nova patologia
                        </button>
                        <button
                          type="button"
                          onClick={handleAtualizarPatologia}
                          disabled={aplicandoFrase || salvandoFraseQualitativa}
                          className="px-3 py-2 text-sm rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Atualizar patologia
                        </button>
                      </div>
                    </div>
                    
                    {CAMPOS_QUALITATIVA.map((campo) => (
                      <div key={campo.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {campo.label}
                        </label>
                        <textarea
                          value={qualitativa[campo.key as keyof typeof qualitativa]}
                          onChange={(e) => handleQualitativaChange(campo.key, e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder={campo.placeholder}
                        />
                      </div>
                    ))}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ConclusÃ£o
                      </label>
                      <textarea
                        value={conteudo.conclusao}
                        onChange={(e) => setConteudo({ ...conteudo, conclusao: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        placeholder="ConclusÃ£o diagnÃ³stica..."
                      />
                    </div>
                  </div>
                )}

                {aba === "imagens" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Imagens do Exame</h3>
                      <span className="text-sm text-gray-500">
                        {imagens.length} imagem(ns)
                      </span>
                    </div>
                    
                    <ImageUploader 
                      onImagensChange={setImagens}
                      sessionId={sessionId}
                      imagensIniciais={imagens}
                    />
                    
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Dica:</strong> As imagens serão inseridas automaticamente no PDF do laudo. 
                        Arraste para reordenar ou clique no X para remover.
                      </p>
                    </div>
                  </div>
                )}

                {aba === "pressao" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900">Laudo de Pressao Arterial</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Preencha as afericoes manualmente. Se marcar a opcao abaixo, o laudo sera salvo como
                        "pressao arterial" e o PDF sera gerado no formato dedicado.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">1a afericao PAS (mmHg)</label>
                        <input
                          type="number"
                          min={0}
                          max={400}
                          step={1}
                          value={pressaoArterial.pas_1}
                          onChange={(e) => setPressaoArterial((prev) => ({ ...prev, pas_1: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">2a afericao PAS (mmHg)</label>
                        <input
                          type="number"
                          min={0}
                          max={400}
                          step={1}
                          value={pressaoArterial.pas_2}
                          onChange={(e) => setPressaoArterial((prev) => ({ ...prev, pas_2: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">3a afericao PAS (mmHg)</label>
                        <input
                          type="number"
                          min={0}
                          max={400}
                          step={1}
                          value={pressaoArterial.pas_3}
                          onChange={(e) => setPressaoArterial((prev) => ({ ...prev, pas_3: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PA Sistolica Media (mmHg)</label>
                        <input
                          type="text"
                          readOnly
                          value={pasMediaCalculada ?? ""}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Metodo</label>
                        <input
                          type="text"
                          readOnly
                          value="Doppler"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">Observacoes do Procedimento</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Manguito</label>
                          <select
                            value={pressaoArterial.manguito_select}
                            onChange={(e) => setPressaoArterial((prev) => ({ ...prev, manguito_select: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            {OPCOES_MANGUITO.map((op) => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                          {pressaoArterial.manguito_select === "Outro" && (
                            <input
                              type="text"
                              value={pressaoArterial.manguito_outro}
                              onChange={(e) => setPressaoArterial((prev) => ({ ...prev, manguito_outro: e.target.value }))}
                              placeholder="Especifique o manguito"
                              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Membro</label>
                          <select
                            value={pressaoArterial.membro_select}
                            onChange={(e) => setPressaoArterial((prev) => ({ ...prev, membro_select: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            {OPCOES_MEMBRO.map((op) => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                          {pressaoArterial.membro_select === "Outro" && (
                            <input
                              type="text"
                              value={pressaoArterial.membro_outro}
                              onChange={(e) => setPressaoArterial((prev) => ({ ...prev, membro_outro: e.target.value }))}
                              placeholder="Especifique o membro"
                              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Decubito</label>
                          <select
                            value={pressaoArterial.decubito_select}
                            onChange={(e) => setPressaoArterial((prev) => ({ ...prev, decubito_select: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            {OPCOES_DECUBITO.map((op) => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                          {pressaoArterial.decubito_select === "Outro" && (
                            <input
                              type="text"
                              value={pressaoArterial.decubito_outro}
                              onChange={(e) => setPressaoArterial((prev) => ({ ...prev, decubito_outro: e.target.value }))}
                              placeholder="Especifique o decubito"
                              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                            />
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Outras observacoes (opcional)</label>
                        <textarea
                          value={pressaoArterial.obs_extra}
                          onChange={(e) => setPressaoArterial((prev) => ({ ...prev, obs_extra: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="Descreva detalhes adicionais da afericao..."
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 space-y-1">
                      <p><strong>Valores de referencia (PAS):</strong></p>
                      <p>Normal: 110 a 140 mmHg</p>
                      <p>Levemente elevada: 141 a 159 mmHg</p>
                      <p>Moderadamente elevada: 160 a 179 mmHg</p>
                      <p>Severamente elevada: &gt;= 180 mmHg</p>
                    </div>

                    <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        checked={pressaoArterial.salvar_como_laudo_pressao}
                        onChange={(e) =>
                          setPressaoArterial((prev) => ({
                            ...prev,
                            salvar_como_laudo_pressao: e.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 text-teal-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        Salvar como <strong>laudo de pressao arterial</strong> (PDF dedicado). Se desmarcado,
                        os dados de pressao ficam anexados ao laudo ecocardiografico.
                      </span>
                    </label>
                  </div>
                )}

                {aba === "frases" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Gerenciamento de Frases</h3>
                      <button
                        type="button"
                        onClick={handleNovaFrase}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                      >
                        + Nova Frase
                      </button>
                    </div>
                    
                    {frases.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        Nenhuma frase cadastrada. Clique em "Nova Frase" para adicionar.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">Patologia</th>
                              <th className="px-4 py-2 text-left">Grau</th>
                              <th className="px-4 py-2 text-left">Conclusão</th>
                              <th className="px-4 py-2 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {frases.map((frase, index) => (
                              <tr key={frase.id ?? frase.chave ?? `frase-${index}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2">{frase.patologia}</td>
                                <td className="px-4 py-2">{frase.grau}</td>
                                <td className="px-4 py-2 truncate max-w-xs">
                                  {frase.conclusao?.substring(0, 50)}...
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleEditarFrase(frase);
                                    }}
                                    className="text-teal-600 hover:text-teal-800 mr-3"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => frase.id != null && handleExcluirFrase(frase.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Excluir
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Modal de Frase */}
                    <FraseModal
                      isOpen={modalFraseOpen}
                      onClose={() => setModalFraseOpen(false)}
                      frase={fraseEditando}
                      onSuccess={handleFraseSalva}
                    />
                  </div>
                )}

                {aba === "referencias" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Tabelas de Referência</h3>
                      <a 
                        href="/referencias-eco"
                        target="_blank"
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm flex items-center gap-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        Editar Tabelas
                      </a>
                    </div>
                    
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Nota:</strong> As tabelas de referência são usadas para comparar automaticamente 
                        as medidas do paciente com os valores normais. Clique em "Editar Tabelas" para gerenciar 
                        os valores de referência.
                      </p>
                    </div>
                    
                    <ReferenciaComparison 
                      especie={paciente.especie === "Felina" ? "Felina" : "Canina"}
                      peso={parseNumero(paciente.peso) ?? undefined}
                      medidas={medidas}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}





