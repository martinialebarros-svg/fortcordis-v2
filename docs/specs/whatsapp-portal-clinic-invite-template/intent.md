# Intent - whatsapp-portal-clinic-invite-template

## Problema

Usuário pediu um botão de "enviar pelo WhatsApp" o convite de acesso ao Portal Clínicas, tanto no
card de acesso da clínica (`/clinicas/{id}`) quanto no menu "Portal das clínicas"
(`/clinicas/portal`). Uma primeira versão adicionou um botão "Abrir no WhatsApp" que só montava um
link `wa.me` e abria o WhatsApp local (desktop/app) - usuário rejeitou: "não é isso que eu quero.
Quero a função de enviar pelo whatsapp interno do fortcordis".

## Diagnóstico

Investigação revelou dois mecanismos de envio de WhatsApp completamente distintos no sistema:

1. **Canal genérico do Portal** (`send_portal_whatsapp_message` / `PORTAL_WHATSAPP_ENABLED` /
   `PORTAL_WHATSAPP_WEBHOOK_URL`): já existia no código do convite, mas nunca foi configurado em
   stage/produção - o próprio spec `portal-secure-access-foundation` documenta que o canal WhatsApp
   fica bloqueado até a "liberação da API do WhatsApp Business pela Meta". Não reaproveita nenhuma
   infraestrutura do módulo de Atendimento.
2. **WhatsApp Business real do Atendimento** (Meta Cloud API, via `whatsapp-stage-backend`):
   já usado em produção para lembrete de consulta, recibo e aviso de laudo, através de um catálogo
   fechado de modelos aprovados pela Meta (`approvedTemplates.ts` +
   `send_approved_utility_template`).

Perguntado qual dos dois usar, o usuário escolheu explicitamente o mecanismo (2) - "mesmo número do
Atendimento" - mesmo sabendo que isso exige submeter novos modelos de mensagem para aprovação da
Meta antes do envio automático funcionar de fato (mensagem de texto livre para um número "frio" que
não escreveu nas últimas 24h é estruturalmente impossível via WhatsApp Business API; só um modelo
aprovado contorna essa janela).

## Escopo desta implementação

- 3 modelos novos no catálogo do Atendimento (`portalClinicInviteActivation`,
  `portalClinicInviteLoginAccess`, `portalClinicInviteTemporaryPassword`), `subject_type: "clinica"`,
  fora do catálogo exposto à caixa de entrada (não são escolhíveis manualmente pelo atendente).
- `criar_convite_clinica` (`portal_clinic_auth.py`) passa a chamar `send_approved_utility_template`
  (o mesmo serviço da Agenda) em vez do webhook genérico; gate muda de `PORTAL_WHATSAPP_ENABLED`
  para `WHATSAPP_AGENDA_ENABLED`.
- Normalização do número para formato internacional (`normalize_whatsapp_number`) antes do envio,
  já que o serviço Node exige 12-15 dígitos.
- Botão "Abrir no WhatsApp" (`wa.me`) removido dos dois lugares pedidos; substituído por "Reenviar
  pelo WhatsApp", que chama o backend diretamente (nenhum app externo abre).

## Fora de escopo (bloqueado por aprovação externa da Meta)

- Submissão e aprovação efetiva dos 3 modelos no Business Manager da Meta - passo que só o usuário
  pode fazer (usuário optou por submeter manualmente pelo próprio WhatsApp Manager; os textos e
  variáveis de exemplo foram fornecidos prontos para colar). Até a aprovação sair, o envio cai de
  volta para `delivery_status = "manual_copy"` sem quebrar a criação do convite - mesmo
  comportamento de fallback que já existia antes desta mudança.
- Atualizar `metaId` em `approvedTemplates.ts` de `PENDING_META_APPROVAL` para o ID real - fica para
  quando o usuário trouxer os 3 IDs aprovados.
- Fluxo de convite do veterinário parceiro externo (`portal_partner_auth.py`) e o código de
  acesso/MFA do portal (`send_portal_access_code`) - fora do escopo pedido ("clínicas parceiras").

## Riscos e decisões

- Cada tentativa de envio usa uma chave de idempotência própria (`portal-clinic-invite-*` etc.),
  permitindo reenvio explícito sem colidir com o registro anterior no serviço Node.
- Os 3 modelos novos ficam fora do catálogo da caixa de entrada do Atendimento (`Partial<Record<...>>`
  em `templateCatalogController.ts`) porque carregam parâmetros estruturados (link de ativação,
  senha temporária) que não fazem sentido escolher manualmente no meio de uma conversa.
