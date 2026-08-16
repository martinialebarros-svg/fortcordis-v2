export const APPROVED_TEMPLATE_LANGUAGE = "pt_BR" as const;

export const APPROVED_UTILITY_TEMPLATES = {
  reservation: {
    name: "reserva_de_agendamento",
    metaId: "1850190569695780",
    body:
      "Olá, {{1}}. A Fort Cordis reservou o atendimento de {{2}} para {{3}}, às {{4}}. " +
      "Confirme até {{5}}. Após esse prazo, o horário poderá ser disponibilizado para outros clientes automaticamente.",
    quickReplies: ["Confirmar", "Solicitar alteração"],
    buttonActions: ["confirmar", "solicitar_alteracao"]
  },
  appointmentReminder: {
    name: "lembrete_de_agendamento",
    metaId: "2196951517539589",
    body:
      "Olá, {{1}}. Lembramos que o atendimento de {{2}} está confirmado para {{3}}, às {{4}}. " +
      "Se precisar alterar o horário, use uma das opções abaixo.",
    quickReplies: ["Confirmar presença", "Solicitar alteração"],
    buttonActions: ["confirmar_presenca", "solicitar_alteracao"]
  },
  appointmentChange: {
    name: "alteracao_de_agendamento",
    metaId: "1325207582741137",
    body:
      "Olá, {{1}}. O atendimento de {{2}} foi alterado para {{3}}, às {{4}}. " +
      "Confirme se o novo horário funciona para você.",
    quickReplies: ["Confirmar horário", "Solicitar alteração"],
    buttonActions: ["confirmar_horario", "solicitar_alteracao"]
  },
  appointmentCancellation: {
    name: "cancelamento_de_agendamento",
    metaId: "1072585772303343",
    body:
      "Olá, {{1}}. O atendimento de {{2}}, previsto para {{3}}, às {{4}}, foi cancelado. " +
      "Se desejar, solicite um novo horário.",
    quickReplies: ["Solicitar novo horário", "Falar com a equipe"],
    buttonActions: ["solicitar_novo_horario", "falar_equipe"]
  },
  appointmentMissingData: {
    name: "dados_pendentes_agendamento",
    metaId: "2094851784715594",
    body:
      "Olá, {{1}}. Para concluir o atendimento de {{2}} em {{3}}, às {{4}}, precisamos confirmar os dados " +
      "do tutor e do paciente. Responda a esta mensagem para continuarmos.",
    quickReplies: ["Enviar dados", "Falar com a equipe"],
    buttonActions: ["enviar_dados", "falar_equipe"]
  },
  portalReportAvailable: {
    name: "laudo_disponivel_portal",
    metaId: "1682393009502350",
    body:
      "Olá, {{1}}. O laudo do exame {{2}} de {{3}} já está disponível no Portal Fort Cordis. " +
      "Por segurança, consulte o resultado diretamente no portal.",
    quickReplies: [],
    buttonActions: []
  },
  receiptAvailable: {
    name: "recibo_disponivel",
    metaId: "934407008986859",
    body: "Olá, {{1}}. O recibo da OS {{2}}, referente ao atendimento de {{3}}, no valor de {{4}}, está disponível.",
    quickReplies: ["Falar com financeiro"],
    buttonActions: ["falar_financeiro"]
  },
  receiptPdf: {
    name: "recibo_pagamento_pdf",
    metaId: "1025876410335393",
    headerType: "document",
    body:
      "Olá, {{1}}. Confirmamos o recebimento da OS {{2}}, referente ao serviço {{3}}, realizado em {{4}}, " +
      "para o tutor {{5}} e o pet {{6}}, no valor de {{7}}. O recibo detalhado está anexado em PDF.",
    quickReplies: ["Falar com financeiro"],
    buttonActions: ["falar_financeiro"]
  },
  receiptPdfBulk: {
    name: "recibo_pagamento_pdf_multiplas_os",
    metaId: "940165775772306",
    headerType: "document",
    body:
      "Olá, {{1}}. Confirmamos o recebimento de {{2}} ordens de serviço, no total de {{3}}. " +
      "O recibo consolidado com OS, datas, serviços, tutores e pets está anexado em PDF.",
    quickReplies: ["Falar com financeiro"],
    buttonActions: ["falar_financeiro"]
  },
  pendingPaymentReminder: {
    name: "lembrete_pagamento_pendente_detalhado",
    metaId: "1265598002271332",
    body:
      "Olá, {{1}}. A OS {{2}}, referente ao serviço {{3}}, realizado em {{4}}, para o tutor {{5}} e o pet {{6}}, " +
      "continua pendente no valor de {{7}}. " +
      "Se o pagamento já foi realizado, desconsidere esta mensagem.",
    quickReplies: ["Já paguei", "Falar com financeiro"],
    buttonActions: ["ja_paguei", "falar_financeiro"]
  },
  pendingPaymentReminderBulk: {
    name: "lembrete_pagamento_pendente_multiplas_os",
    metaId: "1574210064240409",
    body:
      "Olá, {{1}}. Identificamos {{2}} ordens de serviço pendentes, no total de {{3}}. " +
      "Detalhamento: {{4}}. Se o pagamento já foi realizado, desconsidere esta mensagem.",
    quickReplies: ["Já paguei", "Falar com financeiro"],
    buttonActions: ["ja_paguei", "falar_financeiro"]
  }
} as const;

export type ApprovedUtilityTemplateKey = keyof typeof APPROVED_UTILITY_TEMPLATES;

export function templateRequiresDocumentHeader(templateKey: ApprovedUtilityTemplateKey): boolean {
  const definition = APPROVED_UTILITY_TEMPLATES[templateKey];
  return "headerType" in definition && definition.headerType === "document";
}

export function getTemplateBodyParameterCount(templateKey: ApprovedUtilityTemplateKey): number {
  const matches = APPROVED_UTILITY_TEMPLATES[templateKey].body.match(/\{\{\d+\}\}/g);
  return matches?.length ?? 0;
}

export function renderApprovedTemplateBody(
  templateKey: ApprovedUtilityTemplateKey,
  bodyParameters: readonly string[]
): string {
  const definition = APPROVED_UTILITY_TEMPLATES[templateKey];
  const expected = getTemplateBodyParameterCount(templateKey);
  if (bodyParameters.length !== expected) {
    throw new Error(
      `Template '${definition.name}' expects ${expected} body parameters, received ${bodyParameters.length}`
    );
  }

  return definition.body.replace(/\{\{(\d+)\}\}/g, (_placeholder, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    return bodyParameters[index];
  });
}
