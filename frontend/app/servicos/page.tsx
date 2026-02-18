"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { Stethoscope, Search, Plus, Clock, Edit2, DollarSign, MapPin, Sun, Moon } from "lucide-react";

interface Precos {
  fortaleza_comercial: number;
  fortaleza_plantao: number;
  rm_comercial: number;
  rm_plantao: number;
  domiciliar_comercial: number;
  domiciliar_plantao: number;
}

interface Servico {
  id: number;
  nome: string;
  descricao?: string;
  duracao_minutos?: number;
  precos: Precos;
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarServicos();
  }, [router]);

  const carregarServicos = async () => {
    try {
      const response = await api.get("/servicos");
      setServicos(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    } finally {
      setLoading(false);
    }
  };

  const servicosFiltrados = servicos.filter((s) =>
    s.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const formatarValor = (valor: number) => {
    if (!valor || valor === 0) return "—";
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const temPrecoDefinido = (precos: Precos) => {
    return Object.values(precos).some(v => v && v > 0);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
            <p className="text-gray-500">Gerencie os serviços e seus preços por região</p>
          </div>
          <button 
            onClick={() => router.push("/servicos/novo")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Serviço
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{servicos.length}</p>
              <p className="text-sm text-gray-500">Serviços cadastrados</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar serviço..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : servicosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhum serviço encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {servicosFiltrados.map((servico) => (
                <div key={servico.id} className="p-4 hover:bg-gray-50 group">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0"
                      onClick={() => router.push(`/servicos/${servico.id}`)}
                    >
                      <Stethoscope className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div 
                          className="cursor-pointer"
                          onClick={() => router.push(`/servicos/${servico.id}`)}
                        >
                          <h3 className="font-medium text-gray-900">{servico.nome}</h3>
                          {servico.descricao && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{servico.descricao}</p>
                          )}
                          {servico.duracao_minutos && (
                            <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {servico.duracao_minutos} minutos
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => router.push(`/servicos/${servico.id}`)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Preços */}
                      {temPrecoDefinido(servico.precos) ? (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          {servico.precos.fortaleza_comercial > 0 && (
                            <div className="bg-blue-50 px-2 py-1.5 rounded">
                              <span className="text-blue-700 font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Fortaleza
                              </span>
                              <div className="text-blue-600 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Sun className="w-3 h-3" />
                                  {formatarValor(servico.precos.fortaleza_comercial)}
                                </span>
                                {servico.precos.fortaleza_plantao > 0 && (
                                  <span className="flex items-center gap-1 ml-4">
                                    <Moon className="w-3 h-3" />
                                    {formatarValor(servico.precos.fortaleza_plantao)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {servico.precos.rm_comercial > 0 && (
                            <div className="bg-purple-50 px-2 py-1.5 rounded">
                              <span className="text-purple-700 font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                RM
                              </span>
                              <div className="text-purple-600 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Sun className="w-3 h-3" />
                                  {formatarValor(servico.precos.rm_comercial)}
                                </span>
                                {servico.precos.rm_plantao > 0 && (
                                  <span className="flex items-center gap-1 ml-4">
                                    <Moon className="w-3 h-3" />
                                    {formatarValor(servico.precos.rm_plantao)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {servico.precos.domiciliar_comercial > 0 && (
                            <div className="bg-orange-50 px-2 py-1.5 rounded">
                              <span className="text-orange-700 font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Domiciliar
                              </span>
                              <div className="text-orange-600 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Sun className="w-3 h-3" />
                                  {formatarValor(servico.precos.domiciliar_comercial)}
                                </span>
                                {servico.precos.domiciliar_plantao > 0 && (
                                  <span className="flex items-center gap-1 ml-4">
                                    <Moon className="w-3 h-3" />
                                    {formatarValor(servico.precos.domiciliar_plantao)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-gray-400 italic">
                          Nenhum preço definido
                        </p>
                      )}
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
