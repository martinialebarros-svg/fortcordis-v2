# Spec - atendimento-continuidade-pos-alta

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: draft

## 1) Escopo funcional

Duas capacidades novas no modulo de Atendimento, ambas aditivas:

**Adendo clinico.** `EvolucaoClinica` e promovida a adendo tipado. Um adendo
criado em um atendimento ja concluido carrega data propria, tipo, texto,
anexos proprios e, opcionalmente, uma receita propria. Aparece na timeline do
paciente dentro do mesmo episodio, nao como encontro novo.

**Receita multipla por atendimento.** `PrescricaoClinica` deixa de ser 1:1 com
o atendimento. A receita do dia da consulta (`sequencia = 1`) e preservada e
continua reimprimivel; receitas complementares nascem como novos registros,
opcionalmente pre-preenchidos a partir de uma anterior.

Criar adendo ou receita complementar nunca gera ordem de servico nem altera o
status do agendamento.

## 2) Requisitos funcionais (RF)

### Adendo

- RF-001: `POST /atendimentos/{id}/adendos` cria um adendo com `tipo` em
  `{evolucao, resultado_exame, receita_complementar, orientacao}`, `descricao`
  obrigatoria, `titulo` opcional e `data_evolucao` opcional (default: agora).
- RF-002: o adendo nasce com `pos_conclusao = 1` quando o atendimento esta em
  `Concluido` no momento da criacao, e `0` caso contrario. O valor e derivado
  no backend, nunca aceito do payload.
- RF-003: criar adendo nao altera `ordens_servico`, nao altera
  `AtendimentoClinico.status` e nao altera o status do agendamento vinculado.
- RF-004: `POST /atendimentos/{id}/anexos` e
  `POST /atendimentos/{id}/anexos/upload` aceitam `evolucao_id` opcional; o
  anexo e rejeitado com 404 se o adendo nao pertencer ao atendimento.
- RF-005: um anexo com `evolucao_id` e `exame_id` juntos resolve a solicitacao
  de exame pelas regras que ja existem, sem regra nova: o upload tira o exame
  de "Solicitado" e o deixa em "Em andamento", e `_derivar_status_exame` so o
  leva a "Concluido" quando o resultado e preenchido. Liberacao no portal
  continua preservada.
- RF-006: a criacao de um adendo em atendimento concluido registra auditoria
  `CRIAR_ADENDO_POS_CONCLUSAO` no modulo `atendimento`.
- RF-007: `GET /atendimentos/{id}` passa a devolver `adendos: []` com id, tipo,
  titulo, descricao, data_evolucao, pos_conclusao, responsavel, anexos do
  adendo e id da receita vinculada, quando houver.
- RF-008: a timeline do paciente diferencia adendo pos-conclusao de evolucao
  intra-atendimento, exibindo o tipo; o `referencia_id` continua sendo o id da
  evolucao.

### Receita multipla

- RF-010: `prescricoes_clinicas` ganha `sequencia`, `emitida_em` e `adendo_id`.
  Ha no maximo uma receita por `(atendimento_id, sequencia)`.
- RF-011: `POST /atendimentos/{id}/prescricoes` cria a proxima receita do
  atendimento (`sequencia = max + 1`), aceitando `adendo_id` opcional e
  `copiar_de_prescricao_id` opcional. Copiar duplica os itens como registros
  novos, sem reutilizar ids persistidos.
- RF-012: `PUT /atendimentos/{id}/prescricoes/{prescricao_id}` sincroniza os
  itens daquela receita especifica, com a mesma semantica de
  `_sync_prescricao` (itens ausentes do payload sao removidos).
- RF-013: se a receita alvo ja tem `emitida_em` preenchido, o PUT responde 409
  com `codigo: "CONFIRMACAO_EDICAO_RECEITA_EMITIDA"`, `confirmavel: true` e
  mensagem explicando que a edicao cria uma nova versao do documento oficial.
  Com `confirmar_edicao_receita_emitida: true`, a edicao prossegue.
- RF-014: editar receita emitida apos confirmacao registra auditoria
  `EDITAR_RECEITA_EMITIDA` alem dos `prescricao_item_ajustes` ja existentes.
- RF-015: `GET /atendimentos/{id}/prescricoes/{prescricao_id}/pdf` gera o PDF
  daquela receita e, na primeira geracao, grava `emitida_em`. Geracoes
  seguintes nao alteram `emitida_em`.
- RF-016: `GET /atendimentos/{id}/prescricao/pdf` (contrato atual) continua
  funcionando e resolve para a receita de `sequencia = 1`, tambem gravando
  `emitida_em` na primeira geracao.
- RF-017: `GET /atendimentos/{id}` passa a devolver `prescricoes: []` com todas
  as receitas do atendimento. A chave `prescricao` existente continua
  apontando para a receita de `sequencia = 1`, com a mesma forma de hoje.
- RF-018: `PUT /atendimentos/{id}` com `prescricao` no payload continua
  sincronizando a receita de `sequencia = 1`, agora sujeito a RF-013.
- RF-019: excluir um atendimento continua removendo suas receitas em cascata,
  incluindo as complementares.

### Frontend

- RF-020: abrir um atendimento com status `Concluido` troca o aviso de
  "registro historico" por um banner que identifica o encontro pela data do
  atendimento e diz que acrescimos entram como adendo, com acao primaria
  "Adicionar adendo". O formulario permanece editavel (decisao "avisar e
  permitir"). O banner usa a data do atendimento, e nao a data da conclusao:
  o sistema nao armazena quando o atendimento foi concluido, e inventar esse
  dado seria pior do que identificar o encontro pela data que existe.
- RF-021: a secao de prescricao lista todas as receitas do atendimento com
  numero de sequencia e badge de estado (rascunho / emitida em dd/mm/aaaa),
  seguindo o padrao visual ja usado em documentos emitidos.
- RF-022: a acao "Nova receita complementar" cria a proxima receita
  pre-preenchida a partir da selecionada e abre o editor nela.
- RF-023: editar uma receita ja emitida exige confirmacao explicita no
  frontend, com o texto vindo do 409 do backend.
- RF-024: anexar um resultado a um exame solicitado, depois da conclusao,
  acontece pelo card do adendo: o seletor "Vincular ao exame" lista os exames
  sem arquivo e o upload envia `evolucao_id` e `exame_id` juntos. O ponto de
  partida fica no adendo, e nao no card do exame, para nao espalhar a
  mudanca por `AtendimentoExamesSection.tsx` - o adendo ja e o lugar onde o
  vet registra o que chegou depois.
- RF-026: o autosave do prontuario detecta e persiste alteracao feita numa
  receita complementar. O snapshot de deteccao de alteracao inclui a receita
  mesmo quando ela sai do payload do atendimento - sao decisoes distintas: o
  payload define o que vai para `PUT /atendimentos/{id}`, o snapshot define se
  ha algo a salvar.
- RF-027: confirmar a edicao de uma receita emitida reenvia o save ja com a
  confirmacao, sem depender de um novo ciclo de renderizacao.
- RF-028: trocar de receita com alteracao nao confirmada numa receita ja
  emitida abre confirmacao explicita, em vez de o clique nao produzir efeito
  visivel. Confirmar grava a alteracao e troca; cancelar mantem o vet na
  receita atual, com o aviso em aberto.
- RF-029: o aviso de receita emitida oferece "Descartar alteracao", que
  devolve a receita ao conteudo do servidor. O descarte fica em botao
  proprio, e nao no cancelamento do dialogo: Escape e clique fora resolvem
  como cancelar, e descartar texto clinico por Escape seria perda de dado
  silenciosa. Apos o descarte, o indicador de sincronizacao volta a
  "Sincronizado": o formulario passa a ser exatamente o que esta no servidor.
- RF-030: trocar de receita e descartar alteracao mantem o backup local do
  atendimento alinhado com o formulario. Sem isso o rascunho guarda o
  conteudo anterior e o traz de volta no proximo carregamento, desfazendo na
  pratica o descarte e a troca.
- RF-025: um adendo de tipo `receita_complementar` sem receita vinculada
  oferece "Emitir receita deste adendo", que cria a receita complementar
  ligada aquele adendo; com receita vinculada, exibe o estado em vez da acao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (integridade): nenhuma operacao desta entrega apaga ou sobrescreve
  itens de uma receita ja emitida sem confirmacao explicita e auditoria.
- NFR-002 (faturamento): nenhum caminho novo escreve em `ordens_servico`. Um
  teste cobre explicitamente que criar adendo e receita complementar em um
  atendimento finalizado mantem a contagem de OS do agendamento.
- NFR-003 (compatibilidade): clientes que so conhecem `prescricao` e
  `GET /atendimentos/{id}/prescricao/pdf` continuam funcionando sem alteracao.
- NFR-004 (performance): `_montar_detalhe_atendimento` nao pode introduzir
  N+1 - receitas, itens, adendos e anexos de adendo sao carregados em
  consultas agregadas por atendimento, seguindo o padrao de
  `api-01-n-plus-one-atendimento-for27`.
- NFR-005 (migracao): a migracao e aditiva e idempotente, com guarda por
  dialeto, e deixa todo registro existente com `sequencia = 1`,
  `emitida_em = NULL` e `pos_conclusao = 0`.

## 4) Contratos tecnicos

### API

Novos:

- `POST /atendimentos/{id}/adendos`  
  Payload: `{ tipo, descricao, titulo?, data_evolucao?, sinais_vitais? }`  
  Resposta 201: `{ adendo: {...} }`
- `POST /atendimentos/{id}/prescricoes`  
  Payload: `{ adendo_id?, copiar_de_prescricao_id? }`  
  Resposta 201: `{ prescricao: {...} }`
- `PUT /atendimentos/{id}/prescricoes/{prescricao_id}`  
  Payload: `{ orientacoes_gerais?, retorno_dias?, itens: [...],
  confirmar_edicao_receita_emitida?: bool }`  
  Resposta 200: `{ prescricao: {...} }` | 409 confirmavel
- `GET /atendimentos/{id}/prescricoes/{prescricao_id}/pdf`  
  Resposta: `application/pdf`, mesmos headers de `gerar_pdf_prescricao`

Alterados (aditivos):

- `GET /atendimentos/{id}`: ganha `adendos: []` e `prescricoes: []`.
- `POST /atendimentos/{id}/anexos` e `.../anexos/upload`: ganham `evolucao_id`
  opcional.

### Banco/migracoes

Migracao `20260910_83_atendimento_continuidade_pos_alta`:

- `prescricoes_clinicas`: `+ sequencia INTEGER NOT NULL DEFAULT 1`,
  `+ emitida_em TIMESTAMP NULL`, `+ adendo_id INTEGER NULL`.
- indice unico `ux_prescricoes_clinicas_atendimento_sequencia`
  em `(atendimento_id, sequencia)`.
- `evolucoes_clinicas`: `+ tipo VARCHAR(40) NOT NULL DEFAULT 'evolucao'`,
  `+ titulo VARCHAR(255) NULL`, `+ pos_conclusao INTEGER NOT NULL DEFAULT 0`.
- `anexos_atendimentos`: `+ evolucao_id INTEGER NULL` e indice
  `ix_anexos_atendimentos_evolucao_id`.

Sem backfill de dados: os defaults ja produzem o estado correto para todo
registro historico.

### Backend

- `backend/app/models/atendimento_clinico.py`: colunas novas em
  `PrescricaoClinica`, `EvolucaoClinica` e `AnexoAtendimento`.
- `backend/app/api/v1/endpoints/atendimento.py`: endpoints novos,
  `_sync_prescricao` parametrizado por `prescricao_id`, guard de receita
  emitida, serializacao de `adendos`/`prescricoes`, `evolucao_id` no upload.
- `backend/app/schemas/`: payloads de adendo e de receita complementar.

### Frontend

- `frontend/app/atendimento/page.tsx`: banner de atendimento concluido, acao
  "Adicionar adendo", estado das receitas.
- `frontend/app/atendimento/page.tsx`: `prescricao_alvo_id` no formulario,
  hidratacao e roteamento do save por receita alvo. O editor de prescricao e
  reaproveitado inteiro - a receita aberta alimenta os mesmos campos, entao
  calculo de dose, busca de medicamento e protocolos valem tambem para a
  complementar.
- `frontend/app/atendimento/components/AtendimentoAdendosSection.tsx` (novo):
  lista e criacao de adendos, com upload de anexo por adendo.
- `frontend/app/atendimento/components/AtendimentoReceitasBar.tsx` (novo):
  seletor de receitas, badges, criacao de complementar e o aviso acionavel de
  receita emitida.
- `frontend/lib/atendimento-receitas.ts` (novo): as duas regras que nao podem
  errar - se `prescricao` entra no payload do atendimento e qual receita
  alimenta o editor - ficam fora da pagina para poderem ser testadas
  isoladamente.

## 5) Criterios de aceitacao (CA)

- CA-001: em um atendimento finalizado ha dias, com um exame solicitado sem
  arquivo, e possivel criar um adendo `resultado_exame` e anexar o PDF do exame
  a ele, sem criar atendimento novo. O exame sai de "Solicitado" para "Em
  andamento" ao receber o arquivo e chega a "Concluido" quando o resultado e
  interpretado - as duas transicoes pela regra atual.
- CA-002: no mesmo atendimento, "Nova receita complementar" cria a receita 2
  pre-preenchida a partir da receita 1; editar e salvar a receita 2 nao altera
  nenhum item da receita 1.
- CA-003: reimprimir a receita 1 depois de emitir a receita 2 produz o mesmo
  conteudo de antes, com a data original.
- CA-004: tentar editar a receita 1 depois de emitida devolve 409 confirmavel;
  confirmando, a edicao passa e gera auditoria `EDITAR_RECEITA_EMITIDA`.
- CA-005: apos criar adendo e receita complementar em um atendimento vinculado
  a agendamento, a quantidade de OS daquele agendamento continua sendo 1 e o
  agendamento continua "Realizado".
- CA-006: a timeline do paciente mostra o adendo com sua propria data, dentro
  do mesmo episodio, e nao como um atendimento novo.
- CA-007: abrir um atendimento concluido mostra o banner identificando o
  encontro e a acao "Adicionar adendo"; o formulario segue editavel.
- CA-009: com uma receita complementar aberta no editor, o `PUT` do
  atendimento nao carrega `prescricao` - o autosave do prontuario nao pode
  alcancar a receita do dia enquanto o vet edita a complementar.
- CA-010: editar uma receita complementar e esperar o autosave grava a
  alteracao, sem depender de salvamento manual.
- CA-011: clicar em "Confirmar e salvar" no aviso de receita emitida aplica a
  edicao na primeira tentativa.
- CA-013: descartar a alteracao e recarregar a pagina nao traz o texto
  descartado de volta.
- CA-012: com alteracao nao confirmada numa receita emitida, clicar em outra
  receita abre confirmacao; cancelando, o vet permanece na receita atual e
  nada e perdido.
- CA-008: um cliente que chama `GET /atendimentos/{id}/prescricao/pdf` e le
  apenas a chave `prescricao` continua funcionando sem alteracao.

## 6) Fora de escopo

- Ponte WhatsApp -> prontuario (anexar midia recebida direto ao atendimento).
- Fila transversal de "exames solicitados sem arquivo" atravessando
  atendimentos fechados.
- Faturar adendo como teleorientacao ou retorno.
- Tornar o registro clinico original read-only.
- Adendos retroativos em atendimentos historicos.
