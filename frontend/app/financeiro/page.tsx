"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import TransacaoModal from "./TransacaoModal";
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, Search, 
  Calendar, CheckCircle, XCircle, Clock, Edit, Trash2,
  Filter, Download, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  ChevronLeft, ChevronRight
} from "lucide-react";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  valor_final: number;
  desconto: number;
  status: string;
  forma_pagamento: string;
  data_transacao: string;
  data_vencimento: string;
  paciente_nome?: string;
  parcelas?: number;
  parcela_atual?: number;
}

interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
  a_receber: number;
  a_pagar: number;
  pendente_entrada: number;
  pendente_saida: number;
}

export default function FinanceiroPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    entradas: 0,
    saidas: 0,
    saldo: 0,
    a_receber: 0,
    a_pagar: 0,
    pendente_entrada: 0,
    pendente_saida: 0,
  });
  const [periodo, setPeriodo] = useState("mes");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [transacaoEditando, setTransacaoEditando] = useState<any>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarDados();
  }, [router, periodo]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [respTransacoes, respResumo] = await Promise.all([
        api.get("/financeiro/transacoes?limit=100"),
        api.get(`/financeiro/resumo?periodo=${periodo}`),
      ]);
      setTransacoes(respTransacoes.data.items || []);
      setResumo(respResumo.data);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
  };

  const formatarData = (data: string) => {
    if (!data) return "-";
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Recebido':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Pendente':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Cancelado':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Recebido':
        return 'bg-green-100 text-green-800';
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoriaNome = (categoria: string) => {
    const categorias: Record<string, string> = {
      consulta: "Consulta",
      exame: "Exame",
      cirurgia: "Cirurgia",
      medicamento: "Medicamento",
      banho_tosa: "Banho e Tosa",
      produto: "Produto",
      salario: "Salário",
      aluguel: "Aluguel",
      fornecedor: "Fornecedor",
      imposto: "Imposto",
      manutencao: "Manutenção",
      marketing: "Marketing",
      outros: "Outros",
    };
    return categorias[categoria] || categoria;
  };

  const getFormaPagamentoNome = (forma: string) => {
    const formas: Record<string, string> = {
      dinheiro: "Dinheiro",
      cartao_credito: "Cartão Crédito",
      cartao_debito: "Cartão Débito",
      pix: "PIX",
      boleto: "Boleto",
      transferencia: "Transferência",
    };
    return formas[forma] || forma;
  };

  const handleEditar = (transacao: Transacao) => {
    setTransacaoEditando(transacao);
    setModalAberto(true);
  };

  const handleNova = () => {
    setTransacaoEditando(null);
    setModalAberto(true);
  };

  const handleExcluir = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    try {
      await api.delete(`/financeiro/transacoes/${id}`);
      carregarDados();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir transação");
    }
  };

  const handlePagar = async (id: number) => {
    try {
      await api.patch(`/financeiro/transacoes/${id}/pagar`);
      carregarDados();
    } catch (error) {
      console.error("Erro ao pagar:", error);
      alert("Erro ao atualizar status");
    }
  };

  // Filtrar transações
  const transacoesFiltradas = transacoes.filter((t) => {
    const matchTipo = filtroTipo === "todos" || t.tipo === filtroTipo;
    const matchStatus = filtroStatus === "todos" || t.status === filtroStatus;
    const termo = busca.toLowerCase();
    const matchBusca = !busca || 
      t.descricao?.toLowerCase().includes(termo) ||
      t.paciente_nome?.toLowerCase().includes(termo) ||
      getCategoriaNome(t.categoria).toLowerCase().includes(termo);
    return matchTipo && matchStatus && matchBusca;
  });

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-gray-500">Controle financeiro completo</p>
          </div>
          <button 
            onClick={handleNova}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Transação
          </button>
        </div>

        {/* Período */}
        <div className="flex gap-2 mb-6">
          {['dia', 'semana', 'mes', 'ano'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                periodo === p
                  ? "bg-green-100 text-green-700"
                  : "bg-white text-gray-600 hover:bg-gray-100 border"
              }`}
            >
              {p === 'mes' ? 'Mês' : p}
            </button>
          ))}
        </div>

        {/* Cards Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Entradas</p>
                <p className="text-2xl font-bold text-green-600">{formatarValor(resumo.entradas)}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            {resumo.pendente_entrada > 0 && (
              <p className="text-xs text-yellow-600 mt-2">
                + {formatarValor(resumo.pendente_entrada)} pendente
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saídas</p>
                <p className="text-2xl font-bold text-red-600">{formatarValor(resumo.saidas)}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
            {resumo.pendente_saida > 0 && (
              <p className="text-xs text-yellow-600 mt-2">
                + {formatarValor(resumo.pendente_saida)} pendente
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saldo</p>
                <p className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatarValor(resumo.saldo)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {resumo.saldo >= 0 ? 'Positivo' : 'Negativo'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">A Receber</p>
                <p className="text-2xl font-bold text-yellow-600">{formatarValor(resumo.a_receber)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              A pagar: {formatarValor(resumo.a_pagar)}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar transação..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            {/* Filtro Tipo */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="todos">Todos os tipos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>

            {/* Filtro Status */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="todos">Todos os status</option>
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
              <option value="Recebido">Recebido</option>
              <option value="Cancelado">Cancelado</option>
            </select>

            {/* Atualizar */}
            <button
              onClick={carregarDados}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Transações */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Transações 
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({transacoesFiltradas.length})
              </span>
            </h2>
            <button
              onClick={() => alert("Exportação em desenvolvimento")}
              className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : transacoesFiltradas.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma transação encontrada</p>
              <button
                onClick={handleNova}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Criar Transação
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {transacoesFiltradas.map((t) => (
                <div key={t.id} className="p-4 hover:bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      t.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {t.tipo === 'entrada' ? (
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{t.descricao}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(t.status)}`}>
                          {getStatusIcon(t.status)}
                          <span className="ml-1">{t.status}</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {getCategoriaNome(t.categoria)}
                        </span>
                        {t.paciente_nome && <span>• {t.paciente_nome}</span>}
                        <span>• {formatarData(t.data_transacao)}</span>
                        <span>• {getFormaPagamentoNome(t.forma_pagamento)}</span>
                        {t.parcelas && t.parcelas > 1 && (
                          <span className="text-blue-600">
                            • Parcela {t.parcela_atual || 1}/{t.parcelas}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Valor e Ações */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold ${
                          t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {t.tipo === 'entrada' ? '+' : '-'}{formatarValor(t.valor_final)}
                        </p>
                        {(t.desconto || 0) > 0 && (
                          <p className="text-xs text-gray-400">
                            Desc: {formatarValor(t.desconto)}
                          </p>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex gap-1">
                        {t.status === 'Pendente' && (
                          <button
                            onClick={() => handlePagar(t.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Marcar como pago/recebido"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditar(t)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExcluir(t.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links para relatórios */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a 
            href="/financeiro/relatorios"
            className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Relatórios</p>
              <p className="text-sm text-gray-500">Análises detalhadas</p>
            </div>
          </a>
          <a 
            href="/financeiro/dashboard"
            className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Dashboard</p>
              <p className="text-sm text-gray-500">Gráficos e métricas</p>
            </div>
          </a>
          <a 
            href="/financeiro/contas"
            className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Contas</p>
              <p className="text-sm text-gray-500">A pagar / A receber</p>
            </div>
          </a>
        </div>
      </div>

      {/* Modal */}
      <TransacaoModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={carregarDados}
        transacao={transacaoEditando}
      />
    </DashboardLayout>
  );
}
