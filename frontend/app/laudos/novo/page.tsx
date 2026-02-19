"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import XmlUploader from "../components/XmlUploader";
import ImageUploader from "../components/ImageUploader";
import { Save, ArrowLeft, Heart, User, Activity, FileText, BookOpen, Settings, Image as ImageIcon } from "lucide-react";
import { ReferenciaComparison } from "../components/ReferenciaComparison";

interface DadosPaciente {
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
}

// Parâmetros ecocardiográficos
const PARAMETROS_MEDIDAS = [
  { key: "Ao", label: "Ao (cm)", categoria: "Câmaras" },
  { key: "LA", label: "LA (cm)", categoria: "Câmaras" },
  { key: "LA_Ao", label: "LA/Ao", categoria: "Razões" },
  { key: "IVSd", label: "IVSd (cm)", categoria: "Paredes" },
  { key: "LVIDd", label: "LVIDd (cm)", categoria: "Câmaras" },
  { key: "LVPWd", label: "LVPWd (cm)", categoria: "Paredes" },
  { key: "IVSs", label: "IVSs (cm)", categoria: "Paredes" },
  { key: "LVIDs", label: "LVIDs (cm)", categoria: "Câmaras" },
  { key: "LVPWs", label: "LVPWs (cm)", categoria: "Paredes" },
  { key: "EDV", label: "EDV (ml)", categoria: "Volumes" },
  { key: "ESV", label: "ESV (ml)", categoria: "Volumes" },
  { key: "EF", label: "EF (%)", categoria: "Função" },
  { key: "FS", label: "FS (%)", categoria: "Função" },
  { key: "MAPSE", label: "MAPSE (cm)", categoria: "Função" },
  { key: "TAPSE", label: "TAPSE (cm)", categoria: "Função" },
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

export default function NovoLaudoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState<"paciente" | "medidas" | "qualitativa" | "imagens" | "conteudo" | "frases" | "referencias">("paciente");
  
  // Dados do paciente
  const [paciente, setPaciente] = useState({
    nome: "",
    tutor: "",
    raca: "",
    especie: "Canina",
    peso: "",
    idade: "",
    sexo: "Macho",
    telefone: "",
    data_exame: new Date().toISOString().split('T')[0],
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
  
  // Clinica
  const [clinicaId, setClinicaId] = useState<string>("");
  const [clinicaNome, setClinicaNome] = useState<string>("");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [veterinario, setVeterinario] = useState("");
  
  // Mensagem de sucesso
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  
  // Sidebar - Frases
  const [patologias, setPatologias] = useState<string[]>([]);
  const [patologiaSelecionada, setPatologiaSelecionada] = useState("Normal");
  const [graus, setGraus] = useState<string[]>(["Normal", "Leve", "Moderada", "Importante", "Grave"]);
  const [grauSelecionado, setGrauSelecionado] = useState("Normal");
  const [layoutQualitativa, setLayoutQualitativa] = useState<"detalhado" | "enxuto">("detalhado");
  const [aplicandoFrase, setAplicandoFrase] = useState(false);
  
  // Lista de frases (para aba Frases)
  const [frases, setFrases] = useState<FraseQualitativa[]>([]);
  const [fraseEditando, setFraseEditando] = useState<FraseQualitativa | null>(null);
  
  // Imagens do laudo
  const [imagens, setImagens] = useState<any[]>([]);
  const [sessionId] = useState<string>(() => Math.random().toString(36).substring(2, 15));

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarPatologias();
    carregarFrases();
    carregarClinicas();
  }, [router]);

  const carregarClinicas = async () => {
    try {
      const response = await api.get("/clinicas");
      setClinicas(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    }
  };

  const carregarPatologias = async () => {
    try {
      const response = await api.get("/frases/patologias");
      if (response.data && response.data.length > 0) {
        setPatologias(response.data);
      } else {
        // Padrões caso não tenha no banco
        setPatologias(["Normal", "Endocardiose Mitral", "Cardiomiopatia Dilatada", "Estenose Aórtica", "Estenose Pulmonar"]);
      }
    } catch (error) {
      console.error("Erro ao carregar patologias:", error);
      setPatologias(["Normal", "Endocardiose Mitral", "Cardiomiopatia Dilatada"]);
    }
  };

  const carregarFrases = async () => {
    try {
      const response = await api.get("/frases?limit=100");
      setFrases(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar frases:", error);
    }
  };

  const handleGerarTexto = async () => {
    setAplicandoFrase(true);
    try {
      const request = {
        patologia: patologiaSelecionada,
        grau_refluxo: patologiaSelecionada === "Endocardiose Mitral" ? grauSelecionado : undefined,
        grau_geral: patologiaSelecionada !== "Endocardiose Mitral" ? grauSelecionado : undefined,
        layout: layoutQualitativa,
      };
      
      const response = await api.post("/frases/aplicar", request);
      
      if (response.data.success && response.data.dados) {
        const dados = response.data.dados;
        
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

  const handleDadosImportados = (dados: DadosExame) => {
    console.log("Dados recebidos do XML:", dados);
    
    if (dados.paciente) {
      const novoPaciente = {
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
      const medidasFormatadas: Record<string, string> = {};
      Object.entries(dados.medidas).forEach(([key, value]) => {
        medidasFormatadas[key] = value.toString();
      });
      setMedidas(medidasFormatadas);
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

  const handleSalvar = async () => {
    setLoading(true);
    try {
      // Enviar clínica como objeto com id ou nome
      const clinicaPayload = clinicaId 
        ? { id: parseInt(clinicaId), nome: clinicaNome }
        : clinicaNome;
      
      const payload = {
        paciente,
        medidas,
        qualitativa,
        conteudo,
        clinica: clinicaPayload,
        veterinario: { nome: veterinario },
        data_exame: paciente.data_exame,
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
      alert("Erro ao salvar laudo");
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
                    value={graus.indexOf(grauSelecionado)}
                    onChange={(e) => setGrauSelecionado(graus[parseInt(e.target.value)])}
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
                  onClick={() => setAba("conteudo")}
                  className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${
                    aba === "conteudo"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Conteúdo
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
                    {["Câmaras", "Paredes", "Volumes", "Função", "Razões", "Fluxos", "Gradientes", "Mitral", "Tempos", "Regurgitação"].map((categoria) => {
                      const parametrosCategoria = PARAMETROS_MEDIDAS.filter(
                        (p) => p.categoria === categoria
                      );
                      if (parametrosCategoria.length === 0) return null;

                      return (
                        <div key={categoria}>
                          <h4 className="font-medium text-gray-900 mb-3">{categoria}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {parametrosCategoria.map((param) => (
                              <div key={param.key}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  {param.label}
                                </label>
                                <input
                                  type="text"
                                  value={medidas[param.key] || ""}
                                  onChange={(e) => handleMedidaChange(param.key, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                                  placeholder="0.00"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {aba === "qualitativa" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Qualitativa Detalhada</h3>
                      <span className="text-sm text-gray-500">
                        Use a barra lateral para gerar texto automaticamente
                      </span>
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
                    />
                    
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Dica:</strong> As imagens serão inseridas automaticamente no PDF do laudo. 
                        Arraste para reordenar ou clique no X para remover.
                      </p>
                    </div>
                  </div>
                )}

                {aba === "conteudo" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrição do Exame
                      </label>
                      <textarea
                        value={conteudo.descricao}
                        onChange={(e) => setConteudo({...conteudo, descricao: e.target.value})}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        placeholder="Descreva os achados do exame..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Conclusão
                      </label>
                      <textarea
                        value={conteudo.conclusao}
                        onChange={(e) => setConteudo({...conteudo, conclusao: e.target.value})}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        placeholder="Conclusão diagnóstica..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        value={conteudo.observacoes}
                        onChange={(e) => setConteudo({...conteudo, observacoes: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        placeholder="Observações adicionais..."
                      />
                    </div>
                  </div>
                )}

                {aba === "frases" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Gerenciamento de Frases</h3>
                      <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
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
                            {frases.map((frase) => (
                              <tr key={frase.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2">{frase.patologia}</td>
                                <td className="px-4 py-2">{frase.grau}</td>
                                <td className="px-4 py-2 truncate max-w-xs">
                                  {frase.conclusao.substring(0, 50)}...
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <button className="text-teal-600 hover:text-teal-800 mr-2">
                                    Editar
                                  </button>
                                  <button className="text-red-600 hover:text-red-800">
                                    Excluir
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {aba === "referencias" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900">Tabelas de Referência</h3>
                      <a 
                        href="/referencias"
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
                      peso={paciente.peso ? parseFloat(paciente.peso) : undefined}
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
