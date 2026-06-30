"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, LogOut, RefreshCcw, SearchCheck, ShieldCheck } from "lucide-react";

import PortalExamResults from "@/components/portal/PortalExamResults";
import {
  clearPortalSession,
  createPortalExamDownloadUrls,
  downloadPortalAttachment,
  listPortalPetExams,
  loadPortalSession,
  requestClinicPortalChallenge,
  savePortalSession,
  verifyPortalCode,
  type PortalChallengeResponse,
  type PortalExamItem,
  type PortalSessionResponse,
} from "@/lib/portal-api";

export default function PortalClinicaWorkspace() {
  const [session, setSession] = useState<PortalSessionResponse | null>(null);
  const [challenge, setChallenge] = useState<PortalChallengeResponse | null>(null);
  const [clinicaId, setClinicaId] = useState("");
  const [email, setEmail] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const [exams, setExams] = useState<PortalExamItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function parsePositiveInteger(value: string, fieldLabel: string): number {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${fieldLabel} precisa ser um numero valido.`);
    }
    return parsed;
  }

  async function loadClinicExams(activeSession: PortalSessionResponse, pacienteId: number) {
    setSearchLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await listPortalPetExams(pacienteId, activeSession.access_token);
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
    const storedSession = loadPortalSession("clinica");
    if (storedSession) {
      setSession(storedSession);
    }
  }, []);

  async function handleRequestChallenge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await requestClinicPortalChallenge({
        clinica_id: parsePositiveInteger(clinicaId, "ID da clinica"),
        email: email.trim(),
        responsavel_nome: responsavelNome.trim(),
      });
      setChallenge(response);
      setCodigo(response.debug_code || "");
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel solicitar o codigo.");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) {
      return;
    }

    setVerifyLoading(true);
    setError("");
    setMessage("");

    try {
      const verifiedSession = await verifyPortalCode({
        challenge_id: challenge.challenge_id,
        codigo: codigo.trim(),
      });
      savePortalSession(verifiedSession);
      setSession(verifiedSession);
      setMessage("Sessao da clinica parceira validada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel validar o codigo.");
    } finally {
      setVerifyLoading(false);
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

  function handleLogout() {
    clearPortalSession("clinica");
    setSession(null);
    setChallenge(null);
    setExams([]);
    setPatientSearch("");
    setSearchedPatientId(null);
    setCodigo("");
    setMessage("Sessao da clinica encerrada neste dispositivo.");
    setError("");
  }

  async function handleDownload(examId: number, attachmentId: number) {
    if (!session) {
      return;
    }

    setDownloadingAttachmentId(attachmentId);
    setError("");
    try {
      const response = await createPortalExamDownloadUrls(examId, session.access_token);
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
      {!session ? (
        <>
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-100">
                Acesso seguro
              </p>
              <h2 className="mt-2 text-xl font-bold">Entrar como clinica parceira</h2>
            </div>
            <span className="rounded-lg bg-teal-300 px-3 py-2 text-xs font-bold text-slate-950">
              escopo por unidade
            </span>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleRequestChallenge}>
            <label className="block text-sm font-semibold text-white">
              ID da clinica
              <input
                required
                inputMode="numeric"
                value={clinicaId}
                onChange={(event) => setClinicaId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                placeholder="Ex.: 21"
              />
            </label>

            <label className="block text-sm font-semibold text-white">
              Email cadastrado da unidade
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                placeholder="parceira@clinica.com"
              />
            </label>

            <label className="block text-sm font-semibold text-white">
              Responsavel pelo acesso
              <input
                required
                value={responsavelNome}
                onChange={(event) => setResponsavelNome(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                placeholder="Nome do profissional"
              />
            </label>

            <button
              type="submit"
              disabled={requestLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-teal-200"
            >
              {requestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              {requestLoading ? "Solicitando..." : "Receber codigo temporario"}
            </button>
          </form>

          {challenge ? (
            <form className="mt-5 space-y-4 rounded-lg border border-white/15 bg-slate-950/50 p-4" onSubmit={handleVerifyCode}>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-teal-200" />
                <div>
                  <p className="text-sm font-bold text-white">Codigo solicitado</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{challenge.message}</p>
                </div>
              </div>

              {challenge.debug_code ? (
                <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-100/10 p-3 text-sm text-amber-100">
                  Codigo de desenvolvimento: <span className="font-bold">{challenge.debug_code}</span>
                </div>
              ) : null}

              <label className="block text-sm font-semibold text-white">
                Codigo recebido
                <input
                  required
                  value={codigo}
                  onChange={(event) => setCodigo(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-300"
                  placeholder="Digite o codigo temporario"
                />
              </label>

              <button
                type="submit"
                disabled={verifyLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {verifyLoading ? "Validando..." : "Entrar na area da unidade"}
              </button>
            </form>
          ) : null}
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
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-teal-300/30 bg-teal-400/10 p-4 text-sm text-teal-50">
            <p className="font-bold">Unidade autenticada</p>
            <p className="mt-1">ID da clinica: {session.clinica_id ?? "-"}</p>
            <p className="mt-1">Sessao valida ate {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(session.expires_at))}</p>
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
