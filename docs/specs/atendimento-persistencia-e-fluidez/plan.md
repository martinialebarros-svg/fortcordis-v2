# Plan - atendimento-persistencia-e-fluidez

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (investigacao): concluida - 7 leitores confirmaram estado atual e
  drift de linha contra `origin/stage @ 701bc965` (registrado em `intent.md`
  e nas secoes de implementacao abaixo).
- Fase 2 (backend, itens isolados e de baixo risco primeiro): item 6
  (filtro de data), item 5 (guard do DELETE), item 2 backend (migration +
  schema + model + map/sync).
- Fase 3 (frontend, do mais simples ao mais entrelacado): item 3 (cadastro
  complementar - reclassificado como frontend-only durante a
  implementacao, ver `spec.md`), item 2 frontend (buildAtendimentoPayload),
  item 4 (consulta_concluida), item 7 (indexacao de exames), item 1 (perda
  de texto clinico - por ultimo, e o que mais toca efeitos compartilhados).
- Fase 4 (testes e verificacao): suite pytest, roteiro manual dos itens
  sem cobertura automatizada, revisao adversarial item a item.
- Fase 5 (documentacao e release): `verify.md`, commit, guardrail SDD,
  deploy (mediante confirmacao do usuario).

Ordem escolhida deliberadamente: backend antes de frontend (fundacao de
dados antes de UI), e dentro do frontend, do item mais isolado
(consulta_concluida, um unico efeito) ao mais entrelacado (item 1, que
toca autosave/draft/criacao - as mesmas variaveis que os itens 4 e 7
tambem tocam de forma mais pontual). Implementacao sequencial no mesmo
worktree, nao paralela, porque os itens 1/4/7 compartilham arquivo e
estado (`autosaveState`, `hydratingFormRef`, `form.exames`).

## 2) Tarefas por fase

### Fase 2 - Backend

- [ ] T2.1 (item 6) `backend/app/api/v1/endpoints/atendimento.py`: trocar
  `data_atendimento < dt_fim + timedelta(days=1)` por
  `data_atendimento <= dt_fim` em `listar_atendimentos` (~linha 2111).
  Teste novo: atendimento no dia seguinte (00:00:01) fica de fora;
  atendimento as 23:59:59 do proprio `data_fim` continua dentro.
- [ ] T2.2 (item 5) `excluir_atendimento` (~linha 3567): adicionar guard de
  status "Concluido" com 409 confirmavel (`confirmar_exclusao`); reverter
  `agendamento.status` e cancelar OS ativa via `_buscar_os_ativa` quando
  `agendamento_id` presente; limpar `EvolucaoClinica`/
  `PrescricaoItemAjuste`/`AlertaClinico` orfaos; chamar
  `registrar_auditoria` (acao `ATENDIMENTO_EXCLUIDO`) antes do commit.
  Endpoint ganha `request: Request`. Testes novos: delete sem confirmacao
  em atendimento concluido -> 409; delete com confirmacao reverte
  agendamento/OS e audita; delete de atendimento avulso (sem
  agendamento_id) nao tenta reverter nada.
- [ ] T2.3 (item 2, backend) migration nova (`upgrade(connection,
  dialect=None)`) adicionando `dose_mg_kg`, `peso_referencia_kg`,
  `unidade_dose_calculo`, `concentracao_personalizada` (nullable) em
  `prescricoes_itens`; `PrescricaoItemPayload` e model `PrescricaoItem`
  ganham os campos; `_map_prescricao_item` e o bloco de atribuicao em
  `_sync_prescricao` passam a serializar/persistir. Teste novo: salvar e
  reler prescricao com os 4 campos preenchidos preserva os valores; linha
  legada (sem os campos) continua lendo sem erro.
- Criterio de conclusao da Fase 2: `pytest -k atendimento` cobrindo os 4
  itens acima, todos passando.
- Risco: baixo a moderado (item 5 mexe em efeitos colaterais de
  agendamento/OS - mitigado por reaproveitar helpers existentes
  `_buscar_os_ativa`/`registrar_auditoria`, ja usados em
  `_emitir_efeitos_finalizacao`).
- Rollback: reverter o commit; migration do item 2 e aditiva (`ADD
  COLUMN`), sem downgrade destrutivo necessario.

### Fase 3 - Frontend

- [ ] T3.0 (item 3) trocar `aplicarCadastroComplementar(d.paciente, d.tutor)`
  (em `abrirAtendimento`, ~2555) e `aplicarCadastroComplementar(contexto.paciente,
  contexto.tutor)` (fluxo de contexto de agendamento, ~1886) por
  `void carregarCadastroComplementar(<paciente_id>)` nos dois pontos -
  reaproveita a busca ja existente e testada em `/pacientes/{id}` +
  `/tutores/{id}`, sem exigir mudanca de contrato no backend.
- [ ] T3.1 (item 2, frontend) `buildAtendimentoPayload`: incluir os 4
  campos novos no mapeamento de `prescricao.itens`.
- [ ] T3.2 (item 4) remover a escrita em `form.consulta_concluida` no
  `useEffect` (~5160-5163); manter `consultaEtapasCompletas` so como prop
  visual do badge em `AtendimentoConsultaEditorSection.tsx`.
- [ ] T3.3 (item 7) adicionar `_localId` em `emptyExam()`; trocar a chave
  dos 3 mapas (`examesExpandidos`, `examUploadDrafts`, `examDropActive`) e
  a key do React em `AtendimentoExamesSection.tsx` de indice para
  `exame.id ?? exame._localId`, em todos os pontos de leitura/escrita
  (`mergeExamesNoFormulario`, `removerExame`, `clearExamUploadDraft`,
  `setExamUploadDraftFile`, `clearExamDropState`, `removerExamesVazios`).
  `index` continua usado onde a mutacao e por posicao no array
  (`atualizarExame`, `resolveExamIdForUpload`).
- [ ] T3.4 (item 1) quatro mudancas coordenadas:
  (a) handler `beforeunload` lendo `autosaveStateRef`;
  (b) flush no cleanup do efeito de autosave (~3906-3933) quando ha timer
  pendente;
  (c) permitir POST automatico em modo autosave quando `!selecionado` e ha
  paciente + conteudo minimo, com guarda de idempotencia
  (`creatingAtendimentoRef`);
  (d) chave do rascunho em `localStorage` passa a incluir `atendimento_id`
  e o snapshot de fallback continua sendo escrito apos o primeiro save
  (nao so antes).
- Criterio de conclusao da Fase 3: `npm run build` aprovado; roteiro manual
  (T4.2) executado com sucesso para os itens 1, 3, 4 e 7.
- Risco: moderado - item 1 (T3.4) e o mais arriscado por tocar
  `autosaveState`/criacao automatica; mitigado por implementa-lo por
  ultimo, com o restante do arquivo ja estabilizado pelos itens
  anteriores, e por testar manualmente antes de fechar o pacote.
- Rollback: reverter o commit do item especifico (cada item e uma unidade
  logica de commit dentro do pacote, quando possivel).

### Fase 4 - Testes e verificacao

- [ ] T4.1 `cd backend && ./venv/bin/python -m pytest tests/ -k atendimento -q --no-header`
  - comparar contagem com o baseline (62 passed antes deste pacote, mais os
  novos testes dos itens 2/3/5/6).
- [ ] T4.2 Roteiro manual (sem test runner de frontend) para os itens 1, 3,
  4 e 7 - documentado passo a passo no `verify.md`, idealmente com
  verificacao visual via browser contra stage.
- [ ] T4.3 Revisao adversarial: confirmar, item por item, que a correcao
  resolve o defeito descrito sem reabrir nenhum dos 3 defeitos ja corrigidos
  no pacote `atendimento-integridade-prontuario` (ex.: guard de exclusao de
  exame com laudo/portal, preservacao de status "Liberado no portal",
  guard de `agendamento_id null`).
- Criterio de conclusao: `verify.md` com evidencia de todos os CAs.
- Risco residual: item 1 (T3.4) depende de teste manual (sem cobertura
  automatizada) - qualquer regressao so aparece em uso real; mitigado por
  roteiro manual detalhado antes do deploy.

### Fase 5 - Documentacao e release

- [ ] T5.1 `verify.md` com matriz de rastreabilidade completa.
- [ ] T5.2 Commit(s) no worktree.
- [ ] T5.3 `python3 scripts/ci/check_sdd_guardrail.py --base-sha <origin/stage antes> --head-sha <apos commit>`.
- [ ] T5.4 Perguntar ao usuario antes de dar push/deploy (stage -> producao),
  seguindo o padrao dos pacotes anteriores.

## 3) Plano de testes

- Backend: testes novos em `backend/tests/`, seguindo o padrao dos
  arquivos existentes (`test_atendimento_*.py`), um por item (6, 5, 3, 2).
- Frontend: sem test runner - roteiro manual documentado no `verify.md`
  para os itens 1, 3, 4 e 7, com verificacao visual via Browser tool contra
  stage quando possivel (reaproveitando sessao ja autenticada de revisoes
  anteriores nesta mesma conversa).
- Rodar a suite completa do modulo ao final:
  `cd backend && ./venv/bin/python -m pytest tests/ -k atendimento -q --no-header`
  e reportar o numero real. Baseline medido neste worktree, antes de
  qualquer mudanca deste pacote (origin/stage @ 701bc965): **103 passed,
  464 deselected** (o baseline de 62 citado no prompt original e de antes
  do pacote atendimento-integridade-prontuario ser mesclado).

## 4) Dependencias e bloqueios

- Depende do pacote `atendimento-integridade-prontuario` (concluido, em
  producao desde `2c3c1de0`/promocoes anteriores).
- Nenhum bloqueio de infraestrutura identificado (as pendencias de
  infraestrutura do pacote anterior - `test_migration_ci_cycle.py` e a
  migration `20260730_59` - ja foram resolvidas ou nao afetam este pacote,
  visto que o guardrail SDD e a suite de migrations estao passando na CI
  atual de `origin/stage`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
