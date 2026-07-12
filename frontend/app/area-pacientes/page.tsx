import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarHeart,
  Download,
  FileHeart,
  HeartPulse,
  LockKeyhole,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import PortalTutorWorkspace from "@/components/portal/PortalTutorWorkspace";

const tutorAccess = [
  {
    title: "Entrada por link seguro",
    description:
      "O tutor recebe um codigo temporario no email cadastrado e confirma o acesso antes de visualizar dados do pet.",
    icon: Smartphone,
  },
  {
    title: "Permissao por pet",
    description:
      "A API libera apenas pets vinculados ao tutor e ao atendimento, sem listar dados por busca aberta.",
    icon: FileHeart,
  },
  {
    title: "Download temporario",
    description:
      "Laudos e exames sao baixados por URLs assinadas, com expiracao curta e registro de auditoria.",
    icon: Download,
  },
] as const;

const healthNotes = [
  "Tenha em maos receitas, exames antigos e a lista de medicamentos em uso.",
  "Avise a equipe se houve tosse, cansaco, desmaio, apetite reduzido ou mudanca na respiracao.",
  "Depois do exame, acompanhe orientacoes e retornos pelo historico do pet.",
] as const;

export default function AreaPacientesPage() {
  return (
    <main className="fc-public-portal fc-public-portal-tutor">
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
                Area do tutor
              </p>
              <h1>
                Informacoes do pet e exames com acesso simples, mas protegido.
              </h1>
              <p className="fc-public-portal-lead">
                O portal do tutor deve reunir historico cardiologico, orientacoes do atendimento
                e download de documentos liberados pela Fort Cordis, sem expor dados sensiveis em
                links permanentes ou anexos enviados por mensagem.
              </p>
              <div className="fc-public-portal-actions">
                <a
                  href="#acesso"
                  className="fc-public-portal-primary"
                >
                  <LockKeyhole className="h-5 w-5" />
                  Ver modelo de acesso
                </a>
                <a
                  href="#saude-pet"
                  className="fc-public-portal-secondary"
                >
                  <HeartPulse className="h-5 w-5" />
                  Dicas ao tutor
                </a>
              </div>
            </div>

            <PortalTutorWorkspace />
          </div>
        </div>
      </section>

      <section id="acesso" className="fc-public-portal-section">
        <div className="fc-public-portal-inner">
          <div className="fc-public-portal-section-heading">
            <p className="fc-public-portal-eyebrow">
              Acesso recomendado
            </p>
            <h2>
              Rapido para o tutor, restrito para o dado sensivel.
            </h2>
          </div>
          <div className="fc-public-portal-feature-grid fc-public-portal-feature-grid-three">
            {tutorAccess.map(({ title, description, icon: Icon }) => (
              <article key={title} className="fc-public-portal-feature">
                <Icon className="h-7 w-7 text-teal-700" />
                <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="saude-pet" className="fc-public-portal-band">
        <div className="fc-public-portal-band-grid">
          <div>
            <p className="fc-public-portal-eyebrow">
              Saude pet
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Pequenos registros melhoram a consulta cardiologica.
            </h2>
          </div>
          <div className="space-y-3">
            {healthNotes.map((note) => (
              <div key={note} className="flex gap-3 rounded-lg border border-white/15 bg-white/[0.06] p-4">
                <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-teal-200" />
                <p className="text-sm leading-6 text-slate-200">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fc-public-portal-section fc-public-portal-final">
        <div className="fc-public-portal-callout">
          <MessageCircle className="h-8 w-8 text-rose-700" />
          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            Notificacoes podem ser simples. Dados clinicos, nao.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            O canal ideal avisa que existe resultado disponivel e leva o tutor ao login seguro.
            O PDF, imagens e dados do pet permanecem protegidos dentro do sistema Fort Cordis.
          </p>
        </div>
      </section>
    </main>
  );
}
