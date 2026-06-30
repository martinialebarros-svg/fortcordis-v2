import Link from "next/link";
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
      "O tutor recebe um link magico no canal cadastrado e confirma um codigo curto antes de visualizar dados do pet.",
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
    <main className="min-h-screen bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-[#f8fbfc] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-teal-800 transition hover:bg-teal-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Portal Fort Cordis
          </Link>

          <div className="grid gap-10 py-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
                Area do tutor
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                Informacoes do pet e exames com acesso simples, mas protegido.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
                O portal do tutor deve reunir historico cardiologico, orientacoes do atendimento
                e download de documentos liberados pela Fort Cordis, sem expor dados sensiveis em
                links permanentes ou anexos enviados por mensagem.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#acesso"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 sm:w-auto"
                >
                  <LockKeyhole className="h-5 w-5" />
                  Ver modelo de acesso
                </a>
                <a
                  href="#saude-pet"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-white sm:w-auto"
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

      <section id="acesso" className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
              Acesso recomendado
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              Rapido para o tutor, restrito para o dado sensivel.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {tutorAccess.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-lg border border-slate-200 p-5 shadow-sm">
                <Icon className="h-7 w-7 text-teal-700" />
                <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="saude-pet" className="bg-slate-950 px-5 py-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-200">
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

      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-slate-200 p-6 sm:p-8">
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
