import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardList,
  Download,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import PortalClinicaWorkspace from "@/components/portal/PortalClinicaWorkspace";

const clinicRules = [
  {
    title: "Usuario nominal",
    description:
      "Cada profissional entra com sua propria credencial; contas compartilhadas nao devem acessar exames.",
    icon: UserCheck,
  },
  {
    title: "Permissao por unidade",
    description:
      "O backend filtra resultados pelo vinculo entre atendimento, pet, clinica parceira e unidade.",
    icon: Building2,
  },
  {
    title: "MFA em dados sensiveis",
    description:
      "Sessao nova, dispositivo novo ou download de exame exige segunda verificacao.",
    icon: KeyRound,
  },
  {
    title: "Auditoria completa",
    description:
      "Visualizacao e download registram usuario, IP, horario, pet, exame e finalidade.",
    icon: ClipboardList,
  },
] as const;

export default function ClinicaParceiraPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-950 px-5 py-8 text-white sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-teal-100 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Portal Fort Cordis
          </Link>

          <div className="grid gap-10 py-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-200">
                Clinicas parceiras
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
                Exames acessiveis para a unidade certa, no momento certo.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                O portal da clinica deve agilizar a rotina de consulta e download sem abrir
                acesso amplo ao acervo da Fort Cordis. A regra central e simples: a unidade ve
                apenas os pets atendidos sob sua responsabilidade.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#governanca"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 sm:w-auto"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Ver permissoes
                </a>
                <a
                  href="#downloads"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
                >
                  <Download className="h-5 w-5" />
                  Modelo de download
                </a>
              </div>
            </div>

            <PortalClinicaWorkspace />
          </div>
        </div>
      </section>

      <section id="governanca" className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-700">
              Governanca de acesso
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              Acesso rapido precisa de limite operacional claro.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              O modelo recomendado combina convite aprovado pela Fort Cordis, credencial nominal,
              MFA e autorizacao por unidade no backend.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {clinicRules.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-lg border border-slate-200 p-5 shadow-sm">
                <Icon className="h-7 w-7 text-rose-700" />
                <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="downloads" className="bg-[#f8fbfc] px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
              Download de exames
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              O portal solicita. O sistema Fort Cordis autoriza.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              A clinica nao deve receber um link permanente. O backend valida escopo, gera uma URL
              temporaria para o arquivo e registra o evento.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Busca por protocolo, pet ou tutor somente dentro da unidade autorizada.",
              "Preview de metadados do exame antes do download para evitar arquivo errado.",
              "URL assinada com expiracao curta, sem token em query string exposto em logs internos.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-slate-200 p-6 sm:p-8">
          <BadgeCheck className="h-8 w-8 text-amber-700" />
          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            Clinica parceira nao precisa ver tudo para trabalhar melhor.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            O acesso ideal mostra apenas o necessario para continuidade do atendimento, reduzindo
            risco juridico, vazamento de dados e retrabalho operacional.
          </p>
        </div>
      </section>
    </main>
  );
}
