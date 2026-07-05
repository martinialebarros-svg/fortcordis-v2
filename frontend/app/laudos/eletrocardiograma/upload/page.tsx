"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../../layout-dashboard";
import api from "@/lib/axios";
import { ArrowLeft, FileText, Loader2, Upload } from "lucide-react";

type UploadContext = {
  agendamento_id?: string;
  atendimento_id?: string;
  paciente_id?: string;
  clinic_id?: string;
};

type AgendamentoResumo = {
  id: number;
  paciente_id?: number | null;
  clinica_id?: number | null;
  paciente?: string | null;
  tutor?: string | null;
  clinica?: string | null;
  inicio?: string | null;
  data?: string | null;
};

function readInitialContext(): UploadContext {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  return {
    agendamento_id: params.get("agendamento_id") || undefined,
    atendimento_id: params.get("atendimento_id") || undefined,
    paciente_id: params.get("paciente_id") || undefined,
    clinic_id: params.get("clinic_id") || undefined,
  };
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return "";
}

export default function UploadEletrocardiogramaPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<UploadContext>({});
  const [agendamento, setAgendamento] = useState<AgendamentoResumo | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dataExame, setDataExame] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loadingContexto, setLoadingContexto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    setContexto(readInitialContext());
  }, [router]);

  useEffect(() => {
    if (!contexto.agendamento_id) {
      return;
    }

    let ativo = true;
    const carregarAgendamento = async () => {
      setLoadingContexto(true);
      try {
        const response = await api.get(`/agenda/${contexto.agendamento_id}`);
        if (!ativo) return;
        const item = response.data || {};
        setAgendamento(item);
        setDataExame((current) => current || toDateInput(item.inicio || item.data));
        setContexto((current) => ({
          ...current,
          paciente_id: current.paciente_id || (item.paciente_id ? String(item.paciente_id) : undefined),
          clinic_id: current.clinic_id || (item.clinica_id ? String(item.clinica_id) : undefined),
        }));
      } catch (error) {
        if (!ativo) return;
        setErro("Nao foi possivel carregar o contexto do agendamento.");
      } finally {
        if (ativo) {
          setLoadingContexto(false);
        }
      }
    };

    carregarAgendamento();

    return () => {
      ativo = false;
    };
  }, [contexto.agendamento_id]);

  const pacienteLabel = useMemo(() => {
    if (agendamento?.paciente) {
      return agendamento.paciente;
    }
    if (contexto.paciente_id) {
      return `Paciente #${contexto.paciente_id}`;
    }
    return "Paciente nao identificado";
  }, [agendamento?.paciente, contexto.paciente_id]);

  const clinicLabel = agendamento?.clinica || (contexto.clinic_id ? `Clinica #${contexto.clinic_id}` : "Clinica nao vinculada");

  const selecionarArquivo = (file: File | null) => {
    setErro("");
    if (!file) {
      setArquivo(null);
      return;
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setArquivo(null);
      setErro("Selecione um arquivo PDF.");
      return;
    }
    setArquivo(file);
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");

    if (!arquivo) {
      setErro("Selecione o PDF do eletrocardiograma.");
      return;
    }
    if (!contexto.paciente_id) {
      setErro("Nao encontrei o paciente deste atendimento. Abra o upload pelo agendamento ou atendimento correto.");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivo);
    if (contexto.agendamento_id) formData.append("agendamento_id", contexto.agendamento_id);
    if (contexto.atendimento_id) formData.append("atendimento_id", contexto.atendimento_id);
    if (contexto.paciente_id) formData.append("paciente_id", contexto.paciente_id);
    if (contexto.clinic_id) formData.append("clinic_id", contexto.clinic_id);
    if (dataExame) formData.append("data_exame", dataExame);
    if (observacoes.trim()) formData.append("observacoes", observacoes.trim());

    setEnviando(true);
    try {
      const response = await api.post("/laudos/eletrocardiograma/upload-pdf", formData);
      router.push(`/laudos/${response.data.id}`);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } }; userMessage?: string }).response?.data?.detail;
      setErro(detail || (error as { userMessage?: string }).userMessage || "Nao foi possivel enviar o PDF.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Upload de laudo</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">Eletrocardiograma</h1>
              <p className="mt-1 text-sm text-slate-500">
                Envie o PDF final para registrar o laudo e liberar depois pelo ambiente de Laudos.
              </p>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <p className="font-semibold">{pacienteLabel}</p>
              <p>{clinicLabel}</p>
              {agendamento?.tutor ? <p>Tutor: {agendamento.tutor}</p> : null}
            </div>
          </div>

          {loadingContexto ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados do agendamento...
            </div>
          ) : null}

          {erro ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <form onSubmit={enviar} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-900" htmlFor="data-exame">
                Data de realizacao
              </label>
              <input
                id="data-exame"
                type="date"
                value={dataExame}
                onChange={(event) => setDataExame(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-900" htmlFor="pdf-eletro">
                PDF do eletrocardiograma
              </label>
              <label
                htmlFor="pdf-eletro"
                className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-teal-300 hover:bg-teal-50"
              >
                <FileText className="h-9 w-9 text-teal-600" />
                <span className="mt-3 text-sm font-semibold text-slate-900">
                  {arquivo ? arquivo.name : "Selecionar PDF"}
                </span>
                <span className="mt-1 text-xs text-slate-500">Arquivo PDF, ate 25 MB</span>
              </label>
              <input
                id="pdf-eletro"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => selecionarArquivo(event.target.files?.[0] || null)}
                className="sr-only"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-900" htmlFor="observacoes">
                Observacoes internas
              </label>
              <textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="Opcional"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push("/laudos")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando || loadingContexto}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {enviando ? "Enviando..." : "Salvar laudo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
