"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { Save, ArrowLeft, Building2, Trash2, AlertTriangle } from "lucide-react";

export default function EditarClinicaPage() {
  const router = useRouter();
  const params = useParams();
  const clinicaId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clinica, setClinica] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarClinica();
  }, [router, clinicaId]);

  const carregarClinica = async () => {
    try {
      const response = await api.get(`/clinicas/${clinicaId}`);
      const data = response.data;
      setClinica({
        nome: data.nome || "",
        cnpj: data.cnpj || "",
        telefone: data.telefone || "",
        email: data.email || "",
        endereco: data.endereco || "",
      });
    } catch (error) {
      console.error("Erro ao carregar clinica:", error);
      alert("Erro ao carregar dados da clinica");
      router.push("/clinicas");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await api.put(`/clinicas/${clinicaId}`, clinica);
      alert("Clinica atualizada com sucesso!");
      router.push("/clinicas");
    } catch (error) {
      console.error("Erro ao salvar clinica:", error);
      alert("Erro ao atualizar clinica");
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    try {
      await api.delete(`/clinicas/${clinicaId}`);
      alert("Clinica excluida com sucesso!");
      router.push("/clinicas");
    } catch (error) {
      console.error("Erro ao excluir clinica:", error);
      alert("Erro ao excluir clinica");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
              onClick={() => router.push("/clinicas")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Editar Clinica</h1>
              <p className="text-gray-500">Atualize os dados da clinica</p>
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
                Nome da Clinica *
              </label>
              <input
                type="text"
                value={clinica.nome}
                onChange={(e) => setClinica({...clinica, nome: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: Clinica Veterinaria ABC"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ
              </label>
              <input
                type="text"
                value={clinica.cnpj}
                onChange={(e) => setClinica({...clinica, cnpj: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="00.000.000/0000-00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="text"
                value={clinica.telefone}
                onChange={(e) => setClinica({...clinica, telefone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="(00) 00000-0000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={clinica.email}
                onChange={(e) => setClinica({...clinica, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="email@clinica.com"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereco
              </label>
              <input
                type="text"
                value={clinica.endereco}
                onChange={(e) => setClinica({...clinica, endereco: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Rua, numero, complemento"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button
              onClick={() => router.push("/clinicas")}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving || !clinica.nome}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
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
                    Tem certeza que deseja excluir esta clinica? Esta acao nao pode ser desfeita.
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
