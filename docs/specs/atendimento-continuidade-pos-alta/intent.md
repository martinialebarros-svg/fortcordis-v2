# Intent - atendimento-continuidade-pos-alta

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema atual

Cenario real: o paciente e atendido em um horario agendado, o atendimento e
concluido e finalizado. Dias depois o tutor manda pelo WhatsApp os exames que
foram solicitados na consulta, e o vet precisa anexar esses exames ao historico
do paciente e emitir uma receita complementando o tratamento.

Hoje o sistema nao tem um caminho correto para isso. Tecnicamente nada esta
travado - nao existe guard de status concluido em `atualizar_atendimento`
(`backend/app/api/v1/endpoints/atendimento.py`) nem em `upload_anexo` -, mas os
dois caminhos disponiveis produzem um registro errado:

**Reabrir o atendimento concluido.** `PrescricaoClinica` e 1:1 com
`atendimento_id` (`backend/app/models/atendimento_clinico.py`) e
`_sync_prescricao` deleta os itens que nao vierem no payload. A receita
complementar sobrescreve a receita emitida no dia da consulta. O PDF e gerado
ao vivo a partir do estado atual (`gerar_pdf_prescricao`), entao reimprimir a
receita original depois da edicao imprime o conteudo novo com a data antiga. O
unico registro do que foi realmente prescrito no dia 0 passa a ser a tabela de
auditoria `prescricao_item_ajustes`, que nao aparece no prontuario.

**Criar um novo atendimento.** E a resposta oficial do sistema hoje (spec
`atendimento-longitudinal-prescription-workflow`, botao "Novo atendimento deste
paciente"). Mas o registro nasce como um encontro novo na timeline; para
concluir exige documentacao clinica minima
(`_validar_primeira_conclusao_atendimento`) ou uma conclusao com pendencias que
fica sinalizada indefinidamente na lista (`atendimento-pendencias-filtro`); e,
se vinculado a agendamento, `finalizar_atendimento` gera uma segunda OS.

A raiz e conceitual: `finalizar_atendimento` e um evento economico, nao apenas
clinico - cria a ordem de servico e marca o agendamento como "Realizado". Por
isso "deixar o atendimento aberto ate o exame chegar" custa o fechamento
financeiro do dia, e o status `Aguardando exames`, que existe no vocabulario
canonico, nao resolve nada sozinho.

O atendimento esta modelado como **evento** (a visita). Clinicamente a unidade
e o **episodio**, que continua depois da visita.

## 2) Objetivo

Um atendimento concluido passa a ser append-only: o que foi registrado no dia
da consulta permanece intacto e reimprimivel, e o que chega depois entra como
adendo datado dentro do mesmo episodio.

Concretamente, o vet consegue, sem criar um encontro novo e sem destruir o
registro anterior:

- anexar ao prontuario um exame recebido dias depois, resolvendo a solicitacao
  de exame que ficou pendente naquele atendimento;
- emitir uma receita complementar, preservando a receita original como
  documento distinto e reimprimivel.

## 3) Nao objetivos

- **Nao gerar OS pelo adendo.** Decisao explicita: o adendo e continuidade do
  atendimento original, ja faturado na OS dele. Criar adendo nao toca em
  `ordens_servico` nem no status do agendamento.
- **Nao tornar o registro original read-only.** Segue o precedente de
  `atendimento-documento-emitido-aviso`: avisar e permitir. Corrigir um erro de
  digitacao na anamnese continua possivel e auditado; o que muda e que o
  caminho padrao para acrescentar conteudo passa a ser o adendo.
- Nao mexer na regra de documentacao clinica minima para a primeira conclusao.
- Nao construir a ponte WhatsApp -> prontuario nesta entrega (peca separada,
  depende do adendo existir primeiro).
- Nao construir a fila transversal de "exames solicitados sem arquivo" nesta
  entrega (peca separada).
- Nao migrar dados historicos: atendimentos ja concluidos nao ganham adendos
  retroativos.

## 4) Contexto e restricoes

- `EvolucaoClinica` (`evolucoes_clinicas`) ja existe com quase a forma certa:
  `atendimento_id`, `data_evolucao`, `descricao`, `sinais_vitais`,
  `responsavel_id/nome`, e ja aparece na timeline do paciente
  (`_montar_timeline_paciente`). Falta carregar anexos, receita e tipo. Hoje
  esta exposta apenas na secao secundaria de bibliotecas do frontend.
- `Exame` ja tem `atendimento_id` e status derivado da contagem de anexos
  (`_derivar_status_exame`): anexar arquivo a um exame solicitado ja o move
  para "Concluido". A peca que falta e poder fazer isso depois do fechamento,
  por um caminho que deixe rastro.
- `AnexoAtendimento` hoje se liga a `atendimento_id` e opcionalmente a
  `exame_id`. Precisa de um terceiro vinculo opcional para o adendo.
- Migracoes do projeto sao aditivas e idempotentes, com guarda por dialeto
  (`backend/migrations/versions/`). Producao e Postgres; o SQLite local tem
  drift conhecido de schema.
- A entrega nao pode quebrar `GET /atendimentos/{id}/prescricao/pdf`, que e o
  contrato usado hoje pelo frontend e por links ja distribuidos.
