"use client";

import { useEffect, useState } from "react";
import { X, User, Building, Calendar, Clock } from "lucide-react";
import api from "@/lib/axios";

const TABELA_PRECO_PADRAO = [
  { id: 1, nome: "Fortaleza" },
  { id: 2, nome: "Regiao Metropolitana" },
  { id: 3, nome: "Domiciliar" },
  { id: 4, nome: "Personalizado" },
];

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agendamentoCriado?: { data?: string | null }) => void | Promise<void>;
  agendamento?: any;
  defaultDate?: string;
  defaultTime?: string;
}

export default function NovoAgendamentoModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  agendamento,
  defaultDate,
  defaultTime
}: NovoAgendamentoModalProps) {
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [clinicas, setClinicas] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [tabelasPreco, setTabelasPreco] = useState<{ id: number; nome: string }[]>(TABELA_PRECO_PADRAO);
  const [tutorSelecionado, setTutorSelecionado] = useState<string>("");
  const [erroCarregamento, setErroCarregamento] = useState<string>("");
  
  const [formData, setFormData] = useState({
    paciente_id: "",
    paciente_novo: "",
    tutor_novo: "",
    clinica_id: "",
    clinica_nova_nome: "",
    clinica_nova_tabela_preco_id: "1",
    servico_id: "",
    data: "",
    hora: "",
    observacoes: "",
  });

  const isEditando = !!agendamento;

  const parseApiDateTime = (value?: string): Date | null => {
    if (!value) return null;

    const match = value
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, ano, mes, dia, hora, minuto, segundo = "0"] = match;
      const local = new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hora),
        Number(minuto),
        Number(segundo),
        0
      );
      if (!Number.isNaN(local.getTime())) {
        return local;
      }
    }

    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseAgendamentoInicio = (ag: any): Date | null => {
    if (ag?.data && ag?.hora) {
      const [ano, mes, dia] = String(ag.data).split("-").map(Number);
      const [hora, minuto] = String(ag.hora).split(":").map(Number);
      if (
        Number.isFinite(ano) &&
        Number.isFinite(mes) &&
        Number.isFinite(dia) &&
        Number.isFinite(hora) &&
        Number.isFinite(minuto)
      ) {
        const local = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
        if (!Number.isNaN(local.getTime())) {
          return local;
        }
      }
    }

    return parseApiDateTime(ag?.inicio);
  };

  const toInputDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toInputTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const toApiDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (isEditando && agendamento) {
      const inicio = parseAgendamentoInicio(agendamento);
      const data = inicio ? toInputDate(inicio) : "";
      const hora = inicio ? toInputTime(inicio) : "";
      
      setFormData({
        paciente_id: agendamento.paciente_id?.toString() || "",
        paciente_novo: "",
        tutor_novo: "",
        clinica_id: agendamento.clinica_id?.toString() || "",
        clinica_nova_nome: "",
        clinica_nova_tabela_preco_id: "1",
        servico_id: agendamento.servico_id?.toString() || "",
        data: data,
        hora: hora,
        observacoes: agendamento.observacoes || "",
      });
      
      // Buscar tutor do paciente selecionado
      if (agendamento.paciente_id) {
        const paciente = pacientes.find(p => p.id === agendamento.paciente_id);
        if (paciente?.tutor) {
          setTutorSelecionado(paciente.tutor);
        }
      }
    } else {
      setFormData({
        paciente_id: "",
        paciente_novo: "",
        tutor_novo: "",
        clinica_id: "",
        clinica_nova_nome: "",
        clinica_nova_tabela_preco_id: "1",
        servico_id: "",
        data: defaultDate || "",
        hora: defaultTime || "",
        observacoes: "",
      });
      setTutorSelecionado("");
    }
  }, [agendamento, defaultDate, defaultTime, isEditando, isOpen, pacientes]);

  // Carregar dados dos selects
  useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen]);

  const carregarDados = async () => {
    const extrairItems = (payload: any): any[] => {
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload)) return payload;
      return [];
    };

    const resultados = await Promise.allSettled([
      api.get("/pacientes?limit=1000"),
      api.get("/clinicas?limit=1000"),
      api.get("/clinicas/tabelas-preco/opcoes"),
      api.get("/servicos?limit=1000"),
    ]);

    const falhas: string[] = [];

    const pacientesResp = resultados[0];
    if (pacientesResp.status === "fulfilled") {
      setPacientes(extrairItems(pacientesResp.value?.data));
    } else {
      setPacientes([]);
      falhas.push("pacientes");
    }

    const clinicasResp = resultados[1];
    if (clinicasResp.status === "fulfilled") {
      setClinicas(extrairItems(clinicasResp.value?.data));
    } else {
      setClinicas([]);
      falhas.push("clinicas");
    }

    const tabelasResp = resultados[2];
    if (tabelasResp.status === "fulfilled") {
      const itens = extrairItems(tabelasResp.value?.data);
      if (itens.length > 0) {
        setTabelasPreco(itens);
      } else {
        setTabelasPreco(TABELA_PRECO_PADRAO);
      }
    } else {
      setTabelasPreco(TABELA_PRECO_PADRAO);
      falhas.push("tabelas de preco");
    }

    const servicosResp = resultados[3];
    if (servicosResp.status === "fulfilled") {
      setServicos(extrairItems(servicosResp.value?.data));
    } else {
      setServicos([]);
      falhas.push("servicos");
    }

    if (falhas.length > 0) {
      setErroCarregamento(
        `Falha ao carregar ${falhas.join(", ")}. Atualize a pagina e tente novamente.`
      );
    } else {
      setErroCarregamento("");
    }
  };

  const handlePacienteChange = (pacienteId: string) => {
    setFormData({
      ...formData,
      paciente_id: pacienteId,
      paciente_novo: pacienteId ? "" : formData.paciente_novo,
      tutor_novo: pacienteId ? "" : formData.tutor_novo,
    });
    
    // Buscar tutor do paciente selecionado
    const paciente = pacientes.find(p => p.id.toString() === pacienteId);
    setTutorSelecionado(paciente?.tutor || "");
  };

  const handleClinicaChange = (clinicaId: string) => {
    setFormData({
      ...formData,
      clinica_id: clinicaId,
      clinica_nova_nome: clinicaId ? "" : formData.clinica_nova_nome,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const inicio = new Date(`${formData.data}T${formData.hora}:00`);
      let pacienteId = formData.paciente_id ? parseInt(formData.paciente_id, 10) : NaN;

      if (!Number.isFinite(pacienteId)) {
        const nomePaciente = (formData.paciente_novo || "").trim();
        if (!nomePaciente) {
          throw new Error("Selecione um paciente ou informe um nome para cadastro rapido.");
        }

        const respostaPaciente = await api.post("/pacientes", {
          nome: nomePaciente,
          tutor: (formData.tutor_novo || "").trim() || null,
          especie: "Canina",
          raca: "",
          sexo: "Macho",
          peso_kg: null,
          data_nascimento: null,
          microchip: "",
          observacoes: "Cadastro rapido via agenda panoramica",
        });

        pacienteId = respostaPaciente?.data?.id;
        if (!pacienteId) {
          throw new Error("Nao foi possivel criar o paciente rapidamente.");
        }
      }

      let clinicaId = formData.clinica_id ? parseInt(formData.clinica_id, 10) : NaN;
      if (!Number.isFinite(clinicaId) && (formData.clinica_nova_nome || "").trim()) {
        const respostaClinica = await api.post("/clinicas", {
          nome: (formData.clinica_nova_nome || "").trim(),
          cnpj: "",
          telefone: "",
          email: "",
          endereco: "",
          cidade: "",
          estado: "",
          cep: "",
          observacoes: "",
          tabela_preco_id: parseInt(formData.clinica_nova_tabela_preco_id || "1", 10),
          preco_personalizado_km: 0,
          preco_personalizado_base: 0,
          observacoes_preco: "Cadastro rapido via agenda panoramica",
        });

        clinicaId = respostaClinica?.data?.id;
        if (!clinicaId) {
          throw new Error("Nao foi possivel criar a clinica rapidamente.");
        }
      }

      const servicoSelecionado = servicos.find(
        (s) => s.id?.toString() === formData.servico_id
      );
      const duracaoMinutos = Number.parseInt(
        `${servicoSelecionado?.duracao_minutos ?? ""}`,
        10
      );
      const duracaoEfetiva = Number.isFinite(duracaoMinutos) && duracaoMinutos > 0 ? duracaoMinutos : 30;
      const fim = new Date(inicio.getTime() + duracaoEfetiva * 60000);

      const payload = {
        paciente_id: pacienteId,
        clinica_id: Number.isFinite(clinicaId) ? clinicaId : null,
        servico_id: formData.servico_id ? parseInt(formData.servico_id) : null,
        inicio: toApiDateTime(inicio),
        fim: toApiDateTime(fim),
        status: agendamento?.status || "Agendado",
        observacoes: formData.observacoes,
      };

      let response;
      if (isEditando) {
        response = await api.put(`/agenda/${agendamento.id}`, payload);
      } else {
        response = await api.post("/agenda", payload);
      }

      await onSuccess(response?.data);
      onClose();
      setFormData({
        paciente_id: "",
        paciente_novo: "",
        tutor_novo: "",
        clinica_id: "",
        clinica_nova_nome: "",
        clinica_nova_tabela_preco_id: "1",
        servico_id: "",
        data: defaultDate || "",
        hora: defaultTime || "",
        observacoes: "",
      });
      setTutorSelecionado("");
    } catch (error: any) {
      alert(`Erro ao ${isEditando ? 'editar' : 'criar'} agendamento: ` + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEditando ? "Editar Agendamento" : "Novo Agendamento"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erroCarregamento && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erroCarregamento}
            </div>
          )}

          {/* Paciente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Paciente *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.paciente_id}
              onChange={(e) => handlePacienteChange(e.target.value)}
            >
              <option value="">Selecione...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.nome}
                </option>
              ))}
            </select>
            
            {/* Exibir Tutor quando paciente é selecionado */}
            {tutorSelecionado && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg">
                <User className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Tutor:</span>
                <span>{tutorSelecionado}</span>
              </div>
            )}

            {!formData.paciente_id && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.paciente_novo}
                  onChange={(e) => setFormData({ ...formData, paciente_novo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do paciente (cadastro rapido)"
                />
                <input
                  type="text"
                  value={formData.tutor_novo}
                  onChange={(e) => setFormData({ ...formData, tutor_novo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do tutor (opcional)"
                />
              </div>
            )}
          </div>

          {/* Clínica */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building className="w-4 h-4 inline mr-1" />
              Clínica
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.clinica_id}
              onChange={(e) => handleClinicaChange(e.target.value)}
            >
              <option value="">Selecione...</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.nome}
                </option>
              ))}
            </select>

            {!formData.clinica_id && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.clinica_nova_nome}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome da clinica (cadastro rapido)"
                />
                <select
                  value={formData.clinica_nova_tabela_preco_id}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_tabela_preco_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {tabelasPreco.map((opcao) => (
                    <option key={opcao.id} value={opcao.id.toString()}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serviço
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.servico_id}
              onChange={(e) => setFormData({...formData, servico_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id.toString()}>
                  {s.nome}
                </option>
              ))}
            </select>
            {formData.servico_id && (
              <p className="mt-1 text-xs text-gray-500">
                Duração estimada: {
                  (() => {
                    const servicoSelecionado = servicos.find((s) => s.id?.toString() === formData.servico_id);
                    const duracaoMinutos = Number.parseInt(`${servicoSelecionado?.duracao_minutos ?? ""}`, 10);
                    return Number.isFinite(duracaoMinutos) && duracaoMinutos > 0 ? `${duracaoMinutos} min` : "30 min";
                  })()
                }
              </p>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data *
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Hora *
              </label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.hora}
                onChange={(e) => setFormData({...formData, hora: e.target.value})}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Observações sobre o agendamento..."
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading 
                ? (isEditando ? "Salvando..." : "Criando...") 
                : (isEditando ? "Salvar Alterações" : "Salvar Agendamento")
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
