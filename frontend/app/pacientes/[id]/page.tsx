"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  addRacaCustomPorEspecie,
  getRacaOptions,
  loadRacasCustomPorEspecie,
  saveRacasCustomPorEspecie,
} from "@/lib/racas";
import { Save, ArrowLeft, Trash2, AlertTriangle, UserRound } from "lucide-react";

export default function EditarPacientePage() {
  const router = useRouter();
  const params = useParams();
  const pacienteId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paciente, setPaciente] = useState({
    tutor_id: "",
    nome: "",
    tutor: "",
    tutor_email: "",
    tutor_telefone: "",
    tutor_whatsapp: "",
    tutor_cpf: "",
    tutor_cep: "",
    tutor_endereco: "",
    tutor_numero: "",
    tutor_complemento: "",
    tutor_bairro: "",
    tutor_cidade: "",
    tutor_estado: "CE",
    especie: "Canina",
    raca: "",
    sexo: "Macho",
    peso_kg: "",
    data_nascimento: "",
    microchip: "",
    observacoes: "",
  });
  const [novaRaca, setNovaRaca] = useState("");
  const [racasCustomPorEspecie, setRacasCustomPorEspecie] = useState<Record<string, string[]>>({});
  const [racasLoaded, setRacasLoaded] = useState(false);
  const opcoesRaca = getRacaOptions(
    paciente.especie,
    paciente.raca,
    racasCustomPorEspecie[paciente.especie] || [],
  );

  const handleAdicionarRaca = () => {
    const racaDigitada = novaRaca.trim();
    if (!racaDigitada) return;

    const racaExistente =
      opcoesRaca.find((item) => item.toLowerCase() === racaDigitada.toLowerCase()) || racaDigitada;

    setRacasCustomPorEspecie((prev) => addRacaCustomPorEspecie(prev, paciente.especie, racaDigitada));
    setPaciente((prev) => ({ ...prev, raca: racaExistente }));
    setNovaRaca("");
  };

  useEffect(() => {
    setRacasCustomPorEspecie(loadRacasCustomPorEspecie());
    setRacasLoaded(true);
  }, []);

  useEffect(() => {
    if (!racasLoaded) return;
    saveRacasCustomPorEspecie(racasCustomPorEspecie);
  }, [racasLoaded, racasCustomPorEspecie]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarPaciente();
  }, [router, pacienteId]);

  const carregarPaciente = async () => {
    try {
      const response = await api.get(`/pacientes/${pacienteId}`);
      const data = response.data;
      setPaciente({
        tutor_id: data.tutor_id ? String(data.tutor_id) : "",
        nome: data.nome || "",
        tutor: data.tutor || "",
        tutor_email: data.tutor_email || "",
        tutor_telefone: data.tutor_telefone || "",
        tutor_whatsapp: data.tutor_whatsapp || "",
        tutor_cpf: data.tutor_cpf || "",
        tutor_cep: data.tutor_cep || "",
        tutor_endereco: data.tutor_endereco || "",
        tutor_numero: data.tutor_numero || "",
        tutor_complemento: data.tutor_complemento || "",
        tutor_bairro: data.tutor_bairro || "",
        tutor_cidade: data.tutor_cidade || "",
        tutor_estado: data.tutor_estado || "CE",
        especie: data.especie || "Canina",
        raca: data.raca || "",
        sexo: data.sexo || "Macho",
        peso_kg: data.peso_kg?.toString() || "",
        data_nascimento: data.data_nascimento || "",
        microchip: data.microchip || "",
        observacoes: data.observacoes || "",
      });
    } catch (error) {
      console.error("Erro ao carregar paciente:", error);
      alert("Erro ao carregar dados do paciente");
      router.push("/pacientes");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const payload = {
        ...paciente,
        tutor_id: paciente.tutor_id ? Number(paciente.tutor_id) : null,
        peso_kg: paciente.peso_kg ? parseFloat(paciente.peso_kg) : null,
      };
      
      await api.put(`/pacientes/${pacienteId}`, payload);
      alert("Paciente atualizado com sucesso!");
      router.push("/pacientes");
    } catch (error) {
      console.error("Erro ao salvar paciente:", error);
      alert("Erro ao atualizar paciente");
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    try {
      await api.delete(`/pacientes/${pacienteId}`);
      alert("Paciente excluído com sucesso!");
      router.push("/pacientes");
    } catch (error) {
      console.error("Erro ao excluir paciente:", error);
      alert("Erro ao excluir paciente");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/pacientes")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Editar Paciente</h1>
              <p className="text-gray-500">Atualize os dados do paciente</p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-6 flex items-center gap-2 border-b pb-3">
            <UserRound className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Dados do tutor</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID do tutor
              </label>
              <input
                type="text"
                value={paciente.tutor_id || "Sem ID vinculado"}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do tutor *
              </label>
              <input
                type="text"
                value={paciente.tutor}
                onChange={(e) => setPaciente({...paciente, tutor: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail do tutor
              </label>
              <input
                type="email"
                value={paciente.tutor_email}
                onChange={(e) => setPaciente({...paciente, tutor_email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="email@tutor.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="text"
                value={paciente.tutor_telefone}
                onChange={(e) => setPaciente({...paciente, tutor_telefone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp
              </label>
              <input
                type="text"
                value={paciente.tutor_whatsapp}
                onChange={(e) => setPaciente({...paciente, tutor_whatsapp: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPF
              </label>
              <input
                type="text"
                value={paciente.tutor_cpf}
                onChange={(e) => setPaciente({...paciente, tutor_cpf: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                value={paciente.tutor_cep}
                onChange={(e) => setPaciente({...paciente, tutor_cep: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="00000-000"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={paciente.tutor_endereco}
                onChange={(e) => setPaciente({...paciente, tutor_endereco: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Rua / Avenida"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número
              </label>
              <input
                type="text"
                value={paciente.tutor_numero}
                onChange={(e) => setPaciente({...paciente, tutor_numero: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={paciente.tutor_complemento}
                onChange={(e) => setPaciente({...paciente, tutor_complemento: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Apto, bloco, sala"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={paciente.tutor_bairro}
                onChange={(e) => setPaciente({...paciente, tutor_bairro: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Bairro"
              />
            </div>

            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={paciente.tutor_cidade}
                  onChange={(e) => setPaciente({...paciente, tutor_cidade: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Cidade"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UF
                </label>
                <input
                  type="text"
                  value={paciente.tutor_estado}
                  onChange={(e) => setPaciente({...paciente, tutor_estado: e.target.value.toUpperCase().slice(0, 2)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="CE"
                />
              </div>
            </div>
          </div>

          <div className="my-8 flex items-center justify-between gap-3 border-b pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Dados do pet</h2>
            <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              ID do pet: {pacienteId}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Paciente *
              </label>
              <input
                type="text"
                value={paciente.nome}
                onChange={(e) => setPaciente({...paciente, nome: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Rex"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Espécie
              </label>
              <select
                value={paciente.especie}
                onChange={(e) => {
                  setPaciente({ ...paciente, especie: e.target.value, raca: "" });
                  setNovaRaca("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Canina">Canina</option>
                <option value="Felina">Felina</option>
                <option value="Equina">Equina</option>
                <option value="Outra">Outra</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raça
              </label>
              <select
                value={paciente.raca}
                onChange={(e) => setPaciente({...paciente, raca: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {opcoesRaca.map((raca) => (
                  <option key={raca} value={raca}>
                    {raca}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={novaRaca}
                  onChange={(e) => setNovaRaca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdicionarRaca();
                    }
                  }}
                  placeholder="Adicionar nova raça"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAdicionarRaca}
                  disabled={!novaRaca.trim()}
                  className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sexo
              </label>
              <select
                value={paciente.sexo}
                onChange={(e) => setPaciente({...paciente, sexo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Macho">Macho</option>
                <option value="Fêmea">Fêmea</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso (kg)
              </label>
              <input
                type="text"
                value={paciente.peso_kg}
                onChange={(e) => setPaciente({...paciente, peso_kg: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 10.5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                value={paciente.data_nascimento}
                onChange={(e) => setPaciente({...paciente, data_nascimento: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Microchip
              </label>
              <input
                type="text"
                value={paciente.microchip}
                onChange={(e) => setPaciente({...paciente, microchip: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Número do microchip"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={paciente.observacoes}
                onChange={(e) => setPaciente({...paciente, observacoes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Observações adicionais..."
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button
              onClick={() => router.push("/pacientes")}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving || !paciente.nome || !paciente.tutor}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirmar Exclusão</h3>
                  <p className="text-sm text-gray-500">
                    Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExcluir}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
