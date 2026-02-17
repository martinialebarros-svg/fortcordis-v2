"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Calendar, Clock, User, Building, Plus, RefreshCw, X, Trash2 } from "lucide-react";
import NovoAgendamentoModal from "./NovoAgendamentoModal";

interface Agendamento {
  id: number;
  paciente: string | null;
  tutor: string | null;
  clinica: string | null;
  servico: string | null;
  inicio: string;
  fim: string | null;
  status: string;
  observacoes: string | null;
  telefone: string | null;
}

export default function AgendaPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [confirmando, setConfirmando] = useState<{ id: number; acao: "cancelar" | "excluir" } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarAgendamentos();
  }, [router]);

  const carregarAgendamentos = async () => {
    try {
      const response = await api.get("/agenda/");
      setAgendamentos(response.data.items);
      setErro("");
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      if (error.response?.status === 401) {
        setErro("Sessão expirada. Redirecionando...");
        localStorage.removeItem("token");
        setTimeout(() => router.push("/"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelarAgendamento = async (id: number) => {
    try {
      await api.patch(`/agenda/${id}/status?status=Cancelado`);
      setConfirmando(null);
      carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao cancelar:", error);
      setErro("Erro ao cancelar agendamento");
    }
  };

  const excluirAgendamento = async (id: number) => {
    try {
      await api.delete(`/agenda/${id}`);
      setConfirmando(null);
      carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      if (error.response?.status === 403) {
        setErro("Apenas administradores podem excluir agendamentos");
      } else {
        setErro("Erro ao excluir agendamento");
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Agendado': 'bg-blue-100 text-blue-800',
      'Confirmado': 'bg-green-100 text-green-800',
      'Em atendimento': 'bg-yellow-100 text-yellow-800',
      'Concluido': 'bg-gray-100 text-gray-800',
      'Cancelado': 'bg-red-100 text-red-800',
      'Faltou': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const agendamentosFiltrados = filtroStatus === "todos"
    ? agendamentos
    : agendamentos.filter(a => a.status === filtroStatus);

  if (loading) {
    return <div className="p-8">Carregando agenda...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={carregarAgendamentos}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
              <button
                onClick={() => {
                  setAgendamentoEditando(null);
                  setModalAberto(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Novo Agendamento
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {erro && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex justify-between items-center">
            <span>{erro}</span>
            <button onClick={() => setErro("")} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto">
          {['todos', 'Agendado', 'Confirmado', 'Em atendimento', 'Concluido', 'Cancelado'].map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filtroStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'todos' ? 'Todos' : status}
            </button>
          ))}
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {agendamentosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {erro ? "Erro ao carregar" : "Nenhum agendamento encontrado"}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {agendamentosFiltrados.map((ag) => (
                <div key={ag.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {ag.paciente || "Paciente não informado"}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ag.status)}`}>
                          {ag.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{ag.tutor || "Tutor não informado"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          <span>{ag.clinica || "Clínica não informada"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(ag.inicio).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      {ag.servico && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Serviço:</span> {ag.servico}
                        </div>
                      )}
                      {ag.observacoes && (
                        <div className="mt-2 text-sm text-gray-500">
                          <span className="font-medium">Obs:</span> {ag.observacoes}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => { setAgendamentoEditando(ag); setModalAberto(true); }}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      {ag.status !== "Cancelado" && (
                        <button
                          onClick={() => setConfirmando({ id: ag.id, acao: "cancelar" })}
                          className="px-3 py-1 text-sm text-orange-600 hover:text-orange-800"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmando({ id: ag.id, acao: "excluir" })}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
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
      </main>

      {/* Modal de Confirmação */}
      {confirmando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirmando.acao === "cancelar" ? "Cancelar Agendamento" : "Excluir Agendamento"}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmando.acao === "cancelar"
                ? "Tem certeza que deseja cancelar este agendamento? O status será alterado para Cancelado."
                : "Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmando(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
              >
                Não, voltar
              </button>
              <button
                onClick={() => {
                  if (confirmando.acao === "cancelar") {
                    cancelarAgendamento(confirmando.id);
                  } else {
                    excluirAgendamento(confirmando.id);
                  }
                }}
                className={`px-4 py-2 text-white rounded-lg ${
                  confirmando.acao === "cancelar"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {confirmando.acao === "cancelar" ? "Sim, cancelar" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <NovoAgendamentoModal
        isOpen={modalAberto}
        agendamento={agendamentoEditando}
        onClose={() => { setModalAberto(false); setAgendamentoEditando(null); }}
        onSuccess={carregarAgendamentos}
      />
    </div>
  );
}
