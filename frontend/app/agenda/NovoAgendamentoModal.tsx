"use client";

import { useEffect, useState } from "react";
import { X, User, Building, Calendar, Clock } from "lucide-react";
import axios from "axios";

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  agendamento?: any; // Agendamento sendo editado (opcional)
}

export default function NovoAgendamentoModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  agendamento 
}: NovoAgendamentoModalProps) {
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [clinicas, setClinicas] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    paciente_id: "",
    clinica_id: "",
    servico_id: "",
    data: "",
    hora: "",
    observacoes: "",
  });

  const isEditando = !!agendamento;

  // Preencher formulário quando estiver editando
  useEffect(() => {
    console.log("Modal recebeu agendamento:", agendamento);
    if (isEditando && agendamento) {
      const inicio = new Date(agendamento.inicio);
      const data = inicio.toISOString().split('T')[0]; // YYYY-MM-DD
      const hora = inicio.toTimeString().slice(0, 5); // HH:MM
      
      setFormData({
        paciente_id: agendamento.paciente_id?.toString() || "",
        clinica_id: agendamento.clinica_id?.toString() || "",
        servico_id: agendamento.servico_id?.toString() || "",
        data: data,
        hora: hora,
        observacoes: agendamento.observacoes || "",
      });
    } else {
      // Reset quando for novo
      setFormData({
        paciente_id: "",
        clinica_id: "",
        servico_id: "",
        data: "",
        hora: "",
        observacoes: "",
      });
    }
  }, [agendamento, isEditando, isOpen]);

  // Carregar dados dos selects
  useEffect(() => {
    console.log("Modal recebeu agendamento:", agendamento);
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen]);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem("token");
      // Tentar carregar pacientes, clinicas e servicos
      // Se der 404, usamos arrays vazios
      try {
        const resPacientes = await axios.get("/api/v1/pacientes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPacientes(resPacientes.data.items || []);
      } catch (e) {
        setPacientes([]);
      }
      
      try {
        const resClinicas = await axios.get("/api/v1/clinicas", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClinicas(resClinicas.data.items || []);
      } catch (e) {
        setClinicas([]);
      }

      try {
        const resServicos = await axios.get("/api/v1/servicos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setServicos(resServicos.data.items || []);
      } catch (e) {
        setServicos([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const inicio = new Date(`${formData.data}T${formData.hora}`);

      const payload = {
        paciente_id: parseInt(formData.paciente_id),
        clinica_id: formData.clinica_id ? parseInt(formData.clinica_id) : null,
        servico_id: formData.servico_id ? parseInt(formData.servico_id) : null,
        inicio: inicio.toISOString(),
        fim: new Date(inicio.getTime() + 30 * 60000).toISOString(),
        status: agendamento?.status || "Agendado",
        observacoes: formData.observacoes,
      };

      if (isEditando) {
        // PUT para editar
        await axios.put(`/api/v1/agenda/${agendamento.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // POST para criar
        await axios.post("/api/v1/agenda/", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        paciente_id: "",
        clinica_id: "",
        servico_id: "",
        data: "",
        hora: "",
        observacoes: "",
      });
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
          {/* Paciente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Paciente *
            </label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.paciente_id}
              onChange={(e) => setFormData({...formData, paciente_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.nome} {p.tutor ? `(${p.tutor})` : ""}
                </option>
              ))}
            </select>
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
              onChange={(e) => setFormData({...formData, clinica_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.nome}
                </option>
              ))}
            </select>
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
