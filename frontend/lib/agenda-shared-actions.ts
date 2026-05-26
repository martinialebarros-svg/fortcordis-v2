export type AgendaStatus =
  | "Agendado"
  | "Reservado"
  | "Confirmado"
  | "Em atendimento"
  | "Realizado"
  | "Cancelado"
  | "Faltou";

export interface AgendaStatusAction {
  label: string;
  status: AgendaStatus;
  danger?: boolean;
  precisaTipoHorario?: boolean;
}

export const AGENDA_STATUS_LIST: AgendaStatus[] = [
  "Agendado",
  "Reservado",
  "Confirmado",
  "Em atendimento",
  "Realizado",
  "Cancelado",
  "Faltou",
];

export const AGENDA_STATUS_ACOES: AgendaStatusAction[] = [
  { label: "Agendar", status: "Agendado" },
  { label: "Reservar", status: "Reservado" },
  { label: "Confirmar", status: "Confirmado" },
  { label: "Iniciar Atendimento", status: "Em atendimento" },
  { label: "Finalizar Atendimento", status: "Realizado", precisaTipoHorario: true },
  { label: "Marcar Falta", status: "Faltou", danger: true },
  { label: "Cancelar", status: "Cancelado", danger: true },
];

const PROXIMOS_STATUS: Record<AgendaStatus, AgendaStatus[]> = {
  Agendado: ["Reservado", "Confirmado", "Cancelado", "Faltou"],
  Reservado: ["Confirmado", "Agendado", "Cancelado"],
  Confirmado: ["Em atendimento", "Cancelado", "Faltou"],
  "Em atendimento": ["Realizado", "Cancelado"],
  Realizado: ["Em atendimento"],
  Cancelado: ["Agendado"],
  Faltou: ["Agendado"],
};

export const obterProximosStatus = (statusAtual?: string): AgendaStatus[] => {
  const status = String(statusAtual || "").trim() as AgendaStatus;
  return PROXIMOS_STATUS[status] || [];
};

export const obterAcoesStatusPorFluxo = (statusAtual?: string): AgendaStatusAction[] => {
  const permitidos = new Set(obterProximosStatus(statusAtual));
  return AGENDA_STATUS_ACOES.filter((acao) => permitidos.has(acao.status));
};

export const FORMA_PAGAMENTO_OPCOES = [
  { id: "dinheiro", nome: "Dinheiro" },
  { id: "cartao_credito", nome: "Cartao de credito" },
  { id: "cartao_debito", nome: "Cartao de debito" },
  { id: "pix", nome: "PIX" },
  { id: "boleto", nome: "Boleto" },
  { id: "transferencia", nome: "Transferencia" },
] as const;

export type FormaPagamentoAgenda = (typeof FORMA_PAGAMENTO_OPCOES)[number]["id"];

export const FORMA_PAGAMENTO_PADRAO: FormaPagamentoAgenda = "dinheiro";

export interface FormaPagamentoConfig {
  id?: number;
  codigo: string;
  nome: string;
  tipo?: string;
  adquirente?: string | null;
  bandeira_id?: number | null;
  bandeira_nome?: string | null;
  taxa_percentual?: number;
  taxa_fixa?: number;
  ativo?: boolean;
}

export const FORMA_PAGAMENTO_FALLBACK: FormaPagamentoConfig[] = FORMA_PAGAMENTO_OPCOES.map((item) => ({
  codigo: item.id,
  nome: item.nome,
  tipo: item.id,
  taxa_percentual: 0,
  taxa_fixa: 0,
  ativo: true,
}));

export const normalizarCodigoFormaPagamento = (valor?: string | null): string => {
  return String(valor || "").trim().toLowerCase().replace(/\s+/g, "_");
};

export const descricaoFormaPagamentoConfig = (forma: FormaPagamentoConfig): string => {
  const origem = String(forma.adquirente || "").trim();
  const bandeira = String(forma.bandeira_nome || "").trim();
  const partes = [origem, bandeira].filter(Boolean);
  if (partes.length === 0) {
    return forma.nome;
  }
  return `${forma.nome} (${partes.join(" / ")})`;
};

export const osEstaPaga = (status?: string): boolean => {
  return String(status || "").trim().toLowerCase() === "pago";
};
