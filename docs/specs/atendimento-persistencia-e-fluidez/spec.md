# Spec - atendimento-persistencia-e-fluidez

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Sete correcoes independentes (mas com pontos de interacao mapeados) no
modulo de Atendimento Clinico, cobrindo perda de dado (texto clinico,
calculo mg/kg), inconsistencia de estado (cadastro complementar,
consulta_concluida, indexacao de exames), integridade/auditoria (DELETE) e
um bug de filtro (periodo).

## 2) Requisitos funcionais (RF)

### Item 1 - Perda de texto clinico

- RF-101: adicionar handler `beforeunload` na pagina de atendimento que
  dispara `event.preventDefault()` / seta `event.returnValue` quando
  `autosaveStateRef.current !== "saved"` e ha conteudo relevante
  (`selecionado` ou `form.paciente_id` preenchido). Ler o estado via ref
  (nao via closure de state), seguindo o padrao ja usado por
  `formRef`/`lastPersistedSnapshotRef` no arquivo.
- RF-102: no cleanup do efeito de autosave (~3906-3933), alem de
  `clearTimeout`, disparar um flush (`void saveAtendimento("autosave")`)
  quando ha um timer pendente (`autosaveTimerRef.current` truthy) no
  momento do unmount - best effort, sem bloquear o unmount.
- RF-103: permitir POST automatico de criacao em modo autosave quando
  `!selecionado` e ha paciente + conteudo minimo (ex.: `form.paciente_id` e
  pelo menos um campo clinico ou exame preenchido), com guarda de
  idempotencia (ref `creatingAtendimentoRef` ou equivalente) para nao
  disparar dois POSTs concorrentes. Apos o POST bem-sucedido, atualizar
  `selecionado` com o novo id (mesma logica de "criar e continuar editando"
  ja usada no fluxo manual).
- RF-104: apos o primeiro save (`selecionado` truthy), continuar gravando
  um snapshot de fallback em `localStorage`, chaveado por
  `atendimento_id` (`` `fortcordis:atendimento:draft:v1:${atendimento_id}` ``
  ou equivalente), distinto da chave global usada antes do primeiro save.
  Esse snapshot deve ser limpo nos mesmos pontos onde `clearDraftStorage()`
  ja e chamado hoje apos save/finalizacao bem-sucedidos.
- NFR-101: a guarda de idempotencia do POST automatico nao pode quebrar o
  fluxo manual existente (botao "Salvar" continua funcionando exatamente
  como hoje quando `selecionado` ja existe).

### Item 2 - Persistencia do calculo mg/kg

- RF-201: nova migration (apos `20260730_60`, assinatura
  `upgrade(connection, dialect=None)`) adicionando `dose_mg_kg`,
  `peso_referencia_kg`, `unidade_dose_calculo`, `concentracao_personalizada`
  em `prescricoes_itens` (colunas nullable, sem quebrar linhas existentes).
- RF-202: `PrescricaoItemPayload` (backend/app/schemas/atendimento.py)
  ganha os 4 campos opcionais; `unidade_dose_calculo` validado contra os
  3 valores usados no frontend (`"mg" | "ml" | "comprimido"`).
- RF-203: `_map_prescricao_item` (leitura) e o bloco de atribuicao em
  `_sync_prescricao` (escrita) passam a serializar/persistir os 4 campos
  novos.
- RF-204: `buildAtendimentoPayload` (frontend, mapeamento de
  `prescricao.itens`) passa a incluir os 4 campos no payload de save -
  hoje o proprio frontend ja os descarta antes de despachar o PUT.
- NFR-201: campos legados (linhas existentes de `prescricoes_itens` sem os
  novos valores) continuam funcionando - leitura devolve `null`/vazio, sem
  quebrar a hidratacao do formulario.

### Item 3 - Cadastro complementar zerado

**Direcao de correcao revista durante a implementacao** (mais simples e de
menor raio de impacto que a cogitada no `intent.md`): em vez de fazer o
backend devolver objetos `paciente`/`tutor` completos em
`_montar_detalhe_atendimento` e `/contexto` (o que mudaria contrato
compartilhado por outros consumidores), os dois callers no frontend passam
a chamar `carregarCadastroComplementar(paciente_id)` diretamente - a MESMA
funcao que ja busca `/pacientes/{id}` e `/tutores/{id}` com sucesso quando
o `useEffect [form.paciente_id]` dispara. Isso elimina a dependencia do
efeito precisar detectar mudanca de `paciente_id` para popular o cadastro
complementar, sem tocar em nenhum contrato de backend.

- RF-301: `abrirAtendimento` (frontend/app/atendimento/page.tsx ~2555)
  troca `aplicarCadastroComplementar(d.paciente, d.tutor)` (sempre
  `undefined`/`undefined`, pois o backend nunca devolveu esses campos) por
  `void carregarCadastroComplementar(d.paciente_id)`.
- RF-302: o fluxo de contexto de agendamento (~1886) troca
  `aplicarCadastroComplementar(contexto.paciente, contexto.tutor)` por
  `void carregarCadastroComplementar(contexto.paciente_id)`, pelo mesmo
  motivo.
- NFR-301: nenhuma mudanca de contrato de backend (`_montar_detalhe_atendimento`
  e `/contexto` continuam devolvendo exatamente o mesmo payload de hoje).
  `carregarCadastroComplementar` ja trata `paciente_id` ausente/invalido
  chamando `aplicarCadastroComplementar()` (reset), entao o comportamento
  para atendimentos sem paciente selecionado nao muda.

### Item 4 - consulta_concluida com dois donos

- RF-401: remover a escrita em `form.consulta_concluida` a partir de
  `consultaEtapasCompletas` no `useEffect` (~5160-5163) - o efeito deixa de
  existir ou passa a ser usado apenas para fins visuais (ex.: badge "Marcacao
  automatica ativa", ja existente em
  `AtendimentoConsultaEditorSection.tsx` ~60-64).
- RF-402: `form.consulta_concluida` passa a ser propriedade exclusiva do
  checkbox manual (`AtendimentoConsultaEditorSection.tsx` ~52-58) e da
  hidratacao vinda do backend - nunca sobrescrito por calculo derivado.
- NFR-401: o funil visual `fluxoClinico` (~5023-5048, que le
  `form.consulta_concluida === 1` para marcar a etapa "Consulta" como
  concluida) continua funcionando sem alteracao - ele ja le `form`, nao
  `consultaEtapasCompletas` diretamente.

### Item 5 - DELETE sem guard/reversao/auditoria

- RF-501: bloquear (409, com `codigo`/`mensagem`, seguindo o padrao
  confirmavel-409 ja usado no modulo) a exclusao de um atendimento com
  `status == "Concluido"` por padrao; permitir apenas com uma flag de
  confirmacao explicita no payload da requisicao (ex.: query param ou body
  `{"confirmar_exclusao": true}`), auditada.
- RF-502: ao excluir (com ou sem confirmacao, para qualquer status), se
  `atendimento.agendamento_id` estiver presente: reverter
  `agendamento.status` para o estado anterior a "Realizado" (ou o estado
  apropriado) e cancelar a `OrdemServico` ativa vinculada via
  `_buscar_os_ativa` (reaproveitar o helper existente).
- RF-503: remover os registros orfaos em `EvolucaoClinica` e
  `PrescricaoItemAjuste` (ambos com `atendimento_id`, sem FK/cascade)
  associados ao atendimento antes de excluir. **Correcao ao enunciado
  original:** `AlertaClinico` e chaveado por `paciente_id`, nao por
  `atendimento_id` (confirmado no model,
  `backend/app/models/atendimento_clinico.py:169-183`) - representa alerta
  clinico do PACIENTE (alergia, doenca cronica, risco), independente de
  qualquer atendimento especifico, e portanto nunca fica orfao de um
  atendimento excluido. Fora do escopo desta limpeza.
- RF-504: chamar `registrar_auditoria` (padrao ja usado em
  `_emitir_efeitos_finalizacao`) com `acao="ATENDIMENTO_EXCLUIDO"` e
  `detalhes` estruturados (status anterior, agendamento_id, os_id
  cancelada), antes do commit final.
- NFR-501: o endpoint ganha o parametro `request: Request` (injetado pelo
  FastAPI, sem `Depends`) para permitir passar `request` a
  `registrar_auditoria`, seguindo o padrao ja usado em
  `finalizar_atendimento`.

### Item 6 - Filtro de periodo com um dia a mais

- RF-601: no backend (`listar_atendimentos`), trocar o filtro de
  `AtendimentoClinico.data_atendimento < dt_fim + timedelta(days=1)` para
  `AtendimentoClinico.data_atendimento <= dt_fim`, removendo o
  `+ timedelta(days=1)`. O frontend continua enviando `data_fim` como
  `T23:59:59` (fim de dia), sem nenhuma mudanca.
- NFR-601: `_parse_datetime` (reutilizada por outras rotas) nao e alterada
  - a correcao fica isolada na linha do filtro.

### Item 7 - Estado de exames indexado por posicao

- RF-701: adicionar um identificador local estavel (`_localId`, gerado em
  `emptyExam()`, reaproveitado por `buildExamFromCatalog()` via spread) a
  todo exame ainda nao persistido; exames persistidos usam `exame.id`.
- RF-702: `examesExpandidos`, `examUploadDrafts` e `examDropActive` passam
  a ser chaveados por `exame.id ?? exame._localId` em vez do indice, em
  todos os pontos de leitura/escrita (`mergeExamesNoFormulario`,
  `removerExame`, `clearExamUploadDraft`, `setExamUploadDraftFile`,
  `clearExamDropState`, `removerExamesVazios`, e os usos em
  `AtendimentoExamesSection.tsx`).
- RF-703: a key do React em `AtendimentoExamesSection.tsx` (~384) passa a
  usar a mesma chave estavel (`exame.id ?? exame._localId`) em vez de
  `` `${index}-${exame.id || "novo"}` ``.
- NFR-701: `index` continua sendo usado para as mutacoes que realmente
  precisam de posicao no array (`atualizarExame(index, ...)`,
  `form.exames[index]` em `resolveExamIdForUpload`/
  `uploadArquivoResultadoExame`) - so a CHAVE dos 3 mapas de estado por
  linha e a key do React mudam.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (compatibilidade): nenhuma mudanca de contrato em
  `POST /atendimentos/{id}/finalizar` (homologado).
- NFR-B (sem refactor): nenhuma reestruturacao de `page.tsx` alem do
  minimo necessario para os 7 itens.
- NFR-C (auditoria minima): toda exclusao definitiva de dado clinico
  (DELETE de atendimento) deixa rastro em auditoria.

## 4) Contratos tecnicos

- Nova migration `prescricoes_itens` (item 2): 4 colunas nullable,
  `upgrade(connection, dialect=None)`.
- Backend: `DELETE /atendimentos/{id}` passa a poder responder 409
  confirmavel (mesmo padrao de `CONFIRMACAO_DESVINCULO_AGENDAMENTO` /
  `CONFIRMACAO_CONCLUSAO_PENDENCIAS` ja usados no modulo).
- Frontend: novo campo interno `_localId` em `ExameSolicitacao` (nao
  enviado ao backend - so para chaveamento de estado local).

## 5) Compatibilidade e rollout

- Backward compatibility: sim em todos os itens - campos novos sao
  aditivos (nullable/opcionais), o guard do DELETE e opt-in via flag de
  confirmacao, e a correcao do filtro de data so estreita o resultado (
  remove falsos positivos do dia seguinte, nao esconde dados do periodo
  pedido).
- Rollback: reverter o commit por item ou o pacote inteiro; a migration do
  item 2 e aditiva (`ADD COLUMN`), reversivel sem perda de dado historico
  (colunas ficam para tras, nao apagam nada existente).

## 6) Criterios de aceitacao (CA)

- CA-101: fechar a aba com edicao pendente (`autosaveState !== "saved"`)
  dispara o prompt nativo do navegador de confirmacao de saida.
- CA-102: digitar em um atendimento novo (sem `selecionado`) e aguardar o
  debounce cria o atendimento automaticamente (POST), sem duplicar em
  digitacao rapida sucessiva.
- CA-103: apos o primeiro save, um autosave que falhe (endpoint fora do
  ar, simulado em teste manual) ainda deixa uma copia local recuperavel no
  `localStorage`, sob uma chave por `atendimento_id`.
- CA-201: salvar uma prescricao com `dose_mg_kg`/`peso_referencia_kg`/
  `unidade_dose_calculo`/`concentracao_personalizada` preenchidos e reabrir
  o atendimento preserva os 4 valores.
- CA-301: abrir dois atendimentos consecutivos do MESMO paciente preserva
  o cadastro complementar (raca, especie, etc.) visivel no segundo, sem
  precisar trocar de paciente para "destravar" o efeito.
- CA-401: um atendimento com `consulta_concluida = 1` no banco e campos
  clinicos incompletos NAO tem esse valor zerado ao abrir, e o checkbox
  manual do usuario nao e revertido pela completude dos campos.
- CA-501: `DELETE` de um atendimento `Concluido` sem flag de confirmacao
  retorna 409 confirmavel e nao apaga nada; com a flag, apaga e reverte
  agendamento/OS e registra auditoria.
- CA-601: um atendimento as 00:00:01 do dia seguinte ao `data_fim`
  filtrado NAO aparece na lista; um atendimento as 23:59:59 do proprio
  `data_fim` continua aparecendo.
- CA-701: excluir um exame do meio da lista (com upload pendente em outro
  exame mais adiante na lista) preserva a associacao correta entre draft
  de upload e exame apos o deslocamento de indices.
- CA-702: `cd backend && ./venv/bin/python -m pytest tests/ -k atendimento -q --no-header`
  aprovado, com contagem >= baseline atual (103 passed, 464 deselected -
  ja inclui o pacote atendimento-integridade-prontuario) mais os novos
  testes.
- CA-703: `npm run build` do frontend aprovado.

## 7) Casos de borda

- CB-101: usuario fecha a aba ANTES de qualquer paciente ser selecionado
  (form vazio) - `beforeunload` nao deve prompt (nao ha conteudo a perder).
- CB-102: dois autosaves automaticos de criacao disparados quase ao mesmo
  tempo (ex.: duplo debounce por edicao rapida) - guarda de idempotencia
  impede o segundo POST enquanto o primeiro esta em voo.
- CB-201: `unidade_dose_calculo` com valor fora dos 3 aceitos - rejeitado
  pela validacao do Pydantic, nao persistido como lixo.
- CB-501: atendimento sem `agendamento_id` (avulso) - DELETE nao tenta
  reverter agendamento/OS inexistentes.
- CB-601: `data_inicio == data_fim` (filtro de um unico dia) - continua
  trazendo os atendimentos daquele dia inteiro, do inicio ao fim.
- CB-701: exame novo (sem `id`) excluido antes de qualquer upload -
  `_localId` correspondente e limpo dos 3 mapas sem deixar entrada orfa.

## 8) Fora de escopo

- Migrar o frontend para consumir `prescricao.apoio_clinico` do backend em
  vez de recalcular localmente (item 2, ver `intent.md` secao 3).
- Migrar a chave `exame-${index}` de upload em progresso
  (`uploadingAttachmentKey`/`uploadProgressByKey`) - fora do escopo dos 3
  mapas citados no item 7.
- Qualquer refactor arquitetural de `page.tsx`/`atendimento.py`.
