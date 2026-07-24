"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserX,
} from "lucide-react";

import api from "@/lib/axios";
import { extractApiErrorMessageSync } from "@/lib/api-error";
import { buildClinicInviteMessage, getPortalAdminAuthHeaders } from "@/lib/portal-clinic-admin";
import { formatPortalDateTime } from "@/lib/portal-datetime";
import type {
  PortalAdminClinicAccessSummaryResponse,
  PortalAdminClinicInviteResponse,
} from "@/lib/portal-api";

type ClinicaPortalAccessCardProps = {
  clinicaId: number;
  clinicaNome: string;
  defaultWhatsapp?: string;
  defaultEmail?: string;
};

export default function ClinicaPortalAccessCard({
  clinicaId,
  clinicaNome,
  defaultWhatsapp = "",
  defaultEmail = "",
}: ClinicaPortalAccessCardProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<PortalAdminClinicAccessSummaryResponse | null>(null);
  const [deliveryTarget, setDeliveryTarget] = useState(defaultWhatsapp);
  const [inviteEmail, setInviteEmail] = useState(defaultEmail);
  const [expiresInHours, setExpiresInHours] = useState("72");
  const [lastInvite, setLastInvite] = useState<PortalAdminClinicInviteResponse | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentInvite = summary?.invite || null;
  const currentAccount = summary?.account || null;
  const inviteMessage = useMemo(() => {
    if (!lastInvite?.activation_url) {
      return "";
    }
    return buildClinicInviteMessage({
      clinicaNome,
      activationUrl: lastInvite.activation_url,
      accessMode: lastInvite.access_mode,
      expiresAt: lastInvite.expires_at,
      accountEmailMasked: lastInvite.account_email_masked,
    });
  }, [clinicaNome, lastInvite?.access_mode, lastInvite?.account_email_masked, lastInvite?.activation_url, lastInvite?.expires_at]);

  const canRevokeInvite = useMemo(
    () => currentInvite && currentInvite.status === "pending",
    [currentInvite],
  );

  async function loadSummary() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<PortalAdminClinicAccessSummaryResponse>(
        `/portal/admin/clinicas/${clinicaId}/acesso`,
        { headers: getPortalAdminAuthHeaders() },
      );
      setSummary(response.data);
    } catch (err) {
      setError(extractApiErrorMessageSync(err, "Nao foi possivel carregar o acesso da clinica."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [clinicaId]);

  async function handleGenerateInvite() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post<PortalAdminClinicInviteResponse>(
        `/portal/admin/clinicas/${clinicaId}/convites`,
        {
          delivery_channel: "whatsapp",
          delivery_target: deliveryTarget.trim(),
          account_email: inviteEmail.trim(),
          expires_in_hours: Number.parseInt(expiresInHours, 10) || 72,
          allow_manual_copy: true,
        },
        { headers: getPortalAdminAuthHeaders() },
      );
      setLastInvite(response.data);
      setMessage(
        response.data.access_mode === "login"
          ? response.data.delivery_status === "sent"
            ? "Acesso reenviado com sucesso para a clinica."
            : "Acesso preparado. Copie a mensagem e encaminhe pelo WhatsApp institucional."
          : response.data.delivery_status === "sent"
            ? "Convite enviado com sucesso para a clinica."
            : "Convite gerado. Copie a mensagem e encaminhe pelo WhatsApp institucional.",
      );
      await loadSummary();
    } catch (err) {
      setError(extractApiErrorMessageSync(err, "Nao foi possivel gerar o convite da clinica."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!lastInvite?.activation_url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lastInvite.activation_url);
      setMessage(lastInvite.access_mode === "login" ? "Link de acesso copiado." : "Link de ativacao copiado.");
    } catch {
      setError("Nao foi possivel copiar o link automaticamente.");
    }
  }

  async function handleCopyInviteMessage() {
    if (!inviteMessage) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setMessage("Mensagem com link de ativacao copiada.");
    } catch {
      setError("Nao foi possivel copiar a mensagem automaticamente.");
    }
  }

  async function handleRevokeInvite() {
    if (!currentInvite) {
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await api.post(
        `/portal/admin/clinicas/${clinicaId}/convites/${currentInvite.id}/revogar`,
        { reason: "convite revogado pela operacao" },
        { headers: getPortalAdminAuthHeaders() },
      );
      setMessage("Convite pendente revogado.");
      await loadSummary();
    } catch (err) {
      setError(extractApiErrorMessageSync(err, "Nao foi possivel revogar o convite."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeAccount() {
    if (!currentAccount) {
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await api.post(
        `/portal/admin/clinica-accounts/${currentAccount.id}/revogar`,
        {
          reason: "conta revogada pela operacao",
          revoke_sessions: true,
        },
        { headers: getPortalAdminAuthHeaders() },
      );
      setMessage("Conta da clinica revogada e sessoes encerradas.");
      await loadSummary();
    } catch (err) {
      setError(extractApiErrorMessageSync(err, "Nao foi possivel revogar a conta da clinica."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeSessions() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post<{ revoked_count: number }>(
        "/portal/admin/clinica-sessions/revogar",
        {
          clinica_id: clinicaId,
          reason: "sessoes revogadas pela operacao",
        },
        { headers: getPortalAdminAuthHeaders() },
      );
      setMessage(`Sessoes encerradas: ${response.data.revoked_count}.`);
      await loadSummary();
    } catch (err) {
      setError(extractApiErrorMessageSync(err, "Nao foi possivel revogar as sessoes da clinica."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="fc-clinic-form-card fc-clinic-form-card-portal">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            Acesso da clinica ao portal
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Gere o convite da unidade, acompanhe o estado do cadastro e revogue acessos quando necessario.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={loading || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Atualizar
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {currentAccount ? `Reenviar acesso para ${clinicaNome}` : `Gerar convite para ${clinicaNome}`}
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_120px]">
              <label className="block text-sm font-medium text-gray-700">
                WhatsApp da unidade
                <input
                  value={deliveryTarget}
                  onChange={(event) => setDeliveryTarget(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-600"
                  placeholder="85999990000"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Email institucional
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-600"
                  placeholder="portal@clinica.com"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Expira em
                <input
                  value={expiresInHours}
                  onChange={(event) => setExpiresInHours(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-600"
                  placeholder="72"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerateInvite()}
              disabled={submitting || !deliveryTarget.trim() || !inviteEmail.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              {currentAccount ? "Reenviar acesso" : "Gerar convite"}
            </button>

            {lastInvite ? (
              <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-950">
                  {lastInvite.access_mode === "login"
                    ? "Ultimo link de acesso gerado nesta sessao"
                    : "Ultimo link de ativacao gerado nesta sessao"}
                </p>
                <p className="mt-2 break-all text-sm text-teal-900">{lastInvite.activation_url}</p>
                <label className="mt-4 block text-sm font-semibold text-teal-950">
                  {lastInvite.access_mode === "login"
                    ? "Mensagem sugerida para reenvio de acesso"
                    : "Mensagem sugerida para WhatsApp"}
                  <textarea
                    readOnly
                    value={inviteMessage}
                    rows={8}
                    className="mt-2 min-h-44 w-full resize-y rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm leading-6 text-teal-950 outline-none"
                    aria-label="Mensagem sugerida para envio do convite da clinica"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCopyInviteMessage()}
                    className="inline-flex items-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-white"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Copiar mensagem
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="inline-flex items-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-white"
                  >
                    <Copy className="w-4 h-4" />
                    {lastInvite.access_mode === "login" ? "Copiar acesso" : "Copiar link"}
                  </button>
                  <a
                    href={lastInvite.activation_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-white"
                  >
                    <Link2 className="w-4 h-4" />
                    Abrir pagina
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Acoes operacionais</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleRevokeInvite()}
                disabled={submitting || !canRevokeInvite}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Revogar convite pendente
              </button>

              <button
                type="button"
                onClick={() => void handleRevokeSessions()}
                disabled={submitting || !summary?.active_session_count}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className="w-4 h-4" />
                Encerrar sessoes ativas
              </button>

              <button
                type="button"
                onClick={() => void handleRevokeAccount()}
                disabled={submitting || !currentAccount || currentAccount.status === "revoked"}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserX className="w-4 h-4" />
                Revogar conta da unidade
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Resumo atual</p>
            {loading ? (
              <div className="mt-4 text-sm text-gray-500">Carregando resumo do acesso...</div>
            ) : (
              <div className="mt-4 space-y-4 text-sm text-gray-700">
                <div>
                  <p className="font-medium text-gray-900">Convite mais recente</p>
                  {summary?.invite ? (
                    <div className="mt-2 space-y-1">
                      <p>Status: <span className="font-semibold">{summary.invite.status}</span></p>
                      <p>Canal: {summary.invite.delivery_channel}</p>
                      <p>Destino: {summary.invite.delivery_target_masked || "-"}</p>
                      <p>Expira em: {formatPortalDateTime(summary.invite.expires_at)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-gray-500">Nenhum convite registrado.</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <p className="font-medium text-gray-900">Conta da unidade</p>
                  {summary?.account ? (
                    <div className="mt-2 space-y-1">
                      <p>Status: <span className="font-semibold">{summary.account.status}</span></p>
                      <p>Email: {summary.account.email_masked || "-"}</p>
                      <p>Responsavel: {summary.account.responsavel_nome}</p>
                      <p>Ultimo login: {formatPortalDateTime(summary.account.last_login_at)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-gray-500">Nenhuma conta ativada para esta clinica.</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <p className="font-medium text-gray-900">Sessoes ativas</p>
                  <p className="mt-2">
                    Total em aberto: <span className="font-semibold">{summary?.active_session_count || 0}</span>
                  </p>
                  {summary?.active_sessions?.length ? (
                    <div className="mt-3 space-y-2">
                      {summary.active_sessions.map((session) => (
                        <div key={session.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="font-medium text-gray-900">Sessao #{session.id}</p>
                          <p>Valida ate: {formatPortalDateTime(session.trusted_until)}</p>
                          <p>Ultima atividade: {formatPortalDateTime(session.last_seen_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
    </section>
  );
}
