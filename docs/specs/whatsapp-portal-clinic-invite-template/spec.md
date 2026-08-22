# Spec - whatsapp-portal-clinic-invite-template

Data: 2026-08-22
Responsavel: Martiniano + Claude
Status: codigo pronto, aguardando aprovacao da Meta para os 3 modelos novos

## 1) Contexto

O convite de acesso ao Portal Clinicas (`POST /portal/admin/clinicas/{id}/convites`) so conseguia
enviar a mensagem automaticamente por um webhook generico de terceiros (`PORTAL_WHATSAPP_ENABLED` +
`PORTAL_WHATSAPP_WEBHOOK_URL`), nunca configurado em stage/producao. Na pratica, o unico caminho
real de envio era o operador copiar o texto e mandar pelo proprio WhatsApp pessoal - o botao
"Abrir no WhatsApp" abria o aplicativo local (`wa.me`), o que nao e o comportamento desejado.

Esta mudanca substitui esse caminho pelo mesmo canal WhatsApp Business (Meta Cloud API) que o
modulo de Atendimento ja usa para lembrete de consulta, recibo e aviso de laudo
(`whatsapp-approved-template-catalog`), reaproveitando a mesma integracao interna
(`WHATSAPP_AGENDA_ENABLED` / `WHATSAPP_AGENDA_SERVICE_URL` / `/automation/templates`).

## 2) Requisitos funcionais

- RF-001: o catalogo de modelos aprovados ganha 3 chaves novas, todas com `subject_type: "clinica"`:
  `portalClinicInviteActivation` (3 variaveis), `portalClinicInviteLoginAccess` (3 variaveis) e
  `portalClinicInviteTemporaryPassword` (4 variaveis).
- RF-002: os 3 modelos ficam de fora do catalogo consultado pela caixa de entrada
  (`GET /automation/templates` / `listApprovedTemplateCatalog`) - sao disparados apenas pelo fluxo
  automatizado do convite, nunca pela escolha manual do atendente numa conversa.
- RF-003: `criar_convite_clinica` passa a chamar `send_approved_utility_template` (o mesmo servico
  usado pela Agenda) em vez do webhook generico do portal; o gate deixa de ser
  `PORTAL_WHATSAPP_ENABLED` e passa a ser `WHATSAPP_AGENDA_ENABLED`.
- RF-004: o numero de destino informado pelo operador e normalizado para o formato internacional
  (`normalize_whatsapp_number`, prefixo `55`) antes do envio, pois o servico Node exige 12-15
  digitos.
- RF-005: cada tentativa de envio usa uma chave de idempotencia dedicada (`portal-clinic-invite-*`,
  `portal-clinic-login-*` ou `portal-clinic-temp-password-*`), permitindo reenvio explicito sem
  colidir com o registro anterior.
- RF-006: falha no envio (modelo ainda nao aprovado, servico indisponivel, etc.) cai de volta para
  `delivery_status = "manual_copy"` sem quebrar a criacao do convite, exatamente como o
  comportamento anterior.
- RF-007: a UI (card de acesso na pagina da clinica e menu "Portal das clinicas") ganha um botao
  "Reenviar pelo WhatsApp" que chama esse mesmo backend; nao existe mais nenhum botao que abra
  `wa.me`/WhatsApp externo nesses dois lugares.

## 3) Requisitos nao funcionais

- NFR-001 (aprovacao pendente): os 3 modelos usam `metaId: "PENDING_META_APPROVAL"`, seguindo o
  mesmo padrao do `appointmentFormalized`; o envio real so funciona depois da aprovacao no Business
  Manager da Meta. Enquanto isso, o envio falha de forma controlada e cai para copia manual.
- NFR-002 (fail closed): igual ao restante do catalogo - quantidade de variaveis incorreta falha
  antes da chamada externa.
- NFR-003 (escopo): esta mudanca cobre apenas o convite de **clinicas parceiras**
  (`portal_clinic_auth.py`); o fluxo de veterinario parceiro (`portal_partner_auth.py`) e o codigo
  de acesso/MFA do portal (`send_portal_access_code`) continuam usando os mecanismos que já tinham,
  sem alteracao.

## 4) Fora de escopo

- aprovacao efetiva dos 3 modelos no Business Manager da Meta (passo operacional, fora do codigo);
- exposicao desses modelos no seletor manual de templates da caixa de entrada do Atendimento;
- alteracao do fluxo de convite do veterinario parceiro externo.

## 5) Criterios de aceitacao

- CA-001: `npm run build` (tsc) e o teste `test:approved-templates` do `whatsapp-stage-backend`
  passam com os 15 modelos (12 antigos + 3 novos).
- CA-002: `test-inbox-ui-contracts.ts` continua contando exatamente 12 modelos expostos na caixa de
  entrada (os 3 novos ficam fora).
- CA-003: testes Python cobrem o envio com sucesso (`delivery_status = "sent"`,
  `delivery_provider = "whatsapp_business_template"`, payload com `template_key`, `subject_type`,
  `destination` normalizado) e a degradacao para `manual_copy` quando o envio falha.
- CA-004: suites completas de backend (`pytest`) e frontend (`vitest`, `tsc`, `eslint`) passam sem
  regressao.
