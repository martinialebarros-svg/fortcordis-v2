"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { Building2, Search, Plus, MapPin, Phone } from "lucide-react";

interface Clinica {
  id: number;
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

export default function ClinicasPage() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarClinicas();
  }, [router]);

  const carregarClinicas = async () => {
    try {
      const response = await api.get("/clinicas");
      setClinicas(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    } finally {
      setLoading(false);
    }
  };

  const clinicasFiltradas = clinicas.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clínicas</h1>
            <p className="text-gray-500">Gerencie as clínicas parceiras</p>
          </div>
          <button 
            onClick={() => router.push("/clinicas/novo")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Clínica
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{clinicas.length}</p>
              <p className="text-sm text-gray-500">Clínicas parceiras</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar clínica..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : clinicasFiltradas.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhuma clínica encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {clinicasFiltradas.map((clinica) => (
                <div key={clinica.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{clinica.nome}</h3>
                      {clinica.endereco && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {clinica.endereco}
                        </p>
                      )}
                      {clinica.telefone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {clinica.telefone}
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
