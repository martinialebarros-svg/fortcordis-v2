"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, Search, 
  Calendar, CheckCircle, XCircle, Clock 
} from "lucide-react";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  valor_final: number;
  status: string;
  forma_pagamento: string;
  data_transacao: string;
  paciente_nome?: string;
}

interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
  a_receber: number;
  a_pagar: number;
}

export default function FinanceiroPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    entradas: 0,
    saidas: 0,
    saldo: 0,
    a_receber: 0,
    a_pagar: 0,
  });
  const [periodo, setPeriodo] = useState("mes");
  const [loading, setLoading] = useState(true);
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
      const [respTransacoes, respResumo] = await Promise.all([
        api.get("/financeiro/transacoes"),
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

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-gray-500">Controle financeiro do sistema</p>
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
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
                  : "bg-white text-gray-600 hover:bg-gray-100"
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
          </div>
        </div>

        {/* Transações */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Últimas Transações</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : transacoes.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {transacoes.slice(0, 10).map((t) => (
                <div key={t.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    t.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {t.tipo === 'entrada' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{t.descricao}</p>
                    <div className="flex gap-2 text-sm text-gray-500">
                      <span>{t.categoria}</span>
                      {t.paciente_nome && <span>• {t.paciente_nome}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {t.tipo === 'entrada' ? '+' : '-'}{formatarValor(t.valor_final)}
                    </p>
                    <div className="flex items-center gap-1 justify-end text-sm text-gray-500">
                      {getStatusIcon(t.status)}
                      <span>{t.status}</span>
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
