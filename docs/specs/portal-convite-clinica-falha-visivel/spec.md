# Spec - portal-convite-clinica-falha-visivel

Data: 2026-09-15  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

Backend. `backend/app/api/v1/endpoints/portal_clinic_auth.py`, no tratamento de
falha do envio do convite por WhatsApp. Sem mudanca de contrato, de frontend ou
de quando o envio ocorre.

## 2) Requisitos funcionais

- RF-001: falha no envio por WhatsApp gera registro em log com o motivo e o id
  da clinica.
- RF-002: quando o chamador nao aceita copia manual (`allow_manual_copy: false`),
  o `502` traz o motivo real, nao um texto generico.
- RF-003: condicao de ambiente (`HTTPException` do servico de entrega, como
  "integracao nao configurada") e falha de envio
  (`WhatsAppTemplateDeliveryError`, como "template not approved") sao tratadas
  separadamente -- na primeira, o `detail` original e a mensagem util.
- RF-004: o fallback para copia manual continua igual. O convite e criado e o
  link segue valido mesmo quando o WhatsApp falha.
- RF-005: o log nao contem numero de destino nem token.

## 3) Requisitos tecnicos

- RT-001: `logger = logging.getLogger(__name__)`, no padrao ja usado em
  `agenda.py`, `atendimento.py`, `portal.py` e `whatsapp_agenda.py`.
- RT-002: dois `except` -- `HTTPException` antes de `Exception`, porque
  `HTTPException` herda de `Exception` e a ordem inversa a engoliria.
- RT-003: `exc_info=True` apenas no ramo generico. No de ambiente o `detail` ja
  diz tudo, e stack trace ali so polui.
- RT-004: `raise ... from exc` nos dois, preservando a cadeia.

## 4) Criterios de aceitacao

- CA-001: com o servico recusando o modelo e `allow_manual_copy: false`, o `502`
  contem `template not approved`.
- CA-002: com `WHATSAPP_AGENDA_INTERNAL_TOKEN` vazio e `allow_manual_copy:
  false`, o `502` contem `nao configurada`.
- CA-003: com `allow_manual_copy: true`, o comportamento nao muda -- `200`,
  `delivery_status: "manual_copy"`, `delivery_provider: null` e link valido.
- CA-004: a suite `test_portal_clinic_invite_auth` passa inteira.

## 5) Fora de escopo

- Campo de erro na resposta e exibicao na interface (ver `intent.md`, secao 5).
- Causa raiz da falha em stage.
- Os demais `except` do arquivo.
