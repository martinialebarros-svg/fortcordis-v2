"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import XmlUploader from "../components/XmlUploader";
import { Save, ArrowLeft, Heart, User, Activity, FileText } from "lucide-react";

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

interface DadosExame {
  paciente: DadosPaciente;
  medidas: Record<string, number>;
  clinica: string;
  veterinario_solicitante: string;
  fc: string;
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

export default function NovoLaudoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState<"paciente" | "medidas" | "conteudo">("paciente");
  
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
  
  // Conteúdo do laudo
  const [conteudo, setConteudo] = useState({
    descricao: "",
    conclusao: "",
    observacoes: "",
  });
  
  // Clinica
  const [clinica, setClinica] = useState("");
  const [veterinario, setVeterinario] = useState("");
  
  // Mensagem de sucesso
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
    }
  }, [router]);

  const handleDadosImportados = (dados: DadosExame) => {
    console.log("Dados recebidos do XML:", dados);
    
    // Preenche dados do paciente
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
      console.log("Novo paciente:", novoPaciente);
      setPaciente(novoPaciente);
    }
    
    // Preenche medidas
    if (dados.medidas) {
      const medidasFormatadas: Record<string, string> = {};
      Object.entries(dados.medidas).forEach(([key, value]) => {
        medidasFormatadas[key] = value.toString();
      });
      console.log("Medidas formatadas:", medidasFormatadas);
      setMedidas(medidasFormatadas);
    }
    
    // Preenche clínica
    if (dados.clinica) {
      setClinica(dados.clinica);
    }
    
    // Mostra mensagem de sucesso
    setMensagemSucesso("Dados do XML importados com sucesso!");
    setTimeout(() => setMensagemSucesso(null), 5000);
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
      // Primeiro cria o paciente se não existir
      const payload = {
        paciente,
        medidas,
        conteudo,
        clinica,
        veterinario,
        data_exame: paciente.data_exame,
      };
      
      // TODO: Implementar endpoint completo de criação de laudo
      await api.post("/laudos", payload);
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda - Upload XML */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                Importar XML
              </h2>
              {mensagemSucesso && (
                <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-lg">
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
          </div>

          {/* Coluna Direita - Formulário */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Abas */}
              <div className="flex border-b">
                <button
                  onClick={() => setAba("paciente")}
                  className={`px-6 py-3 font-medium flex items-center gap-2 ${
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
                  className={`px-6 py-3 font-medium flex items-center gap-2 ${
                    aba === "medidas"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Medidas
                </button>
                <button
                  onClick={() => setAba("conteudo")}
                  className={`px-6 py-3 font-medium flex items-center gap-2 ${
                    aba === "conteudo"
                      ? "text-teal-600 border-b-2 border-teal-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Conteúdo
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
                          <input
                            type="text"
                            value={clinica}
                            onChange={(e) => setClinica(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          />
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
                    {/* Agrupar por categoria */}
                    {["Câmaras", "Paredes", "Volumes", "Função", "Razões", "Fluxos", "Gradientes", "Mitral", "Tempos", "Regurgitação"].map((categoria) => {
                      const parametrosCategoria = PARAMETROS_MEDIDAS.filter(
                        (p) => p.categoria === categoria
                      );
                      if (parametrosCategoria.length === 0) return null;

                      return (
                        <div key={categoria}>
                          <h4 className="font-medium text-gray-900 mb-3">{categoria}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
