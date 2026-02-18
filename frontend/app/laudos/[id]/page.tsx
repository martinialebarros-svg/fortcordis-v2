"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { ArrowLeft, FileText, Download, Edit, Printer } from "lucide-react";

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
  peso_kg: number;
}

export default function VisualizarLaudoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [medidas, setMedidas] = useState<Record<string, string>>({});
  const [qualitativa, setQualitativa] = useState<Record<string, string>>({});

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
      setLaudo(respLaudo.data);
      
      // Carregar paciente
      if (respLaudo.data.paciente_id) {
        try {
          const respPaciente = await api.get(`/pacientes/${respLaudo.data.paciente_id}`);
          setPaciente(respPaciente.data);
        } catch (e) {
          console.error("Erro ao carregar paciente:", e);
        }
      }
      
      // Extrair medidas e qualitativa da descrição
      if (respLaudo.data.descricao) {
        const descricao = respLaudo.data.descricao;
        
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
        setQualitativa(qualitativaExtraida);
      }
    } catch (error) {
      console.error("Erro ao carregar laudo:", error);
      alert("Erro ao carregar laudo.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const response = await api.get(`/laudos/${params.id}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laudo_${params.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao baixar PDF.');
    }
  };

  const imprimir = () => {
    window.print();
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
      <div className="p-6 max-w-5xl mx-auto">
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
              <h1 className="text-2xl font-bold text-gray-900">Visualizar Laudo</h1>
              <p className="text-gray-500">{laudo.titulo}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={imprimir}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Conteúdo do Laudo */}
        <div className="bg-white rounded-lg shadow-sm border p-8 print:shadow-none print:border-none">
          {/* Cabeçalho do Laudo */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">LAUDO ECOCARDIOGRÁFICO</h2>
            <div className="w-full h-px bg-gray-300 mt-4"></div>
          </div>

          {/* Dados do Paciente */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados do Paciente</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nome:</span>
                <p className="font-medium">{paciente?.nome || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Espécie:</span>
                <p className="font-medium">{paciente?.especie || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Raça:</span>
                <p className="font-medium">{paciente?.raca || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Sexo:</span>
                <p className="font-medium">{paciente?.sexo || "N/A"}</p>
              </div>
              {paciente?.peso_kg && (
                <div>
                  <span className="text-gray-500">Peso:</span>
                  <p className="font-medium">{paciente.peso_kg} kg</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Data:</span>
                <p className="font-medium">
                  {new Date(laudo.data_laudo).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mb-6">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              laudo.status === 'Finalizado' 
                ? 'bg-green-100 text-green-800'
                : laudo.status === 'Rascunho'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {laudo.status}
            </span>
          </div>

          {/* Medidas */}
          {Object.keys(medidas).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Medidas Ecocardiográficas</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-700">Parâmetro</th>
                      <th className="text-left py-2 font-medium text-gray-700">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(medidas).map(([chave, valor]) => (
                      <tr key={chave} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 text-gray-600">{chave}</td>
                        <td className="py-2 font-medium">{valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Qualitativa */}
          {Object.keys(qualitativa).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Avaliação Qualitativa</h3>
              <div className="space-y-3">
                {Object.entries(qualitativa).map(([chave, valor]) => (
                  <div key={chave} className="bg-gray-50 rounded-lg p-3">
                    <span className="font-medium text-gray-700 capitalize">{chave}:</span>
                    <p className="text-gray-600 mt-1">{valor}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusão */}
          {laudo.diagnostico && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Conclusão</h3>
              <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                {laudo.diagnostico}
              </div>
            </div>
          )}

          {/* Observações */}
          {laudo.observacoes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Observações</h3>
              <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                {laudo.observacoes}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Laudo emitido por {laudo.criado_por_nome || "Médico Veterinário"}</p>
            <p className="mt-1">
              Documento gerado eletronicamente em{' '}
              {new Date(laudo.data_laudo).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
