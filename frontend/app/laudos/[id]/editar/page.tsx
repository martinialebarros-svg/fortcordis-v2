"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "../../../layout-dashboard";
import api from "@/lib/axios";
import {
  getLaudoEditPath,
  TIPO_LAUDO_PRESSAO_ARTERIAL,
  TIPO_LAUDO_ULTRASSOM_ABDOMINAL,
} from "@/lib/laudos";
import {
  addRacaCustomPorEspecie,
  getRacaOptions,
  loadRacasCustomPorEspecie,
  saveRacasCustomPorEspecie,
} from "@/lib/racas";
import XmlUploader from "../../components/XmlUploader";
import ImageHeaderUploader from "../../components/ImageHeaderUploader";
import ImageUploader from "../../components/ImageUploader";
import EcoStudyImportUploader from "../../components/EcoStudyImportUploader";
import EcocardiogramaEstruturadoEditor from "../../components/EcocardiogramaEstruturadoEditor";
import EcocardiogramaEstruturadoBiblioteca from "../../components/EcocardiogramaEstruturadoBiblioteca";
import EchoVoiceAssistant from "../../components/EchoVoiceAssistant";
import { ArrowLeft, Save, User, Activity, Heart, BookOpen, Settings, Image as ImageIcon, Minus, Plus, FolderOpen } from "lucide-react";
import { ReferenciaComparison } from "../../components/ReferenciaComparison";
import {
  criarEcocardiogramaEstruturadoInicial,
  derivarLegadoDeEcocardiogramaEstruturado,
  hidratarEcocardiogramaEstruturadoDeLegado,
  montarDescricaoEcocardiograma,
  normalizarEcocardiogramaEstruturado,
  qualitativaEcoLegadaIgual,
  serializarEcocardiogramaEstruturado,
} from "@/lib/ecocardiograma-estruturado";
import { listarTodasClinicas } from "@/lib/clinicas";
import { extrairIdadePaciente, normalizarSexoPaciente, parsePesoKg } from "@/lib/paciente";
import {
  deriveAutomaticEchoMeasurements,
  hasAnyMeasurement,
  LV_2D_KEYS,
  LV_M_MODE_KEYS,
} from "@/lib/echo-derived-measurements";

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

const formatar2Casas = (valor: number): string => valor.toFixed(2);

const parseInteiroPositivo = (valor?: string): number | null => {
  if (!valor) return null;
  const numero = Math.round(Number(valor.toString().replace(",", ".").trim()));
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return numero;
};

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

const OPCOES_RITMO = [
  "Sinusal",
  "Arritmia sinusal",
  "Fibrilacao atrial",
  "Taquicardia sinusal",
  "Bradicardia sinusal",
];

const OPCOES_ESTADO_PACIENTE = [
  "Calmo",
  "Agitado",
  "Ofegante",
  "Dispneico",
  "Sedado",
];

const incluirOpcaoAtual = (opcoes: string[], valorAtual: string) =>
  valorAtual && !opcoes.includes(valorAtual) ? [valorAtual, ...opcoes] : opcoes;

interface Clinica {
  id: number;
  nome: string;
}

interface Imagem {
  id: number;
  nome: string;
  ordem: number;
  descricao: string;
  url: string;
  dataUrl?: string;
  tamanho: number;
}

interface Laudo {
  id: number;
  paciente_id: number;
  paciente?: Paciente;
  tipo: string;
  titulo: string;
  descricao: string;
  diagnostico: string;
  observacoes: string;
  status: string;
  data_laudo: string;
  data_exame?: string;
  clinic_id?: number;
  clinica?: string;
  medico_solicitante?: string;
  imagens?: Imagem[];
  pressao_arterial?: {
    pas_1?: number | null;
    pas_2?: number | null;
    pas_3?: number | null;
    pas_media?: number | null;
    metodo?: string;
    manguito?: string;
    membro?: string;
    decubito?: string;
    obs_extra?: string;
  } | null;
  ecocardiograma_cabecalho?: {
    ritmo?: string | null;
    estado?: string | null;
    fc?: string | null;
  } | null;
  criado_por_nome: string;
}

interface Paciente {
  id: number;
  nome: string;
  especie: string;
  raca: string;
  sexo: string;
  peso_kg: number | null;
  idade: string;
  tutor: string;
  telefone: string;
  tutor_id?: number;
}

interface DadosExame {
  paciente: {
    nome: string;
    tutor: string;
    raca: string;
    especie: string;
    peso: string;
    idade: string;
    sexo: string;
    telefone: string;
    data_exame: string;
  };
  medidas: Record<string, number | string>;
  clinica: string | { id: number; nome: string };
  veterinario_solicitante: string;
  fc: string;
}

interface EcocardiogramaCabecalho {
  ritmo: string;
  estado: string;
  fc: string;
}

export default function EditarLaudoPage() {
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const laudoId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  // Abas
  const [aba, setAba] = useState<"paciente" | "medidas" | "qualitativa" | "biblioteca" | "imagens" | "pressao" | "referencias">("paciente");

  // Form state
  const [titulo, setTitulo] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("Rascunho");

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
  const [ecocardiogramaEstruturado, setEcocardiogramaEstruturado] = useState(
    criarEcocardiogramaEstruturadoInicial()
  );
  const [ecocardiogramaCabecalho, setEcocardiogramaCabecalho] = useState<EcocardiogramaCabecalho>({
    ritmo: "",
    estado: "",
    fc: "",
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
  });

  // Dados do paciente (editáveis)
  const [pacienteForm, setPacienteForm] = useState({
    nome: "",
    especie: "Canina",
    raca: "",
    sexo: "Macho",
    peso: "",
    idade: "",
    tutor: "",
    telefone: "",
    data_exame: new Date().toISOString().split('T')[0],
  });
  const [novaRaca, setNovaRaca] = useState("");
  const [racasCustomPorEspecie, setRacasCustomPorEspecie] = useState<Record<string, string[]>>({});
  const [racasLoaded, setRacasLoaded] = useState(false);
  const opcoesRaca = getRacaOptions(
    pacienteForm.especie,
    pacienteForm.raca,
    racasCustomPorEspecie[pacienteForm.especie] || [],
  );

  const handleAdicionarRaca = () => {
    const racaDigitada = novaRaca.trim();
    if (!racaDigitada) return;

    const racaExistente =
      opcoesRaca.find((item) => item.toLowerCase() === racaDigitada.toLowerCase()) || racaDigitada;

    setRacasCustomPorEspecie((prev) => addRacaCustomPorEspecie(prev, pacienteForm.especie, racaDigitada));
    setPacienteForm((prev) => ({ ...prev, raca: racaExistente }));
    setNovaRaca("");
  };

  // Clínica
  const [clinicaId, setClinicaId] = useState<string>("");
  const [clinicaNome, setClinicaNome] = useState<string>("");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [medicoSolicitante, setMedicoSolicitante] = useState("");

  // Imagens
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [imagensTemp, setImagensTemp] = useState<any[]>([]);
  const [sessionId] = useState<string>(() => Math.random().toString(36).substring(2, 15));
  const opcoesRitmoPaciente = incluirOpcaoAtual(OPCOES_RITMO, ecocardiogramaCabecalho.ritmo);
  const opcoesEstadoPaciente = incluirOpcaoAtual(
    OPCOES_ESTADO_PACIENTE,
    ecocardiogramaCabecalho.estado,
  );

  // Mensagem de sucesso
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    setRacasCustomPorEspecie(loadRacasCustomPorEspecie());
    setRacasLoaded(true);
  }, []);

  useEffect(() => {
    if (!racasLoaded) return;
    saveRacasCustomPorEspecie(racasCustomPorEspecie);
  }, [racasLoaded, racasCustomPorEspecie]);

  useEffect(() => {
    if (!ecocardiogramaEstruturado.usar_no_laudo) return;
    const legado = derivarLegadoDeEcocardiogramaEstruturado(ecocardiogramaEstruturado);
    setQualitativa((prev) =>
      qualitativaEcoLegadaIgual(prev, legado.qualitativa) ? prev : legado.qualitativa
    );
    if (legado.conclusao) {
      setDiagnostico((prev) => (prev === legado.conclusao ? prev : legado.conclusao));
    }
  }, [ecocardiogramaEstruturado]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarLaudo();
    carregarClinicas();
  }, [router, laudoId]);

  useEffect(() => {
    const aorta = parseNumero(medidas["Aorta"]);
    const atrioEsquerdo = parseNumero(medidas["Atrio_esquerdo"]);
    const aoNivelAp = parseNumero(medidas["Ao_nivel_AP"]);
    const arteriaPulmonar = parseNumero(medidas["AP"]);
    const eDoppler = parseNumero(medidas["e_doppler"]);
    const aDoppler = parseNumero(medidas["a_doppler"]);
    const divedMm = parseNumero(medidas["DIVEd"]);
    const peso = parsePesoKg(pacienteForm.peso);

    const aeAoCalculado =
      aorta !== null && aorta > 0 && atrioEsquerdo !== null && atrioEsquerdo > 0
        ? formatar2Casas(atrioEsquerdo / aorta)
        : null;

    const apAoCalculado =
      aoNivelAp !== null && aoNivelAp > 0 && arteriaPulmonar !== null && arteriaPulmonar > 0
        ? formatar2Casas(arteriaPulmonar / aoNivelAp)
        : null;

    const eSobreaCalculado =
      eDoppler !== null && eDoppler > 0 && aDoppler !== null && aDoppler > 0
        ? formatar2Casas(eDoppler / aDoppler)
        : null;

    const divedNormalizadoCalculado =
      divedMm !== null && divedMm > 0 && peso !== null && peso > 0
        ? formatar2Casas((divedMm / 10.0) / Math.pow(peso, 0.294))
        : null;

    const atualizacoes: Record<string, string> = {};
    if (aeAoCalculado !== null && medidas["AE_Ao"] !== aeAoCalculado) {
      atualizacoes.AE_Ao = aeAoCalculado;
    }
    if (apAoCalculado !== null && medidas["AP_Ao"] !== apAoCalculado) {
      atualizacoes.AP_Ao = apAoCalculado;
    }
    if (eSobreaCalculado !== null && medidas["doppler_tecidual_relacao"] !== eSobreaCalculado) {
      atualizacoes.doppler_tecidual_relacao = eSobreaCalculado;
    }
    if (divedNormalizadoCalculado !== null && medidas["DIVEd_normalizado"] !== divedNormalizadoCalculado) {
      atualizacoes.DIVEd_normalizado = divedNormalizadoCalculado;
    }
    const automaticas = deriveAutomaticEchoMeasurements(medidas, pacienteForm.peso);
    Object.entries(automaticas).forEach(([key, value]) => {
      if (medidas[key] !== value) atualizacoes[key] = value;
    });

    if (Object.keys(atualizacoes).length > 0) {
      setMedidas((prev) => ({
        ...prev,
        ...atualizacoes,
      }));
    }
  }, [
    medidas["Aorta"],
    medidas["Atrio_esquerdo"],
    medidas["Ao_nivel_AP"],
    medidas["AP"],
    medidas["e_doppler"],
    medidas["a_doppler"],
    medidas["DIVEd"],
    medidas["DIVEd_2D"],
    medidas["IM_Vmax"],
    medidas["IT_Vmax"],
    medidas["IA_Vmax"],
    medidas["IP_Vmax"],
    medidas["Remodelamento_AD"],
    pacienteForm.peso,
  ]);

  const laudoEhPressao = (laudo?.tipo || "").toLowerCase() === TIPO_LAUDO_PRESSAO_ARTERIAL;

  const pasMediaCalculada = (() => {
    const valores = [
      parseInteiroPositivo(pressaoArterial.pas_1),
      parseInteiroPositivo(pressaoArterial.pas_2),
      parseInteiroPositivo(pressaoArterial.pas_3),
    ].filter((valor): valor is number => valor !== null);
    if (valores.length === 0) return null;
    return Math.round(valores.reduce((acc, valor) => acc + valor, 0) / valores.length);
  })();

  const montarPayloadPressao = () => {
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

    const payload = {
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

    const temDados = Boolean(payload.pas_1 || payload.pas_2 || payload.pas_3 || payload.pas_media);

    return temDados ? payload : null;
  };

  const carregarClinicas = async () => {
    try {
      const items = await listarTodasClinicas<Clinica>();
      setClinicas(items);
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    }
  };

  // Mapeamento de campos antigos para novos (compatibilidade com XMLs)
  const mapearCamposMedidas = (medidasOriginais: Record<string, number | string>): Record<string, string> => {
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
      "TDI e": "e_doppler",
      "TDI a": "a_doppler",
      "Aprime": "a_doppler",
      "Aprime_Velocity": "a_doppler",
      "a_prime": "a_doppler",
      "EEp": "E_E_linha",
      "PA": "AP",
      "PA_Ao": "AP_Ao",
      "PA/Ao": "AP_Ao",
      "Ao_AP": "Ao_nivel_AP",
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
      if (value === null || value === undefined || String(value).trim() === "") return;
      const novoNome = mapeamento[key] || key;
      if (
        novoNome === "VE_tecnica_relatorio" ||
        novoNome === "Remodelamento_AD" ||
        Number.isFinite(Number(String(value).replace(",", ".")))
      ) {
        medidasFormatadas[novoNome] = value.toString();
      }
    });

    return medidasFormatadas;
  };

  const handleDadosImportados = (dados: DadosExame) => {

    if (dados.paciente) {
      const pesoImportado = parsePesoKg(dados.paciente.peso);
      setPacienteForm((anterior) => ({
        ...anterior,
        nome: dados.paciente.nome || anterior.nome,
        especie: dados.paciente.especie || anterior.especie || "Canina",
        raca: dados.paciente.raca || anterior.raca,
        sexo:
          normalizarSexoPaciente(dados.paciente.sexo || anterior.sexo || "Macho") || "Macho",
        peso: pesoImportado !== null ? String(pesoImportado) : anterior.peso,
        idade: dados.paciente.idade || anterior.idade,
        tutor: dados.paciente.tutor || anterior.tutor,
        telefone: dados.paciente.telefone || anterior.telefone,
        data_exame: dados.paciente.data_exame
          ? dados.paciente.data_exame.substring(0, 10)
          : anterior.data_exame || new Date().toISOString().split('T')[0],
      }));
    }

    if (dados.medidas) {
      const medidasFormatadas = mapearCamposMedidas(dados.medidas);
      setMedidas((anteriores) => ({ ...anteriores, ...medidasFormatadas }));
    }

    if (dados.clinica) {
      if (typeof dados.clinica === 'string') {
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

    if (dados.veterinario_solicitante) {
      setMedicoSolicitante(dados.veterinario_solicitante);
    }

    if (dados.fc) {
      setEcocardiogramaCabecalho((prev) => ({
        ...prev,
        fc: String(dados.fc || "").trim(),
      }));
    }

    setMensagemSucesso("Dados importados com sucesso!");
    setTimeout(() => setMensagemSucesso(null), 5000);
  };

  const carregarLaudo = async () => {
    try {
      setLoading(true);

      // Carregar laudo
      if (!laudoId) return;
      const respLaudo = await api.get(`/laudos/${laudoId}`);
      const laudoData = respLaudo.data;
      if (laudoData.tipo === TIPO_LAUDO_ULTRASSOM_ABDOMINAL) {
        router.replace(getLaudoEditPath(laudoId, laudoData.tipo));
        return;
      }
      setLaudo(laudoData);

      // Preencher form
      setTitulo(laudoData.titulo || "");
      setDiagnostico(laudoData.diagnostico || "");
      setObservacoes(laudoData.observacoes || "");
      setDescricao(laudoData.descricao || "");
      setStatus(laudoData.status || "Rascunho");
      const ecoEstruturadoNormalizado = normalizarEcocardiogramaEstruturado(
        laudoData.ecocardiograma_estruturado
      );
      setEcocardiogramaCabecalho({
        ritmo: String(laudoData.ecocardiograma_cabecalho?.ritmo || "").trim(),
        estado: String(laudoData.ecocardiograma_cabecalho?.estado || "").trim(),
        fc: String(laudoData.ecocardiograma_cabecalho?.fc || "").trim(),
      });

      // Preencher clínica
      if (laudoData.clinic_id) {
        setClinicaId(laudoData.clinic_id.toString());
      }
      setMedicoSolicitante(laudoData.medico_solicitante || "");
      setEcocardiogramaCabecalho({
        ritmo: String(laudoData.ecocardiograma_cabecalho?.ritmo || "").trim(),
        estado: String(laudoData.ecocardiograma_cabecalho?.estado || "").trim(),
        fc: String(laudoData.ecocardiograma_cabecalho?.fc || "").trim(),
      });

      const pressao = laudoData.pressao_arterial || {};
      const manguito = String(pressao.manguito || "").trim();
      const membro = String(pressao.membro || "").trim();
      const decubito = String(pressao.decubito || "").trim();
      const manguitoConhecido = OPCOES_MANGUITO.includes(manguito) ? manguito : "Outro";
      const membroConhecido = OPCOES_MEMBRO.includes(membro) ? membro : "Outro";
      const decubitoConhecido = OPCOES_DECUBITO.includes(decubito) ? decubito : "Outro";

      setPressaoArterial({
        pas_1: pressao.pas_1 ? String(pressao.pas_1) : "",
        pas_2: pressao.pas_2 ? String(pressao.pas_2) : "",
        pas_3: pressao.pas_3 ? String(pressao.pas_3) : "",
        manguito_select: manguito ? manguitoConhecido : "Manguito 02",
        manguito_outro: manguito && manguitoConhecido === "Outro" ? manguito : "",
        membro_select: membro ? membroConhecido : "Membro anterior esquerdo",
        membro_outro: membro && membroConhecido === "Outro" ? membro : "",
        decubito_select: decubito ? decubitoConhecido : "Decubito lateral direito",
        decubito_outro: decubito && decubitoConhecido === "Outro" ? decubito : "",
        obs_extra: String(pressao.obs_extra || ""),
      });
      setAba((laudoData.tipo || "").toLowerCase() === TIPO_LAUDO_PRESSAO_ARTERIAL ? "pressao" : "paciente");

      // Carregar imagens (converter para data URLs)
      if (laudoData.imagens && laudoData.imagens.length > 0) {
        const token = localStorage.getItem('token');
        const imagensComDataUrl = await Promise.all(
          laudoData.imagens.map(async (img: Imagem) => {
            try {
              const resp = await api.get(img.url, {
                responseType: 'blob',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              });
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(resp.data);
              });
              return { ...img, dataUrl };
            } catch (e) {
              console.error("Erro ao carregar imagem:", e);
              return img;
            }
          })
        );
        setImagens(imagensComDataUrl);
      }

      // Carregar dados do paciente (agora vem no laudo)
      if (laudoData.paciente) {
        const pacienteData = laudoData.paciente;
        setPaciente(pacienteData);

        // Preencher formulário do paciente - os dados já vêm completos do backend
        setPacienteForm({
          nome: pacienteData.nome || "",
          especie: pacienteData.especie || "Canina",
          raca: pacienteData.raca || "",
          sexo: normalizarSexoPaciente(pacienteData.sexo || "Macho") || "Macho",
          peso: pacienteData.peso_kg ? pacienteData.peso_kg.toString() : "",
          idade: extrairIdadePaciente(pacienteData) || "",
          tutor: pacienteData.tutor || "",
          telefone: pacienteData.telefone || "",
          data_exame: laudoData.data_exame
            ? laudoData.data_exame.substring(0, 10)
            : new Date().toISOString().split('T')[0],
        });
      } else if (laudoData.paciente_id) {
        // Fallback: buscar paciente separadamente (para laudos antigos)
        try {
          const respPaciente = await api.get(`/pacientes/${laudoData.paciente_id}`);
          const pacienteData = respPaciente.data;
          setPaciente(pacienteData);

          // Preencher formulário do paciente
          setPacienteForm({
            nome: pacienteData.nome || "",
            especie: pacienteData.especie || "Canina",
            raca: pacienteData.raca || "",
            sexo: normalizarSexoPaciente(pacienteData.sexo || "Macho") || "Macho",
            peso: pacienteData.peso_kg ? pacienteData.peso_kg.toString() : "",
            idade: extrairIdadePaciente(pacienteData) || "",
            tutor: pacienteData.tutor || "",
            telefone: pacienteData.telefone || "",
            data_exame: laudoData.data_exame
              ? laudoData.data_exame.substring(0, 10)
              : new Date().toISOString().split('T')[0],
          });
        } catch (e) {
          console.error("Erro ao carregar paciente:", e);
        }
      }

      // Extrair medidas e qualitativa da descrição
      const qualitativaExtraida = {
        valvas: "",
        camaras: "",
        funcao: "",
        pericardio: "",
        vasos: "",
        ad_vd: "",
      };

      if (laudoData.descricao) {
        const descricao = laudoData.descricao;

        // Extrair medidas (formato: - DIVEd: 1.50 ou - Fracao_encurtamento_AE: 21,5)
        const medidasExtraidas: Record<string, string> = {};
        const regexMedidas = /-\s*([\w_]+):\s*([\d.,]+)/g;
        let match;
        while ((match = regexMedidas.exec(descricao)) !== null) {
          medidasExtraidas[match[1]] = match[2].replace(",", ".");
        }
        setMedidas(medidasExtraidas);

        // Extrair qualitativa
        const regexQualitativa =
          /-\s*(valvas|camaras|funcao|pericardio|vasos|ad_vd):\s*([\s\S]*?)(?=\n-\s*(?:valvas|camaras|funcao|pericardio|vasos|ad_vd):|$)/gi;
        while ((match = regexQualitativa.exec(descricao)) !== null) {
          const campo = match[1].toLowerCase() as keyof typeof qualitativaExtraida;
          qualitativaExtraida[campo] = match[2].trim();
        }

        setQualitativa(qualitativaExtraida);
      }

      setEcocardiogramaEstruturado(
        hidratarEcocardiogramaEstruturadoDeLegado(
          ecoEstruturadoNormalizado,
          qualitativaExtraida,
          laudoData.diagnostico || ""
        )
      );
    } catch (error) {
      console.error("Erro ao carregar laudo:", error);
      alert("Erro ao carregar laudo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      if (
        hasAnyMeasurement(medidas, LV_M_MODE_KEYS) &&
        hasAnyMeasurement(medidas, LV_2D_KEYS) &&
        !medidas["VE_tecnica_relatorio"]
      ) {
        alert("Escolha se o PDF deve usar as medidas do VE em Modo M ou Modo 2D.");
        setAba("medidas");
        return;
      }
      // 1. Salvar dados do paciente primeiro
      if (paciente?.id) {
        // Montar observações com idade
        let observacoesPaciente = "";
        if (pacienteForm.idade) {
          observacoesPaciente += `Idade: ${pacienteForm.idade}\n`;
        }

        const pacientePayload = {
          nome: pacienteForm.nome,
          tutor: pacienteForm.tutor || undefined,
          especie: pacienteForm.especie,
          raca: pacienteForm.raca,
          sexo: normalizarSexoPaciente(pacienteForm.sexo),
          peso_kg: parsePesoKg(pacienteForm.peso),
          observacoes: observacoesPaciente || null,
        };
        await api.put(`/pacientes/${paciente.id}`, pacientePayload);

        // 2. Salvar/atualizar tutor
        if (pacienteForm.tutor) {
          try {
            const tutorPayload = {
              nome: pacienteForm.tutor,
              telefone: pacienteForm.telefone,
            };

            // Se já existe tutor, atualiza; senão, cria novo
            if (paciente?.tutor_id) {
              await api.put(`/tutores/${paciente.tutor_id}`, tutorPayload);
            } else {
              const respTutor = await api.post("/tutores", tutorPayload);
              if (respTutor?.data?.id) {
                await api.put(`/tutores/${respTutor.data.id}`, tutorPayload);
              }
            }
          } catch (e) {
            console.error("Erro ao salvar tutor:", e);
          }
        }
      }

      const pressaoPayload = montarPayloadPressao();
      const ecoEstruturadoPayload = laudoEhPressao
        ? null
        : serializarEcocardiogramaEstruturado(ecocardiogramaEstruturado);
      const legadoEco = ecoEstruturadoPayload
        ? derivarLegadoDeEcocardiogramaEstruturado(ecoEstruturadoPayload)
        : null;
      const qualitativaPayload = legadoEco?.qualitativa || qualitativa;
      const diagnosticoPayload =
        ecoEstruturadoPayload?.usar_no_laudo
          ? legadoEco?.conclusao || diagnostico
          : diagnostico;

      // 2. Montar descricao do laudo conforme tipo
      let descricao = "";
      if (laudoEhPressao) {
        const pas1 = parseInteiroPositivo(pressaoArterial.pas_1) || 0;
        const pas2 = parseInteiroPositivo(pressaoArterial.pas_2) || 0;
        const pas3 = parseInteiroPositivo(pressaoArterial.pas_3) || 0;
        descricao = "## Afericao de Pressao Arterial\n";
        descricao += `- 1a afericao (PAS): ${pas1} mmHg\n`;
        descricao += `- 2a afericao (PAS): ${pas2} mmHg\n`;
        descricao += `- 3a afericao (PAS): ${pas3} mmHg\n`;
        descricao += `- PAS media: ${pasMediaCalculada || 0} mmHg\n`;
        descricao += "- Metodo: Doppler\n";
      } else {
        descricao = montarDescricaoEcocardiograma(medidas, qualitativaPayload);
      }

      // 3. Salvar laudo
      const payload: any = {
        titulo:
          titulo ||
          (laudoEhPressao
            ? `Laudo de Pressao Arterial - ${pacienteForm.nome || "Paciente"}`
            : `Laudo de Ecocardiograma - ${pacienteForm.nome || "Paciente"}`),
        descricao,
        diagnostico: diagnosticoPayload,
        observacoes,
        status,
        data_exame: pacienteForm.data_exame,
        tipo_laudo: laudoEhPressao ? "pressao_arterial" : "ecocardiograma",
        pressao_arterial: pressaoPayload,
        ecocardiograma_cabecalho: laudoEhPressao ? null : ecocardiogramaCabecalho,
        ecocardiograma_estruturado: ecoEstruturadoPayload,
      };

      // Adicionar clinic_id se selecionado
      if (clinicaId) {
        payload.clinic_id = parseInt(clinicaId);
      }

      // Adicionar médico solicitante
      if (medicoSolicitante) {
        payload.medico_solicitante = medicoSolicitante;
      }

      if (!laudoId) return;
      await api.put(`/laudos/${laudoId}`, payload);

      // 4. Associar novas imagens ao laudo se houver
      if (imagensTemp.length > 0 && imagensTemp.some(img => img.uploaded)) {
        try {
          await api.post(`/imagens/associar/${laudoId}?session_id=${sessionId}`);
        } catch (imgError) {
          console.error("Erro ao associar imagens:", imgError);
        }
      }

      alert("Laudo e dados do paciente salvos com sucesso!");
      router.push(`/laudos/${laudoId}`);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar. Verifique os dados e tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const handleMedidaChange = (key: string, value: string) => {
    setMedidas(prev => ({ ...prev, [key]: value }));
  };

  const handleEchoAssistantApply = (patch: {
    fields: Record<string, string>;
    measurements: Record<string, string>;
    skipped: string[];
  }) => {
    if (Object.keys(patch.measurements).length) {
      setMedidas((previous) => ({ ...previous, ...patch.measurements }));
    }
    if (Object.keys(patch.fields).length) {
      setEcocardiogramaEstruturado((previous) => ({
        ...previous,
        usar_no_laudo: true,
        textos: {
          ...previous.textos,
          ...patch.fields,
        },
        updated_at: new Date().toISOString(),
      }));
    }
    setAba(Object.keys(patch.fields).length ? "qualitativa" : "medidas");
    setStatus("Rascunho");
    setMensagemSucesso(
      patch.skipped.length
        ? `Sugestões aplicadas ao rascunho. ${patch.skipped.length} item(ns) permaneceram para revisão manual.`
        : "Sugestões selecionadas aplicadas ao rascunho. Revise antes de salvar."
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="fc-report-editor-page">
          <div className="fc-report-loading"><span aria-hidden="true" />Carregando laudo...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!laudo) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Laudo não encontrado</h1>
          <p className="text-gray-500 mt-2">O laudo solicitado não existe ou foi removido.</p>
          <button
            onClick={() => router.push("/laudos")}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Voltar para Laudos
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="fc-report-editor-page">
        <header className="fc-report-editor-header">
          <div className="fc-report-editor-heading">
            <button
              type="button"
              onClick={() => router.push(`/laudos/${laudoId}`)}
              className="fc-report-editor-back"
              aria-label="Voltar para o laudo"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <span className="fc-report-editor-kicker">
                <Heart className="h-4 w-4" />
                Central diagnóstica
              </span>
              <h1>
                {laudoEhPressao ? "Editar Laudo de Pressao Arterial" : "Editar Laudo"}
              </h1>
              <p>
                {laudoEhPressao ? `${pacienteForm.nome} · fluxo dedicado de PA` : pacienteForm.nome}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="fc-report-editor-save"
          >
            <Save className="w-4 h-4" />
            {salvando ? "Salvando..." : "Salvar Laudo"}
          </button>
        </header>

        <div className="fc-report-editor-layout">
          {/* Coluna Esquerda - Importadores */}
          <aside className="fc-report-editor-sidebar">
            {laudoEhPressao ? (
              <div className="fc-report-editor-side-card space-y-4">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-teal-600" />
                  Fluxo de PA
                </h2>

                {mensagemSucesso && (
                  <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded-lg text-sm">
                    {mensagemSucesso}
                  </div>
                )}

                <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
                  Este laudo esta configurado como exame dedicado de pressao arterial. A aba de pressao concentra o que voce precisa revisar.
                </div>
              </div>
            ) : (
              <>
                {laudoId && Number.isFinite(Number(laudoId)) ? (
                  <EchoVoiceAssistant
                    laudoId={Number(laudoId)}
                    currentFields={{
                      ...ecocardiogramaEstruturado.textos,
                      conclusao:
                        ecocardiogramaEstruturado.textos.conclusao || diagnostico,
                    }}
                    currentMeasurements={medidas}
                    onApply={handleEchoAssistantApply}
                  />
                ) : null}

                <div className="fc-report-editor-side-card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-teal-600" />
                    Importar Estudo (Imagem/PDF)
                  </h2>

                  <EcoStudyImportUploader onDadosImportados={handleDadosImportados} />

                  <div className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
                    Revise as medidas reconhecidas antes de aplica-las. Valores conflitantes permanecem fora do formulario.
                  </div>
                </div>

                <div className="fc-report-editor-side-card">
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
                      <strong>Dica:</strong> Arraste o arquivo XML exportado do aparelho de ecocardiograma para preencher automaticamente os dados e medidas.
                    </p>
                  </div>
                </div>

                <div className="fc-report-editor-side-card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-teal-600" />
                    Importar Cabecalho (Imagem)
                  </h2>

                  <ImageHeaderUploader onDadosImportados={handleDadosImportados} />

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Dica:</strong> Envie a imagem gerada pelo equipamento para preencher automaticamente os campos de cabecalho.
                    </p>
                  </div>
                </div>
              </>
            )}
          </aside>

          {/* Coluna Direita - Abas */}
          <div className="fc-report-editor-main">
            <div className="fc-report-editor-workspace">
              {/* Abas */}
              <div className="fc-report-editor-tabs" role="tablist" aria-label="Seções do laudo">
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
                  onClick={() => setAba("biblioteca")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "biblioteca"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Biblioteca
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
              <div className="fc-report-editor-body">
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
                          value={pacienteForm.nome}
                          onChange={(e) => setPacienteForm({...pacienteForm, nome: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tutor
                        </label>
                        <input
                          type="text"
                          value={pacienteForm.tutor}
                          onChange={(e) => setPacienteForm({...pacienteForm, tutor: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Espécie
                        </label>
                        <select
                          value={pacienteForm.especie}
                          onChange={(e) => {
                            setPacienteForm({ ...pacienteForm, especie: e.target.value, raca: "" });
                            setNovaRaca("");
                          }}
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
                        <select
                          value={pacienteForm.raca}
                          onChange={(e) => setPacienteForm({...pacienteForm, raca: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Selecione...</option>
                          {opcoesRaca.map((raca) => (
                            <option key={raca} value={raca}>
                              {raca}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={novaRaca}
                            onChange={(e) => setNovaRaca(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAdicionarRaca();
                              }
                            }}
                            placeholder="Adicionar nova raça"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                          <button
                            type="button"
                            onClick={handleAdicionarRaca}
                            disabled={!novaRaca.trim()}
                            className="px-3 py-2 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sexo
                        </label>
                        <select
                          value={pacienteForm.sexo}
                          onChange={(e) => setPacienteForm({...pacienteForm, sexo: e.target.value})}
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
                          value={pacienteForm.idade}
                          onChange={(e) => setPacienteForm({...pacienteForm, idade: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="Ex: 5 anos"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ritmo
                        </label>
                        <select
                          value={ecocardiogramaCabecalho.ritmo}
                          onChange={(e) =>
                            setEcocardiogramaCabecalho((prev) => ({
                              ...prev,
                              ritmo: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Selecione...</option>
                          {opcoesRitmoPaciente.map((ritmo) => (
                            <option key={ritmo} value={ritmo}>
                              {ritmo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Estado do Paciente
                        </label>
                        <select
                          value={ecocardiogramaCabecalho.estado}
                          onChange={(e) =>
                            setEcocardiogramaCabecalho((prev) => ({
                              ...prev,
                              estado: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Selecione...</option>
                          {opcoesEstadoPaciente.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Peso (kg)
                        </label>
                        <input
                          type="text"
                          value={pacienteForm.peso}
                          onChange={(e) => setPacienteForm({...pacienteForm, peso: e.target.value})}
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
                          value={pacienteForm.data_exame}
                          onChange={(e) => setPacienteForm({...pacienteForm, data_exame: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          value={pacienteForm.telefone}
                          onChange={(e) => setPacienteForm({...pacienteForm, telefone: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="(00) 00000-0000"
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
                            value={medicoSolicitante}
                            onChange={(e) => setMedicoSolicitante(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium text-gray-900 mb-4">Informações do Laudo</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Título
                          </label>
                          <input
                            type="text"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                            placeholder="Título do laudo"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="Rascunho">Rascunho</option>
                            <option value="Finalizado">Finalizado</option>
                            <option value="Arquivado">Arquivado</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {aba === "medidas" && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <label className="block text-sm font-semibold text-gray-900">
                        Técnica do estudo do ventrículo esquerdo exibida no PDF
                      </label>
                      <select
                        value={medidas["VE_tecnica_relatorio"] || ""}
                        onChange={(event) =>
                          handleMedidaChange("VE_tecnica_relatorio", event.target.value)
                        }
                        className="mt-2 w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Selecione quando houver medidas em M e 2D</option>
                        <option value="modo_m">Modo M</option>
                        <option value="2d">Modo 2D</option>
                      </select>
                      <p className="mt-2 text-xs text-teal-800">
                        Quando o estudo importado trouxer as duas técnicas, a escolha define qual bloco será levado ao PDF.
                      </p>
                    </div>

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
                          label="DIVEd normalizado (DIVEd [cm] / peso^0,294)"
                          value={medidas["DIVEd_normalizado"] || ""}
                          onChange={(v) => handleMedidaChange("DIVEd_normalizado", v)}
                          readOnly
                          reference="Ref.: 1.27-1.73"
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
                          label="VDF (Teicholz, mL)"
                          value={medidas["VDF"] || ""}
                          onChange={(v) => handleMedidaChange("VDF", v)}
                        />
                        <MedidaInput
                          label="VSF (Teicholz, mL)"
                          value={medidas["VSF"] || ""}
                          onChange={(v) => handleMedidaChange("VSF", v)}
                        />
                        <MedidaInput
                          label="FE (Teicholz, %)"
                          value={medidas["FE_Teicholz"] || ""}
                          onChange={(v) => handleMedidaChange("FE_Teicholz", v)}
                        />
                        <MedidaInput
                          label="Delta D / FS (%)"
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
                          label="AE/Ao (Átrio esquerdo/Aorta, adimensional)"
                          value={medidas["AE_Ao"] || ""}
                          onChange={(v) => handleMedidaChange("AE_Ao", v)}
                          readOnly
                        />

                        {pacienteForm.especie === "Felina" && (
                          <>
                            <MedidaInput
                              label="Fração de encurtamento do AE (%)"
                              value={medidas["Fracao_encurtamento_AE"] ?? ""}
                              onChange={(v) => handleMedidaChange("Fracao_encurtamento_AE", v)}
                              reference="Ref.: 21 - 25%"
                            />
                            <MedidaInput
                              label="Fluxo auricular (m/s)"
                              value={medidas["Fluxo_auricular"] ?? ""}
                              onChange={(v) => handleMedidaChange("Fluxo_auricular", v)}
                              reference="Ref.: >0,25 m/s"
                            />
                          </>
                        )}

                        <hr className="border-gray-200 my-4" />

                        <h4 className="font-semibold text-gray-900 text-sm">Diastólica</h4>

                        <MedidaInput
                          label="Onda E (m/s)"
                          value={medidas["Onda_E"] || ""}
                          onChange={(v) => handleMedidaChange("Onda_E", v)}
                        />
                        <MedidaInput
                          label="Onda A (m/s)"
                          value={medidas["Onda_A"] || ""}
                          onChange={(v) => handleMedidaChange("Onda_A", v)}
                        />
                        <MedidaInput
                          label="E/A (relação adimensional)"
                          value={medidas["E_A"] || ""}
                          onChange={(v) => handleMedidaChange("E_A", v)}
                        />
                        <MedidaInput
                          label="TD (tempo de desaceleração, ms)"
                          value={medidas["TD"] || ""}
                          onChange={(v) => handleMedidaChange("TD", v)}
                        />
                        <MedidaInput
                          label="TRIV (tempo de relaxamento isovolumétrico, ms)"
                          value={medidas["TRIV"] || ""}
                          onChange={(v) => handleMedidaChange("TRIV", v)}
                        />
                        <MedidaInput
                          label="MR dp/dt (mmHg/s)"
                          value={medidas["MR_dp_dt"] || ""}
                          onChange={(v) => handleMedidaChange("MR_dp_dt", v)}
                        />
                        <MedidaInput
                          label="e' (Doppler tecidual, m/s)"
                          value={medidas["e_doppler"] || ""}
                          onChange={(v) => handleMedidaChange("e_doppler", v)}
                        />
                        <MedidaInput
                          label="a' (Doppler tecidual, m/s)"
                          value={medidas["a_doppler"] || ""}
                          onChange={(v) => handleMedidaChange("a_doppler", v)}
                        />
                        <MedidaInput
                          label="Doppler tecidual (relação e'/a', adimensional)"
                          value={medidas["doppler_tecidual_relacao"] || ""}
                          onChange={(v) => handleMedidaChange("doppler_tecidual_relacao", v)}
                        />
                        <MedidaInput
                          label="E/E' (adimensional)"
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
                          label="AP/Ao (Artéria pulmonar/Aorta, adimensional)"
                          value={medidas["AP_Ao"] || ""}
                          onChange={(v) => handleMedidaChange("AP_Ao", v)}
                        />

                        <hr className="border-gray-200 my-4" />

                        <h4 className="font-semibold text-gray-900 text-sm">Regurgitações</h4>

                        <MedidaInput
                          label="IM (insuficiência mitral) Vmax (m/s)"
                          value={medidas["IM_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IM_Vmax", v)}
                        />
                        <MedidaInput
                          label="Gradiente da insuficiência mitral (mmHg, 4 × V²)"
                          value={medidas["IM_Grad"] || ""}
                          onChange={(v) => handleMedidaChange("IM_Grad", v)}
                          readOnly
                        />
                        <MedidaInput
                          label="IT (insuficiência tricúspide) Vmax (m/s)"
                          value={medidas["IT_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IT_Vmax", v)}
                        />
                        <MedidaInput
                          label="Gradiente da insuficiência tricúspide (mmHg, 4 × V²)"
                          value={medidas["IT_Grad"] || ""}
                          onChange={(v) => handleMedidaChange("IT_Grad", v)}
                          readOnly
                        />
                        <MedidaInput
                          label="IA (insuficiência aórtica) Vmax (m/s)"
                          value={medidas["IA_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IA_Vmax", v)}
                        />
                        <MedidaInput
                          label="Gradiente da insuficiência aórtica (mmHg, 4 × V²)"
                          value={medidas["IA_Grad"] || ""}
                          onChange={(v) => handleMedidaChange("IA_Grad", v)}
                          readOnly
                        />
                        <MedidaInput
                          label="IP (insuficiência pulmonar) Vmax (m/s)"
                          value={medidas["IP_Vmax"] || ""}
                          onChange={(v) => handleMedidaChange("IP_Vmax", v)}
                        />
                        <MedidaInput
                          label="Gradiente da insuficiência pulmonar (mmHg, 4 × V²)"
                          value={medidas["IP_Grad"] || ""}
                          onChange={(v) => handleMedidaChange("IP_Grad", v)}
                          readOnly
                        />
                        <div className="space-y-1">
                          <label className="block text-xs leading-tight text-gray-600">
                            Remodelamento do átrio direito
                          </label>
                          <select
                            value={medidas["Remodelamento_AD"] || ""}
                            onChange={(event) =>
                              handleMedidaChange("Remodelamento_AD", event.target.value)
                            }
                            className="w-full rounded bg-blue-50 px-2 py-1.5 text-sm text-gray-700 focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">Selecione ou aplique a sugestão do ditado</option>
                            <option value="ausente">Ausente</option>
                            <option value="leve">Leve</option>
                            <option value="moderado">Moderado</option>
                            <option value="importante">Importante</option>
                          </select>
                        </div>
                        <MedidaInput
                          label="Pressão atrial direita estimada (mmHg)"
                          value={medidas["PAD_estimada"] || ""}
                          onChange={(v) => handleMedidaChange("PAD_estimada", v)}
                          readOnly
                        />
                        <MedidaInput
                          label="PSAP estimada (mmHg = gradiente IT + PAD estimada)"
                          value={medidas["PSAP"] || ""}
                          onChange={(v) => handleMedidaChange("PSAP", v)}
                          readOnly
                          reference="Estimativa ecocardiográfica; confirmar ausência de obstrução da via de saída do VD."
                        />
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="mb-4 text-sm font-semibold text-gray-900">VE - Modo 2D</h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MedidaInput
                          label="DIVEd 2D (mm - Diâmetro interno do VE em diástole)"
                          value={medidas["DIVEd_2D"] || ""}
                          onChange={(v) => handleMedidaChange("DIVEd_2D", v)}
                        />
                        <MedidaInput
                          label="DIVEd normalizado 2D (DIVEd [cm] / peso^0,294)"
                          value={medidas["DIVEd_normalizado_2D"] || ""}
                          onChange={(v) => handleMedidaChange("DIVEd_normalizado_2D", v)}
                          readOnly
                          reference="Ref.: 1.27-1.73"
                        />
                        <MedidaInput
                          label="SIVd 2D (mm)"
                          value={medidas["SIVd_2D"] || ""}
                          onChange={(v) => handleMedidaChange("SIVd_2D", v)}
                        />
                        <MedidaInput
                          label="PLVEd 2D (mm)"
                          value={medidas["PLVEd_2D"] || ""}
                          onChange={(v) => handleMedidaChange("PLVEd_2D", v)}
                        />
                        <MedidaInput
                          label="DIVEs 2D (mm)"
                          value={medidas["DIVES_2D"] || ""}
                          onChange={(v) => handleMedidaChange("DIVES_2D", v)}
                        />
                        <MedidaInput
                          label="SIVs 2D (mm)"
                          value={medidas["SIVs_2D"] || ""}
                          onChange={(v) => handleMedidaChange("SIVs_2D", v)}
                        />
                        <MedidaInput
                          label="PLVEs 2D (mm)"
                          value={medidas["PLVES_2D"] || ""}
                          onChange={(v) => handleMedidaChange("PLVES_2D", v)}
                        />
                        <MedidaInput
                          label="VDF 2D (Teicholz, mL)"
                          value={medidas["VDF_2D"] || ""}
                          onChange={(v) => handleMedidaChange("VDF_2D", v)}
                        />
                        <MedidaInput
                          label="VSF 2D (Teicholz, mL)"
                          value={medidas["VSF_2D"] || ""}
                          onChange={(v) => handleMedidaChange("VSF_2D", v)}
                        />
                        <MedidaInput
                          label="FE 2D (Teicholz, %)"
                          value={medidas["FE_Teicholz_2D"] || ""}
                          onChange={(v) => handleMedidaChange("FE_Teicholz_2D", v)}
                        />
                        <MedidaInput
                          label="Delta D / FS 2D (%)"
                          value={medidas["DeltaD_FS_2D"] || ""}
                          onChange={(v) => handleMedidaChange("DeltaD_FS_2D", v)}
                        />
                      </div>
                    </div>

                    {/* Linha inferior: Doppler - Saídas */}
                    <div className="border-t pt-6 mt-6">
                      <h4 className="font-semibold text-gray-900 text-sm mb-4">Doppler - Saídas</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MedidaInput
                          label="Vmax aorta (m/s)"
                          value={medidas["Vmax_aorta"] || ""}
                          onChange={(v) => handleMedidaChange("Vmax_aorta", v)}
                        />
                        <MedidaInput
                          label="Gradiente aorta (mmHg)"
                          value={medidas["Grad_aorta"] || ""}
                          onChange={(v) => handleMedidaChange("Grad_aorta", v)}
                        />
                        <MedidaInput
                          label="Vmax pulmonar (m/s)"
                          value={medidas["Vmax_pulmonar"] || ""}
                          onChange={(v) => handleMedidaChange("Vmax_pulmonar", v)}
                        />
                        <MedidaInput
                          label="Gradiente pulmonar (mmHg)"
                          value={medidas["Grad_pulmonar"] || ""}
                          onChange={(v) => handleMedidaChange("Grad_pulmonar", v)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {aba === "qualitativa" && (
                  <div className="space-y-4">
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900">Qualitativa Detalhada</h3>
                      <span className="text-sm text-gray-500">
                        Use o editor estruturado como fonte principal. O bloco qualitativo legado eh gerado automaticamente ao salvar para compatibilidade do PDF.
                      </span>
                    </div>

                    <EcocardiogramaEstruturadoEditor
                      value={ecocardiogramaEstruturado}
                      onChange={setEcocardiogramaEstruturado}
                    />

                    {ecocardiogramaEstruturado.usar_no_laudo ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Para ajustar a conclusao oficial, edite o aspecto &quot;Conclusao&quot; no bloco estruturado acima.
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Conclusao
                      </label>
                      <textarea
                        value={diagnostico}
                        onChange={(e) => setDiagnostico(e.target.value)}
                        rows={4}
                        readOnly={ecocardiogramaEstruturado.usar_no_laudo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 read-only:bg-gray-50"
                        placeholder="Conclusao diagnostica..."
                      />
                    </div>
                  </div>
                )}

                {aba === "biblioteca" && (
                  <EcocardiogramaEstruturadoBiblioteca />
                )}

                {aba === "imagens" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Imagens do Exame</h3>
                      <span className="text-sm text-gray-500">
                        {imagens.length} imagem(ns) existente(s)
                      </span>
                    </div>

                    {imagens.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {imagens.map((img, idx) => (
                          <div key={img.id} className="relative group border rounded-lg overflow-hidden">
                            <img
                              src={img.dataUrl || img.url}
                              alt={img.nome}
                              className="w-full h-32 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-image.png';
                              }}
                            />
                            <div className="absolute top-2 left-2 bg-teal-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                              {idx + 1}
                            </div>
                            <button
                              onClick={async () => {
                                if (confirm("Deseja remover esta imagem?")) {
                                  try {
                                    await api.delete(`/imagens/${img.id}`);
                                    setImagens(imagens.filter(i => i.id !== img.id));
                                  } catch (e) {
                                    alert("Erro ao remover imagem");
                                  }
                                }
                              }}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remover"
                            >
                              
                            </button>
                            <p className="text-xs text-gray-600 p-2 truncate">{img.nome}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-6">
                      <h4 className="font-medium text-gray-900 mb-4">Adicionar Novas Imagens</h4>
                      <ImageUploader
                        onImagensChange={setImagensTemp}
                        sessionId={sessionId}
                        imagensIniciais={imagensTemp}
                      />
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Dica:</strong> As imagens serão inseridas automaticamente no PDF do laudo.
                      </p>
                    </div>
                  </div>
                )}

                {aba === "pressao" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900">Pressao Arterial</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Edite as afericoes e observacoes da pressao arterial vinculadas a este laudo.
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
                        as medidas do paciente com os valores normais. Clique em &quot;Editar Tabelas&quot; para gerenciar
                        os valores de referência.
                      </p>
                    </div>

                    <ReferenciaComparison
                      especie={pacienteForm.especie === "Felina" ? "Felina" : "Canina"}
                      peso={parsePesoKg(pacienteForm.peso) ?? undefined}
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
