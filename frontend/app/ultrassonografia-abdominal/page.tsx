"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  getLaudoEditPath,
  getLaudoViewPath,
  TIPO_LAUDO_ULTRASSOM_ABDOMINAL,
} from "@/lib/laudos";
import { Calendar, Download, Eye, Edit, Plus, Search, Trash2 } from "lucide-react";

interface LaudoLista {
  id: number;
  paciente_nome?: string;
  paciente_tutor?: string;
  clinica?: string;
  tipo: string;
  status: string;
  data_laudo: string;
  data_exame?: string;
}

function getStatusColor(status: string) {
  const cores: Record<string, string> = {
    Rascunho: "bg-gray-100 text-gray-800",
    Finalizado: "bg-green-100 text-green-800",
    Arquivado: "bg-blue-100 text-blue-800",
  };
  return cores[status] || "bg-gray-100 text-gray-800";
}

export default function UltrassonografiaAbdominalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [laudos, setLaudos] = useState<LaudoLista[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarLaudos();
  }, [router]);

  const carregarLaudos = async () => {
    try {
      setLoading(true);
      const response = await api.get("/laudos", {
        params: { tipo: TIPO_LAUDO_ULTRASSOM_ABDOMINAL },
      });
      setLaudos(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar laudos:", error);
      setLaudos([]);
    } finally {
      setLoading(false);
    }
  };

  const laudosFiltrados = laudos.filter((laudo) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) {
      return true;
    }
    return (
      (laudo.paciente_nome || "").toLowerCase().includes(termo) ||
      (laudo.paciente_tutor || "").toLowerCase().includes(termo) ||
      (laudo.clinica || "").toLowerCase().includes(termo) ||
      (laudo.status || "").toLowerCase().includes(termo)
    );
  });

  const downloadPDF = async (laudoId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/laudos/${laudoId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("Erro ao gerar PDF.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ultrassonografia_abdominal_${laudoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
      alert("Nao foi possivel baixar o PDF.");
    }
  };

  const excluirLaudo = async (laudoId: number) => {
    if (!confirm("Deseja excluir este laudo?")) {
      return;
    }
    try {
      await api.delete(`/laudos/${laudoId}`);
      setLaudos((prev) => prev.filter((laudo) => laudo.id !== laudoId));
    } catch (error) {
      console.error("Erro ao excluir laudo:", error);
      alert("Nao foi possivel excluir o laudo.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ultrassonografia Abdominal</h1>
            <p className="text-gray-500">Cadastre, visualize e baixe laudos ultrassonograficos.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/ultrassonografia-abdominal/novo")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Novo laudo
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Buscar por paciente, tutor, clinica ou status"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Carregando laudos...</div>
          ) : laudosFiltrados.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Nenhum laudo de ultrassonografia abdominal encontrado.</div>
          ) : (
            <div className="divide-y">
              {laudosFiltrados.map((laudo) => (
                <div key={laudo.id} className="p-4 hover:bg-gray-50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <h2 className="font-semibold text-gray-900">{laudo.paciente_nome || `Paciente #${laudo.id}`}</h2>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span>{laudo.paciente_tutor || "Sem tutor"}</span>
                        {laudo.clinica && <span>{laudo.clinica}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(laudo.data_exame || laudo.data_laudo).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(laudo.status)}`}>
                        {laudo.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => router.push(getLaudoViewPath(laudo.id, laudo.tipo))}
                        className="p-2 rounded-lg text-gray-600 hover:bg-teal-50 hover:text-teal-700"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(getLaudoEditPath(laudo.id, laudo.tipo))}
                        className="p-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadPDF(laudo.id)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700"
                        title="Baixar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirLaudo(laudo.id)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-red-100 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
