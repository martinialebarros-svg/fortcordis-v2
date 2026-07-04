"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";

import {
  activateClinicInvite,
  getClinicInviteStatus,
  verifyClinicEmailCode,
  type PortalClinicInviteStatusResponse,
} from "@/lib/portal-api";

type PortalClinicActivationWorkspaceProps = {
  inviteToken: string;
};

export default function PortalClinicActivationWorkspace({
  inviteToken,
}: PortalClinicActivationWorkspaceProps) {
  const [statusData, setStatusData] = useState<PortalClinicInviteStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  async function loadInviteStatus() {
    setLoadingStatus(true);
    setError("");
    try {
      const response = await getClinicInviteStatus(inviteToken);
      setStatusData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o convite.");
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
        email: email.trim(),
        responsavel_nome: responsavelNome.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      setChallengeId(response.email_challenge_id);
      setMessage(response.message);
      await loadInviteStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel iniciar a ativacao.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setError("");
    setMessage("");

    try {
      const response = await verifyClinicEmailCode({
        challenge_id: challengeId,
        codigo: emailCode.trim(),
      });
      setVerified(true);
      setMessage(response.message || "Email institucional verificado com sucesso.");
      await loadInviteStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel validar o codigo.");
    } finally {
      setVerifying(false);
    }
  }

  const inviteUnavailable = statusData && (!statusData.can_activate || statusData.status !== "pending");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(statusData.expires_at),
                )}
              </span>
              .
            </p>
            {statusData.email_hint ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ja existe um cadastro recente vinculado a este convite: {statusData.email_hint}
              </p>
            ) : null}
          </div>

          {verified ? (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <BadgeCheck className="h-8 w-8 text-emerald-700" />
              <h3 className="mt-4 text-lg font-bold text-emerald-950">Conta ativada com sucesso</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                O email institucional da unidade foi confirmado. A partir de agora o acesso acontece em{" "}
                <span className="font-semibold">email + senha</span>.
              </p>
              <Link
                href="/clinica-parceira"
                className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Ir para o login da clinica
              </Link>
            </div>
          ) : challengeId ? (
            <form className="mt-5 space-y-4" onSubmit={handleVerify}>
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
                Enviamos um codigo para o email institucional informado. Use-o abaixo para concluir a ativacao.
              </div>

              <label className="block text-sm font-semibold text-slate-900">
                Codigo de verificacao
                <input
                  required
                  value={emailCode}
                  onChange={(event) => setEmailCode(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600"
                  placeholder="Digite o codigo enviado por email"
                />
              </label>

              <button
                type="submit"
                disabled={verifying}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {verifying ? "Validando..." : "Confirmar email institucional"}
              </button>
            </form>
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
                {submitting ? "Enviando codigo..." : "Cadastrar email e senha da unidade"}
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
