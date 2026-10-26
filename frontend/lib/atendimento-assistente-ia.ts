import type { ClinicalFieldKey } from "./atendimento-clinical-notes";

export const ASSISTENTE_AUDIO_MAX_BYTES = 24 * 1024 * 1024;
export const ASSISTENTE_AUDIO_MAX_SECONDS = 30 * 60;
export const ASSISTENTE_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";
export const ASSISTENTE_CAMPO_LABELS: Partial<Record<ClinicalFieldKey, string>> = {
  queixa_principal: "Queixa principal",
  anamnese: "Anamnese",
  exame_fisico: "Exame físico",
  dados_clinicos: "Dados clínicos",
  observacoes: "Observações",
};

export interface AssistenteIAStatus {
  usuario_id?: number;
  habilitado: boolean;
  configurado: boolean;
  modelo: string;
  esforco: string;
  modelo_transcricao: string;
  limites?: { audio_bytes: number; arquivo_bytes: number; total_arquivos_bytes: number; arquivos: number; transcricao_chars: number };
}

export interface AssistenteIAResultado {
  modelo: string;
  esforco: string;
  revisao_obrigatoria: boolean;
  bloqueado_integracao: boolean;
  campos: Array<{ campo: ClinicalFieldKey; texto: string; fonte: string; evidencia: string }>;
  fontes: Array<{ arquivo: string; paciente_nome: string | null; especie: string | null; data_exame: string | null; identidade: "compativel" | "divergente" | "nao_confirmada"; motivo: string }>;
  achados_exames: Array<{ arquivo: string; pagina: number | null; descricao: string; evidencia: string; valor: string | null; unidade: string | null; referencia: string | null; confianca: "alta" | "media" | "baixa"; alertas: string[] }>;
  sugestoes: Array<{ titulo: string; justificativa: string; conduta: string; limitacoes: string[] }>;
  pendencias: string[];
  avisos: string[];
}

export function validarArquivosAssistente(files: File[], limites?: AssistenteIAStatus["limites"]): string | null {
  if (files.length > (limites?.arquivos ?? 5)) return "Selecione no máximo cinco arquivos por análise.";
  const maxArquivo = limites?.arquivo_bytes ?? 10 * 1024 * 1024;
  const maxTotal = limites?.total_arquivos_bytes ?? 20 * 1024 * 1024;
  if (files.some((file) => !/\.(jpe?g|png|webp|pdf)$/i.test(file.name))) return "Use fotografias JPG, PNG, WebP ou documentos PDF.";
  if (files.some((file) => !file.size || file.size > maxArquivo)) return "Cada arquivo precisa ter conteúdo e até 10 MB.";
  if (files.reduce((total, file) => total + file.size, 0) > maxTotal) return "O conjunto de arquivos deve ter até 20 MB.";
  return null;
}

export function escolherMimeGravacao(isSupported: (mime: string) => boolean): string | undefined {
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(isSupported);
}

export function extensaoAudio(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

export function podeIncorporarCampo(resultado: AssistenteIAResultado, campo: AssistenteIAResultado["campos"][number]): boolean {
  return resultado.bloqueado_integracao === false && resultado.revisao_obrigatoria === true &&
    Object.prototype.hasOwnProperty.call(ASSISTENTE_CAMPO_LABELS, campo.campo) &&
    Boolean(campo.evidencia?.trim()) && Boolean(campo.fonte?.trim());
}

export function podeIncorporarAchado(resultado: AssistenteIAResultado, achado: AssistenteIAResultado["achados_exames"][number]): boolean {
  return resultado.bloqueado_integracao === false && resultado.revisao_obrigatoria === true && achado.confianca === "alta" &&
    Boolean(achado.evidencia?.trim()) && resultado.fontes.some((fonte) => fonte.arquivo === achado.arquivo && fonte.identidade === "compativel");
}

export function textoAchadoParaRevisao(resultado: AssistenteIAResultado, achado: AssistenteIAResultado["achados_exames"][number]): string {
  const fonte = resultado.fontes.find((item) => item.arquivo === achado.arquivo);
  const origem = `${achado.arquivo}${achado.pagina ? `, página ${achado.pagina}` : ""}${fonte?.data_exame ? `, exame de ${fonte.data_exame}` : ""}`;
  const valor = achado.valor ? `: ${achado.valor}${achado.unidade ? ` ${achado.unidade}` : " (unidade não informada)"}` : "";
  return `[Exame: ${origem}] ${achado.descricao}${valor}.${achado.referencia ? ` Referência descrita no exame: ${achado.referencia}.` : ""}${achado.alertas.length ? ` Pendências: ${achado.alertas.join("; ")}.` : ""}`;
}
