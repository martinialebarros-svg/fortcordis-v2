import Link from "next/link";
import Image from "next/image";
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
    title: "Conta da unidade",
    description:
      "A ativação nasce de um convite da Fort Cordis e vincula e-mail institucional e senha a uma unidade parceira.",
    icon: UserCheck,
  },
  {
    title: "Permissão por unidade",
    description:
      "O backend filtra resultados pelo vínculo entre atendimento, pet, clínica parceira e unidade.",
    icon: Building2,
  },
  {
    title: "MFA em dados sensíveis",
    description:
      "Redefinição de senha, risco de acesso e ações sensíveis podem exigir uma segunda verificação.",
    icon: KeyRound,
  },
  {
    title: "Auditoria completa",
    description:
      "Visualização e download registram usuário, IP, horário, pet, exame e finalidade.",
    icon: ClipboardList,
  },
] as const;

export default function ClinicaParceiraPage() {
  return (
    <main className="fc-public-portal fc-public-portal-clinic">
      <section className="fc-public-portal-hero">
        <div className="fc-public-portal-inner">
          <Link
            href="/"
            className="fc-public-portal-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Portal Fort Cordis
          </Link>

          <div className="fc-public-portal-hero-grid">
            <div className="fc-public-portal-copy">
              <div className="fc-public-portal-brand">
                <Image src="/brand/fortcordis-logo-oficial.png" alt="Fort Cordis" width={52} height={52} priority />
                <span><strong>FORT CORDIS</strong><small>Cardiologia Veterinária</small></span>
              </div>
              <p className="fc-public-portal-kicker">
                Clínicas parceiras
              </p>
              <h1>
                Exames acessíveis para a unidade certa, no momento certo.
              </h1>
              <p className="fc-public-portal-lead">
                O portal da clínica agiliza a consulta e o download sem abrir acesso amplo ao acervo
                da Fort Cordis. A unidade ativa seu convite, confirma o e-mail institucional e
                passa a ver apenas os pets atendidos sob sua responsabilidade.
              </p>
              <div className="fc-public-portal-actions">
                <a
                  href="#governanca"
                  className="fc-public-portal-primary"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Ver permissões
                </a>
                <a
                  href="#downloads"
                  className="fc-public-portal-secondary"
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

      <section id="governanca" className="fc-public-portal-section fc-scroll-section">
        <div className="fc-public-portal-inner">
          <div className="fc-public-portal-section-heading">
            <p className="fc-public-portal-eyebrow">
              Governança de acesso
            </p>
            <h2>
              Acesso rápido precisa de limite operacional claro.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              O modelo combina convite aprovado pela Fort Cordis, e-mail institucional, senha,
              MFA contextual e autorização por unidade no backend.
            </p>
          </div>

          <div className="fc-public-portal-feature-grid fc-public-portal-feature-grid-four">
            {clinicRules.map(({ title, description, icon: Icon }) => (
              <article key={title} className="fc-public-portal-feature">
                <Icon className="h-7 w-7 text-rose-700" />
                <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="downloads" className="fc-public-portal-band fc-public-portal-band-light fc-scroll-section">
        <div className="fc-public-portal-band-grid">
          <div>
            <p className="fc-public-portal-eyebrow">
              Download de exames
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              O portal solicita. O sistema Fort Cordis autoriza.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              A clínica não deve receber um link permanente. O backend valida o escopo, gera uma URL
              temporária para o arquivo e registra o evento.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Busca por protocolo, pet ou tutor somente dentro da unidade autorizada.",
              "Visão panorâmica com filtros por pet, tutor, espécie, tipo de exame e período.",
              "URL assinada com expiração curta, sem token em query string exposto em logs internos.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fc-public-portal-section fc-public-portal-final fc-scroll-section">
        <div className="fc-public-portal-callout">
          <BadgeCheck className="h-8 w-8 text-amber-700" />
          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            Clínica parceira não precisa ver tudo para trabalhar melhor.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            O acesso ideal mostra apenas o necessário para a continuidade do atendimento, reduzindo
            risco jurídico, vazamento de dados e retrabalho operacional.
          </p>
        </div>
      </section>
    </main>
  );
}
