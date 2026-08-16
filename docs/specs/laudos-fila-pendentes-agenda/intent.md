# Intent - laudos-fila-pendentes-agenda

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Problema atual

Martiniano emite os laudos pessoalmente (nao e so admin do sistema) e
hoje nao tem, dentro do proprio Fortcordis, uma visao consolidada dos
exames ja realizados que ainda precisam de laudo, nem um indicador de
quao bem ele esta cumprindo o prazo que ele mesmo promete as clinicas
(48h). Confirmado por investigacao de codigo:
`frontend/app/laudos/page.tsx` nao tem filtro de status nem indicador
de prazo; o dashboard interno nao tem nenhum widget de laudo. A fila
ja estava registrada como sugestao confirmada em
`docs/specs/portal-clinicas-ia-consolidacao/intent.md` secao 9 ("um
campo pra mim"); o indicador de agilidade surgiu nesta conversa como
extensao natural da mesma tela.

## 2) Escopo confirmado com o usuario (2026-08-16)

- "Pendente" inclui as duas situacoes: exame realizado sem nenhum
  laudo vinculado, e exame realizado com laudo ja iniciado mas ainda
  em rascunho (`Laudo.status == "Rascunho"`).
- So entra na fila o que **passou pela Agenda e foi marcado como
  Realizado** (`Agendamento.status == "Realizado"`). Eletrocardiogramas
  enviados por clinicas sem passar pela Agenda
  (`POST /laudos/eletrocardiograma/upload-pdf`,
  `criar_laudo_eletrocardiograma_por_pdf`,
  `backend/app/api/v1/endpoints/laudos.py:1405`) ja criam o `Laudo`
  direto como `"Finalizado"` - nao ha estado "recebido, aguardando
  laudo" pra esse caminho hoje. **Fora de escopo nesta primeira
  versao** (mudar esse fluxo e um projeto separado, maior).
- Prazo oficial: **48 horas corridas, contando so em dias uteis**
  (pula sabado, domingo e feriado cadastrado - reaproveita
  `Configuracao.agenda_feriados`/`carregar_agenda_feriados`/
  `obter_feriado`, `backend/app/core/agenda_config.py`, ja usados pela
  Agenda). Nao ha horario comercial dentro do dia util - conta as 24h
  corridas do dia.
- Prazo e **fixo (48h) para todas as clinicas** - a variacao mencionada
  pelo usuario ("algumas clinicas solicitam mais agilidade") e uma
  gentileza pontual para pacientes com urgencia de cirurgia, resolvida
  pelo marcador manual "urgente" (secao 3), nao por um prazo
  diferenciado por clinica.
- Indicador de agilidade: janela de **90 dias**, com comparacao contra
  os 90 dias anteriores (dia 91-180 atras) pra mostrar se a agilidade
  esta melhorando ou piorando, nao so uma foto unica do periodo atual.
- `finalizado_em` (campo novo) e necessario porque `Laudo.updated_at`
  muda toda vez que o laudo e editado, mesmo depois de finalizado -
  nao serve pra medir o prazo historico com confianca.

## 3) Objetivo

Uma aba "Pendentes" em `/laudos`, listando exames com agendamento
`Realizado` que ainda nao tem laudo finalizado, com selo de atraso
(>48h uteis), marcador manual de urgencia, e acao direta pra
continuar/criar o laudo. Junto, um indicador de agilidade (% dentro do
prazo + tempo medio, ultimos 90 dias vs. 90 dias anteriores).

## 4) Nao objetivos

- Nao cobre os eletrocardiogramas sem agenda (secao 2).
- Nao e ferramenta gerencial/de terceiros - uso pessoal (mesmo
  raciocinio de `user_role_laudo_emission` na memoria do projeto). Sem
  gate de papel alem do que `/laudos` ja exige (`get_current_user`).
- Nao e o nucleo da fila cross-modulo maior (financeiro, agenda,
  convites de portal) de `portal-clinicas-ia-consolidacao` - essa
  permanece adiada.
- Nao muda o fluxo de upload de eletrocardiograma nem nenhum outro
  fluxo de criacao/edicao de laudo existente - so adiciona leitura e
  um campo novo preenchido automaticamente.
- Nao introduz prazo diferenciado por clinica - 48h fixo pra todas.

## 5) Contexto e restricoes

- Cadeia de dados: `Exame.atendimento_id`
  (`backend/app/models/laudo.py:52`) -> `AtendimentoClinico.id`;
  `AtendimentoClinico.agendamento_id`
  (`backend/app/models/atendimento_clinico.py:27`, indexado) ->
  `Agendamento.id`; `Agendamento.status`
  (`backend/app/models/agendamento.py:29`, valor `"Realizado"` em
  `AGENDA_STATUS_PERMITIDOS`, `backend/app/api/v1/endpoints/agenda.py:71`).
- Feriados: `Configuracao.agenda_feriados` (Text/JSON,
  `backend/app/models/configuracao.py:43`), carregado via
  `carregar_agenda_feriados` e consultado via `obter_feriado`
  (`backend/app/core/agenda_config.py`).
- `Laudo.status` so e alterado via dict generico em `atualizar_laudo`
  (`backend/app/api/v1/endpoints/laudos.py:2360`, campo `status` dentro
  do payload) ou fixo na criacao via upload de ECG
  (`laudos.py:1512`) - nao ha um unico ponto de "finalizar". Por isso
  `finalizado_em` e preenchido via evento SQLAlchemy
  (`before_insert`/`before_update`) no modelo `Laudo`, nao em cada
  endpoint - garante que nenhum caminho (presente ou futuro) escape da
  marcacao.
- `/laudos/novo` ja aceita `?atendimento_id=`/`?tipo=`/`?paciente_id=`
  na query string (`frontend/app/laudos/novo/page.tsx:425-457`) -
  reaproveitado para a navegacao direta da fila.
- Guardrail de SDD: mudanca de codigo exige `spec.md`/`verify.md`
  atualizados no mesmo diff.

## 6) Impacto esperado

- Usuario impactado: Martiniano (ferramenta pessoal).
- Modulos impactados: `backend/app/models/laudo.py` (campos novos +
  migrations), `backend/app/api/v1/endpoints/laudos.py` (endpoints
  novos, so leitura + o toggle de urgente reaproveitando o PUT
  generico de exame), novo modulo de servico para o calculo de horas
  uteis, `frontend/app/laudos/page.tsx` (aba nova + card de agilidade).
- Risco de regressao: baixo-medio - o evento SQLAlchemy no modelo
  `Laudo` e o unico ponto que toca um caminho de codigo ja existente
  (criacao/atualizacao de laudo); precisa de teste garantindo que nao
  quebra nenhum fluxo atual.

## 7) Riscos iniciais

- Risco 1: volume de exames antigos sem laudo pode ser maior que o
  esperado - mitigar com paginacao/limite desde o inicio.
- Risco 2: um agendamento pode ter mais de um exame associado (ex.:
  eco + eletro no mesmo atendimento) - a fila lista cada exame
  individualmente, nao agrupado.
- Risco 3: o evento SQLAlchemy em `Laudo` precisa dar conta tanto de
  criacao (upload de ECG, ja nasce Finalizado) quanto de atualizacao
  (Rascunho -> Finalizado via `atualizar_laudo`) - testar os dois
  caminhos explicitamente.
- Risco 4: calculo de horas uteis errado (nao pular fim de semana/
  feriado corretamente) tornaria o indicador de agilidade enganoso -
  cobrir com testes unitarios de casos de borda (fim de semana no
  meio, feriado, exame realizado numa sexta a noite, etc.).
