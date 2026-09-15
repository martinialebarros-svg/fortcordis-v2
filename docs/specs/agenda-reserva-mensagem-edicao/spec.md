# Spec - agenda-reserva-mensagem-edicao

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: approved

## 1) Escopo funcional

No modal de edicao de agendamento (`NovoAgendamentoModal.tsx`), quando o agendamento editado e
uma reserva (`formData.marcar_como_reserva`, inicializado a partir de `status === "Reservado"`),
exibir a mesma secao de destinatario/WhatsApp usada na criacao, mais um botao "Gerar mensagem de
confirmacao". Ao clicar, a mensagem e montada com os dados atuais do formulario (mesma funcao
usada na criacao) e a mesma tela de mensagem pronta (copiar / abrir WhatsApp) e exibida, sem
salvar nem fechar o modal. Fechar essa tela (X ou botao secundario) em modo de edicao volta ao
formulario em vez de fechar o modal.

## 2) Requisitos funcionais (RF)

- RF-001: Ao editar um agendamento com `formData.marcar_como_reserva = true`, o modal exibe a
  secao de destinatario (clinica/tutor) e contato WhatsApp, hoje restrita ao modo de criacao.
- RF-002: A secao exibe um botao "Gerar mensagem de confirmacao", visivel apenas em modo de
  edicao.
- RF-003: Ao clicar no botao, a mensagem e construida com `montarMensagemAgendaManual` usando os
  valores atuais do formulario (paciente, tutor, clinica, servico, data/hora), preservando
  "Pendente" para campos ainda vazios.
- RF-004: A tela de mensagem gerada reaproveita a UI existente (textarea somente leitura, copiar
  mensagem, abrir WhatsApp, selecao de telefone quando houver mais de um).
- RF-005: Em modo de edicao, fechar a tela de mensagem (botao "Voltar ao formulario" ou X) retorna
  ao formulario de edicao sem fechar o modal e sem resetar o estado do formulario; em modo de
  criacao o comportamento atual (fechar o modal ao concluir) nao muda.
- RF-006: A tela de mensagem, quando aberta a partir do botao manual em modo de edicao, mostra um
  aviso indicando que a mensagem usa os dados atuais do formulario e que e necessario clicar em
  "Salvar Alteracoes" para persistir alteracoes pendentes.
- RF-007: O checkbox "marcar como reserva" e os campos de prazo de confirmacao continuam ocultos
  em modo de edicao; apenas destinatario + contato WhatsApp + botao de gerar mensagem passam a
  aparecer.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): geracao da mensagem e sincrona e local (sem chamada de rede); sem
  latencia perceptivel.
- NFR-002 (seguranca/permissoes): nenhuma mudanca de autorizacao; o botao usa os mesmos dados ja
  visiveis a quem pode editar o agendamento.
- NFR-003 (observabilidade): nao necessaria (mesma ausencia de auditoria do fluxo pos-criacao
  atual).

## 4) Contratos tecnicos

### API

- Nenhuma mudanca (feature 100% frontend).

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/agenda/NovoAgendamentoModal.tsx`.
- Estados reaproveitados: `mensagemAgendaCriada`, `whatsappMensagemSelecionado`,
  `feedbackMensagemAgenda` (nenhum estado novo).
- Funcao nova: `gerarMensagemManualEdicao` (chama `construirMensagemAgendaPosCriacao` existente).
- Regras de exibicao: secao de destinatario/botao aparecem apenas quando
  `!isEditando || formData.marcar_como_reserva`; botao "Gerar mensagem de confirmacao" e o aviso
  de dados atuais aparecem apenas quando `isEditando`.

## 5) Compatibilidade e rollout

- Backward compatibility: total; fluxo de criacao inalterado (mesmos textos, mesmo
  `onClose()` ao concluir).
- Feature flag: nao necessaria (mudanca aditiva de baixo risco).
- Estrategia de rollback: reverter o commit do arquivo frontend; nenhum estado de banco envolvido.

## 6) Criterios de aceitacao (CA)

- CA-001: Abrir para edicao um agendamento com status "Reservado" mostra a secao de destinatario
  e o botao "Gerar mensagem de confirmacao".
- CA-002: Preencher paciente/tutor no formulario (sem salvar) e clicar em "Gerar mensagem de
  confirmacao" mostra a mensagem com o nome do paciente/tutor preenchido (nao mais "Pendente").
- CA-003: Na tela de mensagem, clicar em "Voltar ao formulario" ou no X volta ao formulario de
  edicao com os campos preenchidos como estavam (nao fecha o modal, nao reseta o formulario).
- CA-004: Editar um agendamento que nao e reserva (`formData.marcar_como_reserva = false`) nao
  mostra a secao nem o botao.
- CA-005: O fluxo de criacao de uma nova reserva permanece igual ao atual (mensagem fecha o modal
  ao clicar em "Concluir").

## 7) Casos de borda

- CB-001: Clicar em "Gerar mensagem" sem clinica/tutor selecionado gera a mensagem mesmo assim,
  com "Pendente" nos campos ausentes (mesmo comportamento do fluxo de criacao).
- CB-002: Reserva com multiplos WhatsApp cadastrados na clinica permite escolher qual usar, igual
  ao fluxo de criacao.

## 8) Fora de escopo

- Geracao/reenvio automatico da mensagem ao salvar a edicao.
- Botao de geracao de mensagem na lista/calendario da agenda, fora do modal de edicao.
- Qualquer mudanca no backend/endpoint de agendamento.
