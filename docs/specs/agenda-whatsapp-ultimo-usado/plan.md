# Plan - agenda-whatsapp-ultimo-usado

Data: 2026-08-08
Status: concluido

## Tarefas

- [x] Helpers de `localStorage` (`obterUltimoWhatsappStorageKey`, `lerUltimoWhatsappSelecionado`,
      `salvarUltimoWhatsappSelecionado`) em `NovoAgendamentoModal.tsx`.
- [x] `MensagemAgendaPosCriacao` ganha `destinatarioId` e `telefoneSugerido`.
- [x] `construirMensagemAgendaPosCriacao` calcula `telefoneSugerido` a partir do numero lembrado.
- [x] Os dois pontos de selecao inicial (`gerarMensagemManualEdicao`, fluxo de criacao) usam
      `telefoneSugerido` em vez de `telefones[0]`.
- [x] `abrirWhatsAppMensagemAgenda` e `copiarMensagemAgenda` gravam o numero usado.

Criterio de conclusao: tsc/eslint limpos no arquivo alterado. Sem teste automatizado dedicado
(mesma limitacao de cobertura de componente ja registrada nas specs anteriores desta area — o
arquivo nao tem suite de testes de componente).

Rollback: reverter o commit; nenhuma migracao ou dado de backend envolvido.

## Plano de testes

- Automatizado: `tsc --noEmit`, `eslint` sobre o arquivo alterado — executados, sem erros.
- Manual: pendente (mesma limitacao das entregas anteriores nesta sessao — sem ambiente de UI
  interativo neste sandbox). Roteiro sugerido em `verify.md`.
