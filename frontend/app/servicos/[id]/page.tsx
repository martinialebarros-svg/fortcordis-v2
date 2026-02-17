"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { Save, ArrowLeft, Wrench, Trash2, AlertTriangle } from "lucide-react";

export default function EditarServicoPage() {
  const router = useRouter();
  const params = useParams();
  const servicoId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [servico, setServico] = useState({
    nome: "",
    descricao: "",
    preco: "",
    duracao_minutos: "30",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarServico();
  }, [router, servicoId]);

  const carregarServico = async () => {
    try {
      const response = await api.get(`/servicos/${servicoId}`);
      const data = response.data;
      setServico({
        nome: data.nome || "",
        descricao: data.descricao || "",
        preco: data.preco?.toString() || "",
        duracao_minutos: data.duracao_minutos?.toString() || "30",
      });
    } catch (error) {
      console.error("Erro ao carregar servico:", error);
      alert("Erro ao carregar dados do servico");
      router.push("/servicos");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const payload = {
        ...servico,
        preco: servico.preco ? parseFloat(servico.preco) : 0,
        duracao_minutos: servico.duracao_minutos ? parseInt(servico.duracao_minutos) : 30,
      };
      
      await api.put(`/servicos/${servicoId}`, payload);
      alert("Servico atualizado com sucesso!");
      router.push("/servicos");
    } catch (error) {
      console.error("Erro ao salvar servico:", error);
      alert("Erro ao atualizar servico");
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    try {
      await api.delete(`/servicos/${servicoId}`);
      alert("Servico excluido com sucesso!");
      router.push("/servicos");
    } catch (error) {
      console.error("Erro ao excluir servico:", error);
      alert("Erro ao excluir servico");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/servicos")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Editar Servico</h1>
              <p className="text-gray-500">Atualize os dados do servico</p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Servico *
              </label>
              <input
                type="text"
                value={servico.nome}
                onChange={(e) => setServico({...servico, nome: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Ex: Consulta Cardiologica"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descricao
              </label>
              <textarea
                value={servico.descricao}
                onChange={(e) => setServico({...servico, descricao: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Descricao do servico..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preco (R$)
              </label>
              <input
                type="text"
                value={servico.preco}
                onChange={(e) => setServico({...servico, preco: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="0,00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duracao (minutos)
              </label>
              <input
                type="number"
                value={servico.duracao_minutos}
                onChange={(e) => setServico({...servico, duracao_minutos: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="30"
                min="1"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button
              onClick={() => router.push("/servicos")}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving || !servico.nome}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar Alteracoes"}
            </button>
          </div>
        </div>

        {/* Modal de Confirmacao de Exclusao */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirmar Exclusao</h3>
                  <p className="text-sm text-gray-500">
                    Tem certeza que deseja excluir este servico? Esta acao nao pode ser desfeita.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExcluir}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
