"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { Users, Search, Plus, Dog, Cat, User } from "lucide-react";

interface Paciente {
  id: number;
  nome: string;
  tutor: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  peso_kg?: number;
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarPacientes();
  }, [router]);

  const carregarPacientes = async () => {
    try {
      const response = await api.get("/pacientes");
      setPacientes(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const pacientesFiltrados = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.tutor?.toLowerCase().includes(busca.toLowerCase())
  );

  const getEspecieIcon = (especie?: string) => {
    if (especie?.toLowerCase().includes("gato")) return <Cat className="w-5 h-5 text-orange-500" />;
    if (especie?.toLowerCase().includes("cachorro")) return <Dog className="w-5 h-5 text-blue-500" />;
    return <User className="w-5 h-5 text-gray-400" />;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-gray-500">Gerencie os pacientes cadastrados</p>
          </div>
          <button 
            onClick={() => router.push("/pacientes/novo")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Paciente
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pacientes.length}</p>
              <p className="text-sm text-gray-500">Total de pacientes</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou tutor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhum paciente encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {pacientesFiltrados.map((paciente) => (
                <div key={paciente.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {getEspecieIcon(paciente.especie)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{paciente.nome}</h3>
                    <p className="text-sm text-gray-500">Tutor: {paciente.tutor || "Não informado"}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {paciente.especie && <p>{paciente.especie}</p>}
                    {paciente.raca && <p className="text-gray-400">{paciente.raca}</p>}
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
