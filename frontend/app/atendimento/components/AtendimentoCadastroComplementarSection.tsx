"use client";

import { ArrowRight, ChevronDown, ChevronRight, Loader2, Save, User } from "lucide-react";
import type { LooseAtendimentoComponentProps } from "./component-props";

type AtendimentoCadastroComplementarSectionProps = LooseAtendimentoComponentProps;

export default function AtendimentoCadastroComplementarSection(props: AtendimentoCadastroComplementarSectionProps) {
  const {
    buscandoCepTutor,
    cadastroComplementar,
    cadastroComplementarExpandido,
    cadastroComplementarPendencias,
    carregandoCadastroComplementar,
    especieCadastroAtual,
    especieRacaExibicao,
    form,
    handleAdicionarRacaCadastro,
    idadePacienteExibicao,
    consultarCepTutor,
    novaRacaCadastro,
    opcoesRacaCadastro,
    salvandoCadastroComplementar,
    salvarCadastroComplementarAtual,
    setCadastroPacienteField,
    setCadastroComplementarExpandido,
    setCadastroTutorField,
    setNovaRacaCadastro,
    setStatusCepTutor,
    sincronizarPesoCadastroNaTriagem,
    statusCepTutor,
  } = props;

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3">
              <User className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Antes da triagem</p>
              <h3 className="text-lg font-semibold text-slate-900">Complementacao cadastral</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                cadastroComplementarPendencias.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {cadastroComplementarPendencias.length > 0
                ? `${cadastroComplementarPendencias.length} pendencia(s)`
                : "Cadastro pronto"}
            </span>
            <button
              type="button"
              onClick={() => setCadastroComplementarExpandido((prev: boolean) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {cadastroComplementarExpandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {cadastroComplementarExpandido ? "Ocultar cadastro" : "Revisar cadastro"}
            </button>
            {cadastroComplementarExpandido ? (
              <button
                type="button"
                onClick={() => void salvarCadastroComplementarAtual()}
                disabled={!form.paciente_id || salvandoCadastroComplementar || carregandoCadastroComplementar}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvandoCadastroComplementar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {salvandoCadastroComplementar ? "Salvando..." : "Salvar cadastro"}
              </button>
            ) : null}
          </div>
        </div>

        {!cadastroComplementarExpandido ? (
          <div
            className={`rounded-[22px] border px-4 py-4 text-sm ${
              !form.paciente_id
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : cadastroComplementarPendencias.length > 0
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {!form.paciente_id
              ? "Selecione um paciente para revisar os dados cadastrais somente quando necessario."
              : cadastroComplementarPendencias.length > 0
                ? `Cadastro recolhido para manter o foco clinico. ${cadastroComplementarPendencias.length} campo(s) importante(s) ainda precisam de revisao.`
                : "Cadastro conferido. Os dados completos ficam recolhidos para manter a consulta objetiva."}
          </div>
        ) : !form.paciente_id ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Selecione um paciente para complementar cadastro de pet e tutor antes da triagem.
          </div>
        ) : carregandoCadastroComplementar ? (
          <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados atuais do paciente e do tutor...
          </div>
        ) : (
          <>
            <div
              className={`rounded-[22px] border px-4 py-4 text-sm ${
                cadastroComplementarPendencias.length > 0
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {cadastroComplementarPendencias.length > 0
                ? `Campos mais importantes ainda em aberto: ${cadastroComplementarPendencias.slice(0, 6).join(", ")}.`
                : "Os dados principais para receita, envio de medicacao e nota fiscal ja estao preenchidos."}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Paciente</p>
                  <p className="mt-1 text-sm text-slate-600">Dados basicos do pet para seguir ao atendimento.</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={cadastroComplementar.paciente.nome}
                    onChange={(e) => setCadastroPacienteField("nome", e.target.value)}
                    placeholder="Nome do pet"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <select
                    value={cadastroComplementar.paciente.especie || ""}
                    onChange={(e) => {
                      setCadastroPacienteField("especie", e.target.value);
                      setCadastroPacienteField("raca", "");
                      setNovaRacaCadastro("");
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    <option value="">Especie</option>
                    <option value="Canina">Canino</option>
                    <option value="Felina">Felino</option>
                  </select>
                  <div className="space-y-2 md:col-span-2">
                    <select
                      value={cadastroComplementar.paciente.raca || ""}
                      onChange={(e) => setCadastroPacienteField("raca", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    >
                      <option value="">{especieCadastroAtual ? "Selecione a raca" : "Selecione a especie primeiro"}</option>
                      {opcoesRacaCadastro.map((raca: string) => (
                        <option key={raca} value={raca}>
                          {raca}
                        </option>
                      ))}
                    </select>
                    <div className="flex min-w-0 gap-2">
                      <input
                        value={novaRacaCadastro}
                        onChange={(e) => setNovaRacaCadastro(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAdicionarRacaCadastro();
                          }
                        }}
                        placeholder="Cadastrar nova raca"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={handleAdicionarRacaCadastro}
                        disabled={!novaRacaCadastro.trim()}
                        className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Idade informada
                    </label>
                    <input
                      value={cadastroComplementar.paciente.idade || ""}
                      onChange={(e) => setCadastroPacienteField("idade", e.target.value)}
                      placeholder="Ex.: 6, 6a, 8m, 2a 3m"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Data de nascimento
                    </label>
                    <input
                      type="date"
                      value={cadastroComplementar.paciente.data_nascimento || ""}
                      onChange={(e) => setCadastroPacienteField("data_nascimento", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                    <p className="px-1 text-[11px] text-slate-500">Preenchida automaticamente pela idade, com ajuste manual se precisar.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Peso cadastral (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cadastroComplementar.paciente.peso_kg ?? ""}
                      onChange={(e) => setCadastroPacienteField("peso_kg", e.target.value ? Number(e.target.value) : null)}
                      placeholder="Ex.: 6.3"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Idade calculada</p>
                    <p className="mt-1 font-medium text-slate-900">{idadePacienteExibicao || "Em aberto"}</p>
                    <p className="mt-1 text-xs text-slate-500">Atualizada automaticamente pela data de nascimento estimada.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resumo</p>
                    <p className="mt-1 font-medium text-slate-900">{especieRacaExibicao || "Especie e raca em aberto"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={sincronizarPesoCadastroNaTriagem}
                    disabled={cadastroComplementar.paciente.peso_kg == null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Copiar peso para triagem
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tutor</p>
                  <p className="mt-1 text-sm text-slate-600">Contato, endereco para entrega e dados fiscais.</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={cadastroComplementar.tutor.nome || ""}
                    onChange={(e) => setCadastroTutorField("nome", e.target.value)}
                    placeholder="Nome do tutor"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 md:col-span-2"
                  />
                  <input
                    type="tel"
                    value={cadastroComplementar.tutor.whatsapp || ""}
                    onChange={(e) => setCadastroTutorField("whatsapp", e.target.value)}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={15}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    type="tel"
                    value={cadastroComplementar.tutor.telefone || ""}
                    onChange={(e) => setCadastroTutorField("telefone", e.target.value)}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={15}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    type="email"
                    value={cadastroComplementar.tutor.email || ""}
                    onChange={(e) => setCadastroTutorField("email", e.target.value)}
                    placeholder="email@tutor.com"
                    autoComplete="email"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    value={cadastroComplementar.tutor.cpf || ""}
                    onChange={(e) => setCadastroTutorField("cpf", e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <div className="flex gap-2">
                    <input
                      value={cadastroComplementar.tutor.cep || ""}
                      onChange={(e) => {
                        setCadastroTutorField("cep", e.target.value);
                        setStatusCepTutor("");
                      }}
                      onBlur={() => void consultarCepTutor()}
                      placeholder="00000-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={9}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => void consultarCepTutor()}
                      disabled={buscandoCepTutor}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      {buscandoCepTutor ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                    </button>
                  </div>
                  <input
                    value={cadastroComplementar.tutor.endereco || ""}
                    onChange={(e) => setCadastroTutorField("endereco", e.target.value)}
                    placeholder="Endereco"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    value={cadastroComplementar.tutor.numero || ""}
                    onChange={(e) => setCadastroTutorField("numero", e.target.value)}
                    placeholder="Numero"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    value={cadastroComplementar.tutor.complemento || ""}
                    onChange={(e) => setCadastroTutorField("complemento", e.target.value)}
                    placeholder="Complemento"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    value={cadastroComplementar.tutor.bairro || ""}
                    onChange={(e) => setCadastroTutorField("bairro", e.target.value)}
                    placeholder="Bairro"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    value={cadastroComplementar.tutor.cidade || ""}
                    onChange={(e) => setCadastroTutorField("cidade", e.target.value)}
                    placeholder="Cidade"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  <input
                    value={cadastroComplementar.tutor.estado || ""}
                    onChange={(e) => setCadastroTutorField("estado", e.target.value)}
                    placeholder="Estado"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                  {statusCepTutor ? (
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                      {statusCepTutor}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
