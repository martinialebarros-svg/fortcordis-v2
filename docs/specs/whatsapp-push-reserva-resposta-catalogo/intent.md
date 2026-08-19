# Intent - whatsapp-push-reserva-resposta-catalogo

## Problema

Quando um paciente responde a um botão de confirmação de reserva pelo
WhatsApp, `backend/app/api/v1/endpoints/whatsapp_agenda.py` chama
`_notificar_agenda_update(db, action="whatsapp_reserva_resposta", ...)`
para avisar a equipe via push. Só que `"whatsapp_reserva_resposta"` nunca
foi cadastrada em `AGENDA_PUSH_ACTIONS_ORDER`
(`backend/app/services/push_notifications.py`). Como
`normalize_agenda_push_actions` descarta silenciosamente qualquer valor
fora desse catálogo, e `_get_target_subscriptions` filtra assinaturas por
`allowed_actions`, esse push nunca notificava ninguém — bug latente,
silencioso, sem erro visível em log algum.

## Objetivo

Fazer o push de resposta de WhatsApp chegar de fato às assinaturas
elegíveis, com título e corpo que reflitam o resultado real da resposta
(confirmado, já confirmado, fora do prazo, dados pendentes, revisão
manual, alteração solicitada, agendamento não encontrado) em vez do
fallback genérico "Agenda atualizada #N".

## Escopo inicial

- adicionar `"whatsapp_reserva_resposta"` a `AGENDA_PUSH_ACTIONS_ORDER`;
- opção correspondente no painel de preferências de Configurações
  (`TIPOS_PUSH_AGENDA_OPCOES`), mesmo padrão dos demais tipos de push da
  agenda;
- título/corpo dedicados em `_build_agenda_title`/`_build_agenda_body`
  para os 7 resultados possíveis de `process_button_response`
  (`backend/app/services/whatsapp_agenda_service.py`).

## Fora de escopo

- enriquecer o payload de `process_button_response` com nome do
  paciente/clínica/serviço (hoje só carrega `agendamento_id`, `action`,
  `result`, `status`) — o corpo da notificação usa esses campos, não os
  denormalizados do agendamento;
- mudar o catálogo `HIGH_PRIORITY_DEFAULT_ACTIONS_ORDER` — o novo tipo
  fica com prioridade normal por padrão, igual aos demais eventos de
  agenda.

## Riscos e decisões

- Adicionar um valor no fim de `AGENDA_PUSH_ACTIONS_ORDER` é aditivo: não
  reordena nem invalida preferências já salvas de usuários existentes
  (que guardam a lista serializada, não índices).
- Usuários sem preferência salva (`notificacoes_push_tipos is None`) já
  recebem todos os tipos por padrão — o novo tipo passa a chegar para
  eles automaticamente. Usuários que já customizaram a lista não vão
  receber o novo tipo até revisitarem Configurações; mesmo comportamento
  usado sempre que um tipo novo é adicionado ao catálogo.
- `_build_agenda_body` passou a receber `action` como parâmetro (antes só
  recebia `data`) porque o payload dessa ação não tem `paciente_nome`/
  `clinica_nome`/etc. — precisa de um branch dedicado baseado no
  resultado (`data.get("result")"), não nos campos genéricos da agenda.
  Única chamada no repo, sem outros usos a atualizar.
