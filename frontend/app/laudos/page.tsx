"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  getLaudoEditPath,
  getLaudoViewPath,
  getTipoLaudoLabel,
  TIPO_LAUDO_ELETROCARDIOGRAMA,
} from "@/lib/laudos";
import { baixarLaudoPdf, baixarLaudoPdfOriginal } from "@/lib/laudo-pdf";
import {
  Calendar,
  ChevronDown,
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
  tem_pdf_externo?: boolean;
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

function isLaudoPdfExterno(laudo: Laudo) {
  return laudo.tipo === TIPO_LAUDO_ELETROCARDIOGRAMA || Boolean(laudo.tem_pdf_externo);
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
  const novoLaudoMenuRef = useRef<HTMLDivElement | null>(null);
  const [novoLaudoMenuAberto, setNovoLaudoMenuAberto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [busca]);

  useEffect(() => {
    if (!novoLaudoMenuAberto) {
      return;
    }

    const handleClickFora = (event: MouseEvent) => {
      if (!novoLaudoMenuRef.current) {
        return;
      }

      if (!novoLaudoMenuRef.current.contains(event.target as Node)) {
        setNovoLaudoMenuAberto(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNovoLaudoMenuAberto(false);
      }
    };

    document.addEventListener("mousedown", handleClickFora);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [novoLaudoMenuAberto]);

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
      const laudo = laudos.find((item) => item.id === laudoId);
      const filename = `${titulo.replace(/\s+/g, "_")}.pdf`;
      if (laudo && isLaudoPdfExterno(laudo)) {
        await baixarLaudoPdfOriginal(laudoId, filename);
        return;
      }
      await baixarLaudoPdf(laudoId, filename);
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
      const notification = response.data?.notificacao_clinica;
      setLaudos((prev) =>
        prev.map((item) => (item.id === laudo.id ? { ...item, status: novoStatus } : item))
      );
      const successMessage =
        notification?.status === "sent" && notification?.destination_masked
          ? `Laudo liberado no portal da clinica parceira. Email enviado para ${notification.destination_masked}.`
          : "Laudo liberado no portal da clinica parceira.";
      alert(successMessage);
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

  const atalhosNovoLaudo = [
    {
      titulo: "Laudo estruturado",
      descricao: "Ecocardiograma e pressao arterial",
      href: "/laudos/novo",
    },
    {
      titulo: "Upload de eletrocardiograma",
      descricao: "PDF externo com fluxo de telemedicina",
      href: "/laudos/eletrocardiograma/upload",
    },
  ];

  const abrirNovoLaudo = (href: string) => {
    setNovoLaudoMenuAberto(false);
    router.push(href);
  };

  return (
    <DashboardLayout>
      <div className="fc-clinical-page">
        <header className="fc-clinical-header">
          <div>
            <span className="fc-clinical-kicker">
              <FileCheck className="h-4 w-4" />
              Documentação clínica
            </span>
            <h1>Central de laudos</h1>
            <p>Exames, documentos e liberações para o portal organizados por paciente.</p>
          </div>
          <div className="fc-clinical-primary-menu" ref={novoLaudoMenuRef}>
            <button
              type="button"
              onClick={() => setNovoLaudoMenuAberto((aberto) => !aberto)}
              className="fc-clinical-primary"
              aria-haspopup="menu"
              aria-expanded={novoLaudoMenuAberto}
            >
              <Plus className="w-4 h-4" />
              Novo Laudo
              <ChevronDown className={`h-4 w-4 transition ${novoLaudoMenuAberto ? "rotate-180" : ""}`} />
            </button>

            {novoLaudoMenuAberto && (
              <div className="fc-clinical-primary-menu-panel" role="menu" aria-label="Escolher fluxo de laudo">
                <div className="fc-clinical-primary-menu-header">
                  <strong>Escolha o fluxo</strong>
                  <span>Eletrocardiograma e telemedicina agora aparecem aqui.</span>
                </div>

                <div className="fc-clinical-primary-menu-list">
                  {atalhosNovoLaudo.map((atalho) => (
                    <button
                      key={atalho.href}
                      type="button"
                      className="fc-clinical-primary-menu-item"
                      role="menuitem"
                      onClick={() => abrirNovoLaudo(atalho.href)}
                    >
                      <span>{atalho.titulo}</span>
                      <small>{atalho.descricao}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="fc-clinical-tabs" role="tablist" aria-label="Tipo de documento">
          <button
            onClick={() => setTab("laudos")}
            className={`fc-clinical-tab ${tab === "laudos" ? "fc-clinical-tab-active" : ""}`}
            role="tab"
            aria-selected={tab === "laudos"}
          >
            <FileText className="h-4 w-4" />
            Laudos ({totalLaudos})
          </button>
          <button
            onClick={() => setTab("exames")}
            className={`fc-clinical-tab ${tab === "exames" ? "fc-clinical-tab-active" : ""}`}
            role="tab"
            aria-selected={tab === "exames"}
          >
            <FileCheck className="h-4 w-4" />
            Exames ({totalExames})
          </button>
        </div>

        <div className="fc-clinical-filters">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="fc-clinical-control flex-1">
              <Search className="h-5 w-5" />
              <input
                type="text"
                placeholder={
                  tab === "laudos"
                    ? "Buscar por animal, tutor ou clinica"
                    : "Buscar exames por tipo, status ou paciente"
                }
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {tab === "laudos" && (
              <>
                <div className="fc-clinical-control lg:w-56">
                  <Calendar className="h-5 w-5" />
                  <input
                    type="date"
                    value={dataFiltro}
                    onChange={(e) => setDataFiltro(e.target.value)}
                    aria-label="Filtrar laudos por data"
                  />
                </div>

                {(busca || dataFiltro) && (
                  <button
                    type="button"
                    onClick={limparFiltrosLaudos}
                    className="fc-clinical-secondary"
                  >
                    Limpar filtros
                  </button>
                )}
              </>
            )}
          </div>

          {tab === "laudos" && (
            <p className="fc-clinical-filter-note">
              A busca consulta toda a base. A lista abre mostrando apenas os {LAUDOS_PAGE_SIZE} laudos mais recentes.
            </p>
          )}
        </div>

        <div className="fc-clinical-list">
          <div className="fc-clinical-list-summary">
            {tab === "laudos"
              ? resumoLaudos
              : `Mostrando ${examesFiltrados.length} de ${totalExames} exame(s)`}
          </div>

          {tab === "laudos" ? (
            loadingLaudos ? (
              <div className="fc-registry-loading" aria-label="Carregando laudos">
                {[0, 1, 2].map((item) => <span key={item} />)}
              </div>
            ) : laudos.length === 0 ? (
              <div className="fc-registry-empty">
                <div><FileText className="h-6 w-6" /></div>
                <span>Arquivo clínico vazio</span>
                <p>Nenhum laudo encontrado</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-ink-100">
                  {laudos.map((laudo) => (
                    <div key={laudo.id} className="fc-clinical-row">
                      <div className="fc-clinical-row-layout">
                        <div className="fc-clinical-row-icon">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="fc-clinical-row-main">
                          <h3>
                            {laudo.paciente_nome || `Paciente #${laudo.paciente_id}`}
                          </h3>
                          <div>
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
                        <div className="fc-clinical-actions">
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
                              className="fc-clinical-action"
                              title="Liberar no portal da clinica"
                              aria-label={`Liberar laudo de ${laudo.paciente_nome || `paciente ${laudo.paciente_id}`} no portal`}
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => router.push(getLaudoViewPath(laudo.id, laudo.tipo))}
                            className="fc-clinical-action"
                            title="Visualizar"
                            aria-label={`Visualizar laudo de ${laudo.paciente_nome || `paciente ${laudo.paciente_id}`}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isLaudoPdfExterno(laudo) && (
                            <button
                              onClick={() => router.push(getLaudoEditPath(laudo.id, laudo.tipo))}
                              className="fc-clinical-action"
                              title="Editar"
                              aria-label={`Editar laudo de ${laudo.paciente_nome || `paciente ${laudo.paciente_id}`}`}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => downloadPDF(laudo.id, laudo.titulo)}
                            className="fc-clinical-action"
                            title="Baixar PDF"
                            aria-label={`Baixar PDF do laudo de ${laudo.paciente_nome || `paciente ${laudo.paciente_id}`}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletarLaudo(laudo.id)}
                            className="fc-clinical-action fc-clinical-action-danger"
                            title="Excluir"
                            aria-label={`Excluir laudo de ${laudo.paciente_nome || `paciente ${laudo.paciente_id}`}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {haMaisLaudos && (
                  <div className="fc-clinical-load-more">
                    <button
                      type="button"
                      onClick={carregarMaisLaudos}
                      disabled={loadingMoreLaudos}
                      className="fc-clinical-secondary"
                    >
                      {loadingMoreLaudos ? "Carregando..." : "Carregar mais laudos"}
                    </button>
                  </div>
                )}
              </>
            )
          ) : loadingExames ? (
            <div className="fc-registry-loading" aria-label="Carregando exames">
              {[0, 1, 2].map((item) => <span key={item} />)}
            </div>
          ) : examesFiltrados.length === 0 ? (
            <div className="fc-registry-empty">
              <div><FileCheck className="h-6 w-6" /></div>
              <span>Fila de exames vazia</span>
              <p>Nenhum exame encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {examesFiltrados.map((exame) => (
                <div key={exame.id} className="fc-clinical-row">
                  <div className="fc-clinical-row-layout">
                    <div className="fc-clinical-row-icon fc-clinical-row-icon-exam">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="fc-clinical-row-main">
                      <h3>{exame.tipo_exame}</h3>
                      <div>
                        <span>Paciente #{exame.paciente_id}</span>
                        <span>R$ {exame.valor?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="fc-clinical-actions">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(exame.status)}`}>
                        {exame.status}
                      </span>
                      <button
                        onClick={() => deletarExame(exame.id)}
                        className="fc-clinical-action fc-clinical-action-danger"
                        title="Excluir"
                        aria-label={`Excluir exame ${exame.tipo_exame}`}
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
