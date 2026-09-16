import { describe, expect, it } from "vitest";

import {
  getConfirmacaoAvisoWhatsApp,
  getDestinosAvisoWhatsApp,
  getTituloBotaoAvisoWhatsApp,
  podeAvisarWhatsApp,
  resumirRespostaAvisoWhatsApp,
} from "./laudo-whatsapp-aviso";

const laudoClinicaELiberadoParaParceiro = {
  status: "Liberado no portal",
  clinica: "Gram Pet",
  clinic_id: 8,
  portal_clinica_liberado: true,
  veterinario_parceiro_id: 4,
  veterinario_parceiro_nome: "Dra Isadora Bastos",
  portal_veterinario_liberado: true,
};

describe("destinos do aviso por WhatsApp", () => {
  it("inclui clinica e parceiro quando os dois estao liberados no portal", () => {
    expect(getDestinosAvisoWhatsApp(laudoClinicaELiberadoParaParceiro)).toEqual([
      "clinica",
      "veterinario_parceiro",
    ]);
  });

  it("deixa o parceiro de fora enquanto ele nao tem liberacao no portal", () => {
    expect(
      getDestinosAvisoWhatsApp({
        ...laudoClinicaELiberadoParaParceiro,
        portal_veterinario_liberado: false,
      })
    ).toEqual(["clinica"]);
  });

  it("aceita laudo so com parceiro, sem clinica vinculada", () => {
    const laudo = {
      status: "Liberado no portal",
      clinic_id: null,
      veterinario_parceiro_id: 4,
      veterinario_parceiro_nome: "Dra Isadora Bastos",
      portal_veterinario_liberado: true,
    };
    expect(getDestinosAvisoWhatsApp(laudo)).toEqual(["veterinario_parceiro"]);
    expect(podeAvisarWhatsApp(laudo)).toBe(true);
  });

  it("nao oferece o aviso quando nenhum destino esta liberado", () => {
    expect(
      podeAvisarWhatsApp({
        status: "Rascunho",
        clinic_id: 8,
        portal_clinica_liberado: false,
        veterinario_parceiro_id: 4,
        portal_veterinario_liberado: false,
      })
    ).toBe(false);
  });
});

describe("textos de confirmacao e titulo", () => {
  it("nomeia os dois destinatarios na confirmacao", () => {
    expect(getConfirmacaoAvisoWhatsApp(laudoClinicaELiberadoParaParceiro)).toBe(
      "Enviar para Gram Pet e Dra Isadora Bastos o aviso de laudo disponível?"
    );
    expect(getTituloBotaoAvisoWhatsApp(laudoClinicaELiberadoParaParceiro)).toBe(
      "Avisar clínica e veterinário parceiro pelo WhatsApp oficial"
    );
  });

  it("nomeia so a clinica quando o parceiro nao entra no envio", () => {
    const laudo = { ...laudoClinicaELiberadoParaParceiro, portal_veterinario_liberado: false };
    expect(getConfirmacaoAvisoWhatsApp(laudo)).toBe(
      "Enviar para Gram Pet o aviso de laudo disponível?"
    );
    expect(getTituloBotaoAvisoWhatsApp(laudo)).toBe("Avisar clínica pelo WhatsApp oficial");
  });

  it("nomeia so o parceiro em laudo sem clinica", () => {
    const laudo = {
      status: "Liberado no portal",
      clinic_id: null,
      veterinario_parceiro_id: 4,
      veterinario_parceiro_nome: "Dra Isadora Bastos",
      portal_veterinario_liberado: true,
    };
    expect(getConfirmacaoAvisoWhatsApp(laudo)).toBe(
      "Enviar para Dra Isadora Bastos o aviso de laudo disponível?"
    );
    expect(getTituloBotaoAvisoWhatsApp(laudo)).toBe(
      "Avisar veterinário parceiro pelo WhatsApp oficial"
    );
  });
});

describe("resumo da resposta do envio", () => {
  it("confirma os dois envios", () => {
    expect(
      resumirRespostaAvisoWhatsApp({
        clinica: { status: "enviado" },
        veterinario_parceiro: { status: "enviado" },
      })
    ).toEqual({
      texto:
        "Aviso enviado para a clínica e para o veterinário parceiro pelo WhatsApp oficial da Fort Cordis.",
      tom: "sucesso",
    });
  });

  it("trata falha so do parceiro como alerta, com o erro do provedor", () => {
    const resumo = resumirRespostaAvisoWhatsApp({
      clinica: { status: "enviado" },
      veterinario_parceiro: { status: "falhou", erro: "Numero invalido no provedor." },
    });
    expect(resumo.tom).toBe("alerta");
    expect(resumo.texto).toContain("Numero invalido no provedor.");
    expect(resumo.texto).toContain("clínica");
  });

  it("nao inventa envio para a clinica quando so o parceiro foi avisado", () => {
    expect(
      resumirRespostaAvisoWhatsApp({
        clinica: { status: "ignorado", motivo: "sem_vinculo" },
        veterinario_parceiro: { status: "enviado" },
      })
    ).toEqual({
      texto: "Aviso enviado para o veterinário parceiro pelo WhatsApp oficial da Fort Cordis.",
      tom: "sucesso",
    });
  });

  it("cai no texto generico quando a resposta nao detalha os destinos", () => {
    expect(resumirRespostaAvisoWhatsApp(undefined)).toEqual({
      texto: "Aviso enviado pelo WhatsApp oficial da Fort Cordis.",
      tom: "sucesso",
    });
  });
});
