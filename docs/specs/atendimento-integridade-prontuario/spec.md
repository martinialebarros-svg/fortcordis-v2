# Spec - atendimento-integridade-prontuario

Data: 2026-07-31
Responsavel: Claude (pareado com Martiniano)
Status: approved

## 1) Escopo funcional

Corrigir tres defeitos de integridade no modulo de Atendimento Clinico:
exclusao de exame por omissao no payload, revogacao acidental da liberacao no
Portal e evasao dos guards `409` da finalizacao transacional via
`agendamento_id: null`.

A entrega move tres decisoes para o servidor: **o que excluir** (marcacao
explicita com guards), **qual o status do exame** (derivado, com liberacao
preservada) e **quando desvincular da Agenda** (confirmacao mais auditoria). No
frontend, adiciona as acoes explicitas correspondentes: excluir exame, liberar
no Portal e revogar liberacao.

## 2) Requisitos funcionais (RF)

### Exclusao de exame (D1)

- RF-001: `ExameSolicitacaoPayload` deve aceitar o campo booleano `_destroy`
  (default `false`) indicando intencao explicita de exclusao.
- RF-002: `_sync_exames` **nao** deve excluir exame apenas por ausencia no
  payload. Exame existente omitido deve ser preservado com anexos e arquivos
  intactos.
- RF-003: exclusao deve ocorrer somente para item com `id` existente e
  `_destroy: true`.
- RF-004: a exclusao deve ser bloqueada com `409` quando o exame:
  - possuir `laudo_id` preenchido;
  - possuir ao menos um `AnexoAtendimento` vinculado;
  - estiver com status de liberacao no Portal
    (`is_portal_released_status`).
- RF-005: a mensagem de bloqueio deve identificar o exame e o motivo, e no caso
  de anexo deve orientar a remocao previa dos arquivos.
- RF-006: `tipo_exame` deve permanecer obrigatorio (minimo 2 caracteres) para
  item nao marcado com `_destroy`, e dispensado para item marcado.
- RF-007: exclusao confirmada deve continuar removendo os anexos e os arquivos
  fisicos do exame excluido (hard delete permanece, agora so no caminho
  explicito).

### Status do exame e Portal (D2)

- RF-008: o `status` enviado pelo cliente em `exames[]` deve ser **ignorado**
  pelo backend. O campo permanece aceito no payload por compatibilidade.
- RF-009: o backend deve derivar o status do exame a partir do estado do
  servidor, nesta ordem:
  1. se o exame existente esta liberado no Portal, preservar o status atual;
  2. se `resultado` esta preenchido, `Concluido`;
  3. se o exame possui ao menos um anexo em banco, `Em andamento`;
  4. caso contrario, `Solicitado`.
- RF-010: a contagem de anexos usada na derivacao deve vir do banco, nao do
  payload do cliente.
- RF-011: o upload de anexo nao pode rebaixar o status de um exame liberado no
  Portal (`atendimento.py:3855`). A guarda de regressao deve cobrir status
  concluido **e** status de liberacao.
- RF-012: `POST /atendimentos/exames/{exame_id}/portal/liberar` deve ser mantido
  e passar a ter caller na UI de Atendimento.
- RF-013: deve existir `POST /atendimentos/exames/{exame_id}/portal/revogar`
  para revogacao explicita, devolvendo o exame ao status derivado e limpando a
  mensagem de liberacao das observacoes quando ela for a mensagem padrao.
- RF-014: liberacao e revogacao devem registrar auditoria com modulo
  `atendimento`, entidade `exame` e a transicao de status.

### Vinculo com a Agenda (D3)

- RF-015: os dois guards `409` da finalizacao transacional devem ser avaliados
  contra o vinculo relevante - o `agendamento_id` atual em banco **ou** o
  destino - e nao apenas contra o destino do payload.
- RF-016: `PUT` que conclua (`status: "Concluido"`) um atendimento vinculado sem
  passar por `POST /atendimentos/{id}/finalizar` deve retornar `409`, inclusive
  quando o payload envia `agendamento_id: null`.
- RF-017: `PUT` que reabra um atendimento vinculado e concluido deve retornar
  `409`, inclusive quando o payload envia `agendamento_id: null`.
- RF-018: desvincular um prontuario (`agendamento_id: null` sobre vinculo
  existente) deve exigir `confirmar_desvinculo_agendamento: true` no payload;
  sem a confirmacao, `409` com `codigo:
  CONFIRMACAO_DESVINCULO_AGENDAMENTO` e `confirmavel: true`.
- RF-019: desvincular um prontuario **concluido** deve ser bloqueado com `409`
  independentemente da confirmacao, porque o vinculo sustenta a Agenda
  `Realizado` e a OS gerada.
- RF-020: desvinculacao confirmada deve registrar auditoria com o agendamento
  de origem.
- RF-021: `buildAtendimentoPayload` deve omitir `agendamento_id` quando
  `form.agendamento_id` estiver vazio, para que o autosave nunca desvincule por
  hidratacao parcial. Trocar de agendamento continua enviando o novo valor.
- RF-026: `buildAtendimentoPayload` deve parar de recalcular `status` do exame e
  enviar o valor corrente vindo do servidor.
- RF-027: o filtro que deixa fora do payload o exame com `tipo_exame` vazio deve
  ser mantido, e passa a deixar passar os itens marcados com `_destroy`. Com
  RF-002, omitir um exame virou no-op no backend: um campo em branco durante a
  digitacao nao apaga o exame nem derruba o save com `422` de validacao.
- RF-028: os guards que protegem o vinculo de um atendimento **concluido** com
  a Agenda devem cobrir qualquer mudanca de `agendamento_id` — nao so
  desvincular (`null`), mas tambem reatribuir para outro agendamento nao-nulo.
  Achado numa revisao adversarial pos-implementacao: os guards RF-015 a RF-019
  originais so disparavam em transicoes de status atravessando a fronteira
  `Concluido` (concluir sem finalizar, reabrir isoladamente) ou em
  desvinculo explicito; reatribuir o vinculo de um atendimento que **ja
  estava** `Concluido` para um agendamento diferente, sem tocar o `status`,
  nao disparava nenhum dos tres. Isso permitia deixar o agendamento antigo
  orfao (Agenda `Realizado` + OS sem atendimento correspondente) e vincular
  silenciosamente o novo agendamento a um prontuario `Concluido` sem passar
  pela finalizacao transacional, sem auditoria.

### Frontend

- RF-022: cada card de exame deve ter acao explicita de exclusao com
  confirmacao, que marca `_destroy` no exame persistido em vez de removê-lo do
  array silenciosamente. Exame ainda nao persistido continua sendo removido
  apenas do estado local.
- RF-023: "Remover vazios" deve marcar `_destroy` nos exames persistidos vazios
  em vez de omiti-los do payload.
- RF-024: o card do exame deve exibir o estado de liberacao no Portal e oferecer
  "Liberar no portal" quando houver PDF anexado e o exame nao estiver liberado, e
  "Revogar liberacao" quando estiver liberado.
- RF-025: bloqueio `409` de exclusao ou de desvinculacao deve ser apresentado ao
  usuario com a mensagem do backend, sem descartar o conteudo digitado.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (integridade de dado clinico): nenhum caminho de `PUT` ou de upload
  pode apagar exame, anexo ou arquivo fisico sem marcacao explicita de exclusao.
- NFR-002 (autoridade de estado): o status de liberacao no Portal so muda por
  endpoint dedicado de liberacao ou de revogacao.
- NFR-003 (compatibilidade): o contrato de `POST /atendimentos/{id}/finalizar`
  nao muda. Payloads antigos de `PUT` continuam aceitos; a diferenca e que
  exclusao por omissao deixa de acontecer e `status` de exame passa a ser
  ignorado.
- NFR-004 (auditoria): revogacao de liberacao, liberacao e desvinculacao de
  agendamento registram evento de auditoria.
- NFR-005 (observabilidade): bloqueios `409` devem trazer `codigo` estavel
  quando forem confirmaveis pela UI, seguindo o padrao ja usado em
  `CONFIRMACAO_ALTERACAO_SERVICO_HOJE` (`agenda.py:5135`).
- NFR-006 (performance): a derivacao de status nao pode gerar consulta por
  exame em loop N+1; a contagem de anexos do atendimento deve ser resolvida em
  uma consulta agregada por `_sync_exames`.

## 4) Contratos tecnicos

### API

#### `PUT /api/v1/atendimentos/{atendimento_id}`

Novos campos aceitos:

```json
{
  "confirmar_desvinculo_agendamento": true,
  "exames": [
    { "id": 12, "_destroy": true },
    { "id": 13, "tipo_exame": "Hemograma", "resultado": "" }
  ]
}
```

- `_destroy` (bool, default `false`): exclui o exame `id`.
- `status` em `exames[]`: aceito e ignorado.
- `agendamento_id` ausente: vinculo preservado.
- `agendamento_id: null` sobre vinculo existente: exige
  `confirmar_desvinculo_agendamento: true`.

Erros novos ou ampliados:

- `409` `CONFIRMACAO_DESVINCULO_AGENDAMENTO`: desvinculacao sem confirmacao.
- `409` texto: desvinculacao de prontuario concluido.
- `409` texto: exclusao de exame com laudo, anexo ou liberacao no Portal.
- `409` texto: conclusao ou reabertura de prontuario vinculado fora da
  finalizacao transacional (agora tambem com `agendamento_id: null`).

#### `POST /api/v1/atendimentos/exames/{exame_id}/portal/liberar`

Contrato inalterado. Passa a ter caller na UI.

#### `POST /api/v1/atendimentos/exames/{exame_id}/portal/revogar`

Resposta:

```json
{
  "message": "Liberacao do exame no portal revogada.",
  "exame_id": 12,
  "paciente_id": 5,
  "atendimento_id": 3,
  "status": "Concluido",
  "status_anterior": "Liberado no portal",
  "exame": { "...": "_map_exame + anexos_resultado" }
}
```

Erros: `404` exame inexistente; `409` exame que nao esta liberado.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum novo.
- Migracao necessaria: **nao**. A decisao de nao introduzir soft-delete em
  `exames` neste pacote elimina a necessidade de migration, e portanto tambem o
  risco de a esteira parar antes da `20260730_59`.

### Frontend

- Telas afetadas: `/atendimento` (aba Exames e autosave).
- Arquivos: `frontend/app/atendimento/page.tsx`,
  `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`.
- Estados de UI:
  - exame com chip de liberacao no Portal;
  - botao "Liberar no portal" habilitado somente com PDF anexado;
  - botao "Revogar liberacao" visivel somente para exame liberado;
  - confirmacao antes de excluir exame persistido;
  - erro `409` do backend exibido sem limpar o formulario.
- Regras de exibicao/erro: exames marcados com `_destroy` saem da listagem
  visivel imediatamente, mas permanecem no payload ate o save confirmar a
  exclusao.

## 5) Compatibilidade e rollout

- Backward compatibility: clientes antigos continuam funcionando; perdem apenas
  a exclusao por omissao (comportamento destrutivo) e o controle de `status` do
  exame (que era o vetor de revogacao).
- Feature flag: nao.
- Estrategia de rollback: reverter o commit deste pacote. Nenhuma migration e
  nenhum dado migrado, portanto o rollback e puramente de codigo.

## 6) Criterios de aceitacao (CA)

- CA-001: `PUT` que omite um exame existente preserva o exame, seus anexos e os
  arquivos em disco.
- CA-002: `PUT` com `{"id": X, "_destroy": true}` exclui o exame e seus anexos.
- CA-003: `PUT` com `_destroy` em exame com `laudo_id` preenchido retorna `409`
  e nao exclui nada.
- CA-004: `PUT` com `_destroy` em exame com anexo retorna `409` orientando a
  remocao previa dos arquivos.
- CA-005: `PUT` com `_destroy` em exame liberado no Portal retorna `409`.
- CA-006: `PUT` com o payload real do frontend (que envia
  `status: "Concluido"` ou `"Em andamento"`) preserva
  `exame.status == "Liberado no portal"`.
- CA-007: upload de anexo em exame liberado preserva o status de liberacao.
- CA-008: `POST .../portal/revogar` devolve o exame ao status derivado e um
  segundo `PUT` nao restaura a liberacao.
- CA-009: `PUT {"agendamento_id": null, "status": "Concluido"}` em atendimento
  vinculado retorna `409`; status, vinculo, Agenda e OS ficam inalterados.
- CA-010: `PUT {"agendamento_id": null}` em atendimento vinculado e concluido
  retorna `409`.
- CA-011: `PUT {"agendamento_id": null}` em atendimento vinculado e aberto, sem
  `confirmar_desvinculo_agendamento`, retorna `409` com
  `codigo: CONFIRMACAO_DESVINCULO_AGENDAMENTO`; com a confirmacao, desvincula.
- CA-012: o payload gerado pelo frontend omite `agendamento_id` quando o campo
  esta vazio.
- CA-013: a suite do modulo permanece verde e cresce em relacao ao baseline de
  62 testes.
- CA-014: `PUT {"agendamento_id": <outro>}` em atendimento **concluido** e
  vinculado retorna `409`, mesmo sem alterar `status` e mesmo o `agendamento_id`
  destino sendo valido e disponivel; o vinculo original e preservado.

## 7) Casos de borda

- CB-001: item marcado com `_destroy` cujo `id` nao existe no atendimento e
  ignorado silenciosamente (idempotencia de exclusao repetida).
- CB-002: item marcado com `_destroy` **e** com `tipo_exame` vazio deve passar a
  validacao do schema.
- CB-003: exame novo (sem `id`) marcado com `_destroy` e ignorado.
- CB-004: exame liberado no Portal cujo `resultado` e preenchido no mesmo `PUT`
  continua liberado (a preservacao vence a derivacao).
- CB-005: revogar exame que nao esta liberado retorna `409`, nao `200` silencioso.
- CB-006: `PUT` que troca `agendamento_id` de um valor para outro nao exige
  confirmacao e continua validando duplicidade pelo indice unico.
- CB-007: atendimento sem vinculo (`agendamento_id` nulo em banco) pode ser
  concluido por `PUT` como hoje, sem `409`.
- CB-008: exclusao de exame cujo `laudo_id` aponta para laudo inexistente
  continua bloqueada - o guard olha o campo, nao a existencia do laudo.

## 8) Fora de escopo

- Soft-delete de exame e de prontuario.
- Refatoracao de `page.tsx` e do estado de exames indexado por posicao.
- `beforeunload`, POST automatico e snapshot local do autosave.
- Auditoria campo a campo de edicao de prontuario e guard de
  `DELETE /atendimentos/{id}`.
- Persistencia do calculo mg/kg da prescricao.
- Correcao do off-by-one do filtro de periodo.
- Correcao da assinatura de `20260730_58_portal_partner_auth.py` (pacote
  Portal) e conciliacao de duplicidades para a `20260730_59`.
