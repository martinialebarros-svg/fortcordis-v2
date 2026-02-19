"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../../layout-dashboard";
import api from "@/lib/axios";
import ImageUploader from "../../components/ImageUploader";
import { ArrowLeft, Save, FileText, User, Activity, Heart } from "lucide-react";

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
  
  // Clínica
  const [clinicaId, setClinicaId] = useState<string>("");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [medicoSolicitante, setMedicoSolicitante] = useState("");
  
  // Imagens
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [imagensTemp, setImagensTemp] = useState<any[]>([]);
  const [sessionId] = useState<string>(() => Math.random().toString(36).substring(2, 15));

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
    carregarClinicas();
  }, [router, params.id]);
  
  const carregarClinicas = async () => {
    try {
      const response = await api.get("/clinicas");
      setClinicas(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    }
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
      setStatus(laudoData.status || "Rascunho");
      
      // Preencher clínica
      if (laudoData.clinic_id) {
        setClinicaId(laudoData.clinic_id.toString());
      }
      setMedicoSolicitante(laudoData.medico_solicitante || "");
      
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
        // Montar observações com idade
        let observacoesPaciente = "";
        if (pacienteForm.idade) {
          observacoesPaciente += `Idade: ${pacienteForm.idade}\n`;
        }
        
        const pacientePayload = {
          nome: pacienteForm.nome,
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
              // Atualizar paciente com o novo tutor_id
              await api.put(`/pacientes/${paciente.id}`, { tutor_id: respTutor.data.id });
            }
          } catch (e) {
            console.error("Erro ao salvar tutor:", e);
          }
        }
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
      const payload: any = {
        titulo: titulo || `Laudo de Ecocardiograma - ${pacienteForm.nome || 'Paciente'}`,
        descricao,
        diagnostico,
        observacoes,
        status,
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

            {/* Clínica */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Clínica
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clínica
                  </label>
                  <select
                    value={clinicaId}
                    onChange={(e) => setClinicaId(e.target.value)}
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
                    Médico Solicitante
                  </label>
                  <input
                    type="text"
                    value={medicoSolicitante}
                    onChange={(e) => setMedicoSolicitante(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Nome do veterinário solicitante"
                  />
                </div>
              </div>
            </div>

            {/* Imagens */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Imagens do Exame
              </h2>
              
              {imagens.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma imagem cadastrada.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
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
                        ×
                      </button>
                      <p className="text-xs text-gray-600 p-2 truncate">{img.nome}</p>
                    </div>
                  ))}
                </div>
              )}
              
              
              {/* Adicionar novas imagens */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Adicionar Novas Imagens</h3>
                <ImageUploader 
                  onImagensChange={setImagensTemp}
                  sessionId={sessionId}
                />
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
