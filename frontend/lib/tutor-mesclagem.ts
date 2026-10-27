export type EscolhaTutor = "principal" | "secundario";
export type ValorTutor = string | number | boolean | null | Record<string, string | number | null>;
export interface PreviaMesclagem {
  principal: Record<string, ValorTutor> & { id: number };
  secundario: Record<string, ValorTutor> & { id: number };
  campos: string[];
  conflitos: string[];
  bloqueios: string[];
  avisos: string[];
  token_previa: string;
  vinculos: Record<string, { principal: number; secundario: number }>;
  pets: { id: number; nome: string; tutor_id: number }[];
}

export const nomesCamposTutor: Record<string, string> = {
  nome: "Nome", telefone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", cpf: "CPF",
  identificacao_pendente: "Identificação pendente", origem_cadastro: "Origem do cadastro",
  identificacao_observacoes: "Observações da identificação", endereco: "Endereço completo e localização",
};
export const nomesVinculosTutor: Record<string, string> = {
  pacientes: "Animais", agendamentos: "Agendamentos", atendimentos_clinicos: "Atendimentos",
  creditos_financeiros: "Movimentos de crédito",
};

export function valorTutorPreenchido(value: ValorTutor): boolean {
  if (value !== null && typeof value === "object") return Object.values(value).some((v) => v !== null && v !== "");
  return value !== null && value !== "";
}

export function resultadoCampoTutor(previa: PreviaMesclagem, escolhas: Record<string, EscolhaTutor>, campo: string): ValorTutor {
  const escolha = escolhas[campo];
  if (escolha) return previa[escolha][campo];
  const value = previa.principal[campo];
  return valorTutorPreenchido(value) ? value : previa.secundario[campo];
}

export function formatarValorTutor(value: ValorTutor): string {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value !== null && typeof value === "object") return Object.entries(value)
    .filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${v}`).join(" · ") || "Não informado";
  return String(value ?? "").trim() || "Não informado";
}

export function erroTutor(error: unknown): string {
  const e = error as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = e.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "mensagem" in detail) return String(detail.mensagem);
  return "Não foi possível concluir a operação. Confira os dados e tente novamente.";
}
