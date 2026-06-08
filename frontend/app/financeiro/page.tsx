"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import TransacaoModal from "./TransacaoModal";
import {
  FORMA_PAGAMENTO_FALLBACK,
  FORMA_PAGAMENTO_PADRAO,
  descricaoFormaPagamentoConfig,
  normalizarCodigoFormaPagamento,
  type FormaPagamentoConfig,
} from "@/lib/agenda-shared-actions";
import { consultarSaldoCreditoCliente } from "@/lib/credito-cliente";
import { 
  DollarSign, TrendingUp, TrendingDown, Plus, Search, 
  Calendar, CheckCircle, XCircle, Clock, Edit, Trash2,
  Filter, Download, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  ChevronLeft, ChevronRight, FileText, Receipt, Undo2, MessageCircle, Copy, Mail
} from "lucide-react";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  valor_final: number;
  desconto: number;
  status: string;
  forma_pagamento: string;
  data_transacao: string;
  data_vencimento: string;
  paciente_nome?: string;
  parcelas?: number;
  parcela_atual?: number;
}

interface OrdemServico {
  id: number;
  numero_os: string;
  agendamento_id?: number | null;
  paciente_id?: number | null;
  clinica_id?: number | null;
  servico_id?: number | null;
  paciente: string;
  tutor?: string;
  clinica: string;
  servico: string;
  data_atendimento: string;
  tipo_horario: string;
  valor_servico: number;
  desconto: number;
  valor_final: number;
  status: string;
  observacoes?: string | null;
  created_at: string;
}

interface PagamentoRecebimentoItem {
  id: string;
  forma_codigo: string;
  valor: string;
}

interface ClinicaOption {
  id: number;
  nome: string;
  telefone?: string | null;
  email?: string | null;
}

interface BandeiraCartaoOption {
  id: number;
  nome: string;
  codigo: string;
  ativo: boolean;
}

interface ServicoOption {
  id: number;
  nome: string;
}

const CATEGORIAS_TRANSACAO = [
  { id: "consulta", nome: "Consulta" },
  { id: "exame", nome: "Exame" },
  { id: "cirurgia", nome: "Cirurgia" },
  { id: "medicamento", nome: "Medicamento" },
  { id: "banho_tosa", nome: "Banho e Tosa" },
  { id: "produto", nome: "Produto" },
  { id: "salario", nome: "Salario" },
  { id: "aluguel", nome: "Aluguel" },
  { id: "fornecedor", nome: "Fornecedor" },
  { id: "imposto", nome: "Imposto" },
  { id: "manutencao", nome: "Manutencao" },
  { id: "marketing", nome: "Marketing" },
  { id: "outros", nome: "Outros" },
];

const MODELO_MENSAGEM_COBRANCA_PADRAO = [
  "Ola, equipe da clinica ________.",
  "Segue resumo das ordens de servico pendentes ate ___/___/___:",
  "",
  "1. OS numero da os | nome do paciente | data do servico | R$ valor do servico",
  "",
  "Total pendente: R$ valor total das OS pendentes.",
  "Favor confirmar a previsao de pagamento. Obrigado!",
].join("\n");

const MODELO_MENSAGEM_RECIBO_INDIVIDUAL_PADRAO = [
  "Ola, segue o recibo da OS {{os_numero}}.",
  "Paciente: {{paciente}}.",
  "Clinica: {{clinica}}.",
  "Valor recebido: {{valor_recebido}}.",
  "Data de emissao: {{data}}.",
  "",
  "PDF em anexo.",
].join("\n");

const MODELO_MENSAGEM_RECIBO_AGRUPADO_PADRAO = [
  "Ola, segue o recibo consolidado das ordens de servico recebidas.",
  "Clinica: {{clinica}}.",
  "Quantidade de OS: {{quantidade_os}}.",
  "Total recebido: {{total_recebido}}.",
  "Data de emissao: {{data}}.",
  "",
  "{{lista_os}}",
  "",
  "PDF em anexo.",
].join("\n");

const PLACEHOLDERS_MENSAGEM_COBRANCA = [
  { label: "Clinica", valor: "{{clinica}}" },
  { label: "Data", valor: "{{data}}" },
  { label: "Lista OS", valor: "{{lista_os}}" },
  { label: "Total pendente", valor: "{{total_pendente}}" },
];

const PLACEHOLDERS_MENSAGEM_RECIBO = [
  { label: "Clinica", valor: "{{clinica}}" },
  { label: "Data", valor: "{{data}}" },
  { label: "OS", valor: "{{os_numero}}" },
  { label: "Paciente", valor: "{{paciente}}" },
  { label: "Valor", valor: "{{valor_recebido}}" },
  { label: "Total", valor: "{{total_recebido}}" },
  { label: "Qtd. OS", valor: "{{quantidade_os}}" },
  { label: "Lista OS", valor: "{{lista_os}}" },
];

interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
  a_receber: number;
  a_pagar: number;
  pendente_entrada: number;
  pendente_saida: number;
  taxas_pagamento: number;
  creditos_gerados: number;
}

interface GrupoCobrancaClinica {
  chave: string;
  clinica_id?: number | null;
  clinica_nome: string;
  telefone_clinica: string;
  total_pendente: number;
  quantidade_os: number;
  quantidade_total: number;
  ordens: OrdemServico[];
}

interface CompartilhamentoReciboState {
  canal: "whatsapp" | "email";
  ids: number[];
  agrupar: boolean;
  mensagem: string;
  assunto: string;
  telefone: string;
  email: string;
}

interface PreviewReciboState {
  ids: number[];
  agrupar: boolean;
  titulo: string;
  filename: string;
  url: string;
}

export default function FinanceiroPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    entradas: 0,
    saidas: 0,
    saldo: 0,
    a_receber: 0,
    a_pagar: 0,
    pendente_entrada: 0,
    pendente_saida: 0,
    taxas_pagamento: 0,
    creditos_gerados: 0,
  });
  const [periodo, setPeriodo] = useState("mes");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [transacaoEditando, setTransacaoEditando] = useState<any>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string>("todos");
  const [filtroStatusTransacao, setFiltroStatusTransacao] = useState<string>("todos");
  const [filtroStatusOS, setFiltroStatusOS] = useState<string>("todos");
  const [filtroClinicaOS, setFiltroClinicaOS] = useState<string>("todos");
  const [filtroServicoOS, setFiltroServicoOS] = useState<string>("todos");
  const [filtroTipoHorarioOS, setFiltroTipoHorarioOS] = useState<string>("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"transacoes" | "cobrancas" | "ordens">("transacoes");
  const [modalReceberOS, setModalReceberOS] = useState<OrdemServico | null>(null);
  const [modalEditarOS, setModalEditarOS] = useState<OrdemServico | null>(null);
  const [formasPagamentoDisponiveis, setFormasPagamentoDisponiveis] = useState<FormaPagamentoConfig[]>(FORMA_PAGAMENTO_FALLBACK);
  const [carregandoFormasPagamento, setCarregandoFormasPagamento] = useState(false);
  const [pagamentosRecebimentoOS, setPagamentosRecebimentoOS] = useState<PagamentoRecebimentoItem[]>([]);
  const [dataRecebimentoOS, setDataRecebimentoOS] = useState("");
  const [destinoCreditoExcedenteOS, setDestinoCreditoExcedenteOS] = useState<"cliente" | "clinica" | "nenhum">("cliente");
  const [saldoCreditoClienteOS, setSaldoCreditoClienteOS] = useState(0);
  const [carregandoSaldoCreditoClienteOS, setCarregandoSaldoCreditoClienteOS] = useState(false);
  const [erroSaldoCreditoClienteOS, setErroSaldoCreditoClienteOS] = useState("");
  const [usarCreditoClienteOS, setUsarCreditoClienteOS] = useState(false);
  const [valorCreditoUtilizadoOS, setValorCreditoUtilizadoOS] = useState("0.00");
  const [salvandoOS, setSalvandoOS] = useState(false);
  const [clinicas, setClinicas] = useState<ClinicaOption[]>([]);
  const [servicos, setServicos] = useState<ServicoOption[]>([]);
  const [bandeirasCartao, setBandeirasCartao] = useState<BandeiraCartaoOption[]>([]);
  const [formEditarOS, setFormEditarOS] = useState({
    clinica_id: "",
    servico_id: "",
    tipo_horario: "comercial",
    desconto: 0,
    observacoes: "",
  });
  const [mensagemCobrancaModelo, setMensagemCobrancaModelo] = useState(MODELO_MENSAGEM_COBRANCA_PADRAO);
  const [mensagemReciboIndividualModelo, setMensagemReciboIndividualModelo] = useState(
    MODELO_MENSAGEM_RECIBO_INDIVIDUAL_PADRAO
  );
  const [mensagemReciboAgrupadoModelo, setMensagemReciboAgrupadoModelo] = useState(
    MODELO_MENSAGEM_RECIBO_AGRUPADO_PADRAO
  );
  const textareaMensagemRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaMensagemReciboIndividualRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaMensagemReciboAgrupadoRef = useRef<HTMLTextAreaElement | null>(null);
  const [osHighlightId, setOsHighlightId] = useState<number | null>(null);
  const [osHighlightUntil, setOsHighlightUntil] = useState<number>(0);
  const [osSelecionadasRecibo, setOsSelecionadasRecibo] = useState<number[]>([]);
  const [modalCompartilharRecibo, setModalCompartilharRecibo] = useState<CompartilhamentoReciboState | null>(null);
  const [enviandoCompartilhamentoRecibo, setEnviandoCompartilhamentoRecibo] = useState(false);
  const [previewRecibo, setPreviewRecibo] = useState<PreviewReciboState | null>(null);
  const [carregandoPreviewRecibo, setCarregandoPreviewRecibo] = useState(false);
  const highlightedRowRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (previewRecibo?.url) {
        window.URL.revokeObjectURL(previewRecibo.url);
      }
    };
  }, [previewRecibo]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarDados();
  }, [
    router,
    periodo,
    filtroTipo,
    filtroCategoria,
    filtroFormaPagamento,
    filtroStatusTransacao,
    filtroStatusOS,
    filtroClinicaOS,
    filtroServicoOS,
    filtroTipoHorarioOS,
    filtroDataInicio,
    filtroDataFim,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const abaParam = String(searchParams.get("aba") || "").toLowerCase();
    if (abaParam === "transacoes" || abaParam === "cobrancas" || abaParam === "ordens") {
      setAbaAtiva(abaParam as "transacoes" | "cobrancas" | "ordens");
    }

    const osIdParam = Number(searchParams.get("os_id") || "");
    if (Number.isFinite(osIdParam) && osIdParam > 0) {
      setAbaAtiva("ordens");
      setFiltroStatusOS("todos");
      setFiltroClinicaOS("todos");
      setFiltroServicoOS("todos");
      setFiltroTipoHorarioOS("todos");
      setFiltroDataInicio("");
      setFiltroDataFim("");
      setBusca("");
      setOsHighlightId(osIdParam);
      setOsHighlightUntil(Date.now() + 25000);
    }
  }, []);

  useEffect(() => {
    if (!modalReceberOS) {
      setSaldoCreditoClienteOS(0);
      setCarregandoSaldoCreditoClienteOS(false);
      setErroSaldoCreditoClienteOS("");
      return;
    }

    const pacienteId = Number(modalReceberOS.paciente_id || 0);
    if (!Number.isFinite(pacienteId) || pacienteId <= 0) {
      setSaldoCreditoClienteOS(0);
      setCarregandoSaldoCreditoClienteOS(false);
      setErroSaldoCreditoClienteOS("");
      return;
    }

    let ativo = true;
    setCarregandoSaldoCreditoClienteOS(true);
    setErroSaldoCreditoClienteOS("");
    (async () => {
      try {
        const saldo = await consultarSaldoCreditoCliente({ pacienteId });
        if (!ativo) return;
        setSaldoCreditoClienteOS(saldo > 0 ? saldo : 0);
      } catch (error) {
        console.error("Erro ao consultar credito do cliente no financeiro:", error);
        if (!ativo) return;
        setSaldoCreditoClienteOS(0);
        setErroSaldoCreditoClienteOS("Nao foi possivel consultar o credito do cliente.");
      } finally {
        if (!ativo) return;
        setCarregandoSaldoCreditoClienteOS(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [modalReceberOS]);

  const montarQueryString = (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor === undefined || valor === null || valor === "") {
        continue;
      }
      query.set(chave, String(valor));
    }
    const encoded = query.toString();
    return encoded ? `?${encoded}` : "";
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      setCarregandoFormasPagamento(true);
      const queryTransacoes = montarQueryString({
        limit: 500,
        tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
        categoria: filtroCategoria !== "todos" ? filtroCategoria : undefined,
        forma_pagamento: filtroFormaPagamento !== "todos" ? filtroFormaPagamento : undefined,
        status: filtroStatusTransacao !== "todos" ? filtroStatusTransacao : undefined,
        data_inicio: filtroDataInicio || undefined,
        data_fim: filtroDataFim || undefined,
      });
      const queryOS = montarQueryString({
        limit: 500,
        status: filtroStatusOS !== "todos" ? filtroStatusOS : undefined,
        clinica_id: filtroClinicaOS !== "todos" ? filtroClinicaOS : undefined,
        servico_id: filtroServicoOS !== "todos" ? filtroServicoOS : undefined,
        tipo_horario: filtroTipoHorarioOS !== "todos" ? filtroTipoHorarioOS : undefined,
        data_inicio: filtroDataInicio || undefined,
        data_fim: filtroDataFim || undefined,
      });

      const [respTransacoes, respResumo, respOS, respClinicas, respServicos, respFormas, respBandeiras] = await Promise.all([
        api.get(`/financeiro/transacoes${queryTransacoes}`),
        api.get(`/financeiro/resumo?periodo=${periodo}`),
        api.get(`/ordens-servico${queryOS}`),
        api.get("/clinicas?limit=1000"),
        api.get("/servicos?limit=1000"),
        api.get("/financeiro/formas-pagamento", {
          params: { apenas_ativas: true, limit: 300 },
        }),
        api.get("/financeiro/bandeiras-cartao", {
          params: { ativo: true, limit: 300 },
        }),
      ]);
      setTransacoes(respTransacoes.data.items || []);
      setOrdensServico(respOS.data.items || []);
      setResumo(respResumo.data);
      setClinicas(respClinicas.data.items || []);
      setServicos(respServicos.data.items || []);
      setBandeirasCartao(respBandeiras.data.items || []);
      const formasApi = Array.isArray(respFormas.data?.items) ? respFormas.data.items : [];
      if (formasApi.length > 0) {
        const normalizadas: FormaPagamentoConfig[] = formasApi.map((item: any) => ({
          id: Number(item.id),
          codigo: normalizarCodigoFormaPagamento(item.codigo),
          nome: String(item.nome || item.codigo || "Forma de pagamento"),
          tipo: item.tipo,
          adquirente: item.adquirente ?? null,
          bandeira_id: item.bandeira_id ?? null,
          bandeira_nome: item.bandeira_nome ?? null,
          taxa_percentual: Number(item.taxa_percentual || 0),
          taxa_fixa: Number(item.taxa_fixa || 0),
          ativo: Boolean(item.ativo ?? true),
        }));
        setFormasPagamentoDisponiveis(normalizadas);
      } else {
        setFormasPagamentoDisponiveis(FORMA_PAGAMENTO_FALLBACK);
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
      setFormasPagamentoDisponiveis(FORMA_PAGAMENTO_FALLBACK);
    } finally {
      setLoading(false);
      setCarregandoFormasPagamento(false);
    }
  };

  const gerarPagamentoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const parseMoneyValue = (value: string): number => {
    const normalizado = String(value || "").replace(",", ".").trim();
    const parsed = Number.parseFloat(normalizado);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
  };

  const toMoneyInput = (value: number): string => {
    if (!Number.isFinite(value)) return "0.00";
    return value.toFixed(2);
  };

  const formatarValor = (valor: number) => {
    return valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
  };

  const formatarData = (data: string) => {
    if (!data) return "-";
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarDataHoraCurta = (data: string) => {
    if (!data) return "-";
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hojeLocalISO = () => {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const normalizarDataISO = (valor?: string | null) => {
    if (!valor) return "";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";
    return data.toISOString().slice(0, 10);
  };

  const estaNoPeriodo = (valor?: string | null) => {
    if (!filtroDataInicio && !filtroDataFim) return true;
    const data = normalizarDataISO(valor);
    if (!data) return false;
    if (filtroDataInicio && data < filtroDataInicio) return false;
    if (filtroDataFim && data > filtroDataFim) return false;
    return true;
  };

  const limparFiltros = () => {
    setBusca("");
    setFiltroTipo("todos");
    setFiltroCategoria("todos");
    setFiltroFormaPagamento("todos");
    setFiltroStatusTransacao("todos");
    setFiltroStatusOS("todos");
    setFiltroClinicaOS("todos");
    setFiltroServicoOS("todos");
    setFiltroTipoHorarioOS("todos");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Recebido':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Pendente':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Cancelado':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Recebido':
        return 'bg-green-100 text-green-800';
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoriaNome = (categoria: string) => {
    const categorias: Record<string, string> = {
      consulta: "Consulta",
      exame: "Exame",
      cirurgia: "Cirurgia",
      medicamento: "Medicamento",
      banho_tosa: "Banho e Tosa",
      produto: "Produto",
      salario: "Salario",
      aluguel: "Aluguel",
      fornecedor: "Fornecedor",
      imposto: "Imposto",
      manutencao: "Manutencao",
      marketing: "Marketing",
      outros: "Outros",
    };
    return categorias[categoria] || categoria;
  };

  const getFormaPagamentoNome = (forma: string) => {
    const codigo = normalizarCodigoFormaPagamento(forma);
    const configurada = formasPagamentoDisponiveis.find(
      (item) => normalizarCodigoFormaPagamento(item.codigo) === codigo
    );
    if (configurada) {
      return descricaoFormaPagamentoConfig(configurada);
    }
    const formas: Record<string, string> = {
      dinheiro: "Dinheiro",
      cartao_credito: "Cartao Credito",
      cartao_debito: "Cartao Debito",
      pix: "PIX",
      boleto: "Boleto",
      transferencia: "Transferencia",
    };
    return formas[forma] || forma;
  };

  const resumoPagamentoOS = useMemo(() => {
    const linhas = pagamentosRecebimentoOS.map((item) => {
      const codigo = normalizarCodigoFormaPagamento(item.forma_codigo);
      const forma = formasPagamentoDisponiveis.find(
        (opcao) => normalizarCodigoFormaPagamento(opcao.codigo) === codigo
      );
      const valor = parseMoneyValue(item.valor);
      const taxaPercentual = Number(forma?.taxa_percentual || 0);
      const taxaFixa = Number(forma?.taxa_fixa || 0);
      const taxa = Number((valor * (taxaPercentual / 100) + taxaFixa).toFixed(2));
      const liquido = Number((valor - taxa).toFixed(2));
      return {
        ...item,
        forma,
        valor,
        taxa,
        liquido,
      };
    });
    const totalBruto = linhas.reduce((acc, item) => acc + item.valor, 0);
    const totalTaxa = linhas.reduce((acc, item) => acc + item.taxa, 0);
    const totalLiquido = linhas.reduce((acc, item) => acc + item.liquido, 0);
    const valorOS = Number(modalReceberOS?.valor_final || 0);
    const limiteCredito = Math.max(0, Number(saldoCreditoClienteOS || 0));
    const creditoSolicitado = parseMoneyValue(valorCreditoUtilizadoOS);
    const creditoUtilizado = usarCreditoClienteOS
      ? Math.max(0, Math.min(creditoSolicitado, limiteCredito))
      : 0;
    const totalCoberto = Number((totalBruto + creditoUtilizado).toFixed(2));
    const diferenca = Number((totalCoberto - valorOS).toFixed(2));
    return {
      linhas,
      totalBruto,
      totalTaxa,
      totalLiquido,
      totalCoberto,
      valorOS,
      limiteCredito,
      creditoSolicitado,
      creditoUtilizado,
      excedente: diferenca > 0 ? diferenca : 0,
      faltante: diferenca < 0 ? Math.abs(diferenca) : 0,
    };
  }, [
    formasPagamentoDisponiveis,
    modalReceberOS?.valor_final,
    pagamentosRecebimentoOS,
    saldoCreditoClienteOS,
    usarCreditoClienteOS,
    valorCreditoUtilizadoOS,
  ]);

  const atualizarLinhaPagamentoOS = (id: string, campo: "forma_codigo" | "valor", valor: string) => {
    setPagamentosRecebimentoOS((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  };

  const adicionarLinhaPagamentoOS = () => {
    const formaPadrao =
      formasPagamentoDisponiveis.find(
        (forma) => normalizarCodigoFormaPagamento(forma.codigo) === FORMA_PAGAMENTO_PADRAO
      ) || formasPagamentoDisponiveis[0];
    const codigo = normalizarCodigoFormaPagamento(formaPadrao?.codigo || FORMA_PAGAMENTO_PADRAO);
    setPagamentosRecebimentoOS((prev) => [
      ...prev,
      {
        id: gerarPagamentoId(),
        forma_codigo: codigo,
        valor: "0.00",
      },
    ]);
  };

  const removerLinhaPagamentoOS = (id: string) => {
    setPagamentosRecebimentoOS((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const cadastrarBandeiraRapido = async () => {
    const nome = window.prompt("Nome da bandeira (ex.: Visa):");
    if (!nome) return;
    const codigoSugerido = normalizarCodigoFormaPagamento(nome);
    const codigo = window.prompt("Codigo da bandeira:", codigoSugerido);
    if (!codigo) return;
    try {
      await api.post("/financeiro/bandeiras-cartao", {
        nome: nome.trim(),
        codigo: normalizarCodigoFormaPagamento(codigo),
        ativo: true,
      });
      alert("Bandeira cadastrada com sucesso.");
      await carregarDados();
    } catch (error: any) {
      console.error("Erro ao cadastrar bandeira:", error);
      alert("Nao foi possivel cadastrar bandeira: " + (error.response?.data?.detail || error.message));
    }
  };

  const cadastrarFormaPagamentoRapido = async () => {
    const nome = window.prompt("Nome da forma de pagamento (ex.: Cartao credito - TON):");
    if (!nome) return;
    const codigoSugerido = normalizarCodigoFormaPagamento(nome);
    const codigo = window.prompt("Codigo unico da forma de pagamento:", codigoSugerido);
    if (!codigo) return;
    const tipo = window
      .prompt("Tipo (dinheiro, pix, cartao_credito, cartao_debito, boleto, transferencia, credito, outro):", "pix")
      ?.trim();
    if (!tipo) return;
    const adquirente = window.prompt("Adquirente/maquininha (opcional):", "") || "";
    const taxaPercentualStr = window.prompt("Taxa percentual (ex.: 4.99):", "0") || "0";
    const taxaFixaStr = window.prompt("Taxa fixa em R$ (ex.: 0.40):", "0") || "0";
    const ordemStr = window.prompt("Ordem de exibicao (numero):", "0") || "0";

    const bandeirasTexto = bandeirasCartao.map((b) => `${b.id}=${b.nome}`).join(" | ");
    const bandeiraIdStr = window.prompt(
      bandeirasTexto
        ? `ID da bandeira (opcional). Disponiveis: ${bandeirasTexto}`
        : "ID da bandeira (opcional):",
      ""
    );
    const bandeiraId = bandeiraIdStr ? Number(bandeiraIdStr) : null;

    try {
      await api.post("/financeiro/formas-pagamento", {
        nome: nome.trim(),
        codigo: normalizarCodigoFormaPagamento(codigo),
        tipo: normalizarCodigoFormaPagamento(tipo),
        adquirente: adquirente.trim() || null,
        bandeira_id: Number.isFinite(bandeiraId as number) && (bandeiraId as number) > 0 ? Number(bandeiraId) : null,
        taxa_percentual: Number.parseFloat(taxaPercentualStr.replace(",", ".")) || 0,
        taxa_fixa: Number.parseFloat(taxaFixaStr.replace(",", ".")) || 0,
        ordem_exibicao: Number.parseInt(ordemStr, 10) || 0,
        ativo: true,
      });
      alert("Forma de pagamento cadastrada com sucesso.");
      await carregarDados();
    } catch (error: any) {
      console.error("Erro ao cadastrar forma de pagamento:", error);
      alert("Nao foi possivel cadastrar forma: " + (error.response?.data?.detail || error.message));
    }
  };

  const desativarFormaPagamento = async (formaId?: number) => {
    if (!formaId) return;
    if (!confirm("Desativar esta forma de pagamento?")) return;
    try {
      await api.delete(`/financeiro/formas-pagamento/${formaId}`);
      await carregarDados();
    } catch (error: any) {
      console.error("Erro ao desativar forma de pagamento:", error);
      alert("Nao foi possivel desativar: " + (error.response?.data?.detail || error.message));
    }
  };

  const editarTaxasFormaPagamento = async (forma: FormaPagamentoConfig) => {
    if (!forma.id) return;
    const taxaPercentualAtual = Number(forma.taxa_percentual || 0).toFixed(2);
    const taxaPercentualStr = window.prompt(
      `Taxa percentual (%) para "${forma.nome}":`,
      taxaPercentualAtual
    );
    if (taxaPercentualStr === null) return;

    const taxaFixaAtual = Number(forma.taxa_fixa || 0).toFixed(2);
    const taxaFixaStr = window.prompt(
      `Taxa fixa (R$) para "${forma.nome}":`,
      taxaFixaAtual
    );
    if (taxaFixaStr === null) return;

    const taxaPercentual = Number.parseFloat(String(taxaPercentualStr).replace(",", "."));
    const taxaFixa = Number.parseFloat(String(taxaFixaStr).replace(",", "."));
    if (!Number.isFinite(taxaPercentual) || taxaPercentual < 0) {
      alert("Taxa percentual invalida.");
      return;
    }
    if (!Number.isFinite(taxaFixa) || taxaFixa < 0) {
      alert("Taxa fixa invalida.");
      return;
    }

    try {
      await api.put(`/financeiro/formas-pagamento/${forma.id}`, {
        taxa_percentual: Number(taxaPercentual.toFixed(4)),
        taxa_fixa: Number(taxaFixa.toFixed(2)),
      });
      await carregarDados();
      alert("Taxas atualizadas com sucesso.");
    } catch (error: any) {
      console.error("Erro ao atualizar taxas da forma de pagamento:", error);
      alert("Nao foi possivel atualizar as taxas: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleEditar = (transacao: Transacao) => {
    setTransacaoEditando(transacao);
    setModalAberto(true);
  };

  const handleNova = () => {
    setTransacaoEditando(null);
    setModalAberto(true);
  };

  const handleExcluir = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta transacao?")) return;

    try {
      await api.delete(`/financeiro/transacoes/${id}`);
      carregarDados();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir transacao");
    }
  };

  const handlePagar = async (id: number) => {
    try {
      await api.patch(`/financeiro/transacoes/${id}/pagar`);
      carregarDados();
    } catch (error) {
      console.error("Erro ao pagar:", error);
      alert("Erro ao atualizar status");
    }
  };

  const handlePagarOS = (os: OrdemServico) => {
    setModalReceberOS(os);
    const formaPadrao =
      formasPagamentoDisponiveis.find(
        (forma) => normalizarCodigoFormaPagamento(forma.codigo) === FORMA_PAGAMENTO_PADRAO
      ) || formasPagamentoDisponiveis[0];
    const codigo = normalizarCodigoFormaPagamento(formaPadrao?.codigo || FORMA_PAGAMENTO_PADRAO);
    setPagamentosRecebimentoOS([
      {
        id: gerarPagamentoId(),
        forma_codigo: codigo,
        valor: toMoneyInput(Number(os.valor_final || 0)),
      },
    ]);
    setDataRecebimentoOS(hojeLocalISO());
    setDestinoCreditoExcedenteOS("cliente");
    setSaldoCreditoClienteOS(0);
    setCarregandoSaldoCreditoClienteOS(false);
    setErroSaldoCreditoClienteOS("");
    setUsarCreditoClienteOS(false);
    setValorCreditoUtilizadoOS("0.00");
  };

  const handleEditarOS = (os: OrdemServico) => {
    setModalEditarOS(os);
    setFormEditarOS({
      clinica_id: os.clinica_id ? String(os.clinica_id) : "",
      servico_id: os.servico_id ? String(os.servico_id) : "",
      tipo_horario: os.tipo_horario || "comercial",
      desconto: Number(os.desconto || 0),
      observacoes: os.observacoes || "",
    });
  };

  const confirmarRecebimentoOS = async () => {
    if (!modalReceberOS) return;

    try {
      const pagamentosPayload = resumoPagamentoOS.linhas
        .filter((item) => item.valor > 0)
        .map((item) => ({
          forma_pagamento: normalizarCodigoFormaPagamento(item.forma_codigo),
          forma_pagamento_config_id: item.forma?.id ?? undefined,
          valor: Number(item.valor.toFixed(2)),
        }));
      const creditoUtilizado = Number(resumoPagamentoOS.creditoUtilizado || 0);
      if (pagamentosPayload.length === 0 && creditoUtilizado <= 0) {
        alert("Informe ao menos um pagamento com valor maior que zero ou utilize credito disponivel.");
        return;
      }
      await api.patch(`/ordens-servico/${modalReceberOS.id}/receber`, {
        pagamentos: pagamentosPayload,
        data_recebimento: dataRecebimentoOS || null,
        valor_credito_utilizado: Number(creditoUtilizado.toFixed(2)),
        destino_credito_excedente: destinoCreditoExcedenteOS,
      });

      setModalReceberOS(null);
      setPagamentosRecebimentoOS([]);
      setSaldoCreditoClienteOS(0);
      setCarregandoSaldoCreditoClienteOS(false);
      setErroSaldoCreditoClienteOS("");
      setUsarCreditoClienteOS(false);
      setValorCreditoUtilizadoOS("0.00");
      alert("Recebimento registrado com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao pagar OS:", error);
      alert("Erro ao processar pagamento: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDesfazerRecebimentoOS = async (os: OrdemServico) => {
    if (!confirm(`Desfazer o recebimento da OS ${os.numero_os}?`)) return;
    try {
      await api.patch(`/ordens-servico/${os.id}/desfazer-recebimento`);
      alert("Recebimento desfeito com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao desfazer recebimento:", error);
      alert("Erro ao desfazer recebimento: " + (error.response?.data?.detail || error.message));
    }
  };

  const salvarEdicaoOS = async () => {
    if (!modalEditarOS) return;
    if (!formEditarOS.clinica_id || !formEditarOS.servico_id) {
      alert("Selecione clinica e servico para atualizar a OS.");
      return;
    }

    try {
      setSalvandoOS(true);
      await api.put(`/ordens-servico/${modalEditarOS.id}`, {
        clinica_id: Number(formEditarOS.clinica_id),
        servico_id: Number(formEditarOS.servico_id),
        tipo_horario: formEditarOS.tipo_horario,
        desconto: Number(formEditarOS.desconto || 0),
        observacoes: formEditarOS.observacoes,
        recalcular_preco: true,
      });
      setModalEditarOS(null);
      alert("OS atualizada com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao atualizar OS:", error);
      alert("Erro ao atualizar OS: " + (error.response?.data?.detail || error.message));
    } finally {
      setSalvandoOS(false);
    }
  };

  const handleExcluirOS = async (os: OrdemServico) => {
    if (!confirm(`Tem certeza que deseja excluir a OS ${os.numero_os}?`)) return;
    
    try {
      await api.delete(`/ordens-servico/${os.id}`);
      alert("OS excluida com sucesso!");
      carregarDados();
    } catch (error: any) {
      console.error("Erro ao excluir OS:", error);
      alert("Erro ao excluir OS: " + (error.response?.data?.detail || error.message));
    }
  };

  // Filtrar transacoes
  const transacoesFiltradas = transacoes.filter((t) => {
    const matchTipo = filtroTipo === "todos" || t.tipo === filtroTipo;
    const matchCategoria = filtroCategoria === "todos" || t.categoria === filtroCategoria;
    const matchFormaPagamento = filtroFormaPagamento === "todos" || t.forma_pagamento === filtroFormaPagamento;
    const matchStatus = filtroStatusTransacao === "todos" || t.status === filtroStatusTransacao;
    const matchData = estaNoPeriodo(t.data_transacao);
    const termo = busca.toLowerCase();
    const matchBusca = !busca || 
      t.descricao?.toLowerCase().includes(termo) ||
      t.paciente_nome?.toLowerCase().includes(termo) ||
      getCategoriaNome(t.categoria).toLowerCase().includes(termo);
    return matchTipo && matchCategoria && matchFormaPagamento && matchStatus && matchData && matchBusca;
  });

  // Filtrar OS
  const osFiltradas = ordensServico.filter((os) => {
    const matchStatus = filtroStatusOS === "todos" || os.status === filtroStatusOS;
    const matchClinica = filtroClinicaOS === "todos" || String(os.clinica_id || "") === filtroClinicaOS;
    const matchServico = filtroServicoOS === "todos" || String(os.servico_id || "") === filtroServicoOS;
    const matchTipoHorario = filtroTipoHorarioOS === "todos" || os.tipo_horario === filtroTipoHorarioOS;
    const matchData = estaNoPeriodo(os.data_atendimento);
    const termo = busca.toLowerCase();
    const matchBusca = !busca || 
      os.numero_os?.toLowerCase().includes(termo) ||
      os.paciente?.toLowerCase().includes(termo) ||
      os.tutor?.toLowerCase().includes(termo) ||
      os.servico?.toLowerCase().includes(termo) ||
      os.clinica?.toLowerCase().includes(termo);
    return matchStatus && matchClinica && matchServico && matchTipoHorario && matchData && matchBusca;
  });

  const osRecebidasFiltradas = useMemo(
    () => osFiltradas.filter((os) => os.status === "Pago"),
    [osFiltradas]
  );

  useEffect(() => {
    const idsRecebidas = new Set(ordensServico.filter((os) => os.status === "Pago").map((os) => os.id));
    setOsSelecionadasRecibo((prev) => prev.filter((id) => idsRecebidas.has(id)));
  }, [ordensServico]);

  useEffect(() => {
    if (osHighlightId == null) return;
    if (Date.now() >= osHighlightUntil) {
      setOsHighlightId(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      setOsHighlightId(null);
    }, Math.max(1000, osHighlightUntil - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [osHighlightId, osHighlightUntil]);

  useEffect(() => {
    if (abaAtiva !== "ordens" || osHighlightId == null) return;
    const row = document.getElementById(`os-row-${osHighlightId}`);
    if (!row) return;
    highlightedRowRef.current = row as HTMLDivElement;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [abaAtiva, osFiltradas, osHighlightId]);

  const clinicaTelefonePorId = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const clinica of clinicas) {
      if (!clinica?.id) continue;
      const telefone = String(clinica.telefone || "").trim();
      if (telefone) {
        mapa.set(clinica.id, telefone);
      }
    }
    return mapa;
  }, [clinicas]);

  const osCobrancaFiltradas = useMemo(
    () => osFiltradas.filter((os) => os.status !== "Cancelado"),
    [osFiltradas]
  );

  const gruposCobrancaClinica = useMemo<GrupoCobrancaClinica[]>(() => {
    const mapa = new Map<string, GrupoCobrancaClinica>();

    for (const os of osCobrancaFiltradas) {
      const clinicaNome = (os.clinica || "Clinica nao informada").trim();
      const chave = os.clinica_id ? `id:${os.clinica_id}` : `nome:${clinicaNome.toLowerCase()}`;
      const telefoneClinica = os.clinica_id ? (clinicaTelefonePorId.get(os.clinica_id) || "") : "";

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          clinica_id: os.clinica_id,
          clinica_nome: clinicaNome,
          telefone_clinica: telefoneClinica,
          total_pendente: 0,
          quantidade_os: 0,
          quantidade_total: 0,
          ordens: [],
        });
      }

      const grupo = mapa.get(chave)!;
      if (os.status === "Pendente") {
        grupo.total_pendente += Number(os.valor_final || 0);
        grupo.quantidade_os += 1;
      }
      grupo.quantidade_total += 1;
      grupo.ordens.push(os);
    }

    return Array.from(mapa.values())
      .map((grupo) => ({
        ...grupo,
        ordens: [...grupo.ordens].sort((a, b) => {
          const da = a.data_atendimento ? new Date(a.data_atendimento).getTime() : 0;
          const db = b.data_atendimento ? new Date(b.data_atendimento).getTime() : 0;
          return da - db;
        }),
      }))
      .sort((a, b) => b.total_pendente - a.total_pendente);
  }, [osCobrancaFiltradas, clinicaTelefonePorId]);

  const totalPendenteAgrupado = gruposCobrancaClinica.reduce(
    (acc, grupo) => acc + grupo.total_pendente,
    0
  );

  const normalizarTelefoneWhatsApp = (telefone: string) => {
    let digitos = String(telefone || "").replace(/\D/g, "");
    while (digitos.startsWith("0")) {
      digitos = digitos.slice(1);
    }
    if (!digitos) return "";
    if (digitos.startsWith("55")) return digitos;
    if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
    return digitos;
  };

  const formatarDataArquivo = () => new Date().toISOString().slice(0, 10);

  const obterClinicaDaOS = (os: OrdemServico) => {
    if (!os.clinica_id) return null;
    return clinicas.find((clinica) => clinica.id === os.clinica_id) || null;
  };

  const obterContatoCompartilhamento = (ids: number[]) => {
    const selecionadas = ordensServico.filter((os) => ids.includes(os.id));
    const clinicasSelecionadas = selecionadas
      .map((os) => obterClinicaDaOS(os))
      .filter((item): item is ClinicaOption => Boolean(item));
    const clinicasUnicas = Array.from(new Map(clinicasSelecionadas.map((item) => [item.id, item])).values());
    if (clinicasUnicas.length === 1) {
      return clinicasUnicas[0];
    }
    return null;
  };

  const montarMensagemCompartilhamentoRecibo = (ids: number[], agrupar: boolean) => {
    const selecionadas = ordensServico.filter((os) => ids.includes(os.id));
    const total = selecionadas.reduce((acc, item) => acc + Number(item.valor_final || 0), 0);
    const primeiraOS = selecionadas[0];
    const clinicas = Array.from(
      new Set(selecionadas.map((item) => String(item.clinica || "").trim()).filter(Boolean))
    );
    const clinicaTexto =
      clinicas.length === 1 ? clinicas[0] : clinicas.length > 1 ? "Multiplas clinicas" : "Clinica nao informada";
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const listaOS = selecionadas
      .map(
        (os, index) =>
          `${index + 1}. OS ${os.numero_os} | ${os.paciente || "Paciente"} | ${formatarValor(Number(os.valor_final || 0))}`
      )
      .join("\n");

    let modelo =
      agrupar || selecionadas.length > 1
        ? mensagemReciboAgrupadoModelo || MODELO_MENSAGEM_RECIBO_AGRUPADO_PADRAO
        : mensagemReciboIndividualModelo || MODELO_MENSAGEM_RECIBO_INDIVIDUAL_PADRAO;

    modelo = modelo
      .replace(/{{\s*clinica\s*}}/gi, clinicaTexto)
      .replace(/{{\s*data\s*}}/gi, dataHoje)
      .replace(/{{\s*os_numero\s*}}/gi, primeiraOS?.numero_os || "-")
      .replace(/{{\s*paciente\s*}}/gi, primeiraOS?.paciente || "Nao informado")
      .replace(/{{\s*valor_recebido\s*}}/gi, formatarValor(Number(primeiraOS?.valor_final || 0)))
      .replace(/{{\s*total_recebido\s*}}/gi, formatarValor(total))
      .replace(/{{\s*quantidade_os\s*}}/gi, String(selecionadas.length))
      .replace(/{{\s*lista_os\s*}}/gi, listaOS || "1. Nenhuma OS selecionada.");

    return modelo;
  };

  const montarAssuntoCompartilhamentoRecibo = (ids: number[], agrupar: boolean) => {
    if (ids.length === 1) {
      const ordem = ordensServico.find((os) => os.id === ids[0]);
      return `Recibo da OS ${ordem?.numero_os || ids[0]}`;
    }
    return agrupar
      ? "Recibo agrupado de ordens de servico recebidas"
      : "Recibos de ordens de servico recebidas";
  };

  const inserirPlaceholderModeloRecibo = (
    placeholder: string,
    tipo: "individual" | "agrupado"
  ) => {
    const textarea =
      tipo === "individual" ? textareaMensagemReciboIndividualRef.current : textareaMensagemReciboAgrupadoRef.current;
    const textoAtual =
      tipo === "individual" ? mensagemReciboIndividualModelo || "" : mensagemReciboAgrupadoModelo || "";

    if (!textarea) {
      if (tipo === "individual") {
        setMensagemReciboIndividualModelo(`${textoAtual}${placeholder}`);
      } else {
        setMensagemReciboAgrupadoModelo(`${textoAtual}${placeholder}`);
      }
      return;
    }

    const inicio = textarea.selectionStart ?? textoAtual.length;
    const fim = textarea.selectionEnd ?? inicio;
    const novoTexto = `${textoAtual.slice(0, inicio)}${placeholder}${textoAtual.slice(fim)}`;
    const novaPosicao = inicio + placeholder.length;

    if (tipo === "individual") {
      setMensagemReciboIndividualModelo(novoTexto);
    } else {
      setMensagemReciboAgrupadoModelo(novoTexto);
    }

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(novaPosicao, novaPosicao);
    });
  };

  const restaurarModeloMensagemRecibo = (tipo: "individual" | "agrupado") => {
    if (tipo === "individual") {
      setMensagemReciboIndividualModelo(MODELO_MENSAGEM_RECIBO_INDIVIDUAL_PADRAO);
    } else {
      setMensagemReciboAgrupadoModelo(MODELO_MENSAGEM_RECIBO_AGRUPADO_PADRAO);
    }
  };

  const abrirDownloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const fecharPreviewRecibo = () => {
    setPreviewRecibo((prev) => {
      if (prev?.url) {
        window.URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  };

  const abrirMailtoComMensagem = (email: string, subject: string, body: string) => {
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", body);
    const to = email ? email.trim() : "";
    window.open(`mailto:${to}?${params.toString()}`, "_self");
  };

  const abrirWhatsAppComMensagem = (telefone: string, mensagem: string) => {
    const numero = normalizarTelefoneWhatsApp(telefone || "");
    const destino = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(destino, "_blank", "noopener,noreferrer");
  };

  const compartilharArquivoSeDisponivel = async (blob: Blob, filename: string, title: string, text: string) => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return false;
    }

    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      const payload = { title, text, files: [file] };
      if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
        return false;
      }
      await navigator.share(payload);
      return true;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return true;
      }
      return false;
    }
  };

  const abrirComposerCompartilhamentoRecibo = (
    canal: "whatsapp" | "email",
    ids: number[],
    agrupar: boolean
  ) => {
    if (ids.length === 0) {
      alert("Selecione ao menos uma OS recebida para compartilhar o recibo.");
      return;
    }

    const contato = obterContatoCompartilhamento(ids);
    setModalCompartilharRecibo({
      canal,
      ids,
      agrupar,
      mensagem: montarMensagemCompartilhamentoRecibo(ids, agrupar),
      assunto: montarAssuntoCompartilhamentoRecibo(ids, agrupar),
      telefone: String(contato?.telefone || ""),
      email: String(contato?.email || ""),
    });
  };

  const montarLinhasPendentes = (grupo: GrupoCobrancaClinica) => {
    const ordensPendentes = grupo.ordens.filter((os) => os.status === "Pendente");
    return ordensPendentes.map(
      (os, index) =>
        `${index + 1}. OS ${os.numero_os} | ${os.paciente || "Paciente"} | ${formatarData(
          os.data_atendimento
        )} | ${formatarValor(os.valor_final)}`
    );
  };

  const preencherMensagemCobranca = (grupo: GrupoCobrancaClinica) => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhasOS = montarLinhasPendentes(grupo);
    const listaOS = linhasOS.length > 0 ? linhasOS.join("\n") : "1. Nenhuma OS pendente.";

    let mensagem = (mensagemCobrancaModelo || "").trim() || MODELO_MENSAGEM_COBRANCA_PADRAO;

    mensagem = mensagem
      .replace(/{{\s*clinica\s*}}/gi, grupo.clinica_nome)
      .replace(/{{\s*data\s*}}/gi, hoje)
      .replace(/{{\s*lista_os\s*}}/gi, listaOS)
      .replace(/{{\s*total_pendente\s*}}/gi, formatarValor(grupo.total_pendente));

    if (mensagem.includes("________")) {
      mensagem = mensagem.replace(/________/g, grupo.clinica_nome);
    }
    if (mensagem.includes("___/___/___")) {
      mensagem = mensagem.replace(/___\/___\/___/g, hoje);
    }

    if (/R\$\s*valor total das OS pendentes/gi.test(mensagem)) {
      mensagem = mensagem.replace(/R\$\s*valor total das OS pendentes/gi, formatarValor(grupo.total_pendente));
    }

    if (/OS numero da os/gi.test(mensagem)) {
      mensagem = mensagem.replace(/^.*OS numero da os.*$/gim, listaOS);
    } else if (!/{{\s*lista_os\s*}}/gi.test(mensagem) && !mensagem.includes(listaOS)) {
      mensagem = `${mensagem}\n\n${listaOS}`;
    }

    return mensagem;
  };

  const restaurarModeloMensagem = () => {
    setMensagemCobrancaModelo(MODELO_MENSAGEM_COBRANCA_PADRAO);
  };

  const inserirPlaceholderNoModelo = (placeholder: string) => {
    const textarea = textareaMensagemRef.current;
    const textoAtual = mensagemCobrancaModelo || "";

    if (!textarea) {
      setMensagemCobrancaModelo(`${textoAtual}${placeholder}`);
      return;
    }

    const inicio = textarea.selectionStart ?? textoAtual.length;
    const fim = textarea.selectionEnd ?? inicio;
    const novoTexto = `${textoAtual.slice(0, inicio)}${placeholder}${textoAtual.slice(fim)}`;
    const novaPosicao = inicio + placeholder.length;

    setMensagemCobrancaModelo(novoTexto);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(novaPosicao, novaPosicao);
    });
  };

  const enviarCobrancaWhatsApp = (grupo: GrupoCobrancaClinica) => {
    const telefone = normalizarTelefoneWhatsApp(grupo.telefone_clinica || "");
    if (!telefone) {
      alert(`A clinica ${grupo.clinica_nome} nao possui telefone cadastrado.`);
      return;
    }

    const mensagem = preencherMensagemCobranca(grupo);
    const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copiarMensagemCobranca = async (grupo: GrupoCobrancaClinica) => {
    const mensagem = preencherMensagemCobranca(grupo);
    try {
      await navigator.clipboard.writeText(mensagem);
      alert(`Mensagem de cobranca copiada para a clinica ${grupo.clinica_nome}.`);
    } catch (_err) {
      alert("Nao foi possivel copiar automaticamente. Tente novamente.");
    }
  };
  const baixarRelatorioPendenciasPDF = async (grupo?: GrupoCobrancaClinica) => {
    if (gruposCobrancaClinica.length === 0) {
      alert("Nao ha pendencias para gerar relatorio.");
      return;
    }

    try {
      const clinicaRelatorio =
        grupo?.clinica_id != null
          ? String(grupo.clinica_id)
          : filtroClinicaOS !== "todos"
            ? filtroClinicaOS
            : undefined;
      const clinicaNomeRelatorio =
        !clinicaRelatorio && grupo?.clinica_nome ? grupo.clinica_nome : undefined;
      const mensagemRelatorio = grupo ? preencherMensagemCobranca(grupo) : undefined;

      const query = montarQueryString({
        status: filtroStatusOS !== "todos" ? filtroStatusOS : "Pendente",
        clinica_id: clinicaRelatorio,
        clinica_nome: clinicaNomeRelatorio,
        servico_id: filtroServicoOS !== "todos" ? filtroServicoOS : undefined,
        tipo_horario: filtroTipoHorarioOS !== "todos" ? filtroTipoHorarioOS : undefined,
        data_inicio: filtroDataInicio || undefined,
        data_fim: filtroDataFim || undefined,
        busca: busca || undefined,
        mensagem: mensagemRelatorio,
      });

      const response = await api.get(`/ordens-servico/relatorios/pendencias/pdf${query}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers?.["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const sufixoClinica = (grupo?.clinica_nome || "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 40);
      const fallback = sufixoClinica
        ? `relatorio_cobranca_${sufixoClinica}_${new Date().toISOString().slice(0, 10)}.pdf`
        : `relatorio_cobranca_pendencias_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.href = url;
      link.download = match?.[1] || fallback;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Erro ao baixar relatorio PDF:", error);
      alert(error?.response?.data?.detail || "Erro ao gerar relatorio PDF de pendencias.");
    }
  };

  const toggleSelecaoReciboOS = (osId: number) => {
    setOsSelecionadasRecibo((prev) =>
      prev.includes(osId) ? prev.filter((id) => id !== osId) : [...prev, osId]
    );
  };

  const selecionarTodasRecebidasVisiveis = () => {
    setOsSelecionadasRecibo(osRecebidasFiltradas.map((os) => os.id));
  };

  const limparSelecaoRecibo = () => {
    setOsSelecionadasRecibo([]);
  };

  const obterReciboOSPDF = async (ids: number[], agrupar: boolean) => {
    if (ids.length === 0) {
      alert("Selecione ao menos uma OS recebida para gerar o recibo.");
      return null;
    }

    try {
      const query = montarQueryString({
        os_ids: ids.join(","),
        agrupar: agrupar ? "true" : "false",
      });
      const response = await api.get(`/ordens-servico/relatorios/recibos/pdf${query}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const disposition = response.headers?.["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const filename =
        ids.length === 1
          ? `recibo_os_${ids[0]}.pdf`
          : agrupar
            ? `recibo_os_agrupado_${new Date().toISOString().slice(0, 10)}.pdf`
            : `recibos_os_${new Date().toISOString().slice(0, 10)}.pdf`;
      return { blob, filename: match?.[1] || filename };
    } catch (error: any) {
      console.error("Erro ao gerar recibo PDF:", error);
      alert(error?.response?.data?.detail || "Erro ao gerar recibo das OS recebidas.");
      return null;
    }
  };

  const baixarReciboOSPDF = async (ids: number[], agrupar: boolean) => {
    const arquivo = await obterReciboOSPDF(ids, agrupar);
    if (!arquivo) return;
    abrirDownloadBlob(arquivo.blob, arquivo.filename);
  };

  const abrirPreviewRecibo = async (ids: number[], agrupar: boolean) => {
    setCarregandoPreviewRecibo(true);
    try {
      const arquivo = await obterReciboOSPDF(ids, agrupar);
      if (!arquivo) return;

      const titulo =
        ids.length === 1
          ? `Previa do recibo da OS ${ordensServico.find((os) => os.id === ids[0])?.numero_os || ids[0]}`
          : agrupar
            ? `Previa do recibo agrupado`
            : `Previa dos recibos selecionados`;

      const url = window.URL.createObjectURL(arquivo.blob);
      setPreviewRecibo((prev) => {
        if (prev?.url) {
          window.URL.revokeObjectURL(prev.url);
        }
        return {
          ids,
          agrupar,
          titulo,
          filename: arquivo.filename,
          url,
        };
      });
    } finally {
      setCarregandoPreviewRecibo(false);
    }
  };

  const compartilharReciboPorEmail = async (
    ids: number[],
    agrupar: boolean,
    overrides?: { assunto?: string; mensagem?: string; email?: string }
  ) => {
    const arquivo = await obterReciboOSPDF(ids, agrupar);
    if (!arquivo) return;

    const contato = obterContatoCompartilhamento(ids);
    const subject = String(overrides?.assunto || montarAssuntoCompartilhamentoRecibo(ids, agrupar)).trim();
    const body = String(overrides?.mensagem || montarMensagemCompartilhamentoRecibo(ids, agrupar)).trim();
    const emailDestino = String(overrides?.email || contato?.email || "").trim();
    const textoFallback = `${body}\n\nCaso o anexo nao seja compartilhado automaticamente, o PDF foi baixado neste dispositivo para envio manual.`;
    const compartilhado = await compartilharArquivoSeDisponivel(arquivo.blob, arquivo.filename, subject, textoFallback);
    if (compartilhado) return;
    abrirDownloadBlob(arquivo.blob, arquivo.filename);
    abrirMailtoComMensagem(emailDestino, subject, textoFallback);
  };

  const compartilharReciboPorWhatsApp = async (
    ids: number[],
    agrupar: boolean,
    overrides?: { mensagem?: string; telefone?: string }
  ) => {
    const arquivo = await obterReciboOSPDF(ids, agrupar);
    if (!arquivo) return;

    const contato = obterContatoCompartilhamento(ids);
    const title =
      montarAssuntoCompartilhamentoRecibo(ids, agrupar);
    const telefoneDestino = String(overrides?.telefone || contato?.telefone || "").trim();
    const mensagem = String(overrides?.mensagem || montarMensagemCompartilhamentoRecibo(ids, agrupar)).trim();
    const textoFallback = `${mensagem}\n\nSe o PDF nao seguir automaticamente, ele foi baixado neste dispositivo para anexar na conversa.`;
    const compartilhado = await compartilharArquivoSeDisponivel(arquivo.blob, arquivo.filename, title, textoFallback);
    if (compartilhado) return;
    abrirDownloadBlob(arquivo.blob, arquivo.filename);
    abrirWhatsAppComMensagem(telefoneDestino, textoFallback);
  };

  const confirmarCompartilhamentoRecibo = async () => {
    if (!modalCompartilharRecibo) return;
    setEnviandoCompartilhamentoRecibo(true);
    try {
      if (modalCompartilharRecibo.canal === "email") {
        await compartilharReciboPorEmail(modalCompartilharRecibo.ids, modalCompartilharRecibo.agrupar, {
          assunto: modalCompartilharRecibo.assunto,
          mensagem: modalCompartilharRecibo.mensagem,
          email: modalCompartilharRecibo.email,
        });
      } else {
        await compartilharReciboPorWhatsApp(modalCompartilharRecibo.ids, modalCompartilharRecibo.agrupar, {
          mensagem: modalCompartilharRecibo.mensagem,
          telefone: modalCompartilharRecibo.telefone,
        });
      }
      setModalCompartilharRecibo(null);
    } finally {
      setEnviandoCompartilhamentoRecibo(false);
    }
  };

  // Calcular resumo de OS
  const osPendentes = ordensServico.filter(os => os.status === 'Pendente');
  const osPagas = ordensServico.filter(os => os.status === 'Pago');
  const valorTotalOS = osPagas.reduce((acc, os) => acc + os.valor_final, 0);
  const valorPendenteOS = osPendentes.reduce((acc, os) => acc + os.valor_final, 0);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-gray-500">Controle financeiro completo</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleNova}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Transacao
            </button>
          </div>
        </div>

        {/* Periodo */}
        <div className="flex gap-2 mb-6">
          {['dia', 'semana', 'mes', 'ano'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                periodo === p
                  ? "bg-green-100 text-green-700"
                  : "bg-white text-gray-600 hover:bg-gray-100 border"
              }`}
            >
              {p === 'mes' ? 'Mes' : p}
            </button>
          ))}
        </div>

        {/* Cards Resumo */}
	        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Entradas</p>
                <p className="text-2xl font-bold text-green-600">{formatarValor(resumo.entradas)}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            {resumo.pendente_entrada > 0 && (
              <p className="text-xs text-yellow-600 mt-2">
                + {formatarValor(resumo.pendente_entrada)} pendente
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saidas</p>
                <p className="text-2xl font-bold text-red-600">{formatarValor(resumo.saidas)}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
            {resumo.pendente_saida > 0 && (
              <p className="text-xs text-yellow-600 mt-2">
                + {formatarValor(resumo.pendente_saida)} pendente
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saldo</p>
                <p className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatarValor(resumo.saldo)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

	          <div className="bg-white p-5 rounded-xl shadow-sm border">
	            <div className="flex items-center justify-between">
	              <div>
	                <p className="text-sm text-gray-500">OS Pendentes</p>
	                <p className="text-2xl font-bold text-yellow-600">{formatarValor(valorPendenteOS)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
	            <p className="text-xs text-gray-500 mt-2">
	              {osPendentes.length} ordem(ns) pendente(s)
	            </p>
	          </div>

	          <div className="bg-white p-5 rounded-xl shadow-sm border">
	            <div className="flex items-center justify-between">
	              <div>
	                <p className="text-sm text-gray-500">Taxas de pagamento</p>
	                <p className="text-2xl font-bold text-amber-600">{formatarValor(resumo.taxas_pagamento || 0)}</p>
	              </div>
	              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
	                <Receipt className="w-6 h-6 text-amber-600" />
	              </div>
	            </div>
	          </div>

	          <div className="bg-white p-5 rounded-xl shadow-sm border">
	            <div className="flex items-center justify-between">
	              <div>
	                <p className="text-sm text-gray-500">Creditos gerados</p>
	                <p className="text-2xl font-bold text-cyan-600">{formatarValor(resumo.creditos_gerados || 0)}</p>
	              </div>
	              <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center">
	                <TrendingUp className="w-6 h-6 text-cyan-600" />
	              </div>
	            </div>
	          </div>
	        </div>

	        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
	          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	            <div>
	              <h2 className="text-base font-semibold text-gray-900">Cadastro de meios de pagamento</h2>
	              <p className="text-xs text-gray-500">
	                Cadastre bandeiras e formas com taxa para uso no recebimento da OS.
	              </p>
	            </div>
	            <div className="flex gap-2">
	              <button
	                onClick={cadastrarBandeiraRapido}
	                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
	              >
	                Nova bandeira
	              </button>
	              <button
	                onClick={cadastrarFormaPagamentoRapido}
	                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
	              >
	                Nova forma
	              </button>
	            </div>
	          </div>
	          <div className="mt-3 overflow-x-auto">
	            <table className="w-full text-sm">
	              <thead className="bg-gray-50 text-gray-600">
	                <tr>
	                  <th className="text-left px-3 py-2">Forma</th>
	                  <th className="text-left px-3 py-2">Tipo</th>
	                  <th className="text-left px-3 py-2">Adquirente</th>
	                  <th className="text-right px-3 py-2">Taxa %</th>
	                  <th className="text-right px-3 py-2">Taxa fixa</th>
	                  <th className="text-left px-3 py-2">Bandeira</th>
	                  <th className="text-right px-3 py-2">Acao</th>
	                </tr>
	              </thead>
	              <tbody>
	                {formasPagamentoDisponiveis.length === 0 ? (
	                  <tr>
	                    <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
	                      Nenhuma forma de pagamento cadastrada.
	                    </td>
	                  </tr>
	                ) : (
	                  formasPagamentoDisponiveis.map((forma) => {
	                    const bandeira = bandeirasCartao.find((b) => b.id === forma.bandeira_id);
	                    return (
	                      <tr key={`${forma.id ?? forma.codigo}`} className="border-t">
	                        <td className="px-3 py-2">{forma.nome}</td>
	                        <td className="px-3 py-2">{forma.tipo || "-"}</td>
	                        <td className="px-3 py-2">{forma.adquirente || "-"}</td>
	                        <td className="px-3 py-2 text-right">{Number(forma.taxa_percentual || 0).toFixed(2)}%</td>
	                        <td className="px-3 py-2 text-right">{formatarValor(Number(forma.taxa_fixa || 0))}</td>
	                        <td className="px-3 py-2">{forma.bandeira_nome || bandeira?.nome || "-"}</td>
		                        <td className="px-3 py-2 text-right">
		                          {forma.id ? (
		                            <div className="flex justify-end gap-3">
		                              <button
		                                onClick={() => editarTaxasFormaPagamento(forma)}
		                                className="text-blue-600 hover:text-blue-700"
		                              >
		                                Editar taxas
		                              </button>
		                              <button
		                                onClick={() => desativarFormaPagamento(forma.id)}
		                                className="text-red-600 hover:text-red-700"
		                              >
		                                Desativar
		                              </button>
		                            </div>
		                          ) : (
		                            <span className="text-gray-400">-</span>
		                          )}
		                        </td>
	                      </tr>
	                    );
	                  })
	                )}
	              </tbody>
	            </table>
	          </div>
	        </div>

	        {/* Abas */}
	        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setAbaAtiva("transacoes")}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
              abaAtiva === "transacoes"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Transacoes
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {transacoes.length}
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva("cobrancas")}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
              abaAtiva === "cobrancas"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Cobrancas
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
              {gruposCobrancaClinica.length} clinica(s)
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva("ordens")}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
              abaAtiva === "ordens"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            Ordens de Servico
            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
              {osFiltradas.length}
            </span>
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative md:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={
                  abaAtiva === "transacoes"
                    ? "Buscar transacao..."
                    : abaAtiva === "cobrancas"
                      ? "Buscar clinica, paciente ou OS..."
                      : "Buscar OS..."
                }
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <select
              value={abaAtiva === "transacoes" ? filtroStatusTransacao : filtroStatusOS}
              onChange={(e) =>
                abaAtiva === "transacoes"
                  ? setFiltroStatusTransacao(e.target.value)
                  : setFiltroStatusOS(e.target.value)
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="todos">Todos os status</option>
              <option value="Pendente">Pendente</option>
              {abaAtiva === "transacoes" ? (
                <option value="Recebido">Recebido</option>
              ) : null}
              <option value="Pago">Pago</option>
              <option value="Cancelado">Cancelado</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                title="Data inicio"
              />
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                title="Data fim"
              />
            </div>

            {abaAtiva === "transacoes" && (
              <>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="entrada">Entradas</option>
                  <option value="saida">Saidas</option>
                </select>

                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="todos">Todas categorias</option>
                  {CATEGORIAS_TRANSACAO.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>

	                <select
	                  value={filtroFormaPagamento}
	                  onChange={(e) => setFiltroFormaPagamento(e.target.value)}
	                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
	                >
	                  <option value="todos">Todas formas</option>
	                  {formasPagamentoDisponiveis.map((fp) => {
	                    const codigo = normalizarCodigoFormaPagamento(fp.codigo);
	                    return (
	                      <option key={`${codigo}-${fp.id ?? "fallback"}`} value={codigo}>
	                        {descricaoFormaPagamentoConfig(fp)}
	                      </option>
	                    );
	                  })}
	                </select>
              </>
            )}

            {(abaAtiva === "ordens" || abaAtiva === "cobrancas") && (
              <>
                <select
                  value={filtroClinicaOS}
                  onChange={(e) => setFiltroClinicaOS(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="todos">Todas clinicas</option>
                  {clinicas.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nome}
                    </option>
                  ))}
                </select>

                <select
                  value={filtroServicoOS}
                  onChange={(e) => setFiltroServicoOS(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="todos">Todos servicos</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.nome}
                    </option>
                  ))}
                </select>

                <select
                  value={filtroTipoHorarioOS}
                  onChange={(e) => setFiltroTipoHorarioOS(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="todos">Todos horarios</option>
                  <option value="comercial">Comercial</option>
                  <option value="plantao">Plantao</option>
                </select>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={carregarDados}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Atualizar
            </button>
            <button
              onClick={limparFiltros}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Conteudo - Transacoes */}
        {abaAtiva === "transacoes" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-5 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Transacoes 
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({transacoesFiltradas.length})
                </span>
              </h2>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : transacoesFiltradas.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma transacao encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {transacoesFiltradas.map((t) => (
                  <div key={t.id} className="p-4 hover:bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        t.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {t.tipo === 'entrada' ? (
                          <ArrowUpRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{t.descricao}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(t.status)}`}>
                            {getStatusIcon(t.status)}
                            <span className="ml-1">{t.status}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {getCategoriaNome(t.categoria)}
                          </span>
                          {t.paciente_nome && <span>- {t.paciente_nome}</span>}
                          <span>- {formatarData(t.data_transacao)}</span>
                          <span>- {getFormaPagamentoNome(t.forma_pagamento)}</span>
                        </div>
                      </div>

                      {/* Valor e Acoes */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-medium ${
                            t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {t.tipo === 'entrada' ? '+' : '-'}{formatarValor(t.valor_final)}
                          </p>
                          {(t.desconto || 0) > 0 && (
                            <p className="text-xs text-gray-400">
                              Desc: {formatarValor(t.desconto)}
                            </p>
                          )}
                        </div>

                        {/* Acoes */}
                        <div className="flex gap-1">
                          {t.status === 'Pendente' && (
                            <button
                              onClick={() => handlePagar(t.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Marcar como pago/recebido"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditar(t)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExcluir(t.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conteudo - Cobrancas */}
        {abaAtiva === "cobrancas" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-5 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Cobrancas por Clinica
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({gruposCobrancaClinica.length})
                  </span>
                </h2>
                <p className="text-xs text-amber-700 mt-1">
                  Pendencias totais: <span className="font-semibold">{formatarValor(totalPendenteAgrupado)}</span>
                </p>
              </div>
              <button
                onClick={() => baixarRelatorioPendenciasPDF()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100"
              >
                <Download className="w-4 h-4" />
                Baixar relatorio pendente (PDF)
              </button>
            </div>

            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Mensagem da cobranca (modelo unico)</label>
                <button
                  onClick={restaurarModeloMensagem}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Restaurar padrao
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Campos automaticos: `________` clinica, `___/___/___` data, linha com `OS numero da os` para lista, e `R$ valor total das OS pendentes` para o total.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {PLACEHOLDERS_MENSAGEM_COBRANCA.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    onClick={() => inserirPlaceholderNoModelo(item.valor)}
                    className="px-2.5 py-1 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    title={`Inserir ${item.valor}`}
                  >
                    {item.label}: <span className="font-mono">{item.valor}</span>
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaMensagemRef}
                rows={6}
                value={mensagemCobrancaModelo}
                onChange={(e) => setMensagemCobrancaModelo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              />
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : gruposCobrancaClinica.length === 0 ? (
              <div className="p-12 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma cobranca encontrada para os filtros atuais</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {gruposCobrancaClinica.map((grupo) => (
                  <div key={grupo.chave} className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                    <div className="p-4 border-b border-amber-100 bg-white">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{grupo.clinica_nome}</p>
                          <p className="text-xs text-gray-600">
                            {grupo.quantidade_os} pendente(s) de {grupo.quantidade_total} OS listada(s)
                          </p>
                          <p className="text-xs text-gray-600">
                            Total pendente: <span className="font-semibold">{formatarValor(grupo.total_pendente)}</span>
                          </p>
                          <p className="text-xs text-gray-500">Telefone: {grupo.telefone_clinica || "nao informado"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => baixarRelatorioPendenciasPDF(grupo)}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1"
                          >
                            <FileText className="w-4 h-4" />
                            Baixar PDF
                          </button>
                          <button
                            onClick={() => copiarMensagemCobranca(grupo)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-1"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar mensagem
                          </button>
                          <button
                            onClick={() => enviarCobrancaWhatsApp(grupo)}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg flex items-center gap-1"
                          >
                          <MessageCircle className="w-4 h-4" />
                          Enviar WhatsApp
                        </button>
                      </div>
                    </div>
                    </div>

                    <div className="divide-y bg-white">
                      {grupo.ordens.map((os) => (
                        <div key={os.id} className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatarDataHoraCurta(os.data_atendimento)}
                                </span>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(os.status)}`}>
                                  {getStatusIcon(os.status)}
                                  <span className="ml-1">{os.status}</span>
                                </span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {os.tipo_horario === "plantao" ? "Plantao" : "Comercial"}
                                </span>
                                <span className="text-xs text-gray-400">OS #{os.numero_os}</span>
                              </div>

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                                <span className="font-semibold">{os.paciente || "Paciente nao informado"}</span>
                                <span>Tutor: {os.tutor || "Nao informado"}</span>
                                <span>Servico: {os.servico || "Nao informado"}</span>
                              </div>

                              {(os.observacoes || "").trim() && (
                                <p className="text-xs text-gray-500 line-clamp-2">Obs: {os.observacoes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 lg:ml-2">
                              <div className="text-right min-w-[120px]">
                                <p className="font-bold text-gray-900">{formatarValor(os.valor_final)}</p>
                                {(os.desconto || 0) > 0 && (
                                  <p className="text-xs text-gray-400">Desc: {formatarValor(os.desconto)}</p>
                                )}
                              </div>
                              <div className="flex flex-wrap justify-end gap-2">
                                {os.status === "Pendente" && (
                                  <button
                                    onClick={() => handlePagarOS(os)}
                                    className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg flex items-center gap-1"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Receber
                                  </button>
                                )}
                                {os.status === "Pago" && (
                                  <button
                                    onClick={() => handleDesfazerRecebimentoOS(os)}
                                    className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg flex items-center gap-1"
                                  >
                                    <Undo2 className="w-4 h-4" />
                                    Desfazer
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEditarOS(os)}
                                  className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1"
                                >
                                  <Edit className="w-4 h-4" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleExcluirOS(os)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conteudo - Ordens de Servico */}
        {abaAtiva === "ordens" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-5 border-b flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Ordens de Servico
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({osFiltradas.length})
                  </span>
                </h2>
                <p className="text-sm text-gray-500">
                  Geradas automaticamente dos agendamentos
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {osRecebidasFiltradas.length} OS recebida(s) visivel(is) | {osSelecionadasRecibo.length} selecionada(s) para recibo
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={selecionarTodasRecebidasVisiveis}
                  disabled={osRecebidasFiltradas.length === 0}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Selecionar recebidas
                </button>
                <button
                  onClick={limparSelecaoRecibo}
                  disabled={osSelecionadasRecibo.length === 0}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Limpar selecao
                </button>
                <button
                  onClick={() => abrirPreviewRecibo(osSelecionadasRecibo, false)}
                  disabled={osSelecionadasRecibo.length === 0 || carregandoPreviewRecibo}
                  className="px-3 py-1.5 text-sm bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-1 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {carregandoPreviewRecibo ? "Abrindo previa..." : "Previa"}
                </button>
                <button
                  onClick={() => baixarReciboOSPDF(osSelecionadasRecibo, false)}
                  disabled={osSelecionadasRecibo.length === 0}
                  className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1 disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" />
                  Gerar recibo
                </button>
                <button
                  onClick={() => baixarReciboOSPDF(osSelecionadasRecibo, true)}
                  disabled={osSelecionadasRecibo.length === 0}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" />
                  Gerar recibo agrupado
                </button>
                <button
                  onClick={() => abrirComposerCompartilhamentoRecibo("whatsapp", osSelecionadasRecibo, osSelecionadasRecibo.length > 1)}
                  disabled={osSelecionadasRecibo.length === 0}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
                <button
                  onClick={() => abrirComposerCompartilhamentoRecibo("email", osSelecionadasRecibo, osSelecionadasRecibo.length > 1)}
                  disabled={osSelecionadasRecibo.length === 0}
                  className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg flex items-center gap-1 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  E-mail
                </button>
              </div>
            </div>

            <div className="p-4 border-b bg-white space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Mensagem base do recibo individual</label>
                  <button
                    onClick={() => restaurarModeloMensagemRecibo("individual")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Restaurar padrao
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PLACEHOLDERS_MENSAGEM_RECIBO.map((item) => (
                    <button
                      key={`individual-${item.valor}`}
                      type="button"
                      onClick={() => inserirPlaceholderModeloRecibo(item.valor, "individual")}
                      className="px-2.5 py-1 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      {item.label}: <span className="font-mono">{item.valor}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  ref={textareaMensagemReciboIndividualRef}
                  rows={6}
                  value={mensagemReciboIndividualModelo}
                  onChange={(e) => setMensagemReciboIndividualModelo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Mensagem base do recibo agrupado</label>
                  <button
                    onClick={() => restaurarModeloMensagemRecibo("agrupado")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Restaurar padrao
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PLACEHOLDERS_MENSAGEM_RECIBO.map((item) => (
                    <button
                      key={`agrupado-${item.valor}`}
                      type="button"
                      onClick={() => inserirPlaceholderModeloRecibo(item.valor, "agrupado")}
                      className="px-2.5 py-1 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      {item.label}: <span className="font-mono">{item.valor}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  ref={textareaMensagemReciboAgrupadoRef}
                  rows={7}
                  value={mensagemReciboAgrupadoModelo}
                  onChange={(e) => setMensagemReciboAgrupadoModelo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : osFiltradas.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma ordem de servico encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {osFiltradas.map((os) => (
                  <div
                    key={os.id}
                    id={`os-row-${os.id}`}
                    className={`p-4 transition-colors ${
                      osHighlightId === os.id
                        ? "bg-amber-50 ring-2 ring-amber-200"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={osSelecionadasRecibo.includes(os.id)}
                          disabled={os.status !== "Pago"}
                          onChange={() => toggleSelecaoReciboOS(os.id)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            os.status === "Pago"
                              ? "Selecionar para recibo"
                              : "Apenas OS recebidas podem gerar recibo"
                          }
                        />
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatarDataHoraCurta(os.data_atendimento)}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            - {os.clinica || "Clinica nao informada"}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(os.status)}`}>
                            {getStatusIcon(os.status)}
                            <span className="ml-1">{os.status}</span>
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {os.tipo_horario === "plantao" ? "Plantao" : "Comercial"}
                          </span>
                          <span className="text-xs text-gray-400">OS #{os.numero_os}</span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                          <span className="font-semibold">{os.paciente || "Paciente nao informado"}</span>
                          <span>Tutor: {os.tutor || "Nao informado"}</span>
                          <span>Servico: {os.servico || "Nao informado"}</span>
                        </div>

                        {(os.observacoes || "").trim() && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            Obs: {os.observacoes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 lg:ml-2">
                        <div className="text-right min-w-[120px]">
                          <p className="font-bold text-gray-900">{formatarValor(os.valor_final)}</p>
                          {(os.desconto || 0) > 0 && (
                            <p className="text-xs text-gray-400">Desc: {formatarValor(os.desconto)}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          {os.status === "Pendente" && (
                            <button
                              onClick={() => handlePagarOS(os)}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg flex items-center gap-1"
                              title="Marcar como pago e criar transacao"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Receber
                            </button>
                          )}
                          {os.status === "Pago" && (
                            <button
                              onClick={() => abrirPreviewRecibo([os.id], false)}
                              className="px-3 py-1.5 text-sm bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1"
                              title="Visualizar recibo desta OS"
                            >
                              <FileText className="w-4 h-4" />
                              Previa
                            </button>
                          )}
                          {os.status === "Pago" && (
                            <button
                              onClick={() => baixarReciboOSPDF([os.id], false)}
                              className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg flex items-center gap-1"
                              title="Gerar recibo desta OS"
                            >
                              <Receipt className="w-4 h-4" />
                              Recibo
                            </button>
                          )}
                          {os.status === "Pago" && (
                            <button
                              onClick={() => abrirComposerCompartilhamentoRecibo("whatsapp", [os.id], false)}
                              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg flex items-center gap-1"
                              title="Compartilhar recibo por WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                              WhatsApp
                            </button>
                          )}
                          {os.status === "Pago" && (
                            <button
                              onClick={() => abrirComposerCompartilhamentoRecibo("email", [os.id], false)}
                              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg flex items-center gap-1"
                              title="Compartilhar recibo por e-mail"
                            >
                              <Mail className="w-4 h-4" />
                              E-mail
                            </button>
                          )}
                          {os.status === "Pago" && (
                            <button
                              onClick={() => handleDesfazerRecebimentoOS(os)}
                              className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg flex items-center gap-1"
                              title="Desfazer recebimento"
                            >
                              <Undo2 className="w-4 h-4" />
                              Desfazer
                            </button>
                          )}
                          <button
                            onClick={() => handleEditarOS(os)}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1"
                            title="Editar OS"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleExcluirOS(os)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Excluir OS"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Links para relatorios */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a 
            href="/financeiro/relatorios"
            className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Relatorios</p>
              <p className="text-sm text-gray-500">Analises detalhadas</p>
            </div>
          </a>
          <a 
            href="/financeiro/dashboard"
            className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Dashboard</p>
              <p className="text-sm text-gray-500">Graficos e metricas</p>
            </div>
          </a>
          <a 
            href="/financeiro/contas"
            className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Contas</p>
              <p className="text-sm text-gray-500">A pagar / A receber</p>
            </div>
          </a>
        </div>
      </div>

      {/* Modal de Transacao */}
      <TransacaoModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={carregarDados}
        transacao={transacaoEditando}
      />

      {/* Modal de Edicao de OS */}
      {modalEditarOS && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Editar Ordem de Servico</h3>
              <p className="text-sm text-gray-500 mt-1">
                OS #{modalEditarOS.numero_os} - {modalEditarOS.paciente || "Paciente nao informado"}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clinica</label>
                  <select
                    value={formEditarOS.clinica_id}
                    onChange={(e) => setFormEditarOS((prev) => ({ ...prev, clinica_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {clinicas.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Servico</label>
                  <select
                    value={formEditarOS.servico_id}
                    onChange={(e) => setFormEditarOS((prev) => ({ ...prev, servico_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Selecione...</option>
                    {servicos.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de horario</label>
                  <select
                    value={formEditarOS.tipo_horario}
                    onChange={(e) => setFormEditarOS((prev) => ({ ...prev, tipo_horario: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="comercial">Comercial</option>
                    <option value="plantao">Plantao</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formEditarOS.desconto}
                    onChange={(e) =>
                      setFormEditarOS((prev) => ({ ...prev, desconto: Number(e.target.value || 0) }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
                <textarea
                  rows={3}
                  value={formEditarOS.observacoes}
                  onChange={(e) => setFormEditarOS((prev) => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setModalEditarOS(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicaoOS}
                disabled={salvandoOS}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {salvandoOS ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCompartilharRecibo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalCompartilharRecibo.canal === "email" ? "Revisar e-mail do recibo" : "Revisar mensagem do recibo"}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {modalCompartilharRecibo.ids.length === 1
                  ? `1 OS selecionada`
                  : `${modalCompartilharRecibo.ids.length} OS selecionadas`}{" "}
                {modalCompartilharRecibo.agrupar ? "com recibo agrupado" : "com recibo individual"}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {modalCompartilharRecibo.canal === "email" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de destino</label>
                  <input
                    type="email"
                    value={modalCompartilharRecibo.email}
                    onChange={(e) =>
                      setModalCompartilharRecibo((prev) =>
                        prev ? { ...prev, email: e.target.value } : prev
                      )
                    }
                    placeholder="destinatario@exemplo.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp de destino</label>
                  <input
                    type="text"
                    value={modalCompartilharRecibo.telefone}
                    onChange={(e) =>
                      setModalCompartilharRecibo((prev) =>
                        prev ? { ...prev, telefone: e.target.value } : prev
                      )
                    }
                    placeholder="(85) 99999-9999"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              )}

              {modalCompartilharRecibo.canal === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                  <input
                    type="text"
                    value={modalCompartilharRecibo.assunto}
                    onChange={(e) =>
                      setModalCompartilharRecibo((prev) =>
                        prev ? { ...prev, assunto: e.target.value } : prev
                      )
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  rows={10}
                  value={modalCompartilharRecibo.mensagem}
                  onChange={(e) =>
                    setModalCompartilharRecibo((prev) =>
                      prev ? { ...prev, mensagem: e.target.value } : prev
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                O sistema tenta compartilhar o PDF automaticamente. Se o navegador nao permitir, ele baixa o arquivo e abre o {modalCompartilharRecibo.canal === "email" ? "e-mail" : "WhatsApp"} com essa mensagem para anexo manual.
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setModalCompartilharRecibo(null)}
                disabled={enviandoCompartilhamentoRecibo}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCompartilhamentoRecibo}
                disabled={enviandoCompartilhamentoRecibo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
              >
                {modalCompartilharRecibo.canal === "email" ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                {enviandoCompartilhamentoRecibo ? "Preparando..." : modalCompartilharRecibo.canal === "email" ? "Abrir e-mail" : "Abrir WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewRecibo && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{previewRecibo.titulo}</h3>
                <p className="text-sm text-gray-500">{previewRecibo.filename}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => baixarReciboOSPDF(previewRecibo.ids, previewRecibo.agrupar)}
                  className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
                <button
                  onClick={fecharPreviewRecibo}
                  className="px-3 py-1.5 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100">
              <iframe
                src={previewRecibo.url}
                title={previewRecibo.titulo}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Receber OS */}
	      {modalReceberOS && (
	        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
	          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Receber Ordem de Servico</h3>
              <p className="text-sm text-gray-500 mt-1">
                OS {modalReceberOS.numero_os} - {modalReceberOS.paciente}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
	              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Valor:</span>
                  <span className="font-medium">{formatarValor(modalReceberOS.valor_final)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Clinica:</span>
                  <span className="font-medium">{modalReceberOS.clinica}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Servico:</span>
	                  <span className="font-medium">{modalReceberOS.servico}</span>
	                </div>
	              </div>

              {carregandoSaldoCreditoClienteOS && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                  Consultando credito ativo do cliente...
                </div>
              )}
              {!carregandoSaldoCreditoClienteOS && erroSaldoCreditoClienteOS && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {erroSaldoCreditoClienteOS}
                </div>
              )}
              {!carregandoSaldoCreditoClienteOS && saldoCreditoClienteOS > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Cliente com credito ativo: <strong>{formatarValor(saldoCreditoClienteOS)}</strong>. Avalie com o
                  cliente se deseja usar esse saldo antes de confirmar o recebimento.
                </div>
              )}

	              <div className="space-y-3">
	                {pagamentosRecebimentoOS.map((pagamento, index) => (
	                  <div key={pagamento.id} className="rounded-lg border border-gray-200 p-3">
	                    <div className="mb-2 text-xs font-medium text-gray-500">Pagamento {index + 1}</div>
	                    <label className="block text-xs font-medium text-gray-600">Forma de pagamento</label>
	                    <select
	                      value={pagamento.forma_codigo}
	                      onChange={(event) => atualizarLinhaPagamentoOS(pagamento.id, "forma_codigo", event.target.value)}
	                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
	                    >
	                      {formasPagamentoDisponiveis.map((forma) => {
	                        const codigo = normalizarCodigoFormaPagamento(forma.codigo);
	                        return (
	                          <option key={`${codigo}-${forma.id ?? "fallback"}`} value={codigo}>
	                            {descricaoFormaPagamentoConfig(forma)}
	                          </option>
	                        );
	                      })}
	                    </select>
	                    <label className="mt-2 block text-xs font-medium text-gray-600">Valor</label>
	                    <input
	                      type="number"
	                      min="0"
	                      step="0.01"
	                      value={pagamento.valor}
	                      onChange={(event) => atualizarLinhaPagamentoOS(pagamento.id, "valor", event.target.value)}
	                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
	                    />
	                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
	                      <span>
	                        Taxa estimada: {formatarValor(resumoPagamentoOS.linhas[index]?.taxa || 0)}
	                      </span>
	                      {pagamentosRecebimentoOS.length > 1 && (
	                        <button
	                          type="button"
	                          onClick={() => removerLinhaPagamentoOS(pagamento.id)}
	                          className="text-red-600 hover:text-red-700"
	                        >
	                          Remover
	                        </button>
	                      )}
	                    </div>
	                  </div>
	                ))}
	                <button
	                  type="button"
	                  onClick={adicionarLinhaPagamentoOS}
	                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
	                >
	                  + Adicionar forma de pagamento
	                </button>
	              </div>

	              <div>
	                <label className="block text-sm font-medium text-gray-700 mb-2">
	                  Data do Recebimento
	                </label>
                <input
                  type="date"
                  value={dataRecebimentoOS}
                  onChange={(e) => setDataRecebimentoOS(e.target.value)}
	                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
	                />
	              </div>

              {!carregandoSaldoCreditoClienteOS && saldoCreditoClienteOS > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <input
                      type="checkbox"
                      checked={usarCreditoClienteOS}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setUsarCreditoClienteOS(checked);
                        if (checked) {
                          const coberturaAtual = Math.max(
                            0,
                            Number(resumoPagamentoOS.valorOS || 0) - Number(resumoPagamentoOS.totalBruto || 0)
                          );
                          const sugestao = Math.min(
                            Number(saldoCreditoClienteOS || 0),
                            coberturaAtual > 0 ? coberturaAtual : Number(resumoPagamentoOS.valorOS || 0)
                          );
                          setValorCreditoUtilizadoOS(toMoneyInput(sugestao));
                        }
                      }}
                    />
                    Usar credito do cliente neste recebimento
                  </label>
                  {usarCreditoClienteOS && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-amber-900">Valor do credito a usar</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={Number(saldoCreditoClienteOS || 0)}
                        value={valorCreditoUtilizadoOS}
                        onChange={(event) => setValorCreditoUtilizadoOS(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                      <div className="mt-1 text-xs text-amber-800">
                        Saldo disponivel: {formatarValor(saldoCreditoClienteOS)}.
                      </div>
                    </div>
                  )}
                </div>
              )}

	              {resumoPagamentoOS.excedente > 0 && (
	                <div>
	                  <label className="block text-sm font-medium text-gray-700 mb-2">
	                    Excedente detectado. Destino do credito
	                  </label>
	                  <select
	                    value={destinoCreditoExcedenteOS}
	                    onChange={(event) =>
	                      setDestinoCreditoExcedenteOS(event.target.value as "cliente" | "clinica" | "nenhum")
	                    }
	                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
	                  >
	                    <option value="cliente">Cliente</option>
	                    <option value="clinica">Clinica</option>
	                    <option value="nenhum">Nao gerar credito</option>
	                  </select>
	                </div>
	              )}

	              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
	                <div className="flex justify-between">
	                  <span>Valor da OS</span>
	                  <strong>{formatarValor(resumoPagamentoOS.valorOS || 0)}</strong>
	                </div>
	                <div className="flex justify-between">
	                  <span>Total bruto informado</span>
	                  <strong>{formatarValor(resumoPagamentoOS.totalBruto || 0)}</strong>
	                </div>
	                <div className="mt-1 flex justify-between">
	                  <span>Credito aplicado</span>
	                  <strong>{formatarValor(resumoPagamentoOS.creditoUtilizado || 0)}</strong>
	                </div>
	                <div className="mt-1 flex justify-between">
	                  <span>Total coberto</span>
	                  <strong>{formatarValor(resumoPagamentoOS.totalCoberto || 0)}</strong>
	                </div>
	                <div className="mt-1 flex justify-between">
	                  <span>Total de taxas estimadas</span>
	                  <strong>{formatarValor(resumoPagamentoOS.totalTaxa || 0)}</strong>
	                </div>
	                {resumoPagamentoOS.faltante > 0 && (
	                  <p className="mt-1 text-red-700">
	                    Falta cobrir {formatarValor(resumoPagamentoOS.faltante)} para atingir o valor da OS.
	                  </p>
	                )}
	                {resumoPagamentoOS.excedente > 0 && (
	                  <p className="mt-1 text-emerald-700">
	                    Excedente para credito: {formatarValor(resumoPagamentoOS.excedente)}.
	                  </p>
	                )}
	              </div>
	            </div>
	            
	            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setModalReceberOS(null);
                  setSaldoCreditoClienteOS(0);
                  setCarregandoSaldoCreditoClienteOS(false);
                  setErroSaldoCreditoClienteOS("");
                  setUsarCreditoClienteOS(false);
                  setValorCreditoUtilizadoOS("0.00");
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border"
              >
                Cancelar
              </button>
	              <button
	                onClick={confirmarRecebimentoOS}
	                disabled={carregandoFormasPagamento || resumoPagamentoOS.faltante > 0}
	                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
	              >
	                <CheckCircle className="w-4 h-4" />
	                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
