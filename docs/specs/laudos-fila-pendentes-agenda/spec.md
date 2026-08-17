# Spec - laudos-fila-pendentes-agenda

Data: 2026-08-16 (revisado 2026-08-17 - ver `intent.md` secao 8)
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Escopo funcional

Endpoint novo (fila de pendentes + indicador de agilidade, so leitura)
+ campo novo `Agendamento.urgente_laudo` (togglavel) + campo novo
`Laudo.finalizado_em` (automatico) + aba nova em `/laudos`.

A fila cobre dois fluxos, mesclados num unico resultado:

- **Fluxo A** (raro): exame com Atendimento Clinico completo -
  `Exame -> AtendimentoClinico -> Agendamento`.
- **Fluxo B** (comum): agendamento "Realizado" sem Atendimento Clinico -
  o Laudo (se existir) e criado direto via `Laudo.agendamento_id`
  (dropdown "Laudar" da Agenda). O tipo de laudo esperado vem do nome do
  servico agendado.

## 2) Requisitos funcionais (RF)

### Backend - modelo

- RF-1: `Agendamento.urgente_laudo: Boolean, nullable=False,
  default=False` - marcador manual de urgencia da fila, vale pro
  agendamento inteiro (todos os tipos de laudo esperados dele, ex.: os 2
  tipos de um combo "Eco + Eletro"). Togglavel via o `PUT
  /agenda/{agendamento_id}` ja existente (`AgendamentoUpdate` ganhou o
  campo `urgente_laudo`, endpoint ja faz `setattr` generico dos campos
  presentes no payload).
- RF-2: `Laudo.finalizado_em: DateTime(timezone=True), nullable=True` -
  preenchido automaticamente (evento SQLAlchemy `before_insert`/
  `before_update` no modelo `Laudo`) na primeira vez que
  `status == "Finalizado"`. Uma vez preenchido, nunca e resetado
  (reabrir um laudo finalizado para correcao nao apaga o registro
  historico de quando foi finalizado pela primeira vez).

### Backend - calculo de horas uteis

- RF-3: funcao `horas_uteis_entre(inicio, fim, feriados) -> float` -
  soma as horas corridas contidas em dias uteis (segunda a sexta,
  excluindo datas em `feriados`) entre dois timestamps. Sabado,
  domingo e feriado contam 0h. Sem recorte de horario comercial dentro
  do dia util (conta as 24h corridas do dia).
- RF-4: `feriados` vem de `carregar_agenda_feriados(configuracao.agenda_feriados)`
  (mesma fonte da Agenda).

### Backend - mapeamento servico -> tipo de laudo (fluxo B)

- RF-4b: `SERVICO_NOME_TIPOS_LAUDO` (dict fixo, confirmado com o usuario
  a partir do catalogo real de servicos em stage) mapeia o nome do
  servico agendado pra 0+ tipos de laudo esperados: "Ecocardiograma" ->
  `(ecocardiograma,)`; "Eletrocardiograma" -> `(eletrocardiograma,)`;
  "Pressao Arterial" -> `(pressao_arterial,)`; "Eco + Eletro" ->
  `(ecocardiograma, eletrocardiograma)`; "Eco + PA" -> `(ecocardiograma,
  pressao_arterial)`. Servicos fora do dict (Consulta, Drenagem de
  Efusao Pericardica, Reavaliacao/Retorno) nao geram laudo esperado.
- RF-4c: nome do servico resolvido via `Agendamento.servico_id ->
  Servico.nome` (fonte confiavel), com fallback pro campo denormalizado
  `Agendamento.servico` (string livre) quando `servico_id` e nulo -
  ocorrencia real conhecida, nao so de dados legados/teste.

### Backend - fila de pendentes

- RF-5: `GET /laudos/pendentes` - universo mesclado de duas fontes:
  - Fonte A: `Exame` com `atendimento_id` -> `AtendimentoClinico` ->
    `Agendamento.status == "Realizado"`, e (`Exame.laudo_id IS NULL` ou
    `Laudo.status == "Rascunho"`).
  - Fonte B: `Agendamento.status == "Realizado"` **sem** nenhum
    `AtendimentoClinico` vinculado; pra cada tipo esperado (RF-4b/4c)
    sem `Laudo` correspondente (`Laudo.agendamento_id` + `Laudo.tipo`)
    ou com `Laudo.status == "Rascunho"`, gera um item.
- RF-6: cada item retorna `exame_id` (nulo na Fonte B), `atendimento_id`
  (nulo na Fonte B), `agendamento_id` (sempre presente, nas duas
  fontes), `laudo_id` (nulo se nao existe), `tem_rascunho`, `urgente`
  (de `Agendamento.urgente_laudo`), `paciente_nome`, `tutor_nome`,
  `clinica_nome`, `tipo_exame` (Fonte A: `Exame.tipo_exame` livre; Fonte
  B: codigo cru do tipo de laudo - `ecocardiograma`/`eletrocardiograma`/
  `pressao_arterial` -, rotulado no frontend via `getTipoLaudoLabel`),
  `data_atendimento` (Fonte A: `AtendimentoClinico.data_atendimento`;
  Fonte B: `Agendamento.inicio`), `horas_uteis_decorridas` (RF-3, `fim =
  agora`), `atrasado` (`horas_uteis_decorridas > 48`).
- RF-7: ordenacao - `urgente=true` primeiro; dentro de cada grupo,
  `data_atendimento` ascendente (mais antigo primeiro). Mesclagem e
  ordenacao em memoria (duas fontes, sem uma unica query SQL).
- RF-8: resposta inclui `total` (sem paginacao) para o badge da aba.

### Backend - indicador de agilidade

- RF-9: `GET /laudos/agilidade` - universo: `Laudo` join direto
  `Agendamento` por `Laudo.agendamento_id`, `Agendamento.status ==
  "Realizado"`, `Laudo.finalizado_em` preenchido. Cobre os dois fluxos
  (nao depende de `Exame`/`AtendimentoClinico` - a versao anterior so
  contava laudos com `Exame` vinculado e subcontava o fluxo comum).
  `Agendamento.inicio` e a referencia de inicio da contagem (RF-3).
- RF-10: duas janelas: atual (`finalizado_em` nos ultimos 90 dias) e
  anterior (`finalizado_em` entre 91 e 180 dias atras). Cada janela
  retorna `{total_finalizados, no_prazo, percentual_no_prazo,
  media_horas_uteis}`, onde `no_prazo` conta
  `horas_uteis_entre(agendamento.inicio, finalizado_em) <= 48`.
- RF-11: campo `tendencia`: `"melhorou"` se
  `percentual_no_prazo` atual > anterior, `"piorou"` se menor,
  `"estavel"` se igual (ou se a janela anterior nao tiver dados
  suficientes para comparar - nesse caso `tendencia = null`).

### Frontend

- RF-12: `/laudos` ganha uma 3a aba "Pendentes", com contagem no
  rotulo (ex.: "Pendentes (7)").
- RF-13: cada item mostra paciente, tutor, clinica, tipo de exame
  (rotulado via `getTipoLaudoLabel`), data de realizacao, selo
  "Atrasado" (se `atrasado`), selo "Rascunho em aberto" (se
  `tem_rascunho`), e um botao "Marcar como urgente" / "Remover
  urgencia" (toggle, chama `PUT /agenda/{agendamento_id}` com
  `{urgente_laudo: true|false}`).
- RF-14: itens urgentes aparecem destacados visualmente (cor/borda
  diferente) e sempre no topo da lista. Como o marcador e por
  agendamento, marcar um item de um combo (ex.: "Eco + Eletro") marca
  os dois tipos como urgentes juntos.
- RF-15: acao por item - sem laudo: link para
  `/laudos/novo?atendimento_id={id}&tipo={tipo_exame}` (Fonte A) ou
  `/laudos/novo?agendamento_id={id}&tipo={tipo_exame}` (Fonte B, mesmo
  padrao do dropdown "Laudar" da Agenda); com rascunho: link para
  `/laudos/{laudo_id}/editar`.
- RF-16: card "Agilidade" na mesma aba, mostrando o percentual no
  prazo e o tempo medio dos ultimos 90 dias, com indicador de
  tendencia (seta/texto "melhorou"/"piorou"/"estavel" comparado aos
  90 dias anteriores).
- RF-17: estado vazio ("Nenhum laudo pendente - tudo em dia.") quando
  a fila estiver zerada.

## 3) Requisitos nao funcionais (NFR)

- NFR-1 (performance): reaproveita indices existentes
  (`agendamento_id`/`data_atendimento` em `AtendimentoClinico`); sem
  indice novo necessario para o volume atual. A Fonte B carrega todos
  os agendamentos "Realizado" sem Atendimento Clinico sem paginacao no
  banco (pagina so em memoria) - aceitavel para o volume atual (uso
  pessoal de uma clinica), revisar se crescer muito.
- NFR-2 (compatibilidade): nenhuma mudanca nos endpoints/paginas
  existentes de laudos/exames/agenda - so adicao. O evento SQLAlchemy em
  `Laudo` roda em qualquer insert/update, mas so age quando
  `status == "Finalizado"` - nao muda o comportamento de nenhum outro
  campo. `AgendamentoUpdate.urgente_laudo` e um campo novo opcional -
  nao afeta nenhum payload existente.
- NFR-3 (correcao): um exame/tipo de laudo nunca aparece duplicado nem
  agrupado por agendamento - cada `Exame` (Fonte A) ou cada tipo
  esperado (Fonte B) e uma linha independente.
- NFR-4 (previsibilidade): `finalizado_em`, uma vez setado, nunca e
  sobrescrito por edicoes posteriores do mesmo laudo.

## 4) Criterios de aceite (CA)

- CA-1: exame de atendimento com agendamento `Realizado` e sem
  `laudo_id` aparece na fila (Fonte A).
- CA-2: exame com `laudo_id` setado e `Laudo.status == "Rascunho"`
  aparece na fila, marcado "rascunho em aberto" (Fonte A).
- CA-3: exame/agendamento nao `Realizado` (`Agendado`, `Confirmado`,
  etc.) nao aparece na fila (nem Fonte A nem Fonte B).
- CA-4: exame/laudo com `status in ("Finalizado", "Arquivado")` nao
  aparece.
- CA-5: eletrocardiograma via upload sem agenda nao aparece (nunca se
  qualificaria - nasce sem `atendimento_id`/`agendamento_id`).
- CA-6: exame/agendamento realizado ha mais de 48h uteis (contando so
  dias uteis) aparece com selo "Atrasado"; um realizado sexta a tarde,
  com folga de fim de semana no meio, so fica atrasado depois de
  considerar segunda e terca como dias uteis adicionais (nao conta
  sabado/domingo).
- CA-7: marcar um item como urgente move ele (e qualquer outro item do
  mesmo agendamento, ex.: combo) para o topo da lista e aplica o
  destaque visual; desmarcar reverte.
- CA-8: clicar num item sem laudo abre a criacao pre-preenchida (via
  `atendimento_id` na Fonte A, via `agendamento_id` na Fonte B); clicar
  num item com rascunho abre a edicao do laudo existente.
- CA-9: finalizar um laudo (via `atualizar_laudo`, mudando status para
  "Finalizado") preenche `finalizado_em` uma unica vez; editar o mesmo
  laudo de novo depois (ainda Finalizado) nao muda `finalizado_em`.
- CA-10: criar um laudo de ECG via upload (que ja nasce Finalizado)
  tambem preenche `finalizado_em` no momento da criacao.
- CA-11: indicador de agilidade calcula corretamente o percentual no
  prazo e a tendencia comparando os ultimos 90 dias com os 90
  anteriores, cobrindo laudos dos dois fluxos (com e sem Exame
  vinculado).
- CA-12: agendamento "Realizado" sem Atendimento Clinico, com servico
  agendado que nao gera laudo (Consulta, Drenagem de Efusao
  Pericardica, Reavaliacao/Retorno), nao aparece na fila.
- CA-13: agendamento "Realizado" sem Atendimento Clinico, com servico
  combo ("Eco + Eletro" ou "Eco + PA"), gera 2 itens pendentes
  independentes (um por tipo esperado); se um dos tipos ja tiver laudo
  finalizado, so o outro tipo aparece.
- CA-14: agendamento com `servico_id` nulo mas `servico` (denormalizado)
  preenchido com um nome reconhecido ainda e classificado corretamente
  (fallback de RF-4c).
