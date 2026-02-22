"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { 
  Calendar, Clock, User, Building, Plus, RefreshCw, X, Trash2,
  CheckCircle2, PlayCircle, CheckCircle, XCircle, AlertCircle,
  Search, ChevronLeft, ChevronRight, Sun, Moon, FileText
} from "lucide-react";
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
  data: string;
  hora: string;
}

type StatusType = "Agendado" | "Confirmado" | "Em atendimento" | "Realizado" | "Cancelado" | "Faltou";

const STATUS_LIST: StatusType[] = ["Agendado", "Confirmado", "Em atendimento", "Realizado", "Cancelado", "Faltou"];

const hojeLocal = () => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

export default function AgendaPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroData, setFiltroData] = useState<string>(hojeLocal());
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [confirmando, setConfirmando] = useState<{ id: number; acao: string } | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState<number | null>(null);
  const [modalTipoHorario, setModalTipoHorario] = useState<{ id: number; status: StatusType } | null>(null);
  const [tipoHorario, setTipoHorario] = useState<"comercial" | "plantao">("comercial");
  const [osGerada, setOsGerada] = useState<{ numero_os: string; valor_final: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarAgendamentos();
  }, [router, filtroData]);

  const carregarAgendamentos = async () => {
    setLoading(true);
    try {
      let url = "/agenda";
      if (filtroData) {
        url += `?data_inicio=${filtroData}T00:00:00&data_fim=${filtroData}T23:59:59`;
      }
      const response = await api.get(url);
      setAgendamentos(response.data.items || []);
      setErro("");
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      if (error.response?.status === 401) {
        setErro("Sessão expirada. Redirecionando...");
        localStorage.removeItem("token");
        setTimeout(() => router.push("/"), 2000);
      } else {
        setErro("Erro ao carregar agendamentos");
      }
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatus = async (id: number, novoStatus: StatusType, tipoHorarioParam?: "comercial" | "plantao") => {
    // Se for Realizado, abre o modal de seleção de tipo de horário
    if (novoStatus === "Realizado" && !tipoHorarioParam) {
      setModalTipoHorario({ id, status: novoStatus });
      return;
    }

    setAtualizandoStatus(id);
    try {
      const params = new URLSearchParams();
      params.append("status", novoStatus);
      if (tipoHorarioParam) {
        params.append("tipo_horario", tipoHorarioParam);
      }
      
      const response = await api.patch(`/agenda/${id}/status?${params.toString()}`);
      await carregarAgendamentos();
      
      // Se gerou OS, mostra o modal
      if (response.data?.os_gerada) {
        setOsGerada(response.data.os_gerada);
      }
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      setErro("Erro ao atualizar status: " + (error.response?.data?.detail || error.message));
    } finally {
      setAtualizandoStatus(null);
    }
  };

  const confirmarRealizado = async () => {
    if (!modalTipoHorario) return;
    await atualizarStatus(modalTipoHorario.id, modalTipoHorario.status, tipoHorario);
    setModalTipoHorario(null);
  };

  const cancelarAgendamento = async (id: number) => {
    try {
      await api.patch(`/agenda/${id}/status?status=Cancelado`);
      setConfirmando(null);
      await carregarAgendamentos();
    } catch (error: any) {
      console.error("Erro ao cancelar:", error);
      setErro("Erro ao cancelar agendamento");
    }
  };

  const excluirAgendamento = async (id: number) => {
    try {
      await api.delete(`/agenda/${id}`);
      setConfirmando(null);
      await carregarAgendamentos();
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
      'Agendado': 'bg-blue-100 text-blue-800 border-blue-200',
      'Confirmado': 'bg-green-100 text-green-800 border-green-200',
      'Em atendimento': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Realizado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Cancelado': 'bg-red-100 text-red-800 border-red-200',
      'Faltou': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      'Agendado': Calendar,
      'Confirmado': CheckCircle2,
      'Em atendimento': PlayCircle,
      'Realizado': CheckCircle,
      'Cancelado': XCircle,
      'Faltou': AlertCircle,
    };
    return icons[status] || Calendar;
  };

  const getProximosStatus = (statusAtual: string): StatusType[] => {
    const fluxos: Record<string, StatusType[]> = {
      'Agendado': ['Confirmado', 'Cancelado', 'Faltou'],
      'Confirmado': ['Em atendimento', 'Cancelado', 'Faltou'],
      'Em atendimento': ['Realizado', 'Cancelado'],
      'Realizado': [],
      'Cancelado': ['Agendado'],
      'Faltou': ['Agendado'],
    };
    return fluxos[statusAtual] || [];
  };

  const agendamentosFiltrados = agendamentos.filter(a => {
    const matchStatus = filtroStatus === "todos" || a.status === filtroStatus;
    const termo = busca.toLowerCase();
    const matchBusca = !busca || 
      (a.paciente?.toLowerCase().includes(termo)) ||
      (a.tutor?.toLowerCase().includes(termo)) ||
      (a.servico?.toLowerCase().includes(termo));
    return matchStatus && matchBusca;
  });

  const stats = {
    total: agendamentos.length,
    agendado: agendamentos.filter(a => a.status === 'Agendado').length,
    confirmado: agendamentos.filter(a => a.status === 'Confirmado').length,
    emAtendimento: agendamentos.filter(a => a.status === 'Em atendimento').length,
    realizado: agendamentos.filter(a => a.status === 'Realizado').length,
    cancelado: agendamentos.filter(a => a.status === 'Cancelado').length,
  };

  const formatarDataHora = (dataIso: string) => {
    if (!dataIso) return "-";
    const normalizado = dataIso.includes("T") ? dataIso : dataIso.replace(" ", "T");
    const data = new Date(normalizado);
    if (Number.isNaN(data.getTime())) {
      return dataIso;
    }
    return data.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const navegarData = (dias: number) => {
    const data = new Date(filtroData);
    data.setDate(data.getDate() + dias);
    setFiltroData(data.toISOString().split('T')[0]);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-500">Gerencie os agendamentos</p>
          </div>
          <button
            onClick={() => {
              setAgendamentoEditando(null);
              setModalAberto(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{stats.agendado}</div>
            <div className="text-xs text-gray-500">Agendados</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-green-600">{stats.confirmado}</div>
            <div className="text-xs text-gray-500">Confirmados</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-yellow-600">{stats.emAtendimento}</div>
            <div className="text-xs text-gray-500">Em Atend.</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-emerald-600">{stats.realizado}</div>
            <div className="text-xs text-gray-500">Realizados</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-red-600">{stats.cancelado}</div>
            <div className="text-xs text-gray-500">Cancelados</div>
          </div>
        </div>

        {/* Filtros */}
        {erro && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex justify-between items-center">
            <span>{erro}</span>
            <button onClick={() => setErro("")} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Navegação de data */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navegarData(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onClick={() => navegarData(1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar paciente, tutor ou serviço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro status */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os status</option>
              {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={carregarAgendamentos}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* Chips de status */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {STATUS_LIST.map((status) => {
              const count = agendamentos.filter(a => a.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setFiltroStatus(filtroStatus === status ? "todos" : status)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                    filtroStatus === status
                      ? getStatusColor(status)
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {status} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Agendamentos */}
        <div className="bg-white shadow rounded-lg overflow-hidden border">
          {agendamentosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {busca ? "Nenhum agendamento encontrado para a busca" : "Nenhum agendamento para esta data"}
              </p>
              <button
                onClick={() => { setAgendamentoEditando(null); setModalAberto(true); }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Agendamento
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {agendamentosFiltrados.map((ag) => {
                const StatusIcon = getStatusIcon(ag.status);
                const proximosStatus = getProximosStatus(ag.status);
                
                return (
                  <div key={ag.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                      {/* Info Principal */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {ag.paciente || "Paciente não informado"}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(ag.status)}`}>
                            <StatusIcon className="w-3 h-3" />
                            {ag.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{ag.tutor || "Tutor não informado"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-gray-400" />
                            <span>{ag.clinica || "Clínica não informada"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{formatarDataHora(ag.inicio)}</span>
                          </div>
                          {ag.servico && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">{ag.servico}</span>
                            </div>
                          )}
                        </div>
                        
                        {ag.observacoes && (
                          <div className="mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                            <span className="font-medium">Obs:</span> {ag.observacoes}
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {/* Botões de mudança de status */}
                        {proximosStatus.map((novoStatus) => {
                          const icons: Record<string, any> = {
                            'Confirmado': CheckCircle2,
                            'Em atendimento': PlayCircle,
                            'Realizado': CheckCircle,
                            'Cancelado': XCircle,
                            'Faltou': AlertCircle,
                            'Agendado': Calendar,
                          };
                          const Icon = icons[novoStatus] || CheckCircle2;
                          const colors: Record<string, string> = {
                            'Confirmado': 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
                            'Em atendimento': 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200',
                            'Realizado': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
                            'Cancelado': 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
                            'Faltou': 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
                            'Agendado': 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
                          };
                          
                          return (
                            <button
                              key={novoStatus}
                              onClick={() => atualizarStatus(ag.id, novoStatus)}
                              disabled={atualizandoStatus === ag.id}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${colors[novoStatus]}`}
                            >
                              {atualizandoStatus === ag.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Icon className="w-3.5 h-3.5" />
                              )}
                              {novoStatus}
                            </button>
                          );
                        })}

                        {/* Separador */}
                        {proximosStatus.length > 0 && <div className="w-px h-8 bg-gray-300 mx-1" />}

                        {/* Editar */}
                        <button
                          onClick={() => { setAgendamentoEditando(ag); setModalAberto(true); }}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Editar
                        </button>

                        {/* Excluir */}
                        <button
                          onClick={() => setConfirmando({ id: ag.id, acao: "excluir" })}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de Confirmação */}
        {confirmando && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {confirmando.acao === "excluir" ? "Excluir Agendamento" : "Confirmar Ação"}
              </h3>
              <p className="text-gray-600 mb-6">
                {confirmando.acao === "excluir"
                  ? "Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."
                  : "Tem certeza que deseja realizar esta ação?"}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmando(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (confirmando.acao === "excluir") {
                      excluirAgendamento(confirmando.id);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Seleção de Tipo de Horário */}
        {modalTipoHorario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Selecionar Tipo de Horário
              </h3>
              <p className="text-gray-600 mb-6">
                Este atendimento foi realizado em qual tipo de horário? Isso afetará o valor calculado na Ordem de Serviço.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setTipoHorario("comercial")}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    tipoHorario === "comercial" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <Sun className="w-8 h-8 text-amber-500" />
                  <span className="font-medium text-gray-900">Comercial</span>
                  <span className="text-xs text-gray-500">Seg-Sex 8h-18h</span>
                </button>
                
                <button
                  onClick={() => setTipoHorario("plantao")}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    tipoHorario === "plantao" 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <Moon className="w-8 h-8 text-indigo-500" />
                  <span className="font-medium text-gray-900">Plantão</span>
                  <span className="text-xs text-gray-500">Fora do horário</span>
                </button>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setModalTipoHorario(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRealizado}
                  disabled={atualizandoStatus !== null}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                  {atualizandoStatus === modalTipoHorario.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Confirmar Realizado
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de OS Gerada */}
        {osGerada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Ordem de Serviço Gerada!
                  </h3>
                  <p className="text-sm text-gray-500">Nº {osGerada.numero_os}</p>
                </div>
              </div>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-emerald-800">
                  <span className="font-medium">Valor Final:</span>{" "}
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(osGerada.valor_final)}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  Baseado na tabela de preços da clínica e tipo de horário selecionado.
                </p>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setOsGerada(null)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Entendido
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
    </DashboardLayout>
  );
}
