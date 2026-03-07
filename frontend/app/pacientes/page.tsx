"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { Users, Search, Plus, Dog, Cat, User, Edit2, Trash2 } from "lucide-react";

interface Paciente {
  id: number;
  nome: string;
  tutor: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  peso_kg?: number;
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletandoLote, setDeletandoLote] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [mensagemAcao, setMensagemAcao] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const [busca, setBusca] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarPacientes();
  }, [router]);

  const carregarPacientes = async () => {
    try {
      const response = await api.get("/pacientes?limit=1000");
      setPacientes(response.data.items || []);
      setTotalPacientes(Number(response.data.total || 0));
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const pacientesFiltrados = useMemo(
    () =>
      pacientes.filter(
        (p) => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.tutor?.toLowerCase().includes(busca.toLowerCase())
      ),
    [busca, pacientes]
  );

  const selecionadosSet = useMemo(() => new Set(selecionados), [selecionados]);
  const idsFiltrados = useMemo(() => pacientesFiltrados.map((paciente) => paciente.id), [pacientesFiltrados]);
  const todosFiltradosSelecionados = useMemo(() => {
    if (idsFiltrados.length === 0) return false;
    return idsFiltrados.every((id) => selecionadosSet.has(id));
  }, [idsFiltrados, selecionadosSet]);

  useEffect(() => {
    setSelecionados((prev) => prev.filter((id) => pacientes.some((paciente) => paciente.id === id)));
  }, [pacientes]);

  const getEspecieIcon = (especie?: string) => {
    if (especie?.toLowerCase().includes("gato")) return <Cat className="w-5 h-5 text-orange-500" />;
    if (especie?.toLowerCase().includes("cachorro")) return <Dog className="w-5 h-5 text-blue-500" />;
    return <User className="w-5 h-5 text-gray-400" />;
  };

  const alternarSelecaoPaciente = (pacienteId: number) => {
    setSelecionados((prev) => {
      if (prev.includes(pacienteId)) {
        return prev.filter((id) => id !== pacienteId);
      }
      return [...prev, pacienteId];
    });
  };

  const alternarSelecionarFiltrados = () => {
    setSelecionados((prev) => {
      if (todosFiltradosSelecionados) {
        return prev.filter((id) => !idsFiltrados.includes(id));
      }
      const merged = new Set(prev);
      for (const id of idsFiltrados) {
        merged.add(id);
      }
      return Array.from(merged);
    });
  };

  const excluirSelecionados = async () => {
    if (selecionados.length === 0 || deletandoLote) return;

    const confirmar = window.confirm(
      `Deseja excluir ${selecionados.length} paciente(s) selecionado(s)? Esta acao pode desativar pacientes com historico.`
    );
    if (!confirmar) return;

    setDeletandoLote(true);
    setMensagemAcao("");
    setErroAcao("");

    const listaSelecionados = [...selecionados];
    const mapaNomes = new Map(pacientes.map((paciente) => [paciente.id, paciente.nome]));

    const resultados = await Promise.all(
      listaSelecionados.map(async (pacienteId) => {
        try {
          const response = await api.delete(`/pacientes/${pacienteId}`);
          return {
            id: pacienteId,
            ok: true,
            mode: String(response.data?.mode || ""),
          };
        } catch (error: any) {
          return {
            id: pacienteId,
            ok: false,
            erro: String(error?.response?.data?.detail || error?.message || "Erro desconhecido"),
          };
        }
      })
    );

    const sucesso = resultados.filter((resultado) => resultado.ok);
    const falhas = resultados.filter((resultado) => !resultado.ok);
    const idsSucesso = new Set(sucesso.map((item) => item.id));
    const softDelete = sucesso.filter((item) => item.mode === "soft_delete").length;
    const hardDelete = sucesso.filter((item) => item.mode === "hard_delete").length;

    if (idsSucesso.size > 0) {
      setPacientes((prev) => prev.filter((paciente) => !idsSucesso.has(paciente.id)));
      setTotalPacientes((prev) => Math.max(0, prev - idsSucesso.size));
    }

    if (falhas.length > 0) {
      const resumoFalhas = falhas
        .slice(0, 3)
        .map((falha) => `${mapaNomes.get(falha.id) || `ID ${falha.id}`}: ${falha.erro}`)
        .join(" | ");
      setErroAcao(
        `Falha ao excluir ${falhas.length} paciente(s). ${resumoFalhas}${falhas.length > 3 ? " | ..." : ""}`
      );
    } else {
      setErroAcao("");
    }

    if (sucesso.length > 0) {
      const detalhes: string[] = [];
      if (hardDelete > 0) detalhes.push(`${hardDelete} removido(s)`);
      if (softDelete > 0) detalhes.push(`${softDelete} desativado(s)`);
      setMensagemAcao(`Exclusao em lote concluida: ${detalhes.join(" e ")}.`);
    } else {
      setMensagemAcao("");
    }

    setSelecionados((prev) => prev.filter((id) => !idsSucesso.has(id)));
    setDeletandoLote(false);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-gray-500">Gerencie os pacientes cadastrados</p>
          </div>
          <button
            onClick={() => router.push("/pacientes/novo")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Paciente
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalPacientes}</p>
              <p className="text-sm text-gray-500">Total de pacientes</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou tutor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {(mensagemAcao || erroAcao) && (
          <div className="space-y-2 mb-6">
            {mensagemAcao && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                {mensagemAcao}
              </div>
            )}
            {erroAcao && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{erroAcao}</div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhum paciente encontrado</p>
            </div>
          ) : (
            <div>
              <div className="px-4 py-3 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={todosFiltradosSelecionados}
                    onChange={alternarSelecionarFiltrados}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Selecionar visiveis ({idsFiltrados.length})
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{selecionados.length} selecionado(s)</span>
                  <button
                    onClick={excluirSelecionados}
                    disabled={selecionados.length === 0 || deletandoLote}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletandoLote ? "Excluindo..." : "Excluir selecionados"}
                  </button>
                </div>
              </div>

              <div className="divide-y">
                {pacientesFiltrados.map((paciente) => (
                  <div key={paciente.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 group">
                    <label className="flex-shrink-0 inline-flex items-center" title="Selecionar paciente">
                      <input
                        type="checkbox"
                        checked={selecionadosSet.has(paciente.id)}
                        onChange={() => alternarSelecaoPaciente(paciente.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      {getEspecieIcon(paciente.especie)}
                    </div>

                    <div className="flex-1 cursor-pointer" onClick={() => router.push(`/pacientes/${paciente.id}`)}>
                      <h3 className="font-medium text-gray-900">{paciente.nome}</h3>
                      <p className="text-sm text-gray-500">Tutor: {paciente.tutor || "Nao informado"}</p>
                    </div>

                    <div className="text-right text-sm text-gray-500 hidden sm:block">
                      {paciente.especie && <p>{paciente.especie}</p>}
                      {paciente.raca && <p className="text-gray-400">{paciente.raca}</p>}
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => router.push(`/pacientes/${paciente.id}`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
