"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

import PortalExamResults from "@/components/portal/PortalExamResults";
import {
  clearPortalSession,
  createPortalExamDownloadUrls,
  downloadPortalAttachment,
  listPortalPetExams,
  loadPortalSession,
  loginClinicPortal,
  logoutClinicPortal,
  refreshClinicPortalSession,
  requestClinicPasswordReset,
  savePortalSession,
  verifyClinicPortalMfa,
  type PortalClinicAuthResponse,
  type PortalExamItem,
  type PortalSessionResponse,
} from "@/lib/portal-api";

function parsePositiveInteger(value: string, fieldLabel: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} precisa ser um numero valido.`);
  }
  return parsed;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeClinicSession(payload: PortalClinicAuthResponse): PortalSessionResponse {
  if (!payload.access_token || !payload.expires_at || payload.actor_type !== "clinica" || !payload.actor_id) {
    throw new Error("Sessao da clinica retornou incompleta.");
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
  const [patientSearch, setPatientSearch] = useState("");
  const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const [exams, setExams] = useState<PortalExamItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setMessage(refreshed.message || "Sessao da clinica restaurada neste computador.");
    } catch {
      clearPortalSession("clinica");
    } finally {
      setBootstrapping(false);
    }
  }

  async function ensureClinicSession(currentSession: PortalSessionResponse | null): Promise<PortalSessionResponse> {
    if (currentSession && new Date(currentSession.expires_at).getTime() > Date.now() + 30_000) {
      return currentSession;
    }

    const refreshed = normalizeClinicSession(await refreshClinicPortalSession());
    savePortalSession(refreshed);
    setSession(refreshed);
    return refreshed;
  }

  async function loadClinicExams(activeSession: PortalSessionResponse, pacienteId: number) {
    setSearchLoading(true);
    setError("");
    setMessage("");

    try {
      const usableSession = await ensureClinicSession(activeSession);
      const response = await listPortalPetExams(pacienteId, usableSession.access_token);
      setExams(response.items);
      setSearchedPatientId(pacienteId);
      if (response.total === 0) {
        setMessage("Nenhum exame liberado para esta unidade foi encontrado para o pet informado.");
      }
    } catch (err) {
      setExams([]);
      setSearchedPatientId(null);
      setError(err instanceof Error ? err.message : "Nao foi possivel consultar os exames.");
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    void hydrateClinicSession();
  }, []);

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
        setMessage(response.message || "Enviamos um codigo adicional para o email institucional.");
        return;
      }

      const nextSession = normalizeClinicSession(response);
      savePortalSession(nextSession);
      setSession(nextSession);
      setMfaChallengeId(null);
      setPassword("");
      setMessage(response.message || "Sessao da clinica iniciada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel iniciar a sessao da clinica.");
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
      setMessage(response.message || "Sessao da clinica iniciada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel confirmar o acesso da clinica.");
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
      setError(err instanceof Error ? err.message : "Nao foi possivel iniciar a redefinicao de senha.");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleSearchExams(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    try {
      const pacienteId = parsePositiveInteger(patientSearch, "ID do pet");
      await loadClinicExams(session, pacienteId);
    } catch (err) {
      setExams([]);
      setSearchedPatientId(null);
      setError(err instanceof Error ? err.message : "Nao foi possivel consultar os exames.");
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
      setPatientSearch("");
      setSearchedPatientId(null);
      setPassword("");
      setMfaCode("");
      setMessage("Sessao da clinica encerrada neste dispositivo.");
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
        throw new Error("O anexo solicitado nao esta disponivel para download.");
      }
      await downloadPortalAttachment(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel baixar o anexo.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  }

  return (
    <aside className="rounded-lg border border-white/15 bg-white/[0.06] p-5">
      {bootstrapping ? (
        <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-200">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando sessao deste dispositivo...
          </span>
        </div>
      ) : !session ? (
        <>
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-100">
                Acesso da unidade
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">Entrar como clinica parceira</h2>
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
                    Email institucional
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
                      Manter acesso neste computador da unidade ate o fim do expediente.
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
                      <p className="text-sm font-bold text-white">Confirmacao adicional</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        Enviamos um codigo para o email institucional da unidade.
                      </p>
                    </div>
                  </div>

                  <label className="block text-sm font-semibold text-white">
                    Codigo recebido
                    <input
                      required
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                      placeholder="Digite o codigo de acesso"
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
                  Recebeu um convite da Fort Cordis? Abra o link enviado para cadastrar o email e a senha da unidade.
                </div>

                <Link
                  href="/clinica-parceira"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-white"
                >
                  <Mail className="h-4 w-4" />
                  Revisar orientacoes de acesso
                </Link>
              </div>
            </>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleForgotPassword}>
              <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
                Enviaremos as instrucoes de redefinicao para o email institucional informado, se houver uma conta ativa para ele.
              </div>

              <label className="block text-sm font-semibold text-white">
                Email institucional
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
                {requestLoading ? "Enviando..." : "Enviar instrucoes"}
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
      ) : (
        <div>
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-100">
                Sessao ativa
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">Clinica parceira</h2>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-teal-300/30 bg-teal-400/10 p-4 text-sm text-teal-50">
            <p className="font-bold">Unidade autenticada</p>
            <p className="mt-1">ID da clinica: {session.clinica_id ?? "-"}</p>
            <p className="mt-1">Sessao valida ate {formatDateTime(session.expires_at)}</p>
            {session.trusted_session_expires_at ? (
              <p className="mt-1">Acesso mantido neste computador ate {formatDateTime(session.trusted_session_expires_at)}</p>
            ) : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSearchExams}>
            <label className="block text-sm font-semibold text-white">
              ID do pet atendido na unidade
              <input
                required
                inputMode="numeric"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                placeholder="Ex.: 48"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={searchLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-teal-200 sm:w-auto"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                {searchLoading ? "Consultando..." : "Consultar exames"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (session && searchedPatientId) {
                    void loadClinicExams(session, searchedPatientId);
                  }
                }}
                disabled={!searchedPatientId || searchLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <RefreshCcw className="h-4 w-4" />
                Recarregar
              </button>
            </div>
          </form>

          <div className="mt-5">
            {searchLoading ? (
              <div className="rounded-lg border border-white/15 p-5 text-sm text-slate-200">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando exames liberados para a unidade...
                </span>
              </div>
            ) : (
              <PortalExamResults
                emptyMessage={
                  searchedPatientId
                    ? "Nenhum exame liberado para esta unidade foi encontrado para o pet consultado."
                    : "Autentique a unidade e consulte um pet para ver os exames disponiveis."
                }
                exams={exams}
                downloadingAttachmentId={downloadingAttachmentId}
                onDownload={(examId, attachmentId) => void handleDownload(examId, attachmentId)}
              />
            )}
          </div>
        </div>
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
