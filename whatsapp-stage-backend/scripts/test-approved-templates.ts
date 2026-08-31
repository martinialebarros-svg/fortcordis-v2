import assert from "assert";
import axios from "axios";
import { sendWhatsAppApprovedUtilityTemplateWithRetry } from "../src/services/whatsappService";
import {
  APPROVED_TEMPLATE_LANGUAGE,
  APPROVED_UTILITY_TEMPLATES,
  getTemplateBodyParameterCount,
  renderApprovedTemplateBody
} from "../src/templates/approvedTemplates";

async function run(): Promise<void> {
  const expectedCatalog = {
    reservation: ["reserva_de_agendamento", "1850190569695780", 5, 2],
    appointmentReminder: ["lembrete_de_agendamento", "2196951517539589", 4, 2],
    appointmentChange: ["alteracao_de_agendamento", "1325207582741137", 4, 2],
    appointmentCancellation: ["cancelamento_de_agendamento", "1072585772303343", 4, 2],
    appointmentMissingData: ["dados_pendentes_agendamento", "2094851784715594", 4, 2],
    appointmentFormalized: ["agendamento_formalizado", "PENDING_META_APPROVAL", 7, 0],
    portalReportAvailable: ["laudo_disponivel_portal", "1682393009502350", 3, 0],
    receiptAvailable: ["recibo_disponivel", "934407008986859", 4, 1],
    receiptPdf: ["recibo_pagamento_pdf", "1025876410335393", 7, 1],
    receiptPdfBulk: ["recibo_pagamento_pdf_multiplas_os", "940165775772306", 3, 1],
    pendingPaymentReminder: ["lembrete_pagamento_pendente_detalhado", "1265598002271332", 7, 2],
    pendingPaymentReminderBulk: ["lembrete_pagamento_pendente_multiplas_os", "1574210064240409", 4, 2],
    portalClinicInviteActivation: ["convite_portal_clinica_v2", "1402681525155612", 3, 0],
    portalClinicInviteLoginAccess: ["acesso_portal_clinica", "1758345232162346", 3, 0],
    portalClinicInviteTemporaryPassword: ["senha_temporaria_portal_clinica", "1087880320425546", 4, 0]
  } as const;

  assert.strictEqual(Object.keys(APPROVED_UTILITY_TEMPLATES).length, 15);
  assert.strictEqual(APPROVED_TEMPLATE_LANGUAGE, "pt_BR");
  for (const [templateKey, definition] of Object.entries(APPROVED_UTILITY_TEMPLATES)) {
    const expected = expectedCatalog[templateKey as keyof typeof expectedCatalog];
    assert.deepStrictEqual(
      [
        definition.name,
        definition.metaId,
        getTemplateBodyParameterCount(templateKey as keyof typeof APPROVED_UTILITY_TEMPLATES),
        definition.quickReplies.length
      ],
      expected
    );
    assert.strictEqual(
      definition.quickReplies.length,
      definition.buttonActions.length,
      `${templateKey} must keep quick replies and actions aligned`
    );
  }
  assert.strictEqual(getTemplateBodyParameterCount("reservation"), 5);
  assert.strictEqual(getTemplateBodyParameterCount("portalReportAvailable"), 3);
  assert.strictEqual(
    renderApprovedTemplateBody("reservation", [
      "Animal Care",
      "gamora",
      "15/08/2026",
      "09:00",
      "14/08/2026 às 21:02"
    ]),
    "Olá, Animal Care. A Fort Cordis reservou o atendimento de gamora para 15/08/2026, às 09:00. " +
      "Confirme até 14/08/2026 às 21:02. Após esse prazo, o horário poderá ser disponibilizado para outros clientes automaticamente."
  );
  assert.throws(
    () => renderApprovedTemplateBody("receiptAvailable", ["Animal Care"]),
    /expects 4 body parameters/
  );

  const originalPost = axios.post;
  const capturedPayloads: any[] = [];
  try {
    (axios.post as unknown as (url: string, payload: unknown) => Promise<unknown>) = async (_url, payload) => {
      capturedPayloads.push(payload);
      return {
        data: {
          messaging_product: "whatsapp",
          messages: [{ id: `wamid.approved.${capturedPayloads.length}` }]
        }
      };
    };

    await sendWhatsAppApprovedUtilityTemplateWithRetry({
      phoneNumberId: "1279142515283484",
      accessToken: "secret-token",
      to: "558588281436",
      templateKey: "portalReportAvailable",
      bodyParameters: ["Animal Care", "Ecocardiograma", "gamora"],
      quickReplyPayloads: []
    });
    await sendWhatsAppApprovedUtilityTemplateWithRetry({
      phoneNumberId: "1279142515283484",
      accessToken: "secret-token",
      to: "558588281436",
      templateKey: "pendingPaymentReminder",
      bodyParameters: [
        "Animal Care",
        "12345",
        "Ecocardiograma",
        "15/08/2026",
        "Maria",
        "gamora",
        "R$ 350,00"
      ],
      quickReplyPayloads: ["payment-confirmed-token", "finance-contact-token"]
    });

    assert.strictEqual(capturedPayloads[0].template.name, "laudo_disponivel_portal");
    assert.strictEqual(capturedPayloads[0].template.language.code, "pt_BR");
    assert.strictEqual(capturedPayloads[0].template.components.length, 1);
    assert.strictEqual(capturedPayloads[1].template.name, "lembrete_pagamento_pendente_detalhado");
    assert.strictEqual(capturedPayloads[1].template.components.length, 3);
    assert.deepStrictEqual(capturedPayloads[1].template.components[2], {
      type: "button",
      sub_type: "quick_reply",
      index: "1",
      parameters: [{ type: "payload", payload: "finance-contact-token" }]
    });

    await assert.rejects(
      () =>
        sendWhatsAppApprovedUtilityTemplateWithRetry({
          phoneNumberId: "1279142515283484",
          accessToken: "secret-token",
          to: "558588281436",
          templateKey: "appointmentReminder",
          bodyParameters: ["Animal Care"],
          quickReplyPayloads: []
        }),
      /expects 4 body parameters/
    );
    assert.strictEqual(capturedPayloads.length, 2);
  } finally {
    axios.post = originalPost;
  }

  console.log("Approved template catalog and payload tests passed.");
}

void run().catch((error) => {
  console.error("Approved template catalog test failed:", error);
  process.exit(1);
});
