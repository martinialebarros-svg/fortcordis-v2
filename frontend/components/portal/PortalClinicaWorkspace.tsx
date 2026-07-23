"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileCheck2,
  Filter,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  PawPrint,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Users,
} from "lucide-react";

import {
  clearPortalSession,
  createPortalExamDownloadUrls,
  downloadPortalAttachment,
  listPortalClinicExams,
  loadPortalSession,
  loginClinicPortal,
  logoutClinicPortal,
  refreshClinicPortalSession,
  requestClinicPasswordReset,
  savePortalSession,
  verifyClinicPortalMfa,
  type PortalClinicAuthResponse,
  type PortalClinicExamFilters,
  type PortalClinicOperationalItem,
  type PortalClinicOperationalSummary,
  type PortalExamItem,
  type PortalSessionResponse,
} from "@/lib/portal-api";
import { formatPortalDate, formatPortalDateTime, portalDateTimeMillis } from "@/lib/portal-datetime";

type ClinicSortBy = NonNullable<PortalClinicExamFilters["sort_by"]>;
type ClinicSortDir = NonNullable<PortalClinicExamFilters["sort_dir"]>;

type ClinicExamFiltersState = {
  q: string;
  pet: string;
  tutor: string;
  especie: string;
  tipo_exame: string;
  status_exame: string;
  data_inicio: string;
  data_fim: string;
  sort_by: ClinicSortBy;
  sort_dir: ClinicSortDir;
};

const INITIAL_FILTERS: ClinicExamFiltersState = {
  q: "",
  pet: "",
  tutor: "",
  especie: "",
  tipo_exame: "",
  status_exame: "",
  data_inicio: "",
  data_fim: "",
  sort_by: "data",
  sort_dir: "desc",
};

const EMPTY_OPERATIONAL_SUMMARY: PortalClinicOperationalSummary = {
  realizados_hoje: 0,
  em_laudo: 0,
  aguardando_liberacao: 0,
  liberados_hoje: 0,
  sla_horas: 48,
};

const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  liberado_portal: "Liberado no portal",
  aguardando_liberacao: "Aguardando liberação",
  em_laudo: "Em laudo",
  em_andamento: "Em andamento",
};

function operationalStatusClasses(statusKey: string): string {
  switch (statusKey) {
    case "liberado_portal":
      return "bg-teal-50 text-teal-800";
    case "aguardando_liberacao":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatFileSize(value: number | null): string {
  if (!value || value <= 0) {
    return "-";
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${value} B`;
}

function normalizeClinicSession(payload: PortalClinicAuthResponse): PortalSessionResponse {
  if (!payload.access_token || !payload.expires_at || payload.actor_type !== "clinica" || !payload.actor_id) {
    throw new Error("Sessão da clínica retornou incompleta.");
  }
  return {
    access_token: payload.access_token,
    token_type: payload.token_type || "bearer",
    expires_at: payload.expires_at,
    actor_type: "clinica",
    actor_id: payload.actor_id,
    clinica_id: payload.clinica_id ?? payload.actor_id,
    paciente_id: null,
    account_id: payload.account_id ?? null,
    auth_method: payload.auth_method ?? null,
    trusted_session_expires_at: payload.trusted_session_expires_at ?? null,
    scope: payload.scope || [],
    message: payload.message ?? null,
  };
}

function examDateValue(exam: PortalExamItem): string | null {
  return exam.data_exame || exam.data_solicitacao || exam.data_resultado || null;
}

function examExecutionDateValue(exam: PortalExamItem): string | null {
  return exam.data_exame || exam.data_solicitacao || null;
}

function compactFilters(filters: ClinicExamFiltersState): PortalClinicExamFilters {
  return {
    q: filters.q.trim() || undefined,
    pet: filters.pet.trim() || undefined,
    tutor: filters.tutor.trim() || undefined,
    especie: filters.especie.trim() || undefined,
    tipo_exame: filters.tipo_exame.trim() || undefined,
    status_exame: filters.status_exame.trim() || undefined,
    data_inicio: filters.data_inicio || undefined,
    data_fim: filters.data_fim || undefined,
    sort_by: filters.sort_by,
    sort_dir: filters.sort_dir,
    limit: 100,
  };
}

export default function PortalClinicaWorkspace() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [session, setSession] = useState<PortalSessionResponse | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [mfaCode, setMfaCode] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [filters, setFilters] = useState<ClinicExamFiltersState>(INITIAL_FILTERS);
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const [exams, setExams] = useState<PortalExamItem[]>([]);
  const [operationalSummary, setOperationalSummary] = useState<PortalClinicOperationalSummary>(
    EMPTY_OPERATIONAL_SUMMARY,
  );
  const [operationalItems, setOperationalItems] = useState<PortalClinicOperationalItem[]>([]);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dashboardStats = useMemo(() => {
    const petIds = new Set(exams.map((exam) => exam.paciente_id));
    const attachments = exams.reduce(
      (total, exam) => total + exam.anexos.filter((attachment) => attachment.download_available).length,
      0,
    );
    const latestTimestamp = exams
      .map((exam) => portalDateTimeMillis(examDateValue(exam)))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0];

    return {
      totalExams: totalAvailable,
      visibleExams: exams.length,
      pets: petIds.size,
      attachments,
      latestDate: latestTimestamp ? formatPortalDate(new Date(latestTimestamp).toISOString()) : "-",
    };
  }, [exams, totalAvailable]);

  async function hydrateClinicSession() {
    const storedSession = loadPortalSession("clinica");
    if (storedSession) {
      setSession(storedSession);
      setBootstrapping(false);
      return;
    }

    try {
      const refreshed = normalizeClinicSession(await refreshClinicPortalSession());
      savePortalSession(refreshed);
      setSession(refreshed);
      setMessage(refreshed.message || "Sessão da clínica restaurada neste computador.");
    } catch {
      clearPortalSession("clinica");
    } finally {
      setBootstrapping(false);
    }
  }

  async function ensureClinicSession(currentSession: PortalSessionResponse | null): Promise<PortalSessionResponse> {
    if (currentSession && portalDateTimeMillis(currentSession.expires_at) > Date.now() + 30_000) {
      return currentSession;
    }

    const refreshed = normalizeClinicSession(await refreshClinicPortalSession());
    savePortalSession(refreshed);
    setSession(refreshed);
    return refreshed;
  }

  async function loadClinicDashboard(
    activeSession: PortalSessionResponse,
    nextFilters: ClinicExamFiltersState = filters,
  ) {
    setSearchLoading(true);
    setError("");
    setMessage("");

    try {
      const usableSession = await ensureClinicSession(activeSession);
      const response = await listPortalClinicExams(compactFilters(nextFilters), usableSession.access_token);
      setExams(response.items);
      setOperationalSummary(response.operational_summary ?? EMPTY_OPERATIONAL_SUMMARY);
      setOperationalItems(response.operational_items ?? []);
      setClinicName(response.clinica_nome || null);
      setTotalAvailable(response.total);
      setDashboardLoaded(true);
      if (response.total === 0) {
        setMessage("Nenhum exame liberado foi encontrado para os filtros aplicados.");
      }
    } catch (err) {
      setExams([]);
      setOperationalSummary(EMPTY_OPERATIONAL_SUMMARY);
      setOperationalItems([]);
      setTotalAvailable(0);
      setError(err instanceof Error ? err.message : "Não foi possível carregar o painel da clínica.");
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    void hydrateClinicSession();
  }, []);

  useEffect(() => {
    if (session) {
      void loadClinicDashboard(session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await loginClinicPortal({
        email: email.trim(),
        password,
        remember_device_until_shift_end: rememberDevice,
      });

      if (response.mfa_required) {
        setMfaChallengeId(response.challenge_id || null);
        setMfaCode("");
        setMessage(response.message || "Enviamos um código adicional para o e-mail institucional.");
        return;
      }

      const nextSession = normalizeClinicSession(response);
      savePortalSession(nextSession);
      setSession(nextSession);
      setMfaChallengeId(null);
      setPassword("");
      setMessage(response.message || "Sessão da clínica iniciada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a sessão da clínica.");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleVerifyMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaChallengeId) {
      return;
    }

    setVerifyLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await verifyClinicPortalMfa({
        challenge_id: mfaChallengeId,
        codigo: mfaCode.trim(),
        remember_device_until_shift_end: rememberDevice,
      });
      const nextSession = normalizeClinicSession(response);
      savePortalSession(nextSession);
      setSession(nextSession);
      setMfaChallengeId(null);
      setMfaCode("");
      setPassword("");
      setMessage(response.message || "Sessão da clínica iniciada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o acesso da clínica.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await requestClinicPasswordReset({
        email: (resetEmail || email).trim(),
      });
      setMessage(response.message);
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a redefinição de senha.");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session) {
      await loadClinicDashboard(session, filters);
    }
  }

  function updateFilter<K extends keyof ClinicExamFiltersState>(key: K, value: ClinicExamFiltersState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleStartDateChange(value: string) {
    setFilters((current) => ({
      ...current,
      data_inicio: value,
      data_fim: !value || !current.data_fim || current.data_fim < value ? value : current.data_fim,
    }));
  }

  async function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
    if (session) {
      await loadClinicDashboard(session, INITIAL_FILTERS);
    }
  }

  async function handleLogout() {
    try {
      await logoutClinicPortal(session?.access_token || null);
    } catch {
      // A limpeza local ainda precisa acontecer mesmo se o endpoint falhar.
    } finally {
      clearPortalSession("clinica");
      setSession(null);
      setMfaChallengeId(null);
      setExams([]);
      setClinicName(null);
      setTotalAvailable(0);
      setDashboardLoaded(false);
      setFilters(INITIAL_FILTERS);
      setPassword("");
      setMfaCode("");
      setMessage("Sessão da clínica encerrada neste dispositivo.");
      setError("");
    }
  }

  async function handleDownload(examId: number, attachmentId: number) {
    if (!session) {
      return;
    }

    setDownloadingAttachmentId(attachmentId);
    setError("");
    try {
      const usableSession = await ensureClinicSession(session);
      const response = await createPortalExamDownloadUrls(examId, usableSession.access_token);
      const item = response.items.find((entry) => entry.anexo_id === attachmentId);
      if (!item) {
        throw new Error("O anexo solicitado não está disponível para download.");
      }
      await downloadPortalAttachment(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível baixar o anexo.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  }

  if (session) {
    const clinicLabel = clinicName || (session.clinica_id ? `Clínica #${session.clinica_id}` : "Clínica parceira");

    return (
      <section className="fc-clinic-dashboard fixed inset-0 z-50 overflow-y-auto bg-[#f6fafb] text-slate-950">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                Ambiente da clínica parceira
              </p>
              <h1 className="mt-1 truncate text-2xl font-bold text-slate-950">
                {clinicLabel}
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => session && void loadClinicDashboard(session, filters)}
                disabled={searchLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <section className="grid gap-4 lg:grid-cols-[1fr_0.72fr] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-800">
                <LayoutDashboard className="h-4 w-4" />
                Portal da unidade
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                Exames liberados para pacientes atendidos nesta clínica.
              </h2>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              <p className="font-bold text-slate-950">Sessão ativa</p>
              <p className="mt-2">ID da clínica: {session.clinica_id ?? "-"}</p>
              <p className="mt-1">Válida até {formatPortalDateTime(session.expires_at)}</p>
              {session.trusted_session_expires_at ? (
                <p className="mt-1">
                  Acesso neste computador até {formatPortalDateTime(session.trusted_session_expires_at)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Exames encontrados",
                value: dashboardStats.totalExams,
                detail: `${dashboardStats.visibleExams} exibidos agora`,
                icon: FileCheck2,
              },
              {
                label: "Pets no resultado",
                value: dashboardStats.pets,
                detail: "dentro da unidade",
                icon: PawPrint,
              },
              {
                label: "Arquivos disponíveis",
                value: dashboardStats.attachments,
                detail: "PDFs e anexos liberados",
                icon: Download,
              },
              {
                label: "Mais recente",
                value: dashboardStats.latestDate,
                detail: "por data de realização",
                icon: CalendarDays,
              },
            ].map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                    <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
                    <p className="mt-1 text-sm text-slate-500">{detail}</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-950">
                  <ShieldCheck className="h-4 w-4" />
                  Painel operacional da unidade
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Acompanhe o andamento dos exames da clínica e a janela padrão de liberação no portal.
                </p>
              </div>
              <p className="text-sm text-slate-500">
                Prazo padrão: até {operationalSummary.sla_horas}h após a realização.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Realizados hoje",
                  value: operationalSummary.realizados_hoje,
                  detail: "casos no escopo da unidade",
                  icon: Stethoscope,
                },
                {
                  label: "Em laudo",
                  value: operationalSummary.em_laudo,
                  detail: "ainda em produção clínica",
                  icon: FileCheck2,
                },
                {
                  label: "Aguardando liberação",
                  value: operationalSummary.aguardando_liberacao,
                  detail: "prontos para publicação",
                  icon: ShieldCheck,
                },
                {
                  label: "Liberados hoje",
                  value: operationalSummary.liberados_hoje,
                  detail: "já disponíveis no portal",
                  icon: CheckCircle2,
                },
              ].map(({ label, value, detail, icon: Icon }) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
                      <p className="mt-1 text-sm text-slate-500">{detail}</p>
                    </div>
                    <span className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-950">Fila operacional da unidade</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Exames recentes com status, previsão e histórico de liberação.
                  </p>
                </div>
              </div>

              {operationalItems.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  Ainda não há movimentações operacionais recentes para esta clínica.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {operationalItems.map((item) => (
                    <article
                      key={item.item_id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                              {item.origem === "laudo" ? "Laudo" : "Exame"}
                            </span>
                            <span
                              className={`rounded-lg px-2 py-1 text-xs font-bold ${operationalStatusClasses(
                                item.status_key,
                              )}`}
                            >
                              {OPERATIONAL_STATUS_LABELS[item.status_key] || item.status_label}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-slate-950">{item.tipo_exame}</h3>
                          <dl className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-5">
                            <div>
                              <dt className="font-bold text-slate-900">Pet</dt>
                              <dd className="mt-1">{item.paciente_nome || "Não informado"}</dd>
                            </div>
                            <div>
                              <dt className="font-bold text-slate-900">Tutor</dt>
                              <dd className="mt-1">{item.tutor_nome || "Não informado"}</dd>
                            </div>
                            <div>
                              <dt className="font-bold text-slate-900">Espécie</dt>
                              <dd className="mt-1">{item.especie || "Não informada"}</dd>
                            </div>
                            <div>
                              <dt className="font-bold text-slate-900">Data de realização</dt>
                              <dd className="mt-1">{formatPortalDateTime(item.data_realizacao || null)}</dd>
                            </div>
                            <div>
                              <dt className="font-bold text-slate-900">
                                {item.data_liberacao ? "Data de liberação" : "Previsão de liberação"}
                              </dt>
                              <dd className="mt-1">
                                {item.data_liberacao
                                  ? formatPortalDateTime(item.data_liberacao)
                                  : formatPortalDateTime(item.previsao_liberacao || null)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      {item.observacoes ? (
                        <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
                          {item.observacoes}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <form
            className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={handleFilterSubmit}
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-950">
                  <Filter className="h-4 w-4" />
                  Filtros de busca
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleClearFilters()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-teal-200"
                >
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar exames
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-semibold text-slate-800">
                Busca geral
                <input
                  value={filters.q}
                  onChange={(event) => updateFilter("q", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                  placeholder="Pet, tutor ou exame"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Pet
                <input
                  value={filters.pet}
                  onChange={(event) => updateFilter("pet", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                  placeholder="Nome do pet"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Tutor
                <input
                  value={filters.tutor}
                  onChange={(event) => updateFilter("tutor", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                  placeholder="Nome do tutor"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Espécie
                <input
                  value={filters.especie}
                  onChange={(event) => updateFilter("especie", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                  placeholder="Canina, Felina..."
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Tipo de exame
                <input
                  value={filters.tipo_exame}
                  onChange={(event) => updateFilter("tipo_exame", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                  placeholder="Eco, ECG, US..."
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Data de realização - De
                <input
                  type="date"
                  value={filters.data_inicio}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Data de realização - Até
                <input
                  type="date"
                  value={filters.data_fim}
                  onChange={(event) => updateFilter("data_fim", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                Ordenação
                <select
                  value={`${filters.sort_by}:${filters.sort_dir}`}
                  onChange={(event) => {
                    const [sortBy, sortDir] = event.target.value.split(":");
                    updateFilter("sort_by", sortBy as ClinicSortBy);
                    updateFilter("sort_dir", sortDir as ClinicSortDir);
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-500"
                >
                  <option value="data:desc">Mais recentes por realização</option>
                  <option value="data:asc">Mais antigos por realização</option>
                  <option value="tipo_exame:asc">Tipo A-Z</option>
                  <option value="pet:asc">Pet A-Z</option>
                  <option value="tutor:asc">Tutor A-Z</option>
                  <option value="especie:asc">Espécie A-Z</option>
                </select>
              </label>
            </div>
          </form>

          {message ? (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}

          <section className="mt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-950">
                  <SlidersHorizontal className="h-4 w-4" />
                  Exames liberados
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {totalAvailable} resultado(s) no escopo desta clínica.
                </p>
              </div>
            </div>

            {searchLoading && exams.length === 0 ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando exames liberados para a unidade...
                </span>
              </div>
            ) : exams.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm leading-6 text-slate-600">
                {dashboardLoaded
                  ? "Nenhum exame liberado foi encontrado para os filtros aplicados."
                  : "Carregando o painel da clínica..."}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {exams.map((exam) => (
                  <article key={exam.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                            Exame #{exam.id}
                          </span>
                          <span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">
                            {exam.status || "Status não informado"}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-bold text-slate-950">{exam.tipo_exame}</h3>
                        <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-5">
                          <div>
                            <dt className="font-bold text-slate-900">Pet</dt>
                            <dd className="mt-1">{exam.paciente_nome || `Pet #${exam.paciente_id}`}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">Tutor</dt>
                            <dd className="mt-1">{exam.tutor_nome || "Não informado"}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">Espécie</dt>
                            <dd className="mt-1">{exam.especie || "Não informada"}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">Data de realização</dt>
                            <dd className="mt-1">{formatPortalDate(examExecutionDateValue(exam))}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">Data de liberação</dt>
                            <dd className="mt-1">{formatPortalDate(exam.data_resultado)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="text-sm text-slate-600 lg:min-w-56 lg:text-right">
                        <p className="font-bold text-slate-950">{exam.categoria_exame || "Categoria não informada"}</p>
                        <p className="mt-1">{exam.anexos.length} anexo(s)</p>
                      </div>
                    </div>

                    {exam.observacoes ? (
                      <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
                        {exam.observacoes}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap">
                      {exam.anexos.length === 0 ? (
                        <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
                          <FileCheck2 className="h-4 w-4" />
                          Nenhum arquivo disponível
                        </span>
                      ) : (
                        exam.anexos.map((attachment) => {
                          const isDownloading = downloadingAttachmentId === attachment.anexo_id;
                          return (
                            <button
                              key={attachment.anexo_id}
                              type="button"
                              onClick={() => void handleDownload(exam.id, attachment.anexo_id)}
                              disabled={!attachment.download_available || isDownloading}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              title={`${attachment.nome_original} - ${formatFileSize(attachment.tamanho)}`}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              <span className="max-w-52 truncate">
                                {isDownloading ? "Baixando..." : attachment.nome_original}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </section>
    );
  }

  return (
    <aside className="fc-portal-workspace fc-portal-clinic-workspace rounded-lg border border-white/15 bg-white/[0.06] p-5">
      {bootstrapping ? (
        <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-200">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando sessão deste dispositivo...
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-100">
                Acesso da unidade
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">Entrar como clínica parceira</h2>
            </div>
            <span className="rounded-lg bg-teal-300 px-3 py-2 text-xs font-bold text-slate-950">
              convite + senha
            </span>
          </div>

          {!showForgotPassword ? (
            <>
              {!mfaChallengeId ? (
                <form className="mt-5 space-y-4" onSubmit={handleLogin}>
                  <label className="block text-sm font-semibold text-white">
                    E-mail institucional
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                      placeholder="portal@clinica.com"
                    />
                  </label>

                  <label className="block text-sm font-semibold text-white">
                    Senha
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                      placeholder="Sua senha cadastrada"
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(event) => setRememberDevice(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950/60"
                    />
                    <span>
                      Manter acesso neste computador da unidade até o fim do expediente.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={requestLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-teal-200"
                  >
                    {requestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {requestLoading ? "Entrando..." : "Entrar no portal da unidade"}
                  </button>
                </form>
              ) : (
                <form className="mt-5 space-y-4 rounded-lg border border-white/15 bg-slate-950/50 p-4" onSubmit={handleVerifyMfa}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-teal-200" />
                    <div>
                      <p className="text-sm font-bold text-white">Confirmação adicional</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        Enviamos um código para o e-mail institucional da unidade.
                      </p>
                    </div>
                  </div>

                  <label className="block text-sm font-semibold text-white">
                    Código recebido
                    <input
                      required
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                      placeholder="Digite o código de acesso"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={verifyLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {verifyLoading ? "Validando..." : "Confirmar acesso"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMfaChallengeId(null);
                      setMfaCode("");
                    }}
                    className="w-full rounded-lg border border-white/20 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Voltar para login
                  </button>
                </form>
              )}

              <div className="mt-5 space-y-3 rounded-lg border border-white/10 bg-slate-950/30 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setResetEmail(email);
                    setError("");
                    setMessage("");
                  }}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-100 transition hover:text-white"
                >
                  <KeyRound className="h-4 w-4" />
                  Esqueci minha senha
                </button>

                <div className="text-sm leading-6 text-slate-300">
                  Recebeu um convite da Fort Cordis? Abra o link enviado para cadastrar o e-mail e a senha da unidade.
                </div>

                <Link
                  href="/clinica-parceira"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-white"
                >
                  <Mail className="h-4 w-4" />
                  Revisar orientações de acesso
                </Link>
              </div>
            </>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleForgotPassword}>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
                Enviaremos as instruções de redefinição para o e-mail institucional informado, se houver uma conta ativa para ele.
              </div>

              <label className="block text-sm font-semibold text-white">
                E-mail institucional
                <input
                  required
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                  placeholder="portal@clinica.com"
                />
              </label>

              <button
                type="submit"
                disabled={requestLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {requestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {requestLoading ? "Enviando..." : "Enviar instruções"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError("");
                }}
                className="w-full rounded-lg border border-white/20 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Voltar para login
              </button>
            </form>
          )}
        </>
      )}

      {message ? (
        <div className="mt-4 rounded-lg border border-teal-300/30 bg-teal-400/10 p-3 text-sm text-teal-50">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-50">
          {error}
        </div>
      ) : null}
    </aside>
  );
}
