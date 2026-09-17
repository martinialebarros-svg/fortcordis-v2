/**
 * Aviso de laudo disponivel pelo WhatsApp oficial.
 *
 * O mesmo clique avisa todos os destinos externos do laudo que ja estao
 * liberados no portal - a clinica parceira e o veterinario parceiro. Estas
 * funcoes decidem quem entra no aviso e como o resultado e descrito; as duas
 * telas de laudos (lista e visualizacao) compartilham a mesma regra.
 */
export const PORTAL_RELEASE_STATUS = "Liberado no portal";

export type DestinoAvisoWhatsApp = "clinica" | "veterinario_parceiro";

export interface DestinoVeterinarioLaudo {
  partner_id: number;
  nome?: string | null;
  origem?: string | null;
  liberado?: boolean;
}

export interface LaudoAvisoWhatsApp {
  status?: string;
  clinica?: string | null;
  clinic_id?: number | null;
  portal_clinica_liberado?: boolean;
  veterinario_parceiro_id?: number | null;
  veterinario_parceiro_nome?: string | null;
  portal_veterinario_liberado?: boolean;
  /**
   * Todos os veterinarios que recebem este laudo: o nomeado e os que entram
   * por vinculo de clinica com difusao ligada. E daqui que sai o nome de quem
   * vai ser avisado — o `veterinario_parceiro_id` sozinho nao ve os de vinculo.
   */
  portal_veterinarios_destinos?: DestinoVeterinarioLaudo[];
}

export interface ResumoDestinoAvisoWhatsApp {
  status?: "enviado" | "falhou" | "ignorado";
  motivo?: string | null;
  erro?: string | null;
}

export interface RespostaAvisoWhatsApp {
  message?: string;
  clinica?: ResumoDestinoAvisoWhatsApp;
  veterinario_parceiro?: ResumoDestinoAvisoWhatsApp;
  whatsapp_liberacao_status?: "enviado" | "falhou" | null;
  whatsapp_liberacao_em?: string | null;
  whatsapp_liberacao_erro?: string | null;
  whatsapp_parceiro_status?: "enviado" | "falhou" | null;
  whatsapp_parceiro_em?: string | null;
  whatsapp_parceiro_erro?: string | null;
}

export function getVeterinariosLiberados(laudo: LaudoAvisoWhatsApp): DestinoVeterinarioLaudo[] {
  const destinos = laudo.portal_veterinarios_destinos;
  if (Array.isArray(destinos)) {
    return destinos.filter((item) => item?.liberado);
  }
  // Contrato antigo, de antes da difusao por vinculo: so o nomeado.
  if (laudo.veterinario_parceiro_id && laudo.portal_veterinario_liberado) {
    return [{ partner_id: laudo.veterinario_parceiro_id, nome: laudo.veterinario_parceiro_nome }];
  }
  return [];
}

export function getDestinosAvisoWhatsApp(laudo: LaudoAvisoWhatsApp): DestinoAvisoWhatsApp[] {
  const destinos: DestinoAvisoWhatsApp[] = [];
  if (laudo.clinic_id && (laudo.portal_clinica_liberado || laudo.status === PORTAL_RELEASE_STATUS)) {
    destinos.push("clinica");
  }
  if (getVeterinariosLiberados(laudo).length > 0) {
    destinos.push("veterinario_parceiro");
  }
  return destinos;
}

export function podeAvisarWhatsApp(laudo: LaudoAvisoWhatsApp): boolean {
  return getDestinosAvisoWhatsApp(laudo).length > 0;
}

function nomeClinica(laudo: LaudoAvisoWhatsApp): string {
  return laudo.clinica?.trim() || "a clínica parceira";
}

function nomeParceiro(laudo: LaudoAvisoWhatsApp): string {
  const liberados = getVeterinariosLiberados(laudo);
  const nomes = liberados.map((item) => item.nome?.trim()).filter((nome): nome is string => Boolean(nome));

  if (nomes.length === 0) {
    return liberados.length > 1 ? "os veterinários parceiros" : "o veterinário parceiro";
  }
  if (nomes.length === 1) {
    return nomes[0];
  }
  // Nomear todo mundo: quem confirma o envio precisa saber quem vai receber.
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function getConfirmacaoAvisoWhatsApp(laudo: LaudoAvisoWhatsApp): string {
  const destinos = getDestinosAvisoWhatsApp(laudo);
  if (destinos.length === 2) {
    return `Enviar para ${nomeClinica(laudo)} e ${nomeParceiro(laudo)} o aviso de laudo disponível?`;
  }
  if (destinos.includes("veterinario_parceiro")) {
    return `Enviar para ${nomeParceiro(laudo)} o aviso de laudo disponível?`;
  }
  return `Enviar para ${nomeClinica(laudo)} o aviso de laudo disponível?`;
}

export function getTituloBotaoAvisoWhatsApp(laudo: LaudoAvisoWhatsApp): string {
  const destinos = getDestinosAvisoWhatsApp(laudo);
  const plural = getVeterinariosLiberados(laudo).length > 1;
  const rotuloVet = plural ? "veterinários parceiros" : "veterinário parceiro";
  if (destinos.length === 2) {
    return `Avisar clínica e ${rotuloVet} pelo WhatsApp oficial`;
  }
  if (destinos.includes("veterinario_parceiro")) {
    return `Avisar ${rotuloVet} pelo WhatsApp oficial`;
  }
  return "Avisar clínica pelo WhatsApp oficial";
}

export function resumirRespostaAvisoWhatsApp(
  resposta: RespostaAvisoWhatsApp | null | undefined
): { texto: string; tom: "sucesso" | "alerta" } {
  const clinicaEnviada = resposta?.clinica?.status === "enviado";
  const parceiroEnviado = resposta?.veterinario_parceiro?.status === "enviado";
  const parceiroFalhou = resposta?.veterinario_parceiro?.status === "falhou";
  const erroParceiro =
    resposta?.veterinario_parceiro?.erro?.trim() || "erro no envio pelo WhatsApp oficial.";

  if (parceiroFalhou) {
    const inicio = clinicaEnviada
      ? "Aviso enviado para a clínica, mas o envio para o veterinário parceiro falhou: "
      : "O envio para o veterinário parceiro falhou: ";
    return { texto: `${inicio}${erroParceiro}`, tom: "alerta" };
  }

  if (clinicaEnviada && parceiroEnviado) {
    return {
      texto: "Aviso enviado para a clínica e para o veterinário parceiro pelo WhatsApp oficial da Fort Cordis.",
      tom: "sucesso",
    };
  }
  if (parceiroEnviado) {
    return {
      texto: "Aviso enviado para o veterinário parceiro pelo WhatsApp oficial da Fort Cordis.",
      tom: "sucesso",
    };
  }
  return {
    texto: "Aviso enviado pelo WhatsApp oficial da Fort Cordis.",
    tom: "sucesso",
  };
}
