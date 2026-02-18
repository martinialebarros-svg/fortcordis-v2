"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { Save, ArrowLeft, Wrench, Trash2, AlertTriangle, MapPin, Clock, DollarSign, Sun, Moon } from "lucide-react";

interface Precos {
  fortaleza_comercial: string;
  fortaleza_plantao: string;
  rm_comercial: string;
  rm_plantao: string;
  domiciliar_comercial: string;
  domiciliar_plantao: string;
}

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
    duracao_minutos: "30",
  });
  
  const [precos, setPrecos] = useState<Precos>({
    fortaleza_comercial: "",
    fortaleza_plantao: "",
    rm_comercial: "",
    rm_plantao: "",
    domiciliar_comercial: "",
    domiciliar_plantao: "",
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
        duracao_minutos: data.duracao_minutos?.toString() || "30",
      });
      
      const p = data.precos || {};
      setPrecos({
        fortaleza_comercial: p.fortaleza_comercial?.toString() || "",
        fortaleza_plantao: p.fortaleza_plantao?.toString() || "",
        rm_comercial: p.rm_comercial?.toString() || "",
        rm_plantao: p.rm_plantao?.toString() || "",
        domiciliar_comercial: p.domiciliar_comercial?.toString() || "",
        domiciliar_plantao: p.domiciliar_plantao?.toString() || "",
      });
    } catch (error) {
      console.error("Erro ao carregar servico:", error);
      alert("Erro ao carregar dados do servico");
      router.push("/servicos");
    } finally {
      setLoading(false);
    }
  };

  const handlePrecoChange = (campo: keyof Precos, valor: string) => {
    const valorLimpo = valor.replace(/[^\d.,]/g, '');
    setPrecos({ ...precos, [campo]: valorLimpo });
  };

  const formatarValor = (valor: string) => {
    if (!valor) return "0,00";
    const num = parseFloat(valor.replace(',', '.'));
    if (isNaN(num)) return "0,00";
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSalvar = async () => {
    if (!servico.nome.trim()) {
      alert("Digite o nome do serviço");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: servico.nome,
        descricao: servico.descricao,
        duracao_minutos: servico.duracao_minutos ? parseInt(servico.duracao_minutos) : 30,
        precos: {
          fortaleza_comercial: precos.fortaleza_comercial ? parseFloat(precos.fortaleza_comercial.replace(',', '.')) : 0,
          fortaleza_plantao: precos.fortaleza_plantao ? parseFloat(precos.fortaleza_plantao.replace(',', '.')) : 0,
          rm_comercial: precos.rm_comercial ? parseFloat(precos.rm_comercial.replace(',', '.')) : 0,
          rm_plantao: precos.rm_plantao ? parseFloat(precos.rm_plantao.replace(',', '.')) : 0,
          domiciliar_comercial: precos.domiciliar_comercial ? parseFloat(precos.domiciliar_comercial.replace(',', '.')) : 0,
          domiciliar_plantao: precos.domiciliar_plantao ? parseFloat(precos.domiciliar_plantao.replace(',', '.')) : 0,
        }
      };
      
      await api.put(`/servicos/${servicoId}`, payload);
      alert("Serviço atualizado com sucesso!");
      router.push("/servicos");
    } catch (error: any) {
      console.error("Erro ao salvar servico:", error);
      alert("Erro ao atualizar serviço: " + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    try {
      await api.delete(`/servicos/${servicoId}`);
      alert("Serviço excluído com sucesso!");
      router.push("/servicos");
    } catch (error) {
      console.error("Erro ao excluir servico:", error);
      alert("Erro ao excluir serviço");
    }
  };

  const PrecoCard = ({ 
    titulo, 
    icone: Icon, 
    cor,
    campoComercial, 
    campoPlantao 
  }: { 
    titulo: string; 
    icone: any; 
    cor: string;
    campoComercial: keyof Precos; 
    campoPlantao: keyof Precos;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${cor}`}>
        <Icon className="w-5 h-5" />
        <h3 className="font-semibold">{titulo}</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Sun className="w-3 h-3 inline mr-1" />
            Horário Comercial
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
            <input
              type="text"
              value={precos[campoComercial]}
              onChange={(e) => handlePrecoChange(campoComercial, e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0,00"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Seg-Sex: 08h às 18h</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Moon className="w-3 h-3 inline mr-1" />
            Plantão
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
            <input
              type="text"
              value={precos[campoPlantao]}
              onChange={(e) => handlePrecoChange(campoPlantao, e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0,00"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Após 18h, fins de semana e feriados</p>
        </div>
      </div>
    </div>
  );

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
      <div className="p-6 max-w-6xl mx-auto">
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
              <h1 className="text-2xl font-bold text-gray-900">Editar Serviço</h1>
              <p className="text-gray-500">Atualize os dados e preços do serviço</p>
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

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-600" />
              Informações Básicas
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  value={servico.nome}
                  onChange={(e) => setServico({...servico, nome: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: Combo Eco + Eletro + PA"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={servico.descricao}
                  onChange={(e) => setServico({...servico, descricao: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Descrição detalhada do serviço..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Duração (minutos)
                </label>
                <input
                  type="number"
                  value={servico.duracao_minutos}
                  onChange={(e) => setServico({...servico, duracao_minutos: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="30"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Preços por Região */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Preços por Região e Horário
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PrecoCard
                titulo="Fortaleza"
                icone={MapPin}
                cor="text-blue-600 border-blue-200"
                campoComercial="fortaleza_comercial"
                campoPlantao="fortaleza_plantao"
              />
              
              <PrecoCard
                titulo="Região Metropolitana"
                icone={MapPin}
                cor="text-purple-600 border-purple-200"
                campoComercial="rm_comercial"
                campoPlantao="rm_plantao"
              />
              
              <PrecoCard
                titulo="Atendimento Domiciliar"
                icone={MapPin}
                cor="text-orange-600 border-orange-200"
                campoComercial="domiciliar_comercial"
                campoPlantao="domiciliar_plantao"
              />
            </div>
          </div>

          {/* Resumo dos Preços */}
          <div className="bg-gray-50 rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Resumo dos Preços</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Fortaleza Comercial:</span>
                <span className="ml-2 font-medium">{formatarValor(precos.fortaleza_comercial)}</span>
              </div>
              <div>
                <span className="text-gray-500">Fortaleza Plantão:</span>
                <span className="ml-2 font-medium">{formatarValor(precos.fortaleza_plantao)}</span>
              </div>
              <div>
                <span className="text-gray-500">RM Comercial:</span>
                <span className="ml-2 font-medium">{formatarValor(precos.rm_comercial)}</span>
              </div>
              <div>
                <span className="text-gray-500">RM Plantão:</span>
                <span className="ml-2 font-medium">{formatarValor(precos.rm_plantao)}</span>
              </div>
              <div>
                <span className="text-gray-500">Domiciliar Comercial:</span>
                <span className="ml-2 font-medium">{formatarValor(precos.domiciliar_comercial)}</span>
              </div>
              <div>
                <span className="text-gray-500">Domiciliar Plantão:</span>
                <span className="ml-2 font-medium">{formatarValor(precos.domiciliar_plantao)}</span>
              </div>
            </div>
          </div>
          
          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => router.push("/servicos")}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving || !servico.nome}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirmar Exclusão</h3>
                  <p className="text-sm text-gray-500">
                    Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.
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
