# Spec - agenda-whatsapp-ultimo-usado

Data: 2026-08-08
Status: approved

## 1) Escopo funcional

Ao gerar a mensagem de confirmacao (criacao ou edicao de reserva/agendamento), pre-selecionar o
ultimo WhatsApp usado para aquele contato (clinica ou tutor), se ainda estiver entre os candidatos
atuais; caso contrario, manter o comportamento atual (primeiro da lista).

## 2) Requisitos funcionais (RF)

- RF-001: `construirMensagemAgendaPosCriacao` calcula `telefoneSugerido` = numero lembrado (se
  presente em `localStorage` e ainda estiver em `telefones`) ou `telefones[0]`.
- RF-002: Os dois pontos de entrada do fluxo (criacao com entrega automatica da mensagem; botao
  "Gerar mensagem de confirmacao" em modo de edicao) usam `telefoneSugerido` para o valor inicial
  de `whatsappMensagemSelecionado`.
- RF-003: `abrirWhatsAppMensagemAgenda` e `copiarMensagemAgenda` gravam o numero efetivamente
  usado (`whatsappMensagemSelecionado` no momento da acao) associado a `destinatarioTipo` +
  `destinatarioId`.
- RF-004: O dropdown de escolha manual continua disponivel e funcional quando ha mais de um
  candidato; escolher manualmente nao grava nada ate a secretaria abrir o WhatsApp ou copiar.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (resiliencia): falha de `localStorage` (leitura ou escrita) nunca quebra o fluxo de
  gerar/copiar/abrir a mensagem — sempre cai no comportamento anterior.
- NFR-002 (privacidade): a chave de `localStorage` guarda apenas um numero de telefone ja
  visivel na tela para quem usa aquele navegador/sessao; nao e enviada ao backend.

## 4) Contratos tecnicos

### Frontend

- Arquivo: `frontend/app/agenda/NovoAgendamentoModal.tsx`.
- Novo campo em `MensagemAgendaPosCriacao`: `destinatarioId: string`, `telefoneSugerido: string`.
- Novas funcoes de modulo: `obterUltimoWhatsappStorageKey`, `lerUltimoWhatsappSelecionado`,
  `salvarUltimoWhatsappSelecionado`.
- Chave de armazenamento: `` `fortcordis:agenda:ultimo-whatsapp:v1:${tipo}:${id}` ``.

### API / Banco

- Nenhuma mudanca (feature 100% frontend, sem persistencia no backend).

## 5) Compatibilidade e rollout

- Backward compatible; sem flag; sem migracao.

## 6) Criterios de aceitacao (CA)

- CA-001: Gerar a mensagem duas vezes seguidas para o mesmo tutor/clinica, escolhendo um numero
  diferente do primeiro na primeira vez e clicando "Abrir WhatsApp" — na segunda vez, o numero
  escolhido antes vem pre-selecionado.
- CA-002: Gerar a mensagem para um contato nunca usado antes — comportamento identico ao anterior
  (primeiro numero da lista pre-selecionado).
- CA-003: Numero lembrado nao esta mais entre os candidatos atuais — cai para o primeiro
  candidato, sem erro.

## 7) Fora de escopo

- Sincronizar a preferencia entre navegadores/usuarios.
- Alterar a origem dos numeros candidatos.
