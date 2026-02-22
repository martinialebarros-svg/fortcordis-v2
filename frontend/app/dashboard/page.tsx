"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  Calendar,
  Users,
  Building2,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";

interface DashboardStats {
  totalAgendamentos: number;
  agendamentosHoje: number;
  confirmados: number;
  pendentes: number;
  totalPacientes: number;
  totalClinicas: number;
  totalServicos: number;
}

interface AgendamentoHoje {
  id: number;
  paciente: string;
  tutor: string;
  hora: string;
  status: string;
  servico: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgendamentos: 0,
    agendamentosHoje: 0,
    confirmados: 0,
    pendentes: 0,
    totalPacientes: 0,
    totalClinicas: 0,
    totalServicos: 0,
  });
  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoHoje[]>([]);
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
      // Buscar agendamentos de hoje
      const hoje = new Date().toISOString().split('T')[0];
      const respAgenda = await api.get(`/agenda?data_inicio=${hoje}T00:00:00&data_fim=${hoje}T23:59:59`);
      const agendamentos = respAgenda.data.items || [];

      // Buscar totais
      const [respPacientes, respClinicas, respServicos] = await Promise.all([
        api.get('/pacientes'),
        api.get('/clinicas'),
        api.get('/servicos'),
      ]);

      const confirmados = agendamentos.filter((a: any) => a.status === 'Confirmado').length;
      const pendentes = agendamentos.filter((a: any) => a.status === 'Agendado').length;

      setStats({
        totalAgendamentos: agendamentos.length,
        agendamentosHoje: agendamentos.length,
        confirmados,
        pendentes,
        totalPacientes: respPacientes.data.total || 0,
        totalClinicas: respClinicas.data.total || 0,
        totalServicos: respServicos.data.total || 0,
      });

      // Próximos agendamentos (ordenados por hora)
      setAgendamentosHoje(
        agendamentos
          .sort((a: any, b: any) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
          .slice(0, 5)
          .map((a: any) => ({
            id: a.id,
            paciente: a.paciente,
            tutor: a.tutor,
            hora: new Date(a.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: a.status,
            servico: a.servico,
          }))
      );
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmado': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'Cancelado': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'Agendado': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmado': return 'bg-green-50 text-green-700 border-green-200';
      case 'Cancelado': return 'bg-red-50 text-red-700 border-red-200';
      case 'Agendado': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Visão geral do sistema</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : (
          <>
            {/* Cards de estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Agendamentos Hoje</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.agendamentosHoje}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2 text-sm">
                  <span className="text-green-600 font-medium">{stats.confirmados} confirmados</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-blue-600 font-medium">{stats.pendentes} pendentes</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pacientes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPacientes}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-500">Total cadastrados</p>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Clínicas</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalClinicas}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-500">Parceiras ativas</p>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Serviços</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalServicos}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Stethoscope className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-500">Disponíveis</p>
              </div>
            </div>

            {/* Próximos agendamentos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-5 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Agendamentos de Hoje</h2>
                </div>
                <div className="divide-y">
                  {agendamentosHoje.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>Nenhum agendamento para hoje</p>
                    </div>
                  ) : (
                    agendamentosHoje.map((ag) => (
                      <div key={ag.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                        <div className="flex-shrink-0">
                          {getStatusIcon(ag.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{ag.paciente}</p>
                          <p className="text-sm text-gray-500 truncate">{ag.tutor}</p>
                          {ag.servico && (
                            <p className="text-xs text-gray-400">{ag.servico}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{ag.hora}</p>
                          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(ag.status)}`}>
                            {ag.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ações rápidas */}
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-5 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Ações Rápidas</h2>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <a
                    href="/agenda"
                    className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Calendar className="w-8 h-8 text-blue-600 mb-2" />
                    <span className="text-sm font-medium text-blue-700">Ver Agenda</span>
                  </a>
                  <a
                    href="/pacientes"
                    className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Users className="w-8 h-8 text-green-600 mb-2" />
                    <span className="text-sm font-medium text-green-700">Pacientes</span>
                  </a>
                  <a
                    href="/clinicas"
                    className="flex flex-col items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <Building2 className="w-8 h-8 text-purple-600 mb-2" />
                    <span className="text-sm font-medium text-purple-700">Clínicas</span>
                  </a>
                  <a
                    href="/servicos"
                    className="flex flex-col items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                  >
                    <Stethoscope className="w-8 h-8 text-orange-600 mb-2" />
                    <span className="text-sm font-medium text-orange-700">Serviços</span>
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
