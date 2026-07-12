"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";

import {
  activateClinicInvite,
  getClinicInviteStatus,
  savePortalSession,
  type PortalClinicActivationResponse,
  type PortalClinicInviteStatusResponse,
  type PortalSessionResponse,
} from "@/lib/portal-api";
import { formatPortalDateTime } from "@/lib/portal-datetime";

type PortalClinicActivationWorkspaceProps = {
  inviteToken: string;
};

export default function PortalClinicActivationWorkspace({
  inviteToken,
}: PortalClinicActivationWorkspaceProps) {
  const router = useRouter();
  const [statusData, setStatusData] = useState<PortalClinicInviteStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activated, setActivated] = useState(false);

  function normalizeActivationSession(payload: PortalClinicActivationResponse): PortalSessionResponse {
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

  async function loadInviteStatus() {
    setLoadingStatus(true);
    setError("");
    try {
      const response = await getClinicInviteStatus(inviteToken);
      setStatusData(response);
    } catch (err) {
      const detail = err instanceof Error ? err.message.trim() : "";
      setError(
        detail && detail.toLowerCase() !== "internal server error"
          ? detail
          : "Nao foi possivel validar este convite. Solicite um novo link de ativacao.",
      );
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    void loadInviteStatus();
  }, [inviteToken]);

  async function handleActivate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await activateClinicInvite({
        invite_token: inviteToken,
        email: statusData?.email_hint ? undefined : email.trim(),
        responsavel_nome: responsavelNome.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      const nextSession = normalizeActivationSession(response);
      savePortalSession(nextSession);
      setActivated(true);
      setMessage(response.message || "Conta criada com sucesso. Redirecionando para o portal da clinica.");
      router.replace("/clinica-parceira");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel iniciar a ativacao.");
    } finally {
      setSubmitting(false);
    }
  }

  const inviteUnavailable = statusData && (!statusData.can_activate || statusData.status !== "pending");

  return (
    <div className="fc-portal-auth-card rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {loadingStatus ? (
        <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados do convite...
          </span>
        </div>
      ) : statusData ? (
        <div>
          <div className="border-b border-slate-200 pb-4">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
              Convite da unidade
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">{statusData.unidade_nome}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Status atual: <span className="font-semibold text-slate-950">{statusData.status}</span>. Expira em{" "}
              <span className="font-semibold text-slate-950">
                {formatPortalDateTime(statusData.expires_at)}
              </span>
              .
            </p>
            {statusData.email_hint ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ja existe um cadastro recente vinculado a este convite: {statusData.email_hint}
              </p>
            ) : null}
          </div>

          {activated ? (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <BadgeCheck className="h-8 w-8 text-emerald-700" />
              <h3 className="mt-4 text-lg font-bold text-emerald-950">Conta ativada com sucesso</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                A senha da unidade foi criada. Estamos abrindo o portal da clinica.
              </p>
              <Link
                href="/clinica-parceira"
                className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Abrir portal da clinica
              </Link>
            </div>
          ) : inviteUnavailable ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              Este convite nao pode mais ser usado para ativacao. Solicite um novo link a equipe Fort Cordis ou entre com a conta ja cadastrada.
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/clinica-parceira"
                  className="inline-flex rounded-lg bg-amber-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-800"
                >
                  Ir para o login da clinica
                </Link>
              </div>
            </div>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleActivate}>
              {statusData.email_hint ? (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
                  Email institucional definido para este acesso:{" "}
                  <span className="font-semibold">{statusData.email_hint}</span>
                </div>
              ) : (
                <label className="block text-sm font-semibold text-slate-900">
                  Email institucional
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600"
                    placeholder="portal@clinica.com"
                  />
                </label>
              )}

              <label className="block text-sm font-semibold text-slate-900">
                Responsavel pelo acesso
                <input
                  required
                  value={responsavelNome}
                  onChange={(event) => setResponsavelNome(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600"
                  placeholder="Nome do profissional responsavel"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-900">
                  Senha
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600"
                    placeholder="Minimo de 12 caracteres"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-900">
                  Confirmacao de senha
                  <input
                    required
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600"
                    placeholder="Repita a senha"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {submitting ? "Criando acesso..." : "Criar acesso e entrar no portal"}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          {error}
        </div>
      ) : null}
    </div>
  );
}
