import Link from "next/link";

export default function ClinicaParceiraPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur-sm sm:p-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">FortCordis</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Área da clínica parceira em construção</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
          Este portal reunirá download de laudos, andamento de casos e pendências financeiras.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/10 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
        >
          Voltar para a página inicial
        </Link>
      </div>
    </main>
  );
}
