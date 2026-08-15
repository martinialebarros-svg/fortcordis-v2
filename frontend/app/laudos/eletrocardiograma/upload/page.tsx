"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../../layout-dashboard";
import api from "@/lib/axios";
import { listarTodasClinicas } from "@/lib/clinicas";
import {
  formatarTelefoneVisual,
  normalizarTelefone,
} from "@/lib/atendimento-cadastro";
import { calendarDateInput, operationalTodayDateInput } from "@/lib/calendar-date";
import { ArrowLeft, FileText, Loader2, Search, Upload, UserPlus, X } from "lucide-react";

type UploadContext = {
  agendamento_id?: string;
  atendimento_id?: string;
  paciente_id?: string;
  clinic_id?: string;
  veterinario_parceiro_id?: string;
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

type Clinica = {
  id: number;
  nome: string;
};

type ParceiroVeterinario = {
  id: number;
  nome_exibicao: string;
  email_login?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  cidade_base?: string | null;
  estado_base?: string | null;
  crmv?: string | null;
  area_atuacao?: string | null;
};

type PacienteBuscaItem = {
  id: number;
  nome: string;
  tutor?: string | null;
  tutor_id?: number | null;
  especie?: string | null;
  raca?: string | null;
};

type PacienteDetalhe = {
  id: number;
  nome: string;
  tutor?: string | null;
  tutor_id?: number | null;
  tutor_email?: string | null;
  tutor_telefone?: string | null;
  tutor_whatsapp?: string | null;
  especie?: string | null;
  raca?: string | null;
  sexo?: string | null;
  peso_kg?: number | null;
};

type NovoPacienteForm = {
  nome: string;
  tutor: string;
  tutor_email: string;
  tutor_telefone: string;
  tutor_whatsapp: string;
  especie: string;
  raca: string;
  sexo: string;
  peso_kg: string;
  data_nascimento: string;
  microchip: string;
};

type NovoParceiroForm = {
  nome_exibicao: string;
  email_login: string;
  telefone: string;
  whatsapp: string;
  cidade_base: string;
  estado_base: string;
  crmv: string;
  area_atuacao: string;
};

const NOVO_PACIENTE_INICIAL: NovoPacienteForm = {
  nome: "",
  tutor: "",
  tutor_email: "",
  tutor_telefone: "",
  tutor_whatsapp: "",
  especie: "Canina",
  raca: "",
  sexo: "Macho",
  peso_kg: "",
  data_nascimento: "",
  microchip: "",
};

const NOVO_PARCEIRO_INICIAL: NovoParceiroForm = {
  nome_exibicao: "",
  email_login: "",
  telefone: "",
  whatsapp: "",
  cidade_base: "Fortaleza",
  estado_base: "CE",
  crmv: "",
  area_atuacao: "Cardiologia domiciliar",
};

const INPUT_CLASS_NAME =
  "mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";

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
    veterinario_parceiro_id: params.get("veterinario_parceiro_id") || undefined,
  };
}

function toDateInput(value?: string | null) {
  return calendarDateInput(value);
}

function getTodayDateInput() {
  return operationalTodayDateInput();
}

function readApiError(
  error: unknown,
  fallback: string,
) {
  const maybeError = error as {
    response?: { data?: { detail?: string } };
    userMessage?: string;
  };
  return maybeError.response?.data?.detail || maybeError.userMessage || fallback;
}

export default function UploadEletrocardiogramaPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<UploadContext>({});
  const [agendamento, setAgendamento] = useState<AgendamentoResumo | null>(null);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [parceirosVeterinarios, setParceirosVeterinarios] = useState<ParceiroVeterinario[]>([]);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<PacienteDetalhe | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dataExame, setDataExame] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [sugestoesPacientes, setSugestoesPacientes] = useState<PacienteBuscaItem[]>([]);
  const [novoPaciente, setNovoPaciente] = useState<NovoPacienteForm>(NOVO_PACIENTE_INICIAL);
  const [novoParceiro, setNovoParceiro] = useState<NovoParceiroForm>(NOVO_PARCEIRO_INICIAL);
  const [loadingContexto, setLoadingContexto] = useState(false);
  const [loadingClinicas, setLoadingClinicas] = useState(false);
  const [loadingParceiros, setLoadingParceiros] = useState(false);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [carregandoPaciente, setCarregandoPaciente] = useState(false);
  const [salvandoNovoPaciente, setSalvandoNovoPaciente] = useState(false);
  const [salvandoNovoParceiro, setSalvandoNovoParceiro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mostrarCadastroRapido, setMostrarCadastroRapido] = useState(false);
  const [mostrarCadastroParceiro, setMostrarCadastroParceiro] = useState(false);
  const [erro, setErro] = useState("");

  const modoTelemedicina = !contexto.agendamento_id && !contexto.atendimento_id;
  const clinicaSelecionada = useMemo(
    () => clinicas.find((item) => String(item.id) === contexto.clinic_id) || null,
    [clinicas, contexto.clinic_id],
  );
  const parceiroSelecionado = useMemo(
    () => parceirosVeterinarios.find((item) => String(item.id) === contexto.veterinario_parceiro_id) || null,
    [parceirosVeterinarios, contexto.veterinario_parceiro_id],
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    setContexto(readInitialContext());
    setDataExame((current) => current || getTodayDateInput());
  }, [router]);

  useEffect(() => {
    let ativo = true;
    const carregarClinicas = async () => {
      try {
        setLoadingClinicas(true);
        const items = await listarTodasClinicas<Clinica>();
        if (!ativo) return;
        setClinicas(items);
      } catch (error) {
        if (!ativo) return;
        setErro("Nao foi possivel carregar a lista de clinicas.");
      } finally {
        if (ativo) {
          setLoadingClinicas(false);
        }
      }
    };

    void carregarClinicas();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    const carregarParceiros = async () => {
      try {
        setLoadingParceiros(true);
        const response = await api.get("/portal/parceiros/veterinarios/opcoes", {
          params: { limit: 100 },
        });
        if (!ativo) return;
        setParceirosVeterinarios(Array.isArray(response.data?.items) ? response.data.items : []);
      } catch (error) {
        if (!ativo) return;
        setErro((current) => current || "Nao foi possivel carregar os veterinarios parceiros.");
      } finally {
        if (ativo) {
          setLoadingParceiros(false);
        }
      }
    };

    void carregarParceiros();
    return () => {
      ativo = false;
    };
  }, []);

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
        setDataExame((current) => current || toDateInput(item.inicio || item.data) || getTodayDateInput());
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

    void carregarAgendamento();

    return () => {
      ativo = false;
    };
  }, [contexto.agendamento_id]);

  useEffect(() => {
    const pacienteId = Number(contexto.paciente_id || 0);
    if (!Number.isFinite(pacienteId) || pacienteId <= 0) {
      return;
    }

    let ativo = true;
    const carregarPaciente = async () => {
      try {
        setCarregandoPaciente(true);
        const response = await api.get(`/pacientes/${pacienteId}`);
        if (!ativo) return;
        setPacienteSelecionado(response.data || null);
        setBuscaPaciente(response.data?.nome || "");
      } catch (error) {
        if (!ativo) return;
        setErro("Nao foi possivel carregar o paciente selecionado.");
      } finally {
        if (ativo) {
          setCarregandoPaciente(false);
        }
      }
    };

    void carregarPaciente();

    return () => {
      ativo = false;
    };
  }, [contexto.paciente_id]);

  useEffect(() => {
    if (mostrarCadastroRapido) {
      setSugestoesPacientes([]);
      setBuscandoPacientes(false);
      return;
    }

    const termo = buscaPaciente.trim();
    if (termo.length < 2 || pacienteSelecionado?.nome === termo) {
      setSugestoesPacientes([]);
      setBuscandoPacientes(false);
      return;
    }

    let ativo = true;
    const timeout = window.setTimeout(async () => {
      try {
        setBuscandoPacientes(true);
        const response = await api.get("/pacientes", {
          params: { search: termo, limit: 8 },
        });
        if (!ativo) {
          return;
        }
        setSugestoesPacientes(Array.isArray(response.data?.items) ? response.data.items : []);
      } catch (error) {
        if (!ativo) return;
        setSugestoesPacientes([]);
      } finally {
        if (ativo) {
          setBuscandoPacientes(false);
        }
      }
    }, 300);

    return () => {
      ativo = false;
      window.clearTimeout(timeout);
    };
  }, [buscaPaciente, mostrarCadastroRapido, pacienteSelecionado?.nome]);

  const pacienteLabel = useMemo(() => {
    if (pacienteSelecionado?.nome) {
      return pacienteSelecionado.nome;
    }
    if (agendamento?.paciente) {
      return agendamento.paciente;
    }
    if (contexto.paciente_id) {
      return `Paciente #${contexto.paciente_id}`;
    }
    return modoTelemedicina ? "Telemedicina sem paciente selecionado" : "Paciente nao identificado";
  }, [agendamento?.paciente, contexto.paciente_id, modoTelemedicina, pacienteSelecionado?.nome]);

  const tutorLabel = pacienteSelecionado?.tutor || agendamento?.tutor || "";
  const clinicLabel =
    clinicaSelecionada?.nome ||
    agendamento?.clinica ||
    (contexto.clinic_id ? `Clinica #${contexto.clinic_id}` : "Clinica nao vinculada");
  const parceiroLabel =
    parceiroSelecionado?.nome_exibicao ||
    (contexto.veterinario_parceiro_id
      ? `Veterinario parceiro #${contexto.veterinario_parceiro_id}`
      : "Veterinario parceiro nao vinculado");

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

  const limparPacienteSelecionado = () => {
    setPacienteSelecionado(null);
    setBuscaPaciente("");
    setSugestoesPacientes([]);
    setContexto((current) => ({
      ...current,
      paciente_id: undefined,
    }));
  };

  const carregarPacienteSelecionado = async (pacienteId: number, label?: string) => {
    try {
      setErro("");
      setCarregandoPaciente(true);
      const response = await api.get(`/pacientes/${pacienteId}`);
      const paciente = response.data || null;
      setPacienteSelecionado(paciente);
      setContexto((current) => ({
        ...current,
        paciente_id: String(pacienteId),
      }));
      setBuscaPaciente(label || paciente?.nome || `Paciente #${pacienteId}`);
      setSugestoesPacientes([]);
      setMostrarCadastroRapido(false);
    } catch (error) {
      setErro("Nao foi possivel carregar o paciente escolhido.");
    } finally {
      setCarregandoPaciente(false);
    }
  };

  const criarPacienteNoFluxo = async () => {
    const tutor = novoPaciente.tutor.trim();
    const nomePaciente = novoPaciente.nome.trim();

    if (!tutor || !nomePaciente) {
      throw new Error("Informe pelo menos o nome do tutor e o nome do pet.");
    }

    setSalvandoNovoPaciente(true);
    try {
      const payload = {
        nome: nomePaciente,
        tutor,
        tutor_email: novoPaciente.tutor_email.trim() || null,
        tutor_telefone: normalizarTelefone(novoPaciente.tutor_telefone),
        tutor_whatsapp: normalizarTelefone(novoPaciente.tutor_whatsapp),
        especie: novoPaciente.especie,
        raca: novoPaciente.raca.trim(),
        sexo: novoPaciente.sexo,
        peso_kg: novoPaciente.peso_kg ? Number.parseFloat(novoPaciente.peso_kg.replace(",", ".")) : null,
        data_nascimento: novoPaciente.data_nascimento || null,
        microchip: novoPaciente.microchip.trim(),
      };

      const response = await api.post("/pacientes", payload);
      const paciente = response.data as PacienteDetalhe;
      if (!paciente?.id) {
        throw new Error("Nao foi possivel concluir o cadastro do paciente.");
      }
      setPacienteSelecionado(paciente);
      setContexto((current) => ({
        ...current,
        paciente_id: String(paciente.id),
      }));
      setBuscaPaciente(`${paciente.nome}${paciente.tutor ? ` - ${paciente.tutor}` : ""}`);
      setMostrarCadastroRapido(false);
      return paciente.id;
    } catch (error) {
      throw new Error(readApiError(error, "Nao foi possivel cadastrar o paciente neste fluxo."));
    } finally {
      setSalvandoNovoPaciente(false);
    }
  };

  const criarParceiroNoFluxo = async () => {
    const nomeExibicao = novoParceiro.nome_exibicao.trim();
    const emailLogin = novoParceiro.email_login.trim().toLowerCase();

    if (!nomeExibicao || !emailLogin) {
      throw new Error("Informe pelo menos o nome e o email do veterinario parceiro.");
    }

    setSalvandoNovoParceiro(true);
    try {
      const payload = {
        tipo: "veterinario",
        nome_exibicao: nomeExibicao,
        email_login: emailLogin,
        telefone: normalizarTelefone(novoParceiro.telefone),
        whatsapp: normalizarTelefone(novoParceiro.whatsapp),
        cidade_base: novoParceiro.cidade_base.trim(),
        estado_base: novoParceiro.estado_base.trim().toUpperCase(),
        crmv: novoParceiro.crmv.trim() || null,
        area_atuacao: novoParceiro.area_atuacao.trim() || null,
      };

      const response = await api.post("/portal/parceiros/veterinarios/cadastro-rapido", payload);
      const parceiro = response.data as ParceiroVeterinario;
      if (!parceiro?.id) {
        throw new Error("Nao foi possivel concluir o cadastro do veterinario parceiro.");
      }
      setParceirosVeterinarios((current) => {
        const withoutDuplicated = current.filter((item) => item.id !== parceiro.id);
        return [...withoutDuplicated, parceiro].sort((a, b) => a.nome_exibicao.localeCompare(b.nome_exibicao, "pt-BR"));
      });
      setContexto((current) => ({
        ...current,
        veterinario_parceiro_id: String(parceiro.id),
      }));
      setMostrarCadastroParceiro(false);
      return parceiro.id;
    } catch (error) {
      throw new Error(readApiError(error, "Nao foi possivel cadastrar o veterinario parceiro neste fluxo."));
    } finally {
      setSalvandoNovoParceiro(false);
    }
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");

    if (!arquivo) {
      setErro("Selecione o PDF do eletrocardiograma.");
      return;
    }

    let veterinarioParceiroId = contexto.veterinario_parceiro_id;
    if (!veterinarioParceiroId && mostrarCadastroParceiro) {
      try {
        const novoParceiroId = await criarParceiroNoFluxo();
        veterinarioParceiroId = String(novoParceiroId);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Nao foi possivel cadastrar o veterinario parceiro.");
        return;
      }
    }

    if (!contexto.clinic_id && !veterinarioParceiroId) {
      setErro("Selecione a clinica parceira ou o veterinario parceiro antes de salvar o laudo.");
      return;
    }

    let pacienteId = contexto.paciente_id;
    if (!pacienteId && mostrarCadastroRapido) {
      try {
        const novoPacienteId = await criarPacienteNoFluxo();
        pacienteId = String(novoPacienteId);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Nao foi possivel cadastrar o paciente.");
        return;
      }
    }

    if (!pacienteId) {
      setErro(
        modoTelemedicina
          ? "Selecione um paciente existente ou cadastre tutor e pet antes de salvar o eletrocardiograma."
          : "Nao encontrei o paciente deste atendimento. Abra o upload pelo agendamento correto ou selecione o paciente manualmente.",
      );
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivo);
    if (contexto.agendamento_id) formData.append("agendamento_id", contexto.agendamento_id);
    if (contexto.atendimento_id) formData.append("atendimento_id", contexto.atendimento_id);
    formData.append("paciente_id", pacienteId);
    if (contexto.clinic_id) formData.append("clinic_id", contexto.clinic_id);
    if (veterinarioParceiroId) formData.append("veterinario_parceiro_id", veterinarioParceiroId);
    if (dataExame) formData.append("data_exame", dataExame);
    if (observacoes.trim()) formData.append("observacoes", observacoes.trim());

    setEnviando(true);
    try {
      const response = await api.post("/laudos/eletrocardiograma/upload-pdf", formData);
      router.push(`/laudos/${response.data.id}`);
    } catch (error) {
      setErro(readApiError(error, "Nao foi possivel enviar o PDF."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="fc-ecg-upload-page">
        <button
          type="button"
          onClick={() => router.back()}
          className="fc-ecg-upload-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <main className="fc-ecg-upload-panel">
          <div className="fc-ecg-upload-panel-header">
            <div>
              <p className="fc-ecg-upload-kicker">
                {modoTelemedicina ? "Telemedicina" : "Upload diagnostico"}
              </p>
              <h1>Eletrocardiograma</h1>
              <p>
                {modoTelemedicina
                  ? "Envie o PDF do exame remoto, vincule a clinica parceira ou o veterinario parceiro e selecione ou cadastre tutor e pet no mesmo fluxo."
                  : "Envie o PDF final para registrar o laudo e liberar depois pelo ambiente de Laudos."}
              </p>
            </div>
            <div className="fc-ecg-upload-context">
              <p className="font-semibold">{pacienteLabel}</p>
              <p>{clinicLabel}</p>
              <p>{parceiroLabel}</p>
              {tutorLabel ? <p>Tutor: {tutorLabel}</p> : null}
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

          <form onSubmit={enviar} className="fc-ecg-upload-form">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-4">
                <h2 className="text-base font-black text-slate-900">
                  {modoTelemedicina ? "Fluxo de telemedicina" : "Contexto do laudo"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {modoTelemedicina
                    ? "Defina a unidade parceira ou o veterinario que encaminhou o caso e vincule tudo ao pet certo. Se o tutor ainda nao existir, voce pode cadastrar tudo aqui."
                    : "Revise a clinica e o paciente antes de anexar o PDF final."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="clinic_id">Clinica parceira</label>
                  <select
                    id="clinic_id"
                    value={contexto.clinic_id || ""}
                    onChange={(event) =>
                      setContexto((current) => ({
                        ...current,
                        clinic_id: event.target.value || undefined,
                      }))
                    }
                    disabled={loadingClinicas}
                    className={INPUT_CLASS_NAME}
                  >
                    <option value="">
                      {loadingClinicas ? "Carregando clinicas..." : "Selecione a clinica"}
                    </option>
                    {clinicas.map((clinica) => (
                      <option key={clinica.id} value={String(clinica.id)}>
                        {clinica.nome}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Use quando houver uma unidade fixa responsavel pelo caso.
                  </p>
                </div>

                <div>
                  <label htmlFor="veterinario_parceiro_id">Veterinario parceiro que encaminhou</label>
                  <select
                    id="veterinario_parceiro_id"
                    value={contexto.veterinario_parceiro_id || ""}
                    onChange={(event) =>
                      setContexto((current) => ({
                        ...current,
                        veterinario_parceiro_id: event.target.value || undefined,
                      }))
                    }
                    disabled={loadingParceiros}
                    className={INPUT_CLASS_NAME}
                  >
                    <option value="">
                      {loadingParceiros ? "Carregando parceiros..." : "Selecione o veterinario parceiro"}
                    </option>
                    {parceirosVeterinarios.map((partner) => (
                      <option key={partner.id} value={String(partner.id)}>
                        {partner.nome_exibicao}
                      </option>
                    ))}
                  </select>
                  {parceiroSelecionado ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {parceiroSelecionado.cidade_base || "Cidade nao informada"}
                      {parceiroSelecionado.estado_base ? `/${parceiroSelecionado.estado_base}` : ""}
                      {parceiroSelecionado.email_login ? ` • ${parceiroSelecionado.email_login}` : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Use quando o caso foi encaminhado por profissional volante ou domiciliar.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="data-exame">Data de realizacao</label>
                  <input
                    id="data-exame"
                    type="date"
                    value={dataExame}
                    onChange={(event) => setDataExame(event.target.value)}
                    className={INPUT_CLASS_NAME}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!mostrarCadastroParceiro ? (
                  <button
                    type="button"
                    onClick={() => {
                      setContexto((current) => ({ ...current, veterinario_parceiro_id: undefined }));
                      setMostrarCadastroParceiro(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Cadastrar veterinario parceiro
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMostrarCadastroParceiro(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Search className="h-4 w-4" />
                    Usar parceiro ja cadastrado
                  </button>
                )}
              </div>

              {mostrarCadastroParceiro ? (
                <div className="mt-5 rounded-2xl border border-cordis-100 bg-cordis-50/40 p-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-black text-slate-900">Cadastro rapido do veterinario parceiro</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Use este bloco quando o profissional ainda nao estiver no portal. O cadastro sera criado e o laudo continua na mesma etapa.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="parceiro-nome">Nome exibido</label>
                      <input
                        id="parceiro-nome"
                        type="text"
                        value={novoParceiro.nome_exibicao}
                        onChange={(event) => setNovoParceiro((current) => ({ ...current, nome_exibicao: event.target.value }))}
                        className={INPUT_CLASS_NAME}
                        placeholder="Dra. Carla Soares"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-email">Email de login</label>
                      <input
                        id="parceiro-email"
                        type="email"
                        value={novoParceiro.email_login}
                        onChange={(event) => setNovoParceiro((current) => ({ ...current, email_login: event.target.value }))}
                        className={INPUT_CLASS_NAME}
                        placeholder="cardio@vetparceiro.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-whatsapp">WhatsApp</label>
                      <input
                        id="parceiro-whatsapp"
                        type="tel"
                        value={novoParceiro.whatsapp}
                        onChange={(event) =>
                          setNovoParceiro((current) => ({
                            ...current,
                            whatsapp: formatarTelefoneVisual(event.target.value),
                          }))
                        }
                        className={INPUT_CLASS_NAME}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-telefone">Telefone</label>
                      <input
                        id="parceiro-telefone"
                        type="tel"
                        value={novoParceiro.telefone}
                        onChange={(event) =>
                          setNovoParceiro((current) => ({
                            ...current,
                            telefone: formatarTelefoneVisual(event.target.value),
                          }))
                        }
                        className={INPUT_CLASS_NAME}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-cidade">Cidade base</label>
                      <input
                        id="parceiro-cidade"
                        type="text"
                        value={novoParceiro.cidade_base}
                        onChange={(event) => setNovoParceiro((current) => ({ ...current, cidade_base: event.target.value }))}
                        className={INPUT_CLASS_NAME}
                        placeholder="Fortaleza"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-estado">Estado base</label>
                      <input
                        id="parceiro-estado"
                        type="text"
                        value={novoParceiro.estado_base}
                        onChange={(event) => setNovoParceiro((current) => ({ ...current, estado_base: event.target.value.toUpperCase() }))}
                        className={INPUT_CLASS_NAME}
                        placeholder="CE"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-crmv">CRMV</label>
                      <input
                        id="parceiro-crmv"
                        type="text"
                        value={novoParceiro.crmv}
                        onChange={(event) => setNovoParceiro((current) => ({ ...current, crmv: event.target.value }))}
                        className={INPUT_CLASS_NAME}
                        placeholder="Opcional"
                      />
                    </div>

                    <div>
                      <label htmlFor="parceiro-area">Area de atuacao</label>
                      <input
                        id="parceiro-area"
                        type="text"
                        value={novoParceiro.area_atuacao}
                        onChange={(event) => setNovoParceiro((current) => ({ ...current, area_atuacao: event.target.value }))}
                        className={INPUT_CLASS_NAME}
                        placeholder="Cardiologia domiciliar"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">
                      Paciente e tutor
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Busque um pet ja cadastrado ou abra o cadastro rapido sem sair desta tela.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!mostrarCadastroRapido ? (
                      <button
                        type="button"
                        onClick={() => {
                          limparPacienteSelecionado();
                          setMostrarCadastroRapido(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        Cadastrar tutor e pet
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMostrarCadastroRapido(false)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Search className="h-4 w-4" />
                        Usar paciente ja cadastrado
                      </button>
                    )}
                  </div>
                </div>

                {!mostrarCadastroRapido ? (
                  <div className="mt-4">
                    <label htmlFor="busca-paciente">Buscar paciente ja cadastrado</label>
                    <div className="relative">
                      <input
                        id="busca-paciente"
                        type="text"
                        value={buscaPaciente}
                        onChange={(event) => {
                          setBuscaPaciente(event.target.value);
                          if (!event.target.value.trim()) {
                            limparPacienteSelecionado();
                          }
                        }}
                        className={INPUT_CLASS_NAME}
                        placeholder="Digite nome do pet ou tutor"
                      />
                      {buscandoPacientes || carregandoPaciente ? (
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Digite pelo menos 2 letras para localizar um pet ja cadastrado.
                    </p>

                    {sugestoesPacientes.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {sugestoesPacientes.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void carregarPacienteSelecionado(item.id, item.nome)}
                            className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">{item.nome}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.tutor || "Tutor nao informado"}
                                {item.especie ? ` • ${item.especie}` : ""}
                                {item.raca ? ` • ${item.raca}` : ""}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-slate-400">#{item.id}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {pacienteSelecionado ? (
                      <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-900">{pacienteSelecionado.nome}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Tutor: {pacienteSelecionado.tutor || "Nao informado"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              ID do pet: {pacienteSelecionado.id}
                              {pacienteSelecionado.tutor_id ? ` • Tutor #${pacienteSelecionado.tutor_id}` : ""}
                              {pacienteSelecionado.especie ? ` • ${pacienteSelecionado.especie}` : ""}
                              {pacienteSelecionado.raca ? ` • ${pacienteSelecionado.raca}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={limparPacienteSelecionado}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-teal-50"
                          >
                            <X className="h-4 w-4" />
                            Trocar paciente
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-cordis-100 bg-cordis-50/40 p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-black text-slate-900">Cadastro rapido de tutor e pet</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Use este bloco quando o tutor ainda nao estiver no sistema. O cadastro sera criado e o upload continua na mesma etapa.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="novo-tutor">Nome do tutor</label>
                        <input
                          id="novo-tutor"
                          type="text"
                          value={novoPaciente.tutor}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, tutor: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                          placeholder="Nome do tutor"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-paciente">Nome do pet</label>
                        <input
                          id="novo-paciente"
                          type="text"
                          value={novoPaciente.nome}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, nome: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                          placeholder="Nome do pet"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-email">E-mail do tutor</label>
                        <input
                          id="novo-email"
                          type="email"
                          value={novoPaciente.tutor_email}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, tutor_email: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                          placeholder="email@cliente.com"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-whatsapp">WhatsApp do tutor</label>
                        <input
                          id="novo-whatsapp"
                          type="tel"
                          value={novoPaciente.tutor_whatsapp}
                          onChange={(event) =>
                            setNovoPaciente((current) => ({
                              ...current,
                              tutor_whatsapp: formatarTelefoneVisual(event.target.value),
                            }))
                          }
                          className={INPUT_CLASS_NAME}
                          placeholder="(00) 00000-0000"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-telefone">Telefone do tutor</label>
                        <input
                          id="novo-telefone"
                          type="tel"
                          value={novoPaciente.tutor_telefone}
                          onChange={(event) =>
                            setNovoPaciente((current) => ({
                              ...current,
                              tutor_telefone: formatarTelefoneVisual(event.target.value),
                            }))
                          }
                          className={INPUT_CLASS_NAME}
                          placeholder="(00) 00000-0000"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-especie">Especie</label>
                        <select
                          id="novo-especie"
                          value={novoPaciente.especie}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, especie: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                        >
                          <option value="Canina">Canina</option>
                          <option value="Felina">Felina</option>
                          <option value="Equina">Equina</option>
                          <option value="Outra">Outra</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="novo-raca">Raca</label>
                        <input
                          id="novo-raca"
                          type="text"
                          value={novoPaciente.raca}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, raca: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                          placeholder="Raca"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-sexo">Sexo</label>
                        <select
                          id="novo-sexo"
                          value={novoPaciente.sexo}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, sexo: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                        >
                          <option value="Macho">Macho</option>
                          <option value="Femea">Femea</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="novo-peso">Peso (kg)</label>
                        <input
                          id="novo-peso"
                          type="text"
                          value={novoPaciente.peso_kg}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, peso_kg: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                          placeholder="Ex: 4,3"
                        />
                      </div>

                      <div>
                        <label htmlFor="novo-nascimento">Data de nascimento</label>
                        <input
                          id="novo-nascimento"
                          type="date"
                          value={novoPaciente.data_nascimento}
                          onChange={(event) =>
                            setNovoPaciente((current) => ({ ...current, data_nascimento: event.target.value }))
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor="novo-microchip">Microchip</label>
                        <input
                          id="novo-microchip"
                          type="text"
                          value={novoPaciente.microchip}
                          onChange={(event) => setNovoPaciente((current) => ({ ...current, microchip: event.target.value }))}
                          className={INPUT_CLASS_NAME}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div>
              <label htmlFor="pdf-eletro">PDF do eletrocardiograma</label>
              <label
                htmlFor="pdf-eletro"
                className="fc-ecg-upload-dropzone"
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
              <label htmlFor="observacoes">Observacoes internas</label>
              <textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={3}
                className={INPUT_CLASS_NAME}
                placeholder="Opcional"
              />
            </div>

            <div className="fc-ecg-upload-actions">
              <button
                type="button"
                onClick={() => router.push("/laudos")}
                className="fc-ecg-upload-cancel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  enviando ||
                  loadingContexto ||
                  loadingClinicas ||
                  salvandoNovoPaciente ||
                  salvandoNovoParceiro
                }
                className="fc-ecg-upload-submit"
              >
                {enviando || salvandoNovoPaciente || salvandoNovoParceiro ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {enviando
                  ? "Enviando..."
                  : salvandoNovoPaciente
                    ? "Cadastrando paciente..."
                    : salvandoNovoParceiro
                      ? "Cadastrando parceiro..."
                    : "Salvar laudo"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </DashboardLayout>
  );
}
