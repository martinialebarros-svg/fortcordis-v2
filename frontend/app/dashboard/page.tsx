"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Calendar,
  Users,
  Building2,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PawPrint,
  PlusCircle,
  RefreshCw
} from "lucide-react";

interface DashboardStats {
  totalAgendamentos: number;
  agendamentosHoje: number;
  confirmados: number;
  pendentes: number;
  totalPacientes: number;
  totalClinicas: number;
  totalServicos: number;
}

interface AgendamentoHoje {
  id: number;
  paciente: string;
  tutor: string;
  hora: string;
  status: string;
  servico: string;
}

type DashboardTone = "cordis" | "vital" | "ink" | "amber";
type MonitorTone = "ok" | "alert" | "network";

interface DashboardMetric {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone: DashboardTone;
  detail: string;
  signal: string;
}

interface QuickAction {
  href: string;
  label: string;
  caption: string;
  Icon: LucideIcon;
  tone: DashboardTone;
  primary?: boolean;
}

const formatLocalDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function EcgTrace({ compact = false, stretched = false }: { compact?: boolean; stretched?: boolean }) {
  return (
    <svg
      viewBox={compact ? "0 0 130 28" : "0 0 620 250"}
      preserveAspectRatio={stretched ? "none" : undefined}
      aria-hidden="true"
    >
      {compact ? (
        <path
          d="M2 16H18C23 16 25 12 30 12C35 12 37 16 42 16H52L56 20L62 5L69 25L76 16H84C93 16 96 10 106 10C116 10 119 16 128 16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      ) : (
        <>
          <defs>
            <linearGradient id="fc-hero-wave" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#fecdd3" />
              <stop offset="52%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#5eead4" />
            </linearGradient>
          </defs>
          <path
            d="M14 136H66C78 136 83 124 94 124C106 124 112 136 126 136H154L166 154L184 72L206 196L228 136H250C276 136 286 116 316 116C346 116 356 136 382 136H416C428 136 433 124 444 124C456 124 462 136 476 136H504L516 154L534 76L556 190L578 136H592C606 136 612 126 620 126"
            fill="none"
            stroke="url(#fc-hero-wave)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="10"
          />
          <path
            d="M14 137H604"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeDasharray="7 22"
            strokeWidth="3"
          />
          <circle cx="184" cy="72" r="8" fill="#14b8a6" />
          <circle cx="534" cy="76" r="8" fill="#14b8a6" />
        </>
      )}
    </svg>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metric.Icon;

  return (
    <article className={`fc-metric-tile fc-metric-${metric.tone}`}>
      <div className="fc-metric-icon">
        <Icon className="h-5 w-5" />
      </div>
      <span className="fc-metric-signal">{metric.signal}</span>
      <div className="fc-metric-main">
        <strong>{metric.value}</strong>
        <span>{metric.label}</span>
      </div>
      <p>{metric.detail}</p>
      <div className="fc-mini-wave" aria-hidden="true">
        <EcgTrace compact />
      </div>
    </article>
  );
}

function QuickActionLink({ action }: { action: QuickAction }) {
  const Icon = action.Icon;

  return (
    <Link
      href={action.href}
      className={`group fc-action-command fc-action-command-${action.tone} ${
        action.primary ? "fc-action-command-primary" : ""
      }`}
    >
      <span className="fc-action-icon">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{action.label}</span>
        <span className="block truncate text-xs font-semibold text-ink-500 group-hover:text-cordis-600">
          {action.caption}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 justify-self-end opacity-40 transition group-hover:translate-x-1 group-hover:opacity-100" />
    </Link>
  );
}

function DashboardLoadingState() {
  return (
    <div className="fc-dashboard-skeleton" role="status" aria-label="Carregando dashboard">
      {[0, 1, 2, 3].map((item) => (
        <span key={item} className="fc-skeleton-card" />
      ))}
    </div>
  );
}

function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="fc-error-panel" role="alert">
      <div>
        <span>Sincronização interrompida</span>
        <h2>Não foi possível atualizar o painel</h2>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </button>
    </section>
  );
}

function EmptyAgendaState() {
  return (
    <div className="fc-empty-stage">
      <div className="fc-empty-visual" aria-hidden="true">
        <div className="fc-empty-badge">
          <Calendar className="h-5 w-5" />
          <span>0</span>
        </div>
        <EcgTrace stretched />
      </div>
      <div>
        <p className="fc-empty-title">Agenda em repouso</p>
        <p className="fc-empty-copy">
          Nenhum agendamento para hoje. Use a agenda para criar o próximo horário clínico.
        </p>
        <Link href="/agenda" className="fc-empty-action">
          <PlusCircle className="h-4 w-4" />
          Criar agendamento
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgendamentos: 0,
    agendamentosHoje: 0,
    confirmados: 0,
    pendentes: 0,
    totalPacientes: 0,
    totalClinicas: 0,
    totalServicos: 0,
  });
  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoHoje[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      setLoading(false);
      return;
    }

    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Buscar agendamentos de hoje
      const hoje = formatLocalDateForApi(new Date());
      const respAgenda = await api.get(`/agenda?data_inicio=${hoje}T00:00:00&data_fim=${hoje}T23:59:59`);
      const agendamentos = respAgenda.data.items || [];

      // Buscar totais
      const [respPacientes, respClinicas, respServicos] = await Promise.all([
        api.get('/pacientes'),
        api.get('/clinicas'),
        api.get('/servicos'),
      ]);

      const confirmados = agendamentos.filter((a: any) => a.status === 'Confirmado').length;
      const pendentes = agendamentos.filter((a: any) => a.status === 'Agendado' || a.status === 'Reservado').length;

      setStats({
        totalAgendamentos: agendamentos.length,
        agendamentosHoje: agendamentos.length,
        confirmados,
        pendentes,
        totalPacientes: respPacientes.data.total || 0,
        totalClinicas: respClinicas.data.total || 0,
        totalServicos: respServicos.data.total || 0,
      });

      // Próximos agendamentos (ordenados por hora)
      setAgendamentosHoje(
        agendamentos
          .sort((a: any, b: any) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
          .slice(0, 5)
          .map((a: any) => ({
            id: a.id,
            paciente: a.paciente,
            tutor: a.tutor,
            hora: new Date(a.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: a.status,
            servico: a.servico,
          }))
      );
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        return;
      }

      console.error("Erro ao carregar dashboard:", error);
      setErrorMessage("Confira a conexão com o servidor e tente sincronizar novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmado': return <CheckCircle2 className="w-5 h-5 text-vital-600" />;
      case 'Cancelado': return <XCircle className="w-5 h-5 text-cordis-600" />;
      case 'Agendado': return <Clock className="w-5 h-5 text-cordis-600" />;
      case 'Reservado': return <Clock className="w-5 h-5 text-amber-600" />;
      default: return <AlertCircle className="w-5 h-5 text-ink-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmado': return 'border-vital-100 bg-vital-50 text-vital-700';
      case 'Cancelado': return 'border-cordis-100 bg-cordis-50 text-cordis-700';
      case 'Agendado': return 'border-cordis-100 bg-cordis-50 text-cordis-700';
      case 'Reservado': return 'border-amber-100 bg-amber-50 text-amber-700';
      default: return 'border-ink-100 bg-ink-50 text-ink-700';
    }
  };

  const hojeFormatado = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(new Date());

  const commandStats: Array<{ label: string; value: number; tone: MonitorTone }> = [
    {
      label: "confirmados",
      value: stats.confirmados,
      tone: "ok",
    },
    {
      label: "pendentes",
      value: stats.pendentes,
      tone: "alert",
    },
    {
      label: "clinicas",
      value: stats.totalClinicas,
      tone: "network",
    },
  ];

  const boardMetrics: DashboardMetric[] = [
    {
      label: "Agendamentos hoje",
      value: stats.agendamentosHoje,
      Icon: Calendar,
      tone: "cordis",
      detail: `${stats.confirmados} confirmados / ${stats.pendentes} pendentes`,
      signal: "Dia clínico",
    },
    {
      label: "Pacientes",
      value: stats.totalPacientes,
      Icon: Users,
      tone: "vital",
      detail: "Total cadastrados",
      signal: "Carteira ativa",
    },
    {
      label: "Clínicas",
      value: stats.totalClinicas,
      Icon: Building2,
      tone: "ink",
      detail: "Parceiras ativas",
      signal: "Rede assistida",
    },
    {
      label: "Serviços",
      value: stats.totalServicos,
      Icon: Stethoscope,
      tone: "amber",
      detail: "Disponíveis",
      signal: "Catálogo",
    },
  ];

  const quickActions: QuickAction[] = [
    {
      href: "/agenda",
      label: "Criar agendamento",
      caption: "Novo horário clínico",
      Icon: PlusCircle,
      tone: "cordis",
      primary: true,
    },
    {
      href: "/agenda",
      label: "Ver agenda",
      caption: "Agenda do dia",
      Icon: Calendar,
      tone: "cordis",
    },
    {
      href: "/pacientes",
      label: "Pacientes",
      caption: "Base clínica",
      Icon: Users,
      tone: "vital",
    },
    {
      href: "/clinicas",
      label: "Clínicas",
      caption: "Rede parceira",
      Icon: Building2,
      tone: "ink",
    },
    {
      href: "/servicos",
      label: "Serviços",
      caption: "Catálogo",
      Icon: Stethoscope,
      tone: "amber",
    },
  ];

  return (
    <DashboardLayout>
      <div className="fc-page fc-dashboard-page">
        <section className="fc-dashboard-hero" aria-label="Resumo operacional Fort Cordis">
          <div className="fc-hero-copy">
            <div className="fc-hero-brand">
              <div className="fc-hero-brand-card">
                <img
                  src="/brand/fortcordis-logo-oficial.png"
                  alt="Fort Cordis"
                  className="fc-command-seal"
                />
                <div>
                  <span>Fort Cordis</span>
                  <small>Cardiologia veterinária</small>
                </div>
              </div>
            </div>

            <div className="fc-hero-kicker">
              <Activity className="h-4 w-4" />
              Central clínica
            </div>
            <h1 className="fc-hero-title">Painel operacional Fort Cordis</h1>
            <p className="fc-hero-subtitle">Agenda, pacientes e rede de atendimento em uma leitura rápida.</p>
            <div className="fc-hero-tags">
              <span>
                <Clock className="h-4 w-4" />
                {hojeFormatado}
              </span>
              <span>
                <PawPrint className="h-4 w-4" />
                {loading ? "Sincronizando" : "Operação local"}
              </span>
            </div>
          </div>

          <div className="fc-heart-console" aria-label="ECG operacional e indicadores de status">
            <div className="fc-monitor-topline">
              <span>ECG operacional</span>
              <span>ao vivo</span>
            </div>
            <div className="fc-monitor-screen">
              <EcgTrace />
            </div>
            <div className="fc-monitor-footer">
              {commandStats.map((item) => (
                <div key={item.label} className={`fc-monitor-chip fc-monitor-chip-${item.tone}`}>
                  <strong>{loading ? "--" : item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fc-today-orbit">
            <span>Hoje</span>
            <div className="fc-today-summary">
              <strong>{loading ? "--" : stats.agendamentosHoje}</strong>
              <small>eventos clínicos</small>
            </div>
            <div className="fc-today-breakdown">
              <span>{stats.confirmados} confirmados</span>
              <span>{stats.pendentes} pendentes</span>
              <span>{stats.totalClinicas} clínicas</span>
            </div>
          </div>
        </section>

        {loading ? (
          <DashboardLoadingState />
        ) : errorMessage ? (
          <DashboardErrorState message={errorMessage} onRetry={carregarDados} />
        ) : (
          <>
            <section className="fc-metric-ribbon" aria-label="Indicadores principais">
              {boardMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>

            <div className="fc-dashboard-workbench">
              <section className="fc-agenda-theater">
                <div className="fc-section-heading">
                  <div>
                    <span>Agenda de hoje</span>
                    <h2>Fluxo clínico</h2>
                  </div>
                  <div className="fc-section-actions">
                    <strong>{agendamentosHoje.length}</strong>
                    <Link href="/agenda" className="fc-section-button">Abrir agenda</Link>
                  </div>
                </div>
                <div className="fc-agenda-stage">
                  {agendamentosHoje.length === 0 ? (
                    <EmptyAgendaState />
                  ) : (
                    <div className="fc-timeline">
                      {agendamentosHoje.map((ag) => (
                        <div key={ag.id} className="fc-timeline-row">
                          <div className="fc-timeline-time">{ag.hora}</div>
                          <div className="fc-timeline-dot">
                            {getStatusIcon(ag.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-ink-900">{ag.paciente}</p>
                            <p className="truncate text-sm text-ink-500">{ag.tutor}</p>
                            {ag.servico && (
                              <p className="text-xs text-ink-400">{ag.servico}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`rounded-full border px-2 py-1 text-xs ${getStatusColor(ag.status)}`}>
                              {ag.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="fc-action-dock">
                <div className="fc-section-heading">
                  <div>
                    <span>Ações rápidas</span>
                    <h2>Atalhos</h2>
                  </div>
                </div>
                <div className="fc-action-list">
                  {quickActions.map((action) => (
                    <QuickActionLink key={`${action.href}-${action.label}`} action={action} />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
