import Link from "next/link";
import Image from "next/image";
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
    <main className="fc-portal-auth-page">
      <div className="fc-portal-auth-shell">
        <Link
          href="/clinica-parceira"
          className="fc-portal-auth-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o portal da clínica
        </Link>

        <section className="fc-portal-auth-grid">
          <div className="fc-portal-auth-intro">
            <Image src="/brand/fortcordis-logo-oficial.png" alt="Fort Cordis" width={56} height={56} priority />
            <KeyRound className="h-8 w-8 text-teal-700" />
            <h1 className="mt-5 text-3xl font-bold text-slate-950">Recuperação segura da conta</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Este passo atualiza a senha da unidade sem expor exames por e-mail. Depois da troca, o portal invalida as sessões anteriores e pode pedir confirmação adicional no próximo login.
            </p>
          </div>

          <PortalClinicResetPasswordWorkspace resetToken={resetToken} />
        </section>
      </div>
    </main>
  );
}
