# Intent - atendimento-auditoria-conteudo-exame-alertas

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Quatro achados confirmados por leitura de codigo na auditoria completa do
modulo de Atendimento Clinico (docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md,
achados #9, #10, #12, #15):

- `PUT /atendimentos/{id}` e o unico caminho de escrita do prontuario (save
  manual e autosave). Qualquer alteracao de diagnostico, triagem, queixa
  principal ou plano terapeutico acontecia sem nenhum registro de auditoria:
  nao havia como saber quem mudou o que e quando.
- Edicao de um exame ja existente (resultado, valor_referencia, unidade,
  prioridade, status, observacoes) nao guardava historico, ao contrario da
  prescricao (que ja tem `PrescricaoItemAjuste`). Um resultado de exame podia
  ser sobrescrito sem rastro do valor anterior.
- Alertas clinicos do paciente (ex.: alergia a medicamento) podiam ser
  criados, editados e desativados sem nenhuma auditoria - informacao de
  seguranca do paciente sem rastreabilidade.
- Excluir um atendimento concluido com Ordem de Servico paga cancelava a OS
  sem desfazer o recebimento financeiro: a Transacao continuava "Pago" e
  nenhum `CreditoFinanceiro` consumido era restituido, divergindo do
  financeiro real da clinica.

## 2) Objetivo

Toda escrita relevante no prontuario (conteudo clinico, exame, alerta
clinico) e toda reversao financeira decorrente de exclusao de atendimento
devem deixar rastro auditavel e ser reversiveis sem inconsistencia contabil.

## 3) Nao objetivos

- Nao inclui UI para visualizar a trilha de auditoria de conteudo clinico ou
  de alertas (o historico de ajuste de exame ja e exposto em
  `GET /atendimentos/{id}` via `historico_ajustes`, espelhando o que a
  prescricao ja fazia).
- Nao inclui as demais correcoes da mesma auditoria (guards em laudos.py,
  condicoes de corrida no frontend, bloqueios de deploy de migration) - cada
  uma tem sua propria feature SDD.

## 4) Contexto e restricoes

- Restricoes tecnicas: nenhum modelo do modulo de Atendimento declara
  `ForeignKey`/cascade; a nova tabela `exame_ajustes` segue o mesmo padrao
  sem FK que `prescricao_item_ajustes` ja usa.
- Restricoes de prazo: nenhuma - correcao de defeito confirmado, priorizada
  na auditoria por severidade Alta.
- Restricoes regulatorio/operacional: alteracao de prontuario clinico sem
  auditoria e um risco de conformidade, nao apenas tecnico.

## 5) Impacto esperado

- Usuarios impactados: veterinarios e administradores que editam
  atendimentos, exames e alertas clinicos.
- Modulos impactados: Atendimento (backend), Financeiro (reversao de OS via
  `desfazer_recebimento_ordem`).
- Risco de regressao: baixo - auditoria e historico sao aditivos (nao
  alteram o fluxo de escrita existente); a reversao financeira reusa a
  mesma funcao ja usada no fluxo manual de "desfazer recebimento".

## 6) Riscos iniciais

- Risco 1: gravar auditoria/historico a cada `PUT`/autosave pode gerar
  volume alto de linhas - mitigado por so registrar quando ha diff real
  (`_diff_conteudo_clinico`, `_registrar_ajuste_exame` ambos comparam
  antes/depois e nao gravam quando o valor nao mudou).
- Risco 2: reverter recebimento financeiro na exclusao pode falhar
  parcialmente - mitigado por reusar a mesma funcao transacional
  (`desfazer_recebimento_ordem`) ja usada no fluxo manual, dentro da mesma
  transacao da exclusao.

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
