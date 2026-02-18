"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { FileText, Plus, Search, FileCheck, Clock, User, Calendar, Download, Eye, Pencil, Trash2 } from "lucide-react";

interface Laudo {
  id: number;
  paciente_id: number;
  paciente_nome?: string;
  tipo: string;
  titulo: string;
  status: string;
  data_laudo: string;
  veterinario_id: number;
}

interface Exame {
  id: number;
  paciente_id: number;
  tipo_exame: string;
  status: string;
  valor: number;
  data_solicitacao: string;
}

export default function LaudosPage() {
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [exames, setExames] = useState<Exame[]>([]);
  const [tab, setTab] = useState<"laudos" | "exames">("laudos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarDados();
  }, [router]);

  const carregarDados = async () => {
    try {
      const [respLaudos, respExames] = await Promise.all([
        api.get("/laudos"),
        api.get("/exames"),
      ]);
      setLaudos(respLaudos.data.items || []);
      setExames(respExames.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (laudoId: number, titulo: string) => {
    try {
      const response = await api.get(`/laudos/${laudoId}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${titulo.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const deletarLaudo = async (laudoId: number) => {
    if (!confirm('Tem certeza que deseja excluir este laudo? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      await api.delete(`/laudos/${laudoId}`);
      setLaudos(laudos.filter(l => l.id !== laudoId));
      alert('Laudo excluído com sucesso!');
    } catch (error) {
      alert('Erro ao excluir laudo. Tente novamente.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Rascunho': 'bg-gray-100 text-gray-800',
      'Finalizado': 'bg-green-100 text-green-800',
      'Arquivado': 'bg-blue-100 text-blue-800',
      'Solicitado': 'bg-yellow-100 text-yellow-800',
      'Em andamento': 'bg-blue-100 text-blue-800',
      'Concluido': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Laudos e Exames</h1>
            <p className="text-gray-500">Gerencie laudos médicos e exames</p>
          </div>
          <button onClick={() => router.push("/laudos/novo")} className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" />
            Novo Laudo
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("laudos")}
            className={`px-4 py-2 rounded-lg font-medium ${
              tab === "laudos"
                ? "bg-teal-100 text-teal-700"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Laudos ({laudos.length})
          </button>
          <button
            onClick={() => setTab("exames")}
            className={`px-4 py-2 rounded-lg font-medium ${
              tab === "exames"
                ? "bg-teal-100 text-teal-700"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FileCheck className="w-4 h-4 inline mr-2" />
            Exames ({exames.length})
          </button>
        </div>

        {/* Busca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : tab === "laudos" ? (
            laudos.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum laudo encontrado</p>
              </div>
            ) : (
              <div className="divide-y">
                {laudos.map((laudo) => (
                  <div key={laudo.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{laudo.titulo}</h3>
                        <div className="flex gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Paciente #{laudo.paciente_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(laudo.data_laudo).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(laudo.status)}`}>
                          {laudo.status}
                        </span>
                        <button
                          onClick={() => router.push(`/laudos/${laudo.id}`)}
                          className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/laudos/${laudo.id}/editar`)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadPDF(laudo.id, laudo.titulo)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Baixar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletarLaudo(laudo.id)}
                          className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            exames.length === 0 ? (
              <div className="p-12 text-center">
                <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum exame encontrado</p>
              </div>
            ) : (
              <div className="divide-y">
                {exames.map((exame) => (
                  <div key={exame.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{exame.tipo_exame}</h3>
                        <div className="flex gap-4 text-sm text-gray-500 mt-1">
                          <span>Paciente #{exame.paciente_id}</span>
                          <span>R$ {exame.valor?.toFixed(2)}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(exame.status)}`}>
                        {exame.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
