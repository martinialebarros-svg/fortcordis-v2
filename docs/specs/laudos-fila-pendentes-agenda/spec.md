# Spec - laudos-fila-pendentes-agenda

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Escopo funcional

Endpoint novo (fila de pendentes + indicador de agilidade, so leitura)
+ campo novo `Exame.urgente` (togglavel) + campo novo
`Laudo.finalizado_em` (automatico) + aba nova em `/laudos`.

## 2) Requisitos funcionais (RF)

### Backend - modelo

- RF-1: `Exame.urgente: Boolean, nullable=False, default=False` -
  marcador manual, sem relacao com o calculo de atraso. Togglavel via
  o `PUT /exames/{exame_id}` ja existente (endpoint generico por
  dict, so precisa parar de ignorar o campo).
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

### Backend - fila de pendentes

- RF-5: `GET /laudos/pendentes` - universo: `Exame` com
  `atendimento_id` -> `AtendimentoClinico.agendamento_id` ->
  `Agendamento.status == "Realizado"`, e (`Exame.laudo_id IS NULL` ou
  `Laudo.status == "Rascunho"`).
- RF-6: cada item retorna `exame_id`, `atendimento_id`, `laudo_id`
  (nulo se nao existe), `tem_rascunho`, `urgente`, `paciente_nome`,
  `tutor_nome`, `clinica_nome`, `tipo_exame`, `data_atendimento`,
  `horas_uteis_decorridas` (RF-3, `fim = agora`), `atrasado`
  (`horas_uteis_decorridas > 48`).
- RF-7: ordenacao - `urgente=true` primeiro; dentro de cada grupo,
  `data_atendimento` ascendente (mais antigo primeiro).
- RF-8: resposta inclui `total` (sem paginacao) para o badge da aba.

### Backend - indicador de agilidade

- RF-9: `GET /laudos/agilidade` - universo: `Laudo` com
  `finalizado_em` preenchido, cujo(s) `Exame`(s) vinculado(s) tem
  atendimento com agendamento `Realizado` (mesma cadeia de RF-5,
  aplicada ao momento da realizacao do exame como inicio da contagem).
- RF-10: duas janelas: atual (`finalizado_em` nos ultimos 90 dias) e
  anterior (`finalizado_em` entre 91 e 180 dias atras). Cada janela
  retorna `{total_finalizados, no_prazo, percentual_no_prazo,
  media_horas_uteis}`, onde `no_prazo` conta
  `horas_uteis_entre(data_atendimento, finalizado_em) <= 48`.
- RF-11: campo `tendencia`: `"melhorou"` se
  `percentual_no_prazo` atual > anterior, `"piorou"` se menor,
  `"estavel"` se igual (ou se a janela anterior nao tiver dados
  suficientes para comparar - nesse caso `tendencia = null`).

### Frontend

- RF-12: `/laudos` ganha uma 3a aba "Pendentes", com contagem no
  rotulo (ex.: "Pendentes (7)").
- RF-13: cada item mostra paciente, tutor, clinica, tipo de exame,
  data de realizacao, selo "Atrasado" (se `atrasado`), selo "Rascunho
  em aberto" (se `tem_rascunho`), e um botao "Marcar como urgente" /
  "Remover urgencia" (toggle, chama o `PUT /exames/{id}` com
  `{urgente: true|false}`).
- RF-14: itens urgentes aparecem destacados visualmente (cor/borda
  diferente) e sempre no topo da lista.
- RF-15: acao por item - sem laudo: link para
  `/laudos/novo?atendimento_id={id}&tipo={tipo_exame}`; com rascunho:
  link para `/laudos/{laudo_id}/editar`.
- RF-16: card "Agilidade" na mesma aba, mostrando o percentual no
  prazo e o tempo medio dos ultimos 90 dias, com indicador de
  tendencia (seta/texto "melhorou"/"piorou"/"estavel" comparado aos
  90 dias anteriores).
- RF-17: estado vazio ("Nenhum laudo pendente - tudo em dia.") quando
  a fila estiver zerada.

## 3) Requisitos nao funcionais (NFR)

- NFR-1 (performance): reaproveita indices existentes
  (`agendamento_id`/`data_atendimento` em `AtendimentoClinico`); sem
  indice novo necessario para o volume atual.
- NFR-2 (compatibilidade): nenhuma mudanca nos endpoints/paginas
  existentes de laudos/exames - so adicao. O evento SQLAlchemy em
  `Laudo` roda em qualquer insert/update, mas so age quando
  `status == "Finalizado"` - nao muda o comportamento de nenhum outro
  campo.
- NFR-3 (correcao): um exame nunca aparece duplicado nem agrupado por
  agendamento - cada `Exame` e uma linha independente.
- NFR-4 (previsibilidade): `finalizado_em`, uma vez setado, nunca e
  sobrescrito por edicoes posteriores do mesmo laudo.

## 4) Criterios de aceite (CA)

- CA-1: exame de atendimento com agendamento `Realizado` e sem
  `laudo_id` aparece na fila.
- CA-2: exame com `laudo_id` setado e `Laudo.status == "Rascunho"`
  aparece na fila, marcado "rascunho em aberto".
- CA-3: exame de agendamento nao `Realizado` (`Agendado`,
  `Confirmado`, etc.) nao aparece na fila.
- CA-4: exame com `Laudo.status in ("Finalizado", "Arquivado")` nao
  aparece.
- CA-5: eletrocardiograma via upload sem agenda nao aparece (nunca se
  qualificaria - nasce sem `atendimento_id`/`agendamento_id`).
- CA-6: exame realizado ha mais de 48h uteis (contando so dias uteis)
  aparece com selo "Atrasado"; um realizado sexta a tarde, com folga
  de fim de semana no meio, so fica atrasado depois de considerar
  segunda e terca como dias uteis adicionais (nao conta sabado/domingo).
- CA-7: marcar um item como urgente move ele para o topo da lista e
  aplica o destaque visual; desmarcar reverte.
- CA-8: clicar num item sem laudo abre a criacao pre-preenchida;
  clicar num item com rascunho abre a edicao do laudo existente.
- CA-9: finalizar um laudo (via `atualizar_laudo`, mudando status para
  "Finalizado") preenche `finalizado_em` uma unica vez; editar o mesmo
  laudo de novo depois (ainda Finalizado) nao muda `finalizado_em`.
- CA-10: criar um laudo de ECG via upload (que ja nasce Finalizado)
  tambem preenche `finalizado_em` no momento da criacao.
- CA-11: indicador de agilidade calcula corretamente o percentual no
  prazo e a tendencia comparando os ultimos 90 dias com os 90
  anteriores.
