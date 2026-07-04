import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import PortalClinicActivationWorkspace from "@/components/portal/PortalClinicActivationWorkspace";

type ClinicaParceiraAtivarPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ClinicaParceiraAtivarPage({
  params,
}: ClinicaParceiraAtivarPageProps) {
  const { token } = await params;

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
            <ShieldCheck className="h-8 w-8 text-teal-700" />
            <h1 className="mt-5 text-3xl font-bold text-slate-950">
              Ativacao segura da unidade parceira
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Este link apenas autoriza o cadastro inicial. O acesso aos exames continua protegido por email institucional, senha e verificacao adicional em acoes sensiveis.
            </p>
            <div className="mt-6 space-y-3 text-sm leading-6 text-slate-600">
              <p>1. Confira o email institucional definido para a unidade.</p>
              <p>2. Cadastre o responsavel e uma senha forte para o portal.</p>
              <p>3. Ao concluir, a unidade ja entra no portal da clinica.</p>
            </div>
          </div>

          <PortalClinicActivationWorkspace inviteToken={token} />
        </section>
      </div>
    </main>
  );
}
