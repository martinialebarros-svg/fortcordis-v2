"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { getLaudoEditPath, getLaudoViewPath, getTipoLaudoLabel } from "@/lib/laudos";
import { baixarLaudoPdf } from "@/lib/laudo-pdf";
import {
  Calendar,
  Clock,
  Download,
  Edit,
  Eye,
  FileCheck,
  FileText,
  Plus,
  Search,
  Send,
  Trash2,
  User,
} from "lucide-react";

interface Laudo {
  id: number;
  paciente_id: number;
  paciente_nome?: string;
  paciente_tutor?: string;
  clinica?: string;
  clinic_id?: number | null;
  tipo: string;
  titulo: string;
  status: string;
  data_laudo: string;
  data_exame?: string;
}

interface Exame {
  id: number;
  paciente_id: number;
  tipo_exame: string;
  status: string;
  valor: number;
  data_solicitacao: string;
}

const LAUDOS_PAGE_SIZE = 100;
const PORTAL_RELEASE_STATUS = "Liberado no portal";

function isPortalReleased(status?: string) {
  return status === PORTAL_RELEASE_STATUS;
}

function getResponseTotal(payload: { total?: number } | undefined, fallback: number) {
  return typeof payload?.total === "number" ? payload.total : fallback;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    Rascunho: "bg-gray-100 text-gray-800",
    Finalizado: "bg-green-100 text-green-800",
    Arquivado: "bg-blue-100 text-blue-800",
    Solicitado: "bg-yellow-100 text-yellow-800",
    "Em andamento": "bg-blue-100 text-blue-800",
    Concluido: "bg-green-100 text-green-800",
    [PORTAL_RELEASE_STATUS]: "bg-teal-100 text-teal-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export default function LaudosPage() {
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [totalLaudos, setTotalLaudos] = useState(0);
  const [exames, setExames] = useState<Exame[]>([]);
  const [totalExames, setTotalExames] = useState(0);
  const [tab, setTab] = useState<"laudos" | "exames">("laudos");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [dataFiltro, setDataFiltro] = useState("");
  const [loadingLaudos, setLoadingLaudos] = useState(true);
  const [loadingExames, setLoadingExames] = useState(true);
  const [loadingMoreLaudos, setLoadingMoreLaudos] = useState(false);
  const [liberandoLaudoId, setLiberandoLaudoId] = useState<number | null>(null);
  const laudosRequestIdRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [busca]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    let ativo = true;

    const carregarExames = async () => {
      setLoadingExames(true);

      try {
        const response = await api.get("/exames");
        if (!ativo) {
          return;
        }

        const items = response.data.items || [];
        setExames(items);
        setTotalExames(getResponseTotal(response.data, items.length));
      } catch (error) {
        if (!ativo) {
          return;
        }

        console.error("Erro ao carregar exames:", error);
        setExames([]);
        setTotalExames(0);
      } finally {
        if (ativo) {
          setLoadingExames(false);
        }
      }
    };

    carregarExames();

    return () => {
      ativo = false;
    };
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    if (tab !== "laudos") {
      return;
    }

    let ativo = true;
    const requestId = ++laudosRequestIdRef.current;

    const carregarLaudos = async () => {
      setLoadingLaudos(true);

      try {
        const response = await api.get("/laudos", {
          params: {
            skip: 0,
            limit: LAUDOS_PAGE_SIZE,
            search: buscaAplicada || undefined,
            data: dataFiltro || undefined,
          },
        });

        if (!ativo || requestId !== laudosRequestIdRef.current) {
          return;
        }

        const items = response.data.items || [];
        setLaudos(items);
        setTotalLaudos(getResponseTotal(response.data, items.length));
      } catch (error) {
        if (!ativo || requestId !== laudosRequestIdRef.current) {
          return;
        }

        console.error("Erro ao carregar laudos:", error);
        setLaudos([]);
        setTotalLaudos(0);
      } finally {
        if (ativo && requestId === laudosRequestIdRef.current) {
          setLoadingLaudos(false);
        }
      }
    };

    carregarLaudos();

    return () => {
      ativo = false;
    };
  }, [buscaAplicada, dataFiltro, router, tab]);

  const examesFiltrados = exames.filter((exame) => {
    if (!busca.trim()) {
      return true;
    }

    const termo = busca.toLowerCase();
    return (
      exame.tipo_exame?.toLowerCase().includes(termo) ||
      exame.status?.toLowerCase().includes(termo) ||
      exame.paciente_id?.toString().includes(termo)
    );
  });

  const filtrosLaudosAtivos = Boolean(buscaAplicada || dataFiltro);
  const haMaisLaudos = laudos.length < totalLaudos;
  const resumoLaudos = filtrosLaudosAtivos
    ? `Mostrando ${laudos.length} de ${totalLaudos} resultado(s)`
    : haMaisLaudos
      ? `Mostrando ${laudos.length} laudos mais recentes de ${totalLaudos}`
      : `${totalLaudos} laudo(s)`;

  const downloadPDF = async (laudoId: number, titulo: string) => {
    try {
      await baixarLaudoPdf(laudoId, `${titulo.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      alert("Erro ao gerar PDF. Tente novamente.");
    }
  };

  const liberarNoPortalClinica = async (laudo: Laudo) => {
    if (isPortalReleased(laudo.status)) {
      return;
    }
    if (!laudo.clinic_id) {
      alert("Vincule uma clinica ao laudo antes de liberar no portal.");
      return;
    }
    if (!confirm("Liberar este laudo para o portal da clinica parceira?")) {
      return;
    }

    setLiberandoLaudoId(laudo.id);
    try {
      const response = await api.post(`/laudos/${laudo.id}/portal/liberar-clinica`);
      const novoStatus = response.data?.status || PORTAL_RELEASE_STATUS;
      setLaudos((prev) =>
        prev.map((item) => (item.id === laudo.id ? { ...item, status: novoStatus } : item))
      );
      alert("Laudo liberado no portal da clinica parceira.");
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(detail || "Erro ao liberar laudo no portal. Tente novamente.");
    } finally {
      setLiberandoLaudoId(null);
    }
  };

  const carregarMaisLaudos = async () => {
    if (loadingMoreLaudos || !haMaisLaudos) {
      return;
    }

    const requestId = ++laudosRequestIdRef.current;
    setLoadingMoreLaudos(true);

    try {
      const response = await api.get("/laudos", {
        params: {
          skip: laudos.length,
          limit: LAUDOS_PAGE_SIZE,
          search: buscaAplicada || undefined,
          data: dataFiltro || undefined,
        },
      });

      if (requestId !== laudosRequestIdRef.current) {
        return;
      }

      const items = response.data.items || [];
      setLaudos((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const novos = items.filter((item: Laudo) => !ids.has(item.id));
        return [...prev, ...novos];
      });
      setTotalLaudos(getResponseTotal(response.data, totalLaudos));
    } catch (error) {
      if (requestId !== laudosRequestIdRef.current) {
        return;
      }

      console.error("Erro ao carregar mais laudos:", error);
    } finally {
      if (requestId === laudosRequestIdRef.current) {
        setLoadingMoreLaudos(false);
      }
    }
  };

  const limparFiltrosLaudos = () => {
    setBusca("");
    setBuscaAplicada("");
    setDataFiltro("");
  };

  const deletarLaudo = async (laudoId: number) => {
    if (!confirm("Tem certeza que deseja excluir este laudo? Esta acao nao pode ser desfeita.")) {
      return;
    }

    try {
      await api.delete(`/laudos/${laudoId}`);
      setLaudos((prev) => prev.filter((laudo) => laudo.id !== laudoId));
      setTotalLaudos((prev) => Math.max(prev - 1, 0));
      alert("Laudo excluido com sucesso!");
    } catch (error) {
      alert("Erro ao excluir laudo. Tente novamente.");
    }
  };

  const deletarExame = async (exameId: number) => {
    if (!confirm("Tem certeza que deseja excluir este exame? Esta acao nao pode ser desfeita.")) {
      return;
    }

    try {
      await api.delete(`/exames/${exameId}`);
      setExames((prev) => prev.filter((exame) => exame.id !== exameId));
      setTotalExames((prev) => Math.max(prev - 1, 0));
      alert("Exame excluido com sucesso!");
    } catch (error) {
      alert("Erro ao excluir exame. Tente novamente.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Laudos e Exames</h1>
            <p className="text-gray-500">Gerencie laudos medicos e exames</p>
          </div>
          <button
            onClick={() => router.push("/laudos/novo")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Laudo
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("laudos")}
            className={`px-4 py-2 rounded-lg font-medium ${
              tab === "laudos"
                ? "bg-teal-100 text-teal-700"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Laudos ({totalLaudos})
          </button>
          <button
            onClick={() => setTab("exames")}
            className={`px-4 py-2 rounded-lg font-medium ${
              tab === "exames"
                ? "bg-teal-100 text-teal-700"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FileCheck className="w-4 h-4 inline mr-2" />
            Exames ({totalExames})
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={
                  tab === "laudos"
                    ? "Buscar por animal, tutor ou clinica"
                    : "Buscar exames por tipo, status ou paciente"
                }
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {tab === "laudos" && (
              <>
                <div className="relative lg:w-56">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={dataFiltro}
                    onChange={(e) => setDataFiltro(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    aria-label="Filtrar laudos por data"
                  />
                </div>

                {(busca || dataFiltro) && (
                  <button
                    type="button"
                    onClick={limparFiltrosLaudos}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Limpar filtros
                  </button>
                )}
              </>
            )}
          </div>

          {tab === "laudos" && (
            <p className="mt-3 text-xs text-gray-500">
              A busca consulta toda a base. A lista abre mostrando apenas os {LAUDOS_PAGE_SIZE} laudos mais recentes.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 text-sm text-gray-600">
            {tab === "laudos"
              ? resumoLaudos
              : `Mostrando ${examesFiltrados.length} de ${totalExames} exame(s)`}
          </div>

          {tab === "laudos" ? (
            loadingLaudos ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : laudos.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum laudo encontrado</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {laudos.map((laudo) => (
                    <div key={laudo.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {laudo.paciente_nome || `Paciente #${laudo.paciente_id}`}
                          </h3>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {laudo.paciente_tutor || "Sem tutor"}
                            </span>
                            {laudo.clinica && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {laudo.clinica}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(laudo.data_exame || laudo.data_laudo).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full text-xs bg-indigo-100 text-indigo-800">
                            {getTipoLaudoLabel(laudo.tipo)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(laudo.status)}`}>
                            {laudo.status}
                          </span>
                          {!isPortalReleased(laudo.status) && (
                            <button
                              onClick={() => liberarNoPortalClinica(laudo)}
                              disabled={liberandoLaudoId === laudo.id}
                              className="p-2 text-gray-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Liberar no portal da clinica"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => router.push(getLaudoViewPath(laudo.id, laudo.tipo))}
                            className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(getLaudoEditPath(laudo.id, laudo.tipo))}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadPDF(laudo.id, laudo.titulo)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Baixar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletarLaudo(laudo.id)}
                            className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {haMaisLaudos && (
                  <div className="p-4 border-t bg-gray-50 flex justify-center">
                    <button
                      type="button"
                      onClick={carregarMaisLaudos}
                      disabled={loadingMoreLaudos}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-60"
                    >
                      {loadingMoreLaudos ? "Carregando..." : "Carregar mais laudos"}
                    </button>
                  </div>
                )}
              </>
            )
          ) : loadingExames ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : examesFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum exame encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {examesFiltrados.map((exame) => (
                <div key={exame.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{exame.tipo_exame}</h3>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1">
                        <span>Paciente #{exame.paciente_id}</span>
                        <span>R$ {exame.valor?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(exame.status)}`}>
                        {exame.status}
                      </span>
                      <button
                        onClick={() => deletarExame(exame.id)}
                        className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
