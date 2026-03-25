import Link from "next/link";
import { headers } from "next/headers";
import { Fraunces, Manrope } from "next/font/google";
import { ArrowRight, Building2, ShieldCheck, UserRound } from "lucide-react";
import LoginPageClient from "./page-client";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const textFont = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

const INSTITUTIONAL_HOSTS = new Set([
  "fortcordis.com.br",
  "www.fortcordis.com.br",
  "stage.fortcordis.com.br",
]);

const landingLinks = [
  {
    title: "Area de pacientes",
    description: "Espaco para servicos online e acompanhamento do cuidado cardiologico.",
    href: "/area-pacientes",
    icon: UserRound,
  },
  {
    title: "Area da clinica parceira",
    description: "Portal para download de laudos, consultas de status e pendencias financeiras.",
    href: "/clinica-parceira",
    icon: Building2,
  },
  {
    title: "Area administrativa",
    description: "Acesso ao app FortCordis e configuracoes operacionais da equipe interna.",
    href: "https://app.fortcordis.com.br/",
    icon: ShieldCheck,
  },
] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeHost(hostHeader: string | null): string {
  if (!hostHeader) return "";

  const firstHost = hostHeader.split(",")[0] ?? "";
  return firstHost.toLowerCase().split(":")[0]?.trim() ?? "";
}

function isInstitutionalHost(host: string): boolean {
  return INSTITUTIONAL_HOSTS.has(host);
}

function InstitutionalLanding() {
  return (
    <main
      className={`${displayFont.variable} ${textFont.variable} min-h-screen bg-slate-950 text-slate-100`}
    >
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.18),transparent_40%),linear-gradient(180deg,#020617,#0f172a)]" />
        <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-16 sm:px-10 lg:px-14">
          <header className="mb-14 flex flex-col gap-6 border-b border-white/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex w-fit rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                FortCordis
              </p>
              <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-balance text-white sm:text-5xl lg:text-6xl">
                Cardiologia veterinaria com integracao clinica e continuidade do cuidado.
              </h1>
            </div>
            <p className="max-w-md font-[family-name:var(--font-manrope)] text-sm leading-relaxed text-slate-300 sm:text-base">
              Plataforma institucional para conectar tutores, clinicas parceiras e equipe interna em um
              fluxo unico de atendimento.
            </p>
          </header>

          <section className="grid gap-5 md:grid-cols-3">
            {landingLinks.map(({ title, description, href, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="group relative flex min-h-56 flex-col justify-between rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/10"
              >
                <div>
                  <Icon className="mb-5 h-8 w-8 text-cyan-200 transition group-hover:text-cyan-100" />
                  <h2 className="font-[family-name:var(--font-display)] text-2xl leading-tight text-white">
                    {title}
                  </h2>
                  <p className="mt-3 font-[family-name:var(--font-manrope)] text-sm leading-relaxed text-slate-300">
                    {description}
                  </p>
                </div>
                <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--font-manrope)] text-sm font-semibold text-cyan-100">
                  Acessar
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </section>

          <footer className="mt-auto pt-16 font-[family-name:var(--font-manrope)] text-xs uppercase tracking-[0.14em] text-slate-400">
            FortCordis Sistema Integrado de Atendimento Veterinario
          </footer>
        </div>
      </div>
    </main>
  );
}

export default async function HomePage() {
  const headersList = await headers();
  const host = normalizeHost(headersList.get("x-forwarded-host") ?? headersList.get("host"));

  if (isInstitutionalHost(host)) {
    return <InstitutionalLanding />;
  }

  return <LoginPageClient />;
}
