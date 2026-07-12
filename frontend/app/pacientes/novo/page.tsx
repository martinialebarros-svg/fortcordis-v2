"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  addRacaCustomPorEspecie,
  getRacaOptions,
  loadRacasCustomPorEspecie,
  saveRacasCustomPorEspecie,
} from "@/lib/racas";
import { Save, ArrowLeft, Plus, UserRound, PawPrint } from "lucide-react";

export default function NovoPacientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
  const [feedback, setFeedback] = useState("");
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
    }
  }, [router]);

  const handleSalvar = async (cadastrarOutroPet = false) => {
    setLoading(true);
    setFeedback("");
    try {
      const payload = {
        ...paciente,
        tutor_id: paciente.tutor_id ? Number(paciente.tutor_id) : null,
        peso_kg: paciente.peso_kg ? parseFloat(paciente.peso_kg) : null,
      };
      
      const response = await api.post("/pacientes", payload);
      if (cadastrarOutroPet) {
        const tutorId = response.data?.tutor_id || paciente.tutor_id;
        setPaciente((prev) => ({
          ...prev,
          tutor_id: tutorId ? String(tutorId) : prev.tutor_id,
          nome: "",
          especie: "Canina",
          raca: "",
          sexo: "Macho",
          peso_kg: "",
          data_nascimento: "",
          microchip: "",
          observacoes: "",
        }));
        setNovaRaca("");
        setFeedback("Paciente salvo. Cadastre o proximo pet do mesmo tutor.");
        return;
      }
      alert("Paciente cadastrado com sucesso!");
      router.push("/pacientes");
    } catch (error) {
      console.error("Erro ao salvar paciente:", error);
      alert("Erro ao cadastrar paciente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="fc-patient-form-page">
        <header className="fc-patient-form-header">
          <div className="fc-patient-form-heading">
            <button
              type="button"
              onClick={() => router.push("/pacientes")}
              className="fc-patient-form-back"
              aria-label="Voltar para pacientes"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <span className="fc-patient-form-kicker">
                <PawPrint className="h-4 w-4" />
                Carteira clínica
              </span>
              <h1>Novo paciente</h1>
              <p>Cadastre o tutor e a identificação clínica do pet.</p>
            </div>
          </div>
          <div className="fc-patient-form-context">
            <span>Fluxo atual</span>
            <strong>Novo cadastro</strong>
          </div>
        </header>

        <main className="fc-patient-form-panel">
          {feedback && (
            <div className="fc-patient-form-feedback">
              {feedback}
            </div>
          )}

          <div className="fc-patient-form-section-header fc-patient-form-section-tutor">
            <UserRound className="h-5 w-5" />
            <div>
              <span>Responsável</span>
              <h2>Dados do tutor</h2>
            </div>
          </div>

          <div className="fc-patient-form-grid">
            {paciente.tutor_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID do tutor
                </label>
                <input
                  type="text"
                  value={paciente.tutor_id}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700"
                />
              </div>
            )}

            <div className={paciente.tutor_id ? "" : "md:col-span-2"}>
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

          <div className="fc-patient-form-section-header fc-patient-form-section-pet">
            <PawPrint className="h-5 w-5" />
            <div>
              <span>Identificação clínica</span>
              <h2>Dados do pet</h2>
            </div>
          </div>

          <div className="fc-patient-form-grid">
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
          
          <div className="fc-patient-form-actions">
            <button
              type="button"
              onClick={() => router.push("/pacientes")}
              className="fc-patient-form-cancel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleSalvar(true)}
              disabled={loading || !paciente.nome || !paciente.tutor}
              className="fc-patient-form-secondary"
            >
              <Plus className="w-4 h-4" />
              Salvar e adicionar outro pet
            </button>
            <button
              type="button"
              onClick={() => handleSalvar(false)}
              disabled={loading || !paciente.nome || !paciente.tutor}
              className="fc-patient-form-primary"
            >
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar Paciente"}
            </button>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}
