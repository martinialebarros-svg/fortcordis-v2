# Plan - whatsapp-equipe-atendentes-edicao

## Fase 1 - contrato

- [x] P1.1 adicionar `updateAgent` em `agentsController.ts` com atualização
  parcial validada campo a campo;
- [x] P1.2 registrar `PATCH /agents/:id` em `app.ts`, reaproveitando
  `requireApiAuth`.

## Fase 2 - interface

- [x] P2.1 estado de edição inline (`editingAgentId` e campos do formulário)
  na página `whatsapp-stage`;
- [x] P2.2 formulário de edição por atendente com Salvar/Cancelar;
- [x] P2.3 ação rápida de "Desativar"/"Reativar";
- [x] P2.4 estilos `fc-wa-agent-edit*` / `fc-wa-agent-actions` no
  `globals.css`.

## Fase 3 - verificação

- [x] P3.1 testar `PATCH /agents/:id` via `curl` (edição parcial, toggle de
  status, 404, validação de email vazio);
- [x] P3.2 adicionar teste de componente cobrindo editar e desativar um
  atendente pela UI;
- [x] P3.3 executar TypeScript, lint direcionado e testes frontend;
- [x] P3.4 executar `tsc --noEmit` no backend WhatsApp;
- [x] P3.5 executar o guardrail SDD sobre o conjunto alterado.

## Rollback

- Remover a rota `PATCH /agents/:id` e o botão/formulário de edição restaura
  o comportamento anterior (somente cadastro e listagem).
- Não há migração de banco envolvida; a mudança usa apenas colunas já
  existentes em `agents`.
