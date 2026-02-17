"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import { Save, ArrowLeft, Building2 } from "lucide-react";

export default function NovaClinicaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clinica, setClinica] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    observacoes: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
    }
  }, [router]);

  const handleSalvar = async () => {
    setLoading(true);
    try {
      await api.post("/clinicas", clinica);
      alert("Clínica cadastrada com sucesso!");
      router.push("/clinicas");
    } catch (error) {
      console.error("Erro ao salvar clínica:", error);
      alert("Erro ao cadastrar clínica");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
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

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Clínica *
              </label>
              <input
                type="text"
                value={clinica.nome}
                onChange={(e) => setClinica({...clinica, nome: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Rua, número, complemento"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={clinica.cidade}
                onChange={(e) => setClinica({...clinica, cidade: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">UF</option>
                  <option value="AC">AC</option>
                  <option value="AL">AL</option>
                  <option value="AP">AP</option>
                  <option value="AM">AM</option>
                  <option value="BA">BA</option>
                  <option value="CE">CE</option>
                  <option value="DF">DF</option>
                  <option value="ES">ES</option>
                  <option value="GO">GO</option>
                  <option value="MA">MA</option>
                  <option value="MT">MT</option>
                  <option value="MS">MS</option>
                  <option value="MG">MG</option>
                  <option value="PA">PA</option>
                  <option value="PB">PB</option>
                  <option value="PR">PR</option>
                  <option value="PE">PE</option>
                  <option value="PI">PI</option>
                  <option value="RJ">RJ</option>
                  <option value="RN">RN</option>
                  <option value="RS">RS</option>
                  <option value="RO">RO</option>
                  <option value="RR">RR</option>
                  <option value="SC">SC</option>
                  <option value="SP">SP</option>
                  <option value="SE">SE</option>
                  <option value="TO">TO</option>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Observações adicionais..."
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button
              onClick={() => router.push("/clinicas")}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={loading || !clinica.nome}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
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
