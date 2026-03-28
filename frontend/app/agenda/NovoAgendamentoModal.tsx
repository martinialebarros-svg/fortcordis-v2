"use client";

import { useEffect, useState } from "react";
import { X, User, Building, Calendar, Clock, Sparkles } from "lucide-react";
import api from "@/lib/axios";
import {
  AgendaExcecaoConfig,
  AgendaFeriadoConfig,
  AgendaSemanalConfig,
  validarHorarioAgendamento,
} from "@/lib/agenda-config";

const TABELA_PRECO_PADRAO = [
  { id: 1, nome: "Fortaleza" },
  { id: 2, nome: "Regiao Metropolitana" },
  { id: 3, nome: "Domiciliar" },
  { id: 4, nome: "Personalizado" },
];

interface NovoAgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agendamentoCriado?: { data?: string | null }) => void | Promise<void>;
  agendamento?: any;
  defaultDate?: string;
  defaultTime?: string;
  agendaSemanal: AgendaSemanalConfig;
  agendaFeriados: AgendaFeriadoConfig[];
  agendaExcecoes: AgendaExcecaoConfig[];
}

interface SugestaoHorarioVizinho {
  agendamento_id: number;
  clinica_id: number;
  clinica: string;
  inicio?: string;
  fim?: string;
  duracao_deslocamento_min: number;
  folga_min: number | null;
  margem_min: number | null;
  fonte: string;
}

interface SugestaoHorarioItem {
  inicio: string;
  fim: string;
  score: number;
  risco: number;
  tempo_deslocamento_total_min: number;
  ociosidade_min: number;
  anterior: SugestaoHorarioVizinho | null;
  proximo: SugestaoHorarioVizinho | null;
}

interface SugestoesHorarioResponse {
  ok: boolean;
  data: string;
  clinica_id: number;
  duracao_minutos: number;
  perfil_deslocamento: string;
  intervalo_minutos?: number;
  motivo?: string;
  total_encontrados: number;
  items: SugestaoHorarioItem[];
}

interface ConflitoDeslocamentoDetail {
  codigo?: string;
  mensagem?: string;
  duracao_min?: number;
  folga_min?: number;
  confirmavel?: boolean;
}

interface SugestaoProximidadeResponse {
  ok: boolean;
  sugerir: boolean;
  mensagem: string;
  limite_minutos?: number;
  item?: {
    agendamento_id: number;
    clinica_id: number;
    clinica: string;
    data?: string | null;
    inicio?: string | null;
    fim?: string | null;
    duracao_deslocamento_min: number;
    fonte_deslocamento?: string;
    status?: string;
  } | null;
}

interface TutorOption {
  id: number;
  nome: string;
  telefone?: string | null;
}

interface PacienteOption {
  id: number;
  nome: string;
  tutor_id?: number | null;
  tutor?: string;
  especie?: string;
  raca?: string;
}

interface FormDataAgenda {
  tutor_id: string;
  paciente_id: string;
  clinica_id: string;
  clinica_nova_nome: string;
  clinica_nova_tabela_preco_id: string;
  servico_id: string;
  data: string;
  hora: string;
  marcar_como_reserva: boolean;
  observacoes: string;
}

interface NovoTutorForm {
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
}

interface NovoAnimalForm {
  tutor_id: string;
  nome: string;
  especie: string;
  raca: string;
  sexo: string;
  peso_kg: string;
  data_nascimento: string;
  microchip: string;
  observacoes: string;
}

const buildInitialFormData = (defaultDate?: string, defaultTime?: string): FormDataAgenda => ({
  tutor_id: "",
  paciente_id: "",
  clinica_id: "",
  clinica_nova_nome: "",
  clinica_nova_tabela_preco_id: "1",
  servico_id: "",
  data: defaultDate || "",
  hora: defaultTime || "",
  marcar_como_reserva: false,
  observacoes: "",
});

const buildInitialTutorForm = (): NovoTutorForm => ({
  nome: "",
  telefone: "",
  whatsapp: "",
  email: "",
});

const buildInitialAnimalForm = (tutorId = ""): NovoAnimalForm => ({
  tutor_id: tutorId,
  nome: "",
  especie: "Canina",
  raca: "",
  sexo: "Macho",
  peso_kg: "",
  data_nascimento: "",
  microchip: "",
  observacoes: "",
});

const rotularFonteDeslocamento = (fonte?: string | null): string => {
  const valor = String(fonte || "").trim().toLowerCase();
  if (!valor) return "Fonte nao informada";
  if (valor.startsWith("google_")) return "Google Maps";
  if (valor.startsWith("heuristica")) return "Heuristica local";
  if (valor === "mesma_clinica") return "Mesma clinica";
  if (valor === "clinica_indefinida") return "Clinica indefinida";
  if (valor === "sem_matriz") return "Sem matriz";
  return valor.replaceAll("_", " ");
};

const resumirDeslocamentoSugestao = (item: SugestaoHorarioItem): string => {
  const fontes = [item.anterior?.fonte, item.proximo?.fonte].filter(Boolean) as string[];
  if (fontes.length === 0) {
    return "Sem agendamentos vizinhos na data para aplicar deslocamento neste horario.";
  }

  const fontesUnicas = Array.from(new Set(fontes.map((fonte) => rotularFonteDeslocamento(fonte))));
  return `Fonte do deslocamento: ${fontesUnicas.join(" + ")}.`;
};

export default function NovoAgendamentoModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  agendamento,
  defaultDate,
  defaultTime,
  agendaSemanal,
  agendaFeriados,
  agendaExcecoes,
}: NovoAgendamentoModalProps) {
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState<PacienteOption[]>([]);
  const [tutores, setTutores] = useState<TutorOption[]>([]);
  const [clinicas, setClinicas] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [tabelasPreco, setTabelasPreco] = useState<{ id: number; nome: string }[]>(TABELA_PRECO_PADRAO);
  const [tutorSelecionado, setTutorSelecionado] = useState<string>("");
  const [erroCarregamento, setErroCarregamento] = useState<string>("");
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [sugestoesHorario, setSugestoesHorario] = useState<SugestaoHorarioItem[]>([]);
  const [erroSugestoes, setErroSugestoes] = useState<string>("");
  const [mensagemSugestoes, setMensagemSugestoes] = useState<string>("");
  const [mensagemProximidade, setMensagemProximidade] = useState<string>("");
  const [sugestaoProximidade, setSugestaoProximidade] = useState<SugestaoProximidadeResponse | null>(null);
  const [modalTutorAberto, setModalTutorAberto] = useState(false);
  const [modalAnimalAberto, setModalAnimalAberto] = useState(false);
  const [salvandoTutor, setSalvandoTutor] = useState(false);
  const [salvandoAnimal, setSalvandoAnimal] = useState(false);
  const [novoTutor, setNovoTutor] = useState<NovoTutorForm>(buildInitialTutorForm());
  const [novoAnimal, setNovoAnimal] = useState<NovoAnimalForm>(buildInitialAnimalForm());

  const [formData, setFormData] = useState<FormDataAgenda>(
    buildInitialFormData(defaultDate, defaultTime)
  );

  const isEditando = !!agendamento;
  const statusFormulario = isEditando
    ? (agendamento?.status || "Agendado")
    : (formData.marcar_como_reserva ? "Reservado" : "Agendado");
  const permiteSemPacienteTutor = statusFormulario === "Reservado";

  const parseApiDateTime = (value?: string): Date | null => {
    if (!value) return null;

    const match = value
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, ano, mes, dia, hora, minuto, segundo = "0"] = match;
      const local = new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hora),
        Number(minuto),
        Number(segundo),
        0
      );
      if (!Number.isNaN(local.getTime())) {
        return local;
      }
    }

    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseAgendamentoInicio = (ag: any): Date | null => {
    if (ag?.data && ag?.hora) {
      const [ano, mes, dia] = String(ag.data).split("-").map(Number);
      const [hora, minuto] = String(ag.hora).split(":").map(Number);
      if (
        Number.isFinite(ano) &&
        Number.isFinite(mes) &&
        Number.isFinite(dia) &&
        Number.isFinite(hora) &&
        Number.isFinite(minuto)
      ) {
        const local = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
        if (!Number.isNaN(local.getTime())) {
          return local;
        }
      }
    }

    return parseApiDateTime(ag?.inicio);
  };

  const toInputDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toInputTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const toApiDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  // Inicializa formulario ao abrir no modo "novo" sem resetar quando pacientes/tutores atualizam.
  useEffect(() => {
    if (!isOpen || isEditando) return;
    setFormData(buildInitialFormData(defaultDate, defaultTime));
    setTutorSelecionado("");
  }, [defaultDate, defaultTime, isEditando, isOpen]);

  // Preenche formulario ao abrir/atualizar no modo de edicao.
  useEffect(() => {
    if (!isOpen || !isEditando || !agendamento) return;

    const inicio = parseAgendamentoInicio(agendamento);
    const data = inicio ? toInputDate(inicio) : "";
    const hora = inicio ? toInputTime(inicio) : "";
    const pacienteSelecionado =
      agendamento.paciente_id && agendamento.paciente_id > 0
        ? pacientes.find((p) => p.id === agendamento.paciente_id)
        : null;

    setFormData({
      tutor_id:
        pacienteSelecionado?.tutor_id !== null &&
        pacienteSelecionado?.tutor_id !== undefined
          ? pacienteSelecionado.tutor_id.toString()
          : "",
      paciente_id:
        agendamento.paciente_id && agendamento.paciente_id > 0
          ? agendamento.paciente_id.toString()
          : "",
      clinica_id: agendamento.clinica_id?.toString() || "",
      clinica_nova_nome: "",
      clinica_nova_tabela_preco_id: "1",
      servico_id: agendamento.servico_id?.toString() || "",
      data,
      hora,
      marcar_como_reserva: agendamento.status === "Reservado",
      observacoes: agendamento.observacoes || "",
    });

    setTutorSelecionado(pacienteSelecionado?.tutor || "");
  }, [agendamento, isEditando, isOpen, pacientes]);

  // Carregar dados dos selects
  useEffect(() => {
    if (isOpen) {
      carregarDados();
      return;
    }

    setModalTutorAberto(false);
    setModalAnimalAberto(false);
    setSalvandoTutor(false);
    setSalvandoAnimal(false);
    setNovoTutor(buildInitialTutorForm());
    setNovoAnimal(buildInitialAnimalForm());
    setFormData(buildInitialFormData(defaultDate, defaultTime));
    setTutorSelecionado("");
    setMensagemProximidade("");
    setSugestaoProximidade(null);
  }, [defaultDate, defaultTime, isOpen]);

  const carregarDados = async () => {
    const extrairItems = (payload: any): any[] => {
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload)) return payload;
      return [];
    };

    const resultados = await Promise.allSettled([
      api.get("/pacientes?limit=1000"),
      api.get("/tutores?limit=1000"),
      api.get("/clinicas?limit=1000"),
      api.get("/clinicas/tabelas-preco/opcoes"),
      api.get("/servicos?limit=1000"),
    ]);

    const falhas: string[] = [];

    const pacientesResp = resultados[0];
    if (pacientesResp.status === "fulfilled") {
      setPacientes(extrairItems(pacientesResp.value?.data) as PacienteOption[]);
    } else {
      setPacientes([]);
      falhas.push("pacientes");
    }

    const tutoresResp = resultados[1];
    if (tutoresResp.status === "fulfilled") {
      setTutores(extrairItems(tutoresResp.value?.data) as TutorOption[]);
    } else {
      setTutores([]);
      falhas.push("tutores");
    }

    const clinicasResp = resultados[2];
    if (clinicasResp.status === "fulfilled") {
      setClinicas(extrairItems(clinicasResp.value?.data));
    } else {
      setClinicas([]);
      falhas.push("clinicas");
    }

    const tabelasResp = resultados[3];
    if (tabelasResp.status === "fulfilled") {
      const itens = extrairItems(tabelasResp.value?.data);
      if (itens.length > 0) {
        setTabelasPreco(itens);
      } else {
        setTabelasPreco(TABELA_PRECO_PADRAO);
      }
    } else {
      setTabelasPreco(TABELA_PRECO_PADRAO);
      falhas.push("tabelas de preco");
    }

    const servicosResp = resultados[4];
    if (servicosResp.status === "fulfilled") {
      setServicos(extrairItems(servicosResp.value?.data));
    } else {
      setServicos([]);
      falhas.push("servicos");
    }

    if (falhas.length > 0) {
      setErroCarregamento(
        `Falha ao carregar ${falhas.join(", ")}. Atualize a pagina e tente novamente.`
      );
    } else {
      setErroCarregamento("");
    }
  };

  const handleTutorChange = (tutorId: string) => {
    const tutor = tutores.find((t) => t.id.toString() === tutorId);
    setTutorSelecionado(tutor?.nome || "");
    setFormData((prev) => ({
      ...prev,
      tutor_id: tutorId,
      paciente_id: "",
    }));
  };

  const handlePacienteChange = (pacienteId: string) => {
    const paciente = pacientes.find((p) => p.id.toString() === pacienteId);
    setTutorSelecionado(paciente?.tutor || "");
    setFormData((prev) => ({
      ...prev,
      paciente_id: pacienteId,
      tutor_id:
        paciente?.tutor_id !== null && paciente?.tutor_id !== undefined
          ? paciente.tutor_id.toString()
          : prev.tutor_id,
    }));
  };

  const buscarSugestaoProximidade = async (clinicaId: string, dataISO: string) => {
    const clinicaIdNum = Number.parseInt(clinicaId, 10);
    if (!Number.isFinite(clinicaIdNum)) {
      setMensagemProximidade("");
      setSugestaoProximidade(null);
      return;
    }
    if (!dataISO) {
      setMensagemProximidade("Selecione a data para ativar o assistente inteligente de proximidade.");
      setSugestaoProximidade(null);
      return;
    }

    try {
      const response = await api.post<SugestaoProximidadeResponse>("/agenda/sugestao-proximidade", {
        clinica_id: clinicaIdNum,
        data: dataISO,
        perfil_deslocamento: "comercial",
        limite_minutos: 20,
        ignorar_agendamento_id: isEditando ? agendamento?.id : null,
      });

      const data = response?.data || null;
      setSugestaoProximidade(data);
      const mensagem = String(data?.mensagem || "").trim();
      setMensagemProximidade(mensagem || "Assistente inteligente sem sugestao para os dados atuais.");
    } catch {
      setMensagemProximidade("Nao foi possivel consultar sugestoes de proximidade agora.");
      setSugestaoProximidade(null);
    }
  };

  const handleClinicaChange = (clinicaId: string) => {
    setFormData((prev) => ({
      ...prev,
      clinica_id: clinicaId,
      clinica_nova_nome: clinicaId ? "" : prev.clinica_nova_nome,
    }));
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!formData.clinica_id) {
      setMensagemProximidade("");
      setSugestaoProximidade(null);
      return;
    }
    if (!formData.servico_id) {
      setMensagemProximidade("Selecione o servico para ativar o assistente inteligente de proximidade.");
      setSugestaoProximidade(null);
      return;
    }
    void buscarSugestaoProximidade(formData.clinica_id, formData.data);
  }, [isOpen, formData.clinica_id, formData.servico_id, formData.data]);

  const pacientesFiltradosPorTutor = formData.tutor_id
    ? pacientes.filter((paciente) => String(paciente.tutor_id || "") === formData.tutor_id)
    : pacientes;

  const obterDuracaoServicoSelecionado = (): number => {
    const servicoSelecionado = servicos.find((s) => s.id?.toString() === formData.servico_id);
    const duracaoMinutos = Number.parseInt(
      `${servicoSelecionado?.duracao_minutos ?? ""}`,
      10
    );
    return Number.isFinite(duracaoMinutos) && duracaoMinutos > 0 ? duracaoMinutos : 30;
  };

  const aplicarSugestaoHorario = (item: SugestaoHorarioItem) => {
    const [data, hora] = String(item.inicio || "").split(" ");
    if (!data || !hora) {
      setErroSugestoes("Nao foi possivel aplicar o horario sugerido.");
      return;
    }

    setFormData((prev) => ({ ...prev, data, hora }));
    setMensagemSugestoes(`Horario sugerido aplicado: ${hora}.`);
    setErroSugestoes("");
  };

  const extrairHoraDataHora = (value: string): string => {
    const [, hora] = String(value || "").split(" ");
    return hora || value;
  };

  const buscarSugestoesHorario = async () => {
    setMensagemSugestoes("");
    setErroSugestoes("");
    setSugestoesHorario([]);

    const clinicaId = Number.parseInt(formData.clinica_id || "", 10);
    if (!Number.isFinite(clinicaId)) {
      setErroSugestoes("Selecione uma clinica cadastrada para sugerir horarios.");
      return;
    }
    if (!formData.servico_id) {
      setErroSugestoes("Selecione o servico para sugerir horarios operacionais com duracao correta.");
      return;
    }

    const dataSelecionada = String(formData.data || "").trim();
    const dataProximidade = String(sugestaoProximidade?.item?.data || "").trim();
    const deveUsarDataProximidade =
      Boolean(sugestaoProximidade?.sugerir) && Boolean(dataProximidade);
    const dataBaseBusca = deveUsarDataProximidade ? dataProximidade : dataSelecionada;

    if (!dataBaseBusca) {
      setErroSugestoes("Informe a data antes de buscar sugestoes.");
      return;
    }

    try {
      setCarregandoSugestoes(true);
      const mudouDataPorProximidade = dataBaseBusca !== dataSelecionada;
      const prefixoMensagem = mudouDataPorProximidade
        ? `Sugestoes calculadas automaticamente para ${dataBaseBusca} com base no agendamento proximo. `
        : "";

      if (mudouDataPorProximidade) {
        setFormData((prev) => ({ ...prev, data: dataBaseBusca }));
      }

      const payload = {
        data: dataBaseBusca,
        clinica_id: clinicaId,
        servico_id: formData.servico_id ? parseInt(formData.servico_id, 10) : null,
        duracao_minutos: obterDuracaoServicoSelecionado(),
        intervalo_minutos: 30,
        limite: 8,
        perfil_deslocamento: "comercial",
        ignorar_agendamento_id: isEditando ? agendamento?.id : null,
      };

      const response = await api.post<SugestoesHorarioResponse>("/agenda/sugestoes-horario", payload);
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      setSugestoesHorario(items);
      if (items.length === 0) {
        setMensagemSugestoes(
          `${prefixoMensagem}${response?.data?.motivo || "Nenhum horario operacional encontrado para essa data."}`.trim()
        );
      } else if (items.every((item) => !item.anterior && !item.proximo)) {
        setMensagemSugestoes(
          `${prefixoMensagem}Nao ha agendamentos vizinhos nesta data; por isso o deslocamento pode aparecer como 0 min.`.trim()
        );
      } else if (prefixoMensagem) {
        setMensagemSugestoes(prefixoMensagem.trim());
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setErroSugestoes(typeof detail === "string" ? detail : "Falha ao buscar sugestoes de horario.");
    } finally {
      setCarregandoSugestoes(false);
    }
  };

  const extrairMensagemErro = (detail: any, fallback = "Falha inesperada."): string => {
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail && typeof detail === "object") {
      if (typeof detail.mensagem === "string" && detail.mensagem.trim()) return detail.mensagem;
      if (typeof detail.message === "string" && detail.message.trim()) return detail.message;
      if (typeof detail.detail === "string" && detail.detail.trim()) return detail.detail;
    }
    return fallback;
  };

  const extrairConflitoDeslocamento = (error: any): ConflitoDeslocamentoDetail | null => {
    if (error?.response?.status !== 409) return null;
    const detail = error?.response?.data?.detail;
    if (detail && typeof detail === "object" && detail.codigo === "CONFLITO_DESLOCAMENTO") {
      return detail as ConflitoDeslocamentoDetail;
    }

    const detailStr = String(detail || "");
    if (detailStr.toLowerCase().includes("deslocamento")) {
      return { mensagem: detailStr, confirmavel: true };
    }
    return null;
  };

  const abrirModalTutor = () => {
    setNovoTutor(buildInitialTutorForm());
    setModalTutorAberto(true);
  };

  const abrirModalAnimal = () => {
    setNovoAnimal(buildInitialAnimalForm(formData.tutor_id));
    setModalAnimalAberto(true);
  };

  const salvarNovoTutor = async () => {
    const nome = novoTutor.nome.trim();
    if (!nome) {
      alert("Informe o nome do tutor.");
      return;
    }

    try {
      setSalvandoTutor(true);
      const response = await api.post("/tutores", {
        nome,
        telefone: novoTutor.telefone || null,
        whatsapp: novoTutor.whatsapp || novoTutor.telefone || null,
        email: novoTutor.email || null,
      });

      const tutorId = response?.data?.id;
      const tutorNome = response?.data?.nome || nome;
      if (!tutorId) {
        throw new Error("Nao foi possivel salvar o tutor.");
      }

      setTutores((prev) => {
        const tutorNormalizado: TutorOption = {
          id: Number(tutorId),
          nome: tutorNome,
          telefone: novoTutor.telefone || null,
        };
        const restantes = prev.filter((item) => item.id !== Number(tutorId));
        return [...restantes, tutorNormalizado].sort((a, b) => a.nome.localeCompare(b.nome));
      });

      setFormData((prev) => ({
        ...prev,
        tutor_id: String(tutorId),
        paciente_id: "",
      }));
      setTutorSelecionado(tutorNome);
      setModalTutorAberto(false);
      setNovoTutor(buildInitialTutorForm());
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      alert(`Erro ao salvar tutor: ${extrairMensagemErro(detail)}`);
    } finally {
      setSalvandoTutor(false);
    }
  };

  const salvarNovoAnimal = async () => {
    const nomeAnimal = novoAnimal.nome.trim();
    if (!nomeAnimal) {
      alert("Informe o nome do animal.");
      return;
    }

    const tutorId = Number.parseInt(novoAnimal.tutor_id || "", 10);
    if (!Number.isFinite(tutorId)) {
      alert("Selecione um tutor para cadastrar o animal.");
      return;
    }

    const tutor = tutores.find((item) => item.id === tutorId);
    if (!tutor?.nome) {
      alert("Tutor selecionado nao encontrado.");
      return;
    }

    const pesoInformado = (novoAnimal.peso_kg || "").trim().replace(",", ".");
    const pesoKg = pesoInformado ? Number.parseFloat(pesoInformado) : NaN;

    try {
      setSalvandoAnimal(true);
      const response = await api.post("/pacientes", {
        nome: nomeAnimal,
        tutor: tutor.nome,
        especie: (novoAnimal.especie || "").trim() || "Canina",
        raca: novoAnimal.raca || "",
        sexo: novoAnimal.sexo || "Macho",
        peso_kg: Number.isFinite(pesoKg) ? pesoKg : null,
        data_nascimento: novoAnimal.data_nascimento || null,
        microchip: novoAnimal.microchip || "",
        observacoes: novoAnimal.observacoes || "Cadastro via modal de animal na agenda",
      });

      const novoPacienteId = response?.data?.id;
      if (!novoPacienteId) {
        throw new Error("Nao foi possivel salvar o animal.");
      }

      const pacienteCriado: PacienteOption = {
        id: Number(novoPacienteId),
        nome: response?.data?.nome || nomeAnimal,
        tutor: tutor.nome,
        tutor_id: tutor.id,
        especie: response?.data?.especie || novoAnimal.especie || "Canina",
        raca: response?.data?.raca || novoAnimal.raca || "",
      };

      setPacientes((prev) => {
        const restantes = prev.filter((item) => item.id !== pacienteCriado.id);
        return [...restantes, pacienteCriado].sort((a, b) => a.nome.localeCompare(b.nome));
      });
      setFormData((prev) => ({
        ...prev,
        tutor_id: String(tutor.id),
        paciente_id: String(pacienteCriado.id),
      }));
      setTutorSelecionado(tutor.nome);
      setModalAnimalAberto(false);
      setNovoAnimal(buildInitialAnimalForm(String(tutor.id)));
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      alert(`Erro ao salvar animal: ${extrairMensagemErro(detail)}`);
    } finally {
      setSalvandoAnimal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const inicio = new Date(`${formData.data}T${formData.hora}:00`);
      if (Number.isNaN(inicio.getTime())) {
        throw new Error("Data ou hora invalida.");
      }

      const duracaoEfetiva = obterDuracaoServicoSelecionado();
      const fim = new Date(inicio.getTime() + duracaoEfetiva * 60000);

      const validacaoHorario = validarHorarioAgendamento(
        inicio,
        fim,
        agendaSemanal,
        agendaFeriados,
        agendaExcecoes
      );
      if (!validacaoHorario.valido) {
        throw new Error(validacaoHorario.motivo);
      }

      let pacienteId = formData.paciente_id ? parseInt(formData.paciente_id, 10) : NaN;

      if (!Number.isFinite(pacienteId) && !permiteSemPacienteTutor) {
        if (formData.tutor_id) {
          throw new Error("Selecione um animal do tutor escolhido ou cadastre um novo animal.");
        }
        throw new Error("Selecione um animal para o agendamento.");
      }

      let clinicaId = formData.clinica_id ? parseInt(formData.clinica_id, 10) : NaN;
      if (!Number.isFinite(clinicaId) && (formData.clinica_nova_nome || "").trim()) {
        const respostaClinica = await api.post("/clinicas", {
          nome: (formData.clinica_nova_nome || "").trim(),
          cnpj: "",
          telefone: "",
          email: "",
          endereco: "",
          cidade: "",
          estado: "",
          cep: "",
          observacoes: "",
          tabela_preco_id: parseInt(formData.clinica_nova_tabela_preco_id || "1", 10),
          preco_personalizado_km: 0,
          preco_personalizado_base: 0,
          observacoes_preco: "Cadastro rapido via agenda panoramica",
        });

        clinicaId = respostaClinica?.data?.id;
        if (!clinicaId) {
          throw new Error("Nao foi possivel criar a clinica rapidamente.");
        }
      }

      const payloadBase = {
        paciente_id: Number.isFinite(pacienteId) ? pacienteId : null,
        clinica_id: Number.isFinite(clinicaId) ? clinicaId : null,
        servico_id: formData.servico_id ? parseInt(formData.servico_id, 10) : null,
        inicio: toApiDateTime(inicio),
        fim: toApiDateTime(fim),
        status: statusFormulario,
        observacoes: formData.observacoes,
      };

      const enviarAgendamento = async (confirmarConflitoDeslocamento: boolean) => {
        const payload = confirmarConflitoDeslocamento
          ? { ...payloadBase, confirmar_conflito_deslocamento: true }
          : payloadBase;

        if (isEditando) {
          return api.put(`/agenda/${agendamento.id}`, payload);
        }
        return api.post("/agenda", payload);
      };

      let response;
      try {
        response = await enviarAgendamento(false);
      } catch (error: any) {
        const conflito = extrairConflitoDeslocamento(error);
        if (!conflito?.confirmavel) {
          throw error;
        }

        const mensagemConflito = extrairMensagemErro(
          conflito,
          "Existe um conflito operacional de deslocamento para este horario."
        );
        const confirmou = window.confirm(`${mensagemConflito}\n\nDeseja confirmar este agendamento?`);
        if (!confirmou) {
          return;
        }

        response = await enviarAgendamento(true);
      }

      await onSuccess(response?.data);
      onClose();
      setFormData(buildInitialFormData(defaultDate, defaultTime));
      setTutorSelecionado("");
      setSugestoesHorario([]);
      setErroSugestoes("");
      setMensagemSugestoes("");
      setMensagemProximidade("");
      setSugestaoProximidade(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message;
      const detailStr = extrairMensagemErro(detail);
      alert(`Erro ao ${isEditando ? "editar" : "criar"} agendamento: ${detailStr}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEditando ? "Editar Agendamento" : "Novo Agendamento"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erroCarregamento && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erroCarregamento}
            </div>
          )}

          {/* Tutor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Tutor {permiteSemPacienteTutor ? "(opcional para reserva)" : "*"}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.tutor_id}
                onChange={(e) => handleTutorChange(e.target.value)}
              >
                <option value="">Selecione...</option>
                {tutores.map((tutor) => (
                  <option key={tutor.id} value={tutor.id.toString()}>
                    {tutor.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={abrirModalTutor}
                className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                Novo tutor
              </button>
            </div>
          </div>

          {/* Animal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              {permiteSemPacienteTutor ? "Animal (opcional para reserva)" : "Animal *"}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.paciente_id}
                onChange={(e) => handlePacienteChange(e.target.value)}
              >
                <option value="">Selecione...</option>
                {pacientesFiltradosPorTutor.map((p) => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.nome}
                    {!formData.tutor_id && p.tutor ? ` - Tutor: ${p.tutor}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={abrirModalAnimal}
                className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                Novo animal
              </button>
            </div>

            {tutorSelecionado && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg">
                <User className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Tutor selecionado:</span>
                <span>{tutorSelecionado}</span>
              </div>
            )}
          </div>

          {/* Clínica */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building className="w-4 h-4 inline mr-1" />
              Clínica
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.clinica_id}
              onChange={(e) => handleClinicaChange(e.target.value)}
            >
              <option value="">Selecione...</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.nome}
                </option>
              ))}
            </select>
            {mensagemProximidade && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <strong>Assistente inteligente:</strong> {mensagemProximidade}
              </div>
            )}

            {!formData.clinica_id && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.clinica_nova_nome}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome da clinica (cadastro rapido)"
                />
                <select
                  value={formData.clinica_nova_tabela_preco_id}
                  onChange={(e) => setFormData({ ...formData, clinica_nova_tabela_preco_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {tabelasPreco.map((opcao) => (
                    <option key={opcao.id} value={opcao.id.toString()}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serviço
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.servico_id}
              onChange={(e) => setFormData({...formData, servico_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id.toString()}>
                  {s.nome}
                </option>
              ))}
            </select>
            {formData.servico_id && (
              <p className="mt-1 text-xs text-gray-500">
                Duração estimada: {
                  (() => {
                    const servicoSelecionado = servicos.find((s) => s.id?.toString() === formData.servico_id);
                    const duracaoMinutos = Number.parseInt(`${servicoSelecionado?.duracao_minutos ?? ""}`, 10);
                    return Number.isFinite(duracaoMinutos) && duracaoMinutos > 0 ? `${duracaoMinutos} min` : "30 min";
                  })()
                }
              </p>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data *
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Hora *
              </label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.hora}
                onChange={(e) => setFormData({...formData, hora: e.target.value})}
              />
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Sugerir horarios operacionais
              </div>
              <button
                type="button"
                onClick={buscarSugestoesHorario}
                disabled={carregandoSugestoes}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {carregandoSugestoes ? "Buscando..." : "Sugerir horarios"}
              </button>
            </div>

            <p className="text-xs text-blue-800">
              Considera conflitos de agenda e tempo de deslocamento entre clinicas.
            </p>

            {erroSugestoes && (
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                {erroSugestoes}
              </div>
            )}

            {mensagemSugestoes && !erroSugestoes && (
              <div className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700">
                {mensagemSugestoes}
              </div>
            )}

            {sugestoesHorario.length > 0 && (
              <div className="space-y-2">
                {sugestoesHorario.map((item, idx) => (
                  <button
                    key={`${item.inicio}-${idx}`}
                    type="button"
                    onClick={() => aplicarSugestaoHorario(item)}
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-left hover:border-blue-400"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {extrairHoraDataHora(item.inicio)} - {extrairHoraDataHora(item.fim)}
                    </div>
                    <div className="text-xs text-gray-600">
                      Deslocamento total: {item.tempo_deslocamento_total_min} min | Risco: {item.risco}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {resumirDeslocamentoSugestao(item)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isEditando && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={formData.marcar_como_reserva}
                onChange={(e) => setFormData({ ...formData, marcar_como_reserva: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                Marcar como <strong>reserva de horário</strong> (bloqueia o slot como pendente de confirmação).
              </span>
            </label>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Observações sobre o agendamento..."
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading 
                ? (isEditando ? "Salvando..." : "Criando...") 
                : (isEditando ? "Salvar Alterações" : "Salvar Agendamento")
              }
            </button>
          </div>
        </form>
      </div>

      {modalTutorAberto && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Cadastrar Tutor</h3>
              <button
                type="button"
                onClick={() => setModalTutorAberto(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={salvandoTutor}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={novoTutor.nome}
                  onChange={(e) => setNovoTutor((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do tutor"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={novoTutor.telefone}
                    onChange={(e) => setNovoTutor((prev) => ({ ...prev, telefone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={novoTutor.whatsapp}
                    onChange={(e) => setNovoTutor((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={novoTutor.email}
                  onChange={(e) => setNovoTutor((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setModalTutorAberto(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={salvandoTutor}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovoTutor}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={salvandoTutor}
              >
                {salvandoTutor ? "Salvando..." : "Salvar Tutor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAnimalAberto && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Cadastrar Animal</h3>
              <button
                type="button"
                onClick={() => setModalAnimalAberto(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={salvandoAnimal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutor *</label>
                <select
                  value={novoAnimal.tutor_id}
                  onChange={(e) => setNovoAnimal((prev) => ({ ...prev, tutor_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {tutores.map((tutor) => (
                    <option key={tutor.id} value={tutor.id.toString()}>
                      {tutor.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Animal *</label>
                  <input
                    type="text"
                    value={novoAnimal.nome}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do animal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especie</label>
                  <select
                    value={novoAnimal.especie}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, especie: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {["Canina", "Felina", "Equina", "Outra"].map((especie) => (
                      <option key={especie} value={especie}>
                        {especie}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raca</label>
                  <input
                    type="text"
                    value={novoAnimal.raca}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, raca: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Raca"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                  <select
                    value={novoAnimal.sexo}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, sexo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {["Macho", "Femea"].map((sexo) => (
                      <option key={sexo} value={sexo}>
                        {sexo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                  <input
                    type="text"
                    value={novoAnimal.peso_kg}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, peso_kg: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 12.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={novoAnimal.data_nascimento}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, data_nascimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Microchip</label>
                  <input
                    type="text"
                    value={novoAnimal.microchip}
                    onChange={(e) => setNovoAnimal((prev) => ({ ...prev, microchip: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Codigo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                <textarea
                  rows={3}
                  value={novoAnimal.observacoes}
                  onChange={(e) => setNovoAnimal((prev) => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Informacoes adicionais"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setModalAnimalAberto(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={salvandoAnimal}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovoAnimal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={salvandoAnimal}
              >
                {salvandoAnimal ? "Salvando..." : "Salvar Animal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
