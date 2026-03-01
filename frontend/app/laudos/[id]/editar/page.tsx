"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../../layout-dashboard";
import api from "@/lib/axios";
import {
  addRacaCustomPorEspecie,
  getRacaOptions,
  loadRacasCustomPorEspecie,
  saveRacasCustomPorEspecie,
} from "@/lib/racas";
import XmlUploader from "../../components/XmlUploader";
import ImageUploader from "../../components/ImageUploader";
import { ArrowLeft, Save, User, Activity, Heart, BookOpen, Settings, Image as ImageIcon, Minus, Plus } from "lucide-react";
import { ReferenciaComparison } from "../../components/ReferenciaComparison";

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

const CAMPOS_QUALITATIVA = [
  { key: "valvas", label: "Válvulas", placeholder: "Descreva o estado das válvulas cardíacas..." },
  { key: "camaras", label: "Câmaras", placeholder: "Descreva as cavidades cardíacas..." },
  { key: "funcao", label: "Função", placeholder: "Descreva a função cardíaca..." },
  { key: "pericardio", label: "Pericárdio", placeholder: "Descreva o pericárdio..." },
  { key: "vasos", label: "Vasos", placeholder: "Descreva os grandes vasos..." },
  { key: "ad_vd", label: "AD/VD", placeholder: "Descreva as câmaras direitas..." },
];

export default function EditarLaudoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  // Abas
  const [aba, setAba] = useState<"paciente" | "medidas" | "qualitativa" | "imagens" | "pressao" | "referencias">("paciente");

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

  // Mensagem de sucesso
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  // Sidebar - Frases/Patologia
  const [patologias, setPatologias] = useState<string[]>([]);
  const [patologiaSelecionada, setPatologiaSelecionada] = useState("Normal");
  const [graus] = useState<string[]>(["Leve", "Moderada", "Importante"]);
  const [grauSelecionado, setGrauSelecionado] = useState("Leve");
  const [layoutQualitativa, setLayoutQualitativa] = useState<"detalhado" | "enxuto">("detalhado");
  const [aplicandoFrase, setAplicandoFrase] = useState(false);
  const [salvandoFraseQualitativa, setSalvandoFraseQualitativa] = useState(false);
  const [fraseAplicadaId, setFraseAplicadaId] = useState<number | null>(null);
  const [frases, setFrases] = useState<FraseQualitativa[]>([]);

  useEffect(() => {
    setRacasCustomPorEspecie(loadRacasCustomPorEspecie());
    setRacasLoaded(true);
  }, []);

  useEffect(() => {
    if (!racasLoaded) return;
    saveRacasCustomPorEspecie(racasCustomPorEspecie);
  }, [racasLoaded, racasCustomPorEspecie]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarLaudo();
    carregarClinicas();
    carregarFrases();
  }, [router, params.id]);

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
    conclusao: diagnostico || "",
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

        setQualitativa({
          valvas: dados.valvas || "",
          camaras: dados.camaras || "",
          funcao: dados.funcao || "",
          pericardio: dados.pericardio || "",
          vasos: dados.vasos || "",
          ad_vd: dados.ad_vd || "",
        });
        setDiagnostico(dados.conclusao || "");
        setMensagemSucesso("Texto gerado com sucesso!");
        setTimeout(() => setMensagemSucesso(null), 3000);
      } else {
        alert("Frase nao encontrada para esta patologia/grau.");
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
      conclusao: diagnostico || "",
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

  useEffect(() => {
    const aorta = parseNumero(medidas["Aorta"]);
    const atrioEsquerdo = parseNumero(medidas["Atrio_esquerdo"]);
    const divedMm = parseNumero(medidas["DIVEd"]);
    const peso = parseNumero(pacienteForm.peso);

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
  }, [medidas["Aorta"], medidas["Atrio_esquerdo"], medidas["DIVEd"], pacienteForm.peso]);

  const laudoEhPressao = (laudo?.tipo || "").toLowerCase() === "pressao_arterial";

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
      const response = await api.get("/clinicas");
      setClinicas(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
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
      if (value !== null && value !== undefined && !isNaN(value)) {
        const novoNome = mapeamento[key] || key;
        medidasFormatadas[novoNome] = value.toString();
      }
    });

    return medidasFormatadas;
  };

  const handleDadosImportados = (dados: DadosExame) => {
    console.log("Dados recebidos do XML:", dados);

    if (dados.paciente) {
      const novoPaciente = {
        nome: dados.paciente.nome || "",
        especie: dados.paciente.especie || "Canina",
        raca: dados.paciente.raca || "",
        sexo: dados.paciente.sexo || "Macho",
        peso: dados.paciente.peso || "",
        idade: dados.paciente.idade || "",
        tutor: dados.paciente.tutor || "",
        telefone: dados.paciente.telefone || "",
        data_exame: dados.paciente.data_exame
          ? dados.paciente.data_exame.substring(0, 10)
          : new Date().toISOString().split('T')[0],
      };
      setPacienteForm(novoPaciente);
    }

    if (dados.medidas) {
      const medidasFormatadas = mapearCamposMedidas(dados.medidas);
      setMedidas(medidasFormatadas);
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

    setMensagemSucesso("Dados do XML importados com sucesso!");
    setTimeout(() => setMensagemSucesso(null), 5000);
  };

  const carregarLaudo = async () => {
    try {
      setLoading(true);

      // Carregar laudo
      const respLaudo = await api.get(`/laudos/${params.id}`);
      const laudoData = respLaudo.data;
      setLaudo(laudoData);

      // Preencher form
      setTitulo(laudoData.titulo || "");
      setDiagnostico(laudoData.diagnostico || "");
      setObservacoes(laudoData.observacoes || "");
      setDescricao(laudoData.descricao || "");
      setStatus(laudoData.status || "Rascunho");

      // Preencher clínica
      if (laudoData.clinic_id) {
        setClinicaId(laudoData.clinic_id.toString());
      }
      setMedicoSolicitante(laudoData.medico_solicitante || "");

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
          sexo: pacienteData.sexo || "Macho",
          peso: pacienteData.peso_kg ? pacienteData.peso_kg.toString() : "",
          idade: pacienteData.idade || "",
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
            sexo: pacienteData.sexo || "Macho",
            peso: pacienteData.peso_kg ? pacienteData.peso_kg.toString() : "",
            idade: pacienteData.idade || "",
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
        const qualitativaExtraida: Record<string, string> = {};
        const regexQualitativa = /-\s*(valvas|camaras|funcao|pericardio|vasos|ad_vd):\s*(.+?)(?=\n-|$)/gi;
        while ((match = regexQualitativa.exec(descricao)) !== null) {
          qualitativaExtraida[match[1].toLowerCase()] = match[2].trim();
        }

        setQualitativa({
          valvas: qualitativaExtraida["valvas"] || "",
          camaras: qualitativaExtraida["camaras"] || "",
          funcao: qualitativaExtraida["funcao"] || "",
          pericardio: qualitativaExtraida["pericardio"] || "",
          vasos: qualitativaExtraida["vasos"] || "",
          ad_vd: qualitativaExtraida["ad_vd"] || "",
        });
      }
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
          sexo: pacienteForm.sexo,
          peso_kg: pacienteForm.peso ? parseFloat(pacienteForm.peso) : null,
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

      // 2. Montar descrição do laudo conforme tipo
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
        descricao = "## Medidas Ecocardiográficas\n";
        Object.entries(medidas).forEach(([key, value]) => {
          if (value) {
            descricao += `- ${key}: ${value}\n`;
          }
        });

        descricao += "\n## Avaliação Qualitativa\n";
        Object.entries(qualitativa).forEach(([key, value]) => {
          if (value) {
            descricao += `- ${key}: ${value}\n`;
          }
        });
      }

      // 3. Salvar laudo
      const payload: any = {
        titulo:
          titulo ||
          (laudoEhPressao
            ? `Laudo de Pressao Arterial - ${pacienteForm.nome || "Paciente"}`
            : `Laudo de Ecocardiograma - ${pacienteForm.nome || "Paciente"}`),
        descricao,
        diagnostico,
        observacoes,
        status,
        data_exame: pacienteForm.data_exame,
        tipo_laudo: laudoEhPressao ? "pressao_arterial" : "ecocardiograma",
        pressao_arterial: pressaoPayload,
      };

      // Adicionar clinic_id se selecionado
      if (clinicaId) {
        payload.clinic_id = parseInt(clinicaId);
      }

      // Adicionar médico solicitante
      if (medicoSolicitante) {
        payload.medico_solicitante = medicoSolicitante;
      }

      await api.put(`/laudos/${params.id}`, payload);

      // 4. Associar novas imagens ao laudo se houver
      if (imagensTemp.length > 0 && imagensTemp.some(img => img.uploaded)) {
        try {
          await api.post(`/imagens/associar/${params.id}?session_id=${sessionId}`);
        } catch (imgError) {
          console.error("Erro ao associar imagens:", imgError);
        }
      }

      alert("Laudo e dados do paciente salvos com sucesso!");
      router.push(`/laudos/${params.id}`);
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

  const handleQualitativaChange = (key: string, value: string) => {
    setQualitativa(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">Carregando laudo...</div>
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
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/laudos/${params.id}`)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Editar Laudo</h1>
              <p className="text-gray-500">{pacienteForm.nome}</p>
            </div>
          </div>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {salvando ? "Salvando..." : "Salvar Laudo"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna Esquerda - Upload XML */}
          <div className="lg:col-span-1 space-y-6">
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
                  <strong>Dica:</strong> Arraste o arquivo XML exportado do aparelho de ecocardiograma para preencher automaticamente os dados e medidas.
                </p>
              </div>
            </div>

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
                      type="button"
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
                      type="button"
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
                  type="button"
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

          {/* Coluna Direita - Abas */}
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
                  Pressão
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

                        {pacienteForm.especie === "Felina" && (
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
                      <h3 className="font-medium text-gray-900">Qualitativa Detalhada</h3>
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
                        Conclusao
                      </label>
                      <textarea
                        value={diagnostico}
                        onChange={(e) => setDiagnostico(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        placeholder="Conclusao diagnostica..."
                      />
                    </div>
                  </div>
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
                        as medidas do paciente com os valores normais. Clique em "Editar Tabelas" para gerenciar
                        os valores de referência.
                      </p>
                    </div>

                    <ReferenciaComparison
                      especie={pacienteForm.especie === "Felina" ? "Felina" : "Canina"}
                      peso={parseNumero(pacienteForm.peso) ?? undefined}
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
