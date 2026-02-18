"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../../layout-dashboard";
import api from "@/lib/axios";
import { ArrowLeft, Save, FileText, User, Activity, Heart } from "lucide-react";

interface Laudo {
  id: number;
  paciente_id: number;
  tipo: string;
  titulo: string;
  descricao: string;
  diagnostico: string;
  observacoes: string;
  status: string;
  data_laudo: string;
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
}

export default function EditarLaudoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  
  // Form state
  const [titulo, setTitulo] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [observacoes, setObservacoes] = useState("");
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
  });

  // Lista de parâmetros ecocardiográficos
  const parametrosMedidas = [
    { key: "Ao", label: "Ao (cm)" },
    { key: "LA", label: "LA (cm)" },
    { key: "LA_Ao", label: "LA/Ao" },
    { key: "IVSd", label: "IVSd (cm)" },
    { key: "LVIDd", label: "LVIDd (cm)" },
    { key: "LVPWd", label: "LVPWd (cm)" },
    { key: "IVSs", label: "IVSs (cm)" },
    { key: "LVIDs", label: "LVIDs (cm)" },
    { key: "LVPWs", label: "LVPWs (cm)" },
    { key: "EF", label: "EF (%)" },
    { key: "FS", label: "FS (%)" },
    { key: "TAPSE", label: "TAPSE (cm)" },
    { key: "MAPSE", label: "MAPSE (cm)" },
    { key: "MV_E", label: "MV E (m/s)" },
    { key: "MV_A", label: "MV A (m/s)" },
    { key: "MV_E_A", label: "MV E/A" },
    { key: "Vmax_Ao", label: "Vmax Ao (m/s)" },
    { key: "Vmax_Pulm", label: "Vmax Pulm (m/s)" },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarLaudo();
  }, [router, params.id]);

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
      setStatus(laudoData.status || "Rascunho");
      
      // Carregar paciente
      if (laudoData.paciente_id) {
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
          });
        } catch (e) {
          console.error("Erro ao carregar paciente:", e);
        }
      }
      
      // Extrair medidas e qualitativa da descrição
      if (laudoData.descricao) {
        const descricao = laudoData.descricao;
        
        // Extrair medidas
        const medidasExtraidas: Record<string, string> = {};
        const regexMedidas = /-\s*(\w+):\s*([\d.]+)/g;
        let match;
        while ((match = regexMedidas.exec(descricao)) !== null) {
          medidasExtraidas[match[1]] = match[2];
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
        const pacientePayload = {
          nome: pacienteForm.nome,
          especie: pacienteForm.especie,
          raca: pacienteForm.raca,
          sexo: pacienteForm.sexo,
          peso_kg: pacienteForm.peso ? parseFloat(pacienteForm.peso) : null,
          idade: pacienteForm.idade,
          tutor: pacienteForm.tutor,
          telefone: pacienteForm.telefone,
        };
        await api.put(`/pacientes/${paciente.id}`, pacientePayload);
      }

      // 2. Montar descrição do laudo com medidas
      let descricao = "## Medidas Ecocardiográficas\n";
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
      
      // 3. Salvar laudo
      const payload = {
        titulo: titulo || `Laudo de Ecocardiograma - ${pacienteForm.nome || 'Paciente'}`,
        descricao,
        diagnostico,
        observacoes,
        status,
      };
      
      await api.put(`/laudos/${params.id}`, payload);
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
              <p className="text-gray-500">{paciente?.nome || 'Paciente'}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Informações do Laudo
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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

            {/* Medidas */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                Medidas Ecocardiográficas
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {parametrosMedidas.map((param) => (
                  <div key={param.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {param.label}
                    </label>
                    <input
                      type="text"
                      value={medidas[param.key] || ""}
                      onChange={(e) => handleMedidaChange(param.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="--"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Avaliação Qualitativa */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-600" />
                Avaliação Qualitativa
              </h2>
              
              <div className="space-y-4">
                {[
                  { key: "valvas", label: "Válvulas" },
                  { key: "camaras", label: "Câmaras" },
                  { key: "funcao", label: "Função" },
                  { key: "pericardio", label: "Pericárdio" },
                  { key: "vasos", label: "Vasos" },
                  { key: "ad_vd", label: "AD/VD" },
                ].map((campo) => (
                  <div key={campo.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {campo.label}
                    </label>
                    <textarea
                      value={qualitativa[campo.key as keyof typeof qualitativa]}
                      onChange={(e) => handleQualitativaChange(campo.key, e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder={`Descreva ${campo.label.toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Conclusão */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Conclusão</h2>
              <textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Digite a conclusão do laudo..."
              />
            </div>

            {/* Observações */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Observações</h2>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Observações adicionais..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Dados do Paciente - Editável */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" />
                Dados do Paciente
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Paciente *
                  </label>
                  <input
                    type="text"
                    value={pacienteForm.nome}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Nome do animal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Espécie
                    </label>
                    <select
                      value={pacienteForm.especie}
                      onChange={(e) => setPacienteForm({ ...pacienteForm, especie: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="Canina">Canina</option>
                      <option value="Felina">Felina</option>
                      <option value="Outra">Outra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sexo
                    </label>
                    <select
                      value={pacienteForm.sexo}
                      onChange={(e) => setPacienteForm({ ...pacienteForm, sexo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="Macho">Macho</option>
                      <option value="Fêmea">Fêmea</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Raça
                  </label>
                  <input
                    type="text"
                    value={pacienteForm.raca}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, raca: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex: SRD, Labrador, etc"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={pacienteForm.peso}
                      onChange={(e) => setPacienteForm({ ...pacienteForm, peso: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Idade
                    </label>
                    <input
                      type="text"
                      value={pacienteForm.idade}
                      onChange={(e) => setPacienteForm({ ...pacienteForm, idade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Ex: 5 anos"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tutor
                  </label>
                  <input
                    type="text"
                    value={pacienteForm.tutor}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, tutor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Nome do tutor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={pacienteForm.telefone}
                    onChange={(e) => setPacienteForm({ ...pacienteForm, telefone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Ações</h2>
              
              <div className="space-y-3">
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar Alterações"}
                </button>
                
                <button
                  onClick={() => router.push(`/laudos/${params.id}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
