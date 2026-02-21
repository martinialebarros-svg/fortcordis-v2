"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { 
  BarChart3, PieChart, TrendingUp, Calendar, Download,
  ChevronDown, ChevronUp, DollarSign
} from "lucide-react";

interface RelatorioCategoria {
  categoria: string;
  total: number;
  quantidade: number;
  percentual: number;
}

interface ComparativoMes {
  mes: string;
  ano: number;
  entradas: number;
  saidas: number;
  saldo: number;
  variacao_entrada?: number;
  variacao_saida?: number;
}

export default function RelatoriosFinanceirosPage() {
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [relatorioEntradas, setRelatorioEntradas] = useState<RelatorioCategoria[]>([]);
  const [relatorioSaidas, setRelatorioSaidas] = useState<RelatorioCategoria[]>([]);
  const [comparativo, setComparativo] = useState<ComparativoMes[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState("categorias");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    
    // Definir período padrão (último mês)
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setPeriodoFim(hoje.toISOString().split('T')[0]);
    setPeriodoInicio(inicioMes.toISOString().split('T')[0]);
  }, [router]);

  const carregarRelatorios = async () => {
    if (!periodoInicio || !periodoFim) return;
    
    try {
      setLoading(true);
      const [entradas, saidas, comparativoData, grafico] = await Promise.all([
        api.get(`/financeiro/relatorios/categorias?tipo=entrada&data_inicio=${periodoInicio}&data_fim=${periodoFim}`),
        api.get(`/financeiro/relatorios/categorias?tipo=saida&data_inicio=${periodoInicio}&data_fim=${periodoFim}`),
        api.get("/financeiro/relatorios/comparativo-mensal?meses=6"),
        api.get("/financeiro/relatorios/dados-grafico?tipo=mensal&meses=6"),
      ]);
      
      setRelatorioEntradas(entradas.data.categorias || []);
      setRelatorioSaidas(saidas.data.categorias || []);
      setComparativo(comparativoData.data.items || []);
      setDadosGrafico(grafico.data);
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodoInicio && periodoFim) {
      carregarRelatorios();
    }
  }, [periodoInicio, periodoFim]);

  const formatarValor = (valor: number) => {
    return valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
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

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios Financeiros</h1>
            <p className="text-gray-500">Análise detalhada das finanças</p>
          </div>
        </div>

        {/* Período */}
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={carregarRelatorios}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Carregando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: "categorias", nome: "Por Categoria", icon: PieChart },
            { id: "comparativo", nome: "Comparativo Mensal", icon: TrendingUp },
            { id: "grafico", nome: "Gráficos", icon: BarChart3 },
          ].map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
                abaAtiva === aba.id
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <aba.icon className="w-4 h-4" />
              {aba.nome}
            </button>
          ))}
        </div>

        {/* Conteúdo das Abas */}
        {abaAtiva === "categorias" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Entradas por Categoria */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-5 border-b">
                <h3 className="font-semibold text-gray-900">Entradas por Categoria</h3>
              </div>
              <div className="p-4">
                {relatorioEntradas.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhuma entrada no período</p>
                ) : (
                  <div className="space-y-3">
                    {relatorioEntradas.map((item) => (
                      <div key={item.categoria} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{getCategoriaNome(item.categoria)}</span>
                            <span className="text-sm text-gray-600">{formatarValor(item.total)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${item.percentual}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>{item.quantidade} transações</span>
                            <span>{item.percentual}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Saídas por Categoria */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-5 border-b">
                <h3 className="font-semibold text-gray-900">Saídas por Categoria</h3>
              </div>
              <div className="p-4">
                {relatorioSaidas.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhuma saída no período</p>
                ) : (
                  <div className="space-y-3">
                    {relatorioSaidas.map((item) => (
                      <div key={item.categoria} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{getCategoriaNome(item.categoria)}</span>
                            <span className="text-sm text-gray-600">{formatarValor(item.total)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${item.percentual}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>{item.quantidade} transações</span>
                            <span>{item.percentual}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {abaAtiva === "comparativo" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-5 border-b">
              <h3 className="font-semibold text-gray-900">Comparativo dos Últimos Meses</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Período</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Entradas</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Variação</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Saídas</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Variação</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comparativo.map((mes) => (
                    <tr key={`${mes.mes}-${mes.ano}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{mes.mes}/{mes.ano}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {formatarValor(mes.entradas)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {mes.variacao_entrada !== undefined && (
                          <span className={mes.variacao_entrada >= 0 ? "text-green-600" : "text-red-600"}>
                            {mes.variacao_entrada >= 0 ? "+" : ""}{mes.variacao_entrada}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {formatarValor(mes.saidas)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {mes.variacao_saida !== undefined && (
                          <span className={mes.variacao_saida <= 0 ? "text-green-600" : "text-red-600"}>
                            {mes.variacao_saida >= 0 ? "+" : ""}{mes.variacao_saida}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        <span className={mes.saldo >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatarValor(mes.saldo)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaAtiva === "grafico" && dadosGrafico && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Evolução Mensal</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {dadosGrafico.labels.map((label: string, index: number) => {
                const entrada = dadosGrafico.entradas[index] || 0;
                const saida = dadosGrafico.saidas[index] || 0;
                const max = Math.max(...dadosGrafico.entradas, ...dadosGrafico.saidas) || 1;
                
                return (
                  <div key={label} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex gap-1 items-end h-48">
                      <div 
                        className="flex-1 bg-green-500 rounded-t transition-all"
                        style={{ height: `${(entrada / max) * 100}%` }}
                        title={`Entrada: ${formatarValor(entrada)}`}
                      />
                      <div 
                        className="flex-1 bg-red-500 rounded-t transition-all"
                        style={{ height: `${(saida / max) * 100}%` }}
                        title={`Saída: ${formatarValor(saida)}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-sm text-gray-600">Entradas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-sm text-gray-600">Saídas</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
