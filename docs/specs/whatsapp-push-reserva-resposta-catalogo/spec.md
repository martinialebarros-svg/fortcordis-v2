# Spec - whatsapp-push-reserva-resposta-catalogo

## Requisitos funcionais

- RF-001: `"whatsapp_reserva_resposta"` está em `AGENDA_PUSH_ACTIONS_ORDER`
  (`backend/app/services/push_notifications.py`), portanto em
  `PUSH_ACTIONS_ORDER`/`PUSH_ACTIONS_SET`; `normalize_agenda_push_actions`
  não descarta mais esse valor.
- RF-002: `_get_target_subscriptions` passa a incluir assinaturas cuja
  `allowed_actions` contenha (ou não restrinja, quando preferência é
  default) `"whatsapp_reserva_resposta"`.
- RF-003: `_build_agenda_title` retorna um título específico por
  resultado de `process_button_response` (`data.get("result")`):
  `confirmado`, `ja_confirmado`, `confirmacao_apos_prazo`,
  `confirmacao_dados_pendentes`, `revisao_manual`, `alteracao_solicitada`,
  `agendamento_nao_encontrado`; resultado desconhecido cai num texto
  genérico ("Resposta do WhatsApp recebida"), nunca no fallback antigo
  "Agenda atualizada #N".
- RF-004: `_build_agenda_body` (agora recebendo `action` além de `data`)
  retorna um corpo específico para a mesma lista de resultados, incluindo
  o `status` atual do agendamento quando disponível.
- RF-005: `TIPOS_PUSH_AGENDA_OPCOES`
  (`frontend/app/configuracoes/page.tsx`) ganha a opção
  `"whatsapp_reserva_resposta"` ("Resposta do WhatsApp"), aparecendo no
  painel de preferências de push da agenda e no toggle
  `alternarTipoPushAgenda` (que já itera sobre esse array).

## Requisitos não funcionais

- NFR-001 (compatibilidade): mudança é aditiva no catálogo — não
  reordena nem remove nenhum valor existente; preferências já salvas
  continuam válidas.
- NFR-002 (sem regressão de assinatura): usuários sem preferência
  explícita (default = todos os tipos) passam a receber o novo tipo sem
  qualquer ação manual.

## Contratos técnicos

### Backend

- `AGENDA_PUSH_ACTIONS_ORDER` (tupla, `backend/app/services/push_notifications.py`):
  adiciona `"whatsapp_reserva_resposta"` como último elemento.
- `_build_agenda_body(action: str, data: dict) -> str`: assinatura
  alterada (antes só `data`); único call site é
  `send_agenda_push_notification`, atualizado junto.
- Nenhuma migração de banco necessária — catálogo e preferências vivem em
  código Python e na coluna texto serializada
  `configuracoes_usuario.notificacoes_push_tipos`.

### Frontend

- `TIPOS_PUSH_AGENDA_OPCOES` (`frontend/app/configuracoes/page.tsx`):
  novo item `{ valor: "whatsapp_reserva_resposta", label: "Resposta do
  WhatsApp", descricao: "..." }`. Renderização do painel e do toggle já
  iteram sobre o array — nenhuma outra mudança de tela necessária.

## Compatibilidade e rollout

- Backward compatibility: total — valor novo é aditivo ao catálogo, sem
  quebrar preferências existentes.
- Feature flag: nenhuma; segue o mesmo modelo on/off por tipo já usado
  pelos demais eventos de push da agenda.
- Rollback: reverter o commit remove a ação do catálogo e ela volta a ser
  descartada silenciosamente (comportamento anterior, não uma regressão
  nova).

## Critérios de aceitação

- CA-001: com a ação registrada no catálogo, uma resposta de confirmação
  via WhatsApp gera push para assinaturas com
  `notificacoes_push_tipos` default (`None`) ou que incluam
  `"whatsapp_reserva_resposta"` explicitamente.
- CA-002: o título/corpo do push refletem o resultado real
  (`process_button_response`), não o fallback genérico.
- CA-003: a opção aparece em Configurações → painel de push da agenda,
  pode ser marcada/desmarcada como as demais.

## Casos de borda

- CB-001: `data.get("result")` fora do dicionário de mapeamento (valor
  inesperado) cai no texto genérico de título/corpo, sem erro.
- CB-002: usuário com `notificacoes_push_tipos` customizado antes desta
  mudança não recebe o novo tipo até revisitar Configurações (mesmo
  comportamento de qualquer tipo novo adicionado ao catálogo).

## Fora de escopo

- Enriquecer `process_button_response`/payload com nome de
  paciente/clínica/serviço.
- Mudar prioridade padrão (`HIGH_PRIORITY_DEFAULT_ACTIONS_ORDER`) para
  incluir o novo tipo.
