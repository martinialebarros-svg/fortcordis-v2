import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";

import PortalClinicResetPasswordWorkspace from "@/components/portal/PortalClinicResetPasswordWorkspace";

type ClinicaParceiraResetPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ClinicaParceiraResetPage({
  searchParams,
}: ClinicaParceiraResetPageProps) {
  const params = await searchParams;
  const resetToken = params.token || "";

  return (
    <main className="min-h-screen bg-[#f8fbfc] px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/clinica-parceira"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o portal da clinica
        </Link>

        <section className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-start">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <KeyRound className="h-8 w-8 text-teal-700" />
            <h1 className="mt-5 text-3xl font-bold text-slate-950">Recuperacao segura da conta</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Este passo atualiza a senha da unidade sem expor exames por email. Depois da troca, o portal invalida as sessoes anteriores e pode pedir confirmacao adicional no proximo login.
            </p>
          </div>

          <PortalClinicResetPasswordWorkspace resetToken={resetToken} />
        </section>
      </div>
    </main>
  );
}
