"use client";

import { Heart, Search, User } from "lucide-react";
import type { LooseAtendimentoComponentProps } from "./component-props";

type AtendimentoConsultaOverviewSectionProps = LooseAtendimentoComponentProps;

export default function AtendimentoConsultaOverviewSection(props: AtendimentoConsultaOverviewSectionProps) {
  const {
    clinicas,
    fluxoClinico,
    form,
    getBadgeStatusClass,
    pacienteBusca,
    pacienteDropdownAberto,
    pacienteDropdownBlurTimeoutRef,
    pacienteNomeExibicao,
    pacientesFiltrados,
    selecionarPaciente,
    setField,
    setMostrarPacientes,
    setPacienteBusca,
    setWorkspacePainel,
    STATUS_ATENDIMENTO,
    especieRacaExibicao,
    tutorNomeExibicao,
  } = props;

  return (
    <>
      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-50 p-3">
              <User className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Contexto do paciente</p>
              <h2 className="text-lg font-semibold text-slate-900">Cabecalho clinico</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={pacienteBusca}
                onChange={(e) => {
                  setPacienteBusca(e.target.value);
                  const nextValue = e.target.value;
                  setMostrarPacientes(nextValue.trim().length >= 2);
                  if (!nextValue.trim()) {
                    setField("paciente_id", "");
                    setMostrarPacientes(false);
                  }
                }}
                onFocus={() => {
                  if (pacienteDropdownBlurTimeoutRef.current) {
                    window.clearTimeout(pacienteDropdownBlurTimeoutRef.current);
                  }
                  if (pacienteBusca.trim().length >= 2) {
                    setMostrarPacientes(true);
                  }
                }}
                onBlur={() => {
                  if (pacienteDropdownBlurTimeoutRef.current) {
                    window.clearTimeout(pacienteDropdownBlurTimeoutRef.current);
                  }
                  pacienteDropdownBlurTimeoutRef.current = window.setTimeout(() => {
                    setMostrarPacientes(false);
                  }, 120);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setMostrarPacientes(false);
                  }
                }}
                placeholder="Buscar paciente ou tutor..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm text-slate-900"
              />
              {pacienteDropdownAberto ? (
                <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                  {pacientesFiltrados.map((paciente: any) => (
                    <button
                      key={paciente.id}
                      type="button"
                      onClick={() => selecionarPaciente(paciente)}
                      className={`w-full rounded-2xl px-3 py-3 text-left transition hover:bg-teal-50 ${
                        String(paciente.id) === form.paciente_id ? "bg-teal-50" : ""
                      }`}
                    >
                      <span className="block text-sm font-medium text-slate-900">{paciente.nome}</span>
                      <span className="block text-xs text-slate-500">{paciente.tutor || "Tutor nao informado"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">Digite pelo menos 2 letras para buscar pacientes e tutores.</p>
            </div>
            <select
              value={form.clinica_id}
              onChange={(e) => setField("clinica_id", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Clinica</option>
              {clinicas.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={form.data_atendimento}
              onChange={(e) => setField("data_atendimento", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            />
            <input
              value={form.agendamento_id}
              onChange={(e) => setField("agendamento_id", e.target.value)}
              placeholder="Agendamento ID"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <select
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            >
              {STATUS_ATENDIMENTO.map((status: string) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Paciente</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{pacienteNomeExibicao || "Nao selecionado"}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Tutor</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{tutorNomeExibicao || "Nao informado"}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Especie / raca</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{especieRacaExibicao || "Nao informadas"}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Status do caso</p>
              <p className="mt-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getBadgeStatusClass(form.status)}`}>
                  {form.status || "Triagem"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-rose-50 p-3">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Fluxo clinico</p>
            <h2 className="text-lg font-semibold text-slate-900">Jornada do atendimento</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {fluxoClinico.map((etapa: any, index: number) => (
            <button
              key={etapa.id}
              type="button"
              onClick={() => setWorkspacePainel(etapa.id === "exames" ? "exames" : etapa.id === "prescricao" ? "prescricao" : "consulta")}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                etapa.concluido ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Etapa {index + 1}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    etapa.concluido ? "bg-emerald-200 text-emerald-800" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {etapa.concluido ? "Concluida" : "Em aberto"}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-900">{etapa.titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{etapa.descricao}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
