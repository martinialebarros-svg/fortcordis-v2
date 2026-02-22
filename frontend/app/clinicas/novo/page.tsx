"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { Save, ArrowLeft, Building2, MapPin, DollarSign, Calculator } from "lucide-react";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const TABELAS_PRECO = [
  { id: 1, nome: "Fortaleza", descricao: "Clínicas na capital", cor: "blue" },
  { id: 2, nome: "Região Metropolitana", descricao: "Cidades próximas a Fortaleza", cor: "purple" },
  { id: 3, nome: "Domiciliar", descricao: "Atendimento domiciliar padrão", cor: "orange" },
  { id: 4, nome: "Personalizado", descricao: "Preço negociado para cidade distante", cor: "green" },
];

export default function NovaClinicaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tabelaSugerida, setTabelaSugerida] = useState<number | null>(null);
  
  const [clinica, setClinica] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
    cidade: "",
    estado: "CE",
    cep: "",
    observacoes: "",
    tabela_preco_id: 1,
    preco_personalizado_km: "",
    preco_personalizado_base: "",
    observacoes_preco: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
    }
  }, [router]);

  // Sugerir tabela de preço quando a cidade mudar
  useEffect(() => {
    if (clinica.cidade) {
      sugerirTabelaPreco();
    }
  }, [clinica.cidade]);

  const sugerirTabelaPreco = async () => {
    if (!clinica.cidade) return;
    
    try {
      const response = await api.post(`/clinicas/sugerir-tabela-preco?cidade=${encodeURIComponent(clinica.cidade)}`);
      const sugestao = response.data;
      
      if (sugestao.tabela_sugerida) {
        setTabelaSugerida(sugestao.tabela_sugerida.id);
        // Se a cidade não for reconhecida, sugerir tabela 3 (Domiciliar)
        if (!sugestao.cidade_reconhecida) {
          setClinica(prev => ({ ...prev, tabela_preco_id: 3 }));
        }
      }
    } catch (error) {
      console.error("Erro ao sugerir tabela:", error);
    }
  };

  const handleSalvar = async () => {
    if (!clinica.nome.trim()) {
      alert("Digite o nome da clínica");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...clinica,
        tabela_preco_id: parseInt(clinica.tabela_preco_id.toString()),
        preco_personalizado_km: clinica.preco_personalizado_km ? parseFloat(clinica.preco_personalizado_km.replace(',', '.')) : 0,
        preco_personalizado_base: clinica.preco_personalizado_base ? parseFloat(clinica.preco_personalizado_base.replace(',', '.')) : 0,
      };
      
      await api.post("/clinicas", payload);
      alert("Clínica cadastrada com sucesso!");
      router.push("/clinicas");
    } catch (error: any) {
      console.error("Erro ao salvar clínica:", error);
      alert("Erro ao cadastrar clínica: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: string) => {
    if (!valor) return "0,00";
    const num = parseFloat(valor.replace(',', '.'));
    if (isNaN(num)) return "0,00";
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const tabelaAtual = TABELAS_PRECO.find(t => t.id === clinica.tabela_preco_id);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/clinicas")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nova Clínica</h1>
            <p className="text-gray-500">Cadastre uma nova clínica parceira</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              Informações Básicas
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Clínica *
                </label>
                <input
                  type="text"
                  value={clinica.nome}
                  onChange={(e) => setClinica({...clinica, nome: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Clínica Veterinária ABC"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={clinica.cnpj}
                  onChange={(e) => setClinica({...clinica, cnpj: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  value={clinica.telefone}
                  onChange={(e) => setClinica({...clinica, telefone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="(00) 00000-0000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={clinica.email}
                  onChange={(e) => setClinica({...clinica, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="email@clinica.com"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={clinica.endereco}
                  onChange={(e) => setClinica({...clinica, endereco: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Rua, número, complemento"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Cidade
                </label>
                <input
                  type="text"
                  value={clinica.cidade}
                  onChange={(e) => setClinica({...clinica, cidade: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Cidade"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={clinica.estado}
                    onChange={(e) => setClinica({...clinica, estado: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {ESTADOS.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={clinica.cep}
                    onChange={(e) => setClinica({...clinica, cep: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="00000-000"
                  />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={clinica.observacoes}
                  onChange={(e) => setClinica({...clinica, observacoes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>
          </div>

          {/* Tabela de Preços */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Tabela de Preços
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              A tabela é sugerida automaticamente baseada na cidade, mas pode ser alterada manualmente.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {TABELAS_PRECO.map((tabela) => (
                <label
                  key={tabela.id}
                  className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${
                    clinica.tabela_preco_id === tabela.id
                      ? `border-${tabela.cor}-500 bg-${tabela.cor}-50`
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="tabela_preco"
                      value={tabela.id}
                      checked={clinica.tabela_preco_id === tabela.id}
                      onChange={() => setClinica({...clinica, tabela_preco_id: tabela.id})}
                      className="mt-1"
                    />
                    <div>
                      <p className={`font-medium ${clinica.tabela_preco_id === tabela.id ? `text-${tabela.cor}-700` : "text-gray-900"}`}>
                        {tabela.nome}
                      </p>
                      <p className="text-sm text-gray-500">{tabela.descricao}</p>
                      {tabelaSugerida === tabela.id && clinica.tabela_preco_id === tabela.id && (
                        <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Sugerido
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Preço Personalizado */}
            {clinica.tabela_preco_id === 4 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <h3 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Preço Personalizado (Negociado)
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  Use esta opção para cidades distantes como Aracati, onde o valor é negociado caso a caso.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-green-800 mb-1">
                      Valor Base do Atendimento
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600">R$</span>
                      <input
                        type="text"
                        value={clinica.preco_personalizado_base}
                        onChange={(e) => setClinica({...clinica, preco_personalizado_base: e.target.value})}
                        className="w-full pl-10 pr-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0,00"
                      />
                    </div>
                    <p className="text-xs text-green-600 mt-1">Valor mínimo do atendimento</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-green-800 mb-1">
                      Valor por KM Adicional
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600">R$</span>
                      <input
                        type="text"
                        value={clinica.preco_personalizado_km}
                        onChange={(e) => setClinica({...clinica, preco_personalizado_km: e.target.value})}
                        className="w-full pl-10 pr-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0,00"
                      />
                    </div>
                    <p className="text-xs text-green-600 mt-1">Valor cobrado por km de distância</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-green-800 mb-1">
                    Observações sobre o Preço Negociado
                  </label>
                  <textarea
                    value={clinica.observacoes_preco}
                    onChange={(e) => setClinica({...clinica, observacoes_preco: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex: Preço negociado para atendimento em Aracati. Valor fixo de R$ 800,00 + R$ 2,00/km após 150km."
                  />
                </div>
                
                {/* Resumo do cálculo */}
                {(clinica.preco_personalizado_base || clinica.preco_personalizado_km) && (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Exemplo de cálculo:</strong>
                      <br />
                      Base: {formatarValor(clinica.preco_personalizado_base)}
                      <br />
                      + KM: {formatarValor(clinica.preco_personalizado_km)}/km
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="bg-gray-50 rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Resumo da Configuração</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Tabela aplicada:</span>
                <span className={`ml-2 font-medium ${tabelaAtual ? `text-${tabelaAtual.cor}-600` : "text-gray-900"}`}>
                  {tabelaAtual?.nome || "Fortaleza"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Cidade:</span>
                <span className="ml-2 font-medium">{clinica.cidade || "Não informada"}</span>
              </div>
            </div>
          </div>
          
          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => router.push("/clinicas")}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={loading || !clinica.nome}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar Clínica"}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
