# Spec - whatsapp-atendente-auto-selecao

## Requisitos funcionais

- RF-001: um hook `useCurrentUser()` deve expor o usuário autenticado
  (`id`, `email`, `nome`, `ativo`, `papeis`) lido de
  `localStorage.getItem("user")`, retornando `null` quando ausente ou
  inválido.
- RF-002: ao carregar a Central de Atendimento, se nenhuma conversa
  selecionada tiver `last_agent_id`, o campo "Atribuir para"
  (`agentActionId`) deve pré-selecionar o atendente ativo cujo `email`
  corresponde (case-insensitive, com trim) ao email do usuário autenticado.
- RF-003: quando não houver atendente ativo com email correspondente, o
  comportamento anterior é preservado: seleciona o primeiro atendente ativo
  da lista.
- RF-004: quando a conversa selecionada já tiver `last_agent_id`, o campo
  continua refletindo esse atendente (comportamento inalterado).

## Requisitos não funcionais

- NFR-001 (robustez): comparação de email tolera diferenças de
  maiúsculas/minúsculas e espaços incidentais nos dois lados.
- NFR-002 (compatibilidade): nenhuma mudança de contrato de API; a lógica é
  inteiramente client-side sobre dados já carregados (`GET /agents`,
  `localStorage.user`).

## Critérios de aceitação

- CA-001: usuário logado com email correspondente a um atendente ativo →
  campo "Atribuir para" pré-selecionado com esse atendente.
- CA-002: usuário logado sem correspondência → campo pré-selecionado com o
  primeiro atendente ativo, igual ao comportamento anterior.
- CA-003: atendente inativo com email correspondente não é selecionado.
