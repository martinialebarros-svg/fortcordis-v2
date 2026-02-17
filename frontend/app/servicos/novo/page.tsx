"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { Save, ArrowLeft, Wrench } from "lucide-react";

export default function NovoServicoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    }
  }, [router]);

  const handleSalvar = async () => {
    setLoading(true);
    try {
      const payload = {
        ...servico,
        preco: servico.preco ? parseFloat(servico.preco) : 0,
        duracao_minutos: servico.duracao_minutos ? parseInt(servico.duracao_minutos) : 30,
      };
      
      await api.post("/servicos", payload);
      alert("Servico cadastrado com sucesso!");
      router.push("/servicos");
    } catch (error) {
      console.error("Erro ao salvar servico:", error);
      alert("Erro ao cadastrar servico");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/servicos")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Novo Servico</h1>
            <p className="text-gray-500">Cadastre um novo servico</p>
          </div>
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
              disabled={loading || !servico.nome}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar Servico"}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
