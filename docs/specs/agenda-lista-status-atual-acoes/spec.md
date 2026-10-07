# Spec - agenda-lista-status-atual-acoes

Data: 2026-10-06
Status: implementado e verificado localmente

## 1) Escopo

Apresentacao dos cards de agendamento na lista de `/agenda`. Sem alteracao
de API, modelo de dados, autorizacao ou regras de transicao.

## 2) Requisitos funcionais

- RF-001: cada card exibe o valor de `ag.status` com o rotulo visivel
  `Status atual`, em elemento informativo que nao se apresenta como botao.
- RF-002: os controles que mudam status ficam em grupo visual separado,
  identificado como `Alterar status` ou expressao equivalente. O agrupamento
  e a diferenca de forma/texto distinguem acoes do status atual sem depender
  somente da cor.
- RF-003: os botoes usam verbos das acoes compartilhadas
  (`Agendar`, `Reservar`, `Confirmar`, `Iniciar Atendimento`,
  `Finalizar Atendimento`, `Marcar Falta` e `Cancelar`), preservando os
  rotulos contextuais `Desfazer realizado` e
  `Agendar apos confirmacao tardia`.
- RF-004: o conjunto de transicoes permitidas, a ordem para `Reservado`,
  o status de destino de cada clique e as confirmacoes existentes permanecem
  iguais.
- RF-005: no celular e tablet, o status atual aparece antes das acoes na
  ordem de leitura; o grupo quebra sem sobrepor ou cortar botoes e sem
  causar rolagem horizontal da pagina. Os botoes mantem alvos de toque e
  espacamento confortaveis.
- RF-006: cada acao conserva nome acessivel, foco visivel e estado
  desabilitado durante a atualizacao. O status atual permanece texto
  estatico, fora da ordem de tabulacao.

## 3) Requisitos tecnicos

- RT-001: obter os rotulos padrao de
  `frontend/lib/agenda-shared-actions.ts`, evitando uma segunda lista de
  nomes para as mesmas transicoes na Agenda em modo lista.
- RT-002: manter `ag.status` e `obterProximosStatus(ag.status)` como fontes
  existentes para estado atual e destinos permitidos, respectivamente.
- RT-003: a mudanca de layout deve ficar no frontend da Agenda lista. Nao
  alterar o `PATCH /api/v1/agenda/{id}/status`, schemas ou persistencia.

## 4) Criterios de aceitacao

- CA-001: card com `status = Agendado` mostra `Status atual: Agendado`
  claramente separado da acao `Cancelar`. `Cancelado` nao aparece como
  se fosse um estado ja aplicado.
- CA-002: card `Reservado` oferece `Agendar` antes de `Confirmar` e
  `Cancelar`; os tres continuam enviando os mesmos status de destino.
- CA-003: card `Confirmado` oferece os verbos de acao pertinentes; card
  `Realizado` mantem `Desfazer realizado` e card `Expirado` mantem
  `Agendar apos confirmacao tardia`.
- CA-004: em 375x812, 768x1024 e 1440x900, o status atual e o grupo de
  acoes sao distinguiveis, todos os textos e botoes ficam visiveis e nao
  ha sobreposicao nem rolagem horizontal indevida.
- CA-005: navegacao por teclado alcança cada botao em ordem coerente,
  exibe foco perceptivel e nao trata o texto do status atual como acao.
- CA-006: os testes de transicao existentes, TypeScript, lint e build passam
  sem mudar contrato/API.
- CA-007: a avaliacao local do guardrail SDD reconhece a feature e aprova
  os arquivos alterados. O job CI por SHA sera uma verificacao separada no
  fluxo de publicacao.

## 5) Fora de escopo

- Agenda FullCalendar e outras telas que exibem o status.
- Alteracoes em notificacoes, relatorios, dados clinicos ou financeiro.
