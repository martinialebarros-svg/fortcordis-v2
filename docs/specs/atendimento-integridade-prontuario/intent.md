# Intent - atendimento-integridade-prontuario

Data: 2026-07-31
Responsavel: Claude (pareado com Martiniano)
Status: approved

## 1) Problema atual

Tres defeitos confirmados por leitura direta do codigo fazem o modulo de
Atendimento Clinico destruir dado clinico e furar a fronteira transacional
Atendimento/Agenda/OS entregue no pacote
`atendimento-agenda-transactional-finalization`.

### D1 - O autosave apaga exames, anexos e arquivos fisicos sem confirmacao

`buildAtendimentoPayload` filtra fora todo exame com `tipo_exame` vazio
(`frontend/app/atendimento/page.tsx:1168`). No backend, `_sync_exames` deleta
todo exame do atendimento que nao veio no payload e chama
`_excluir_anexos_por_exame` (`backend/app/api/v1/endpoints/atendimento.py:1649`
e `:870`), que apaga os registros de anexo **e os arquivos em disco** via
`remove_atendimento_attachment_file`.

Cenario reproduzivel: abrir um atendimento com exame anexado, limpar o campo
"tipo de exame" para redigitar, aguardar 1,8 s (autosave). O exame e o PDF do
resultado desaparecem. Sem confirmacao, sem toast, sem recuperacao.

O delete tambem nao protege exames com `laudo_id` vinculado nem exames com
status `Liberado no portal`, entao o dano cruza para Laudos e Portal.

### D2 - Salvar o atendimento revoga a liberacao do exame no Portal

`PORTAL_RELEASED_STATUS = "Liberado no portal"`
(`backend/app/core/portal_release.py:1`) e o valor exato que o Portal usa para
autorizar acesso (`backend/app/api/v1/endpoints/portal.py:393-408`).

Ha dois caminhos independentes de revogacao acidental:

1. `resolveExamBackendStatus` (`page.tsx:928`) recalcula o status a cada save e
   so conhece `Concluido | Em andamento | Solicitado`; `_sync_exames` aceita
   cegamente `exame.status = (payload.status or "Solicitado").strip()`
   (`atendimento.py:1633`).
2. No upload de anexo, `if exame and not _status_exame_concluido(exame.status)`
   rebaixa o exame para `Em andamento` (`atendimento.py:3855`).
   `_status_exame_concluido` so casa com o prefixo `concluid`
   (`atendimento.py:1436`), entao anexar um segundo arquivo a um exame ja
   liberado o retira do Portal.

Alem disso, `POST /atendimentos/exames/{exame_id}/portal/liberar`
(`atendimento.py:3624`) nao possui nenhum caller no frontend: os unicos callers
de portal na UI apontam para `/laudos/{id}/portal/liberar`, endpoint diferente.
Existe backend de liberacao sem porta de entrada, e nao existe revogacao.

### D3 - `PUT` com `agendamento_id: null` fura os guards da finalizacao

`agendamento_destino = data.get("agendamento_id", atendimento.agendamento_id)`
(`atendimento.py:2795`) e os dois bloqueios `409` da finalizacao transacional so
rodam `if agendamento_destino` (`:2835` e `:2847`).

Com `exclude_unset=True`, o payload `{"agendamento_id": null, "status":
"Concluido"}` faz `agendamento_destino = None`, pula os dois guards, desvincula
o prontuario (`:2871`) e o conclui sem gerar OS e sem marcar a Agenda como
`Realizada`. O mesmo caminho reabre um atendimento concluido.

E alcancavel pela UI: `buildAtendimentoPayload` envia sempre
`agendamento_id: form.agendamento_id ? Number(...) : null`
(`page.tsx:1152`). Qualquer estado com o campo vazio (restauracao de rascunho,
hidratacao parcial) faz o **autosave desvincular silenciosamente** o prontuario.
Isso tambem libera o indice unico `ux_atendimentos_clinicos_agendamento_unico`,
permitindo um segundo prontuario no mesmo agendamento.

## 2) Objetivo

Tornar a exclusao de exame, o status de liberacao no Portal e o vinculo com a
Agenda **propriedades explicitas e protegidas** do servidor:

- exame so e excluido quando o cliente pede a exclusao por marcacao explicita;
- exame com laudo vinculado, com anexo ou liberado no Portal nao pode ser
  excluido pelo prontuario;
- `status` do exame passa a ser derivado pelo servidor e a liberacao no Portal
  sobrevive a qualquer save ou upload;
- liberar e revogar no Portal ganham acao explicita na UI de Atendimento;
- desvincular um prontuario da Agenda passa a ser acao confirmada e auditada,
  nunca efeito colateral de um `PUT` parcial;
- os dois guards `409` da finalizacao transacional passam a avaliar o vinculo
  atual em banco, nao o destino do payload.

Valor operacional: prontuario, anexo e liberacao no Portal param de desaparecer
durante a digitacao normal da consulta, e a fronteira transacional homologada
deixa de ser contornavel.

## 3) Nao objetivos

- Refatorar `frontend/app/atendimento/page.tsx` (spec propria:
  `docs/specs/arch-fe-01-modularizar-atendimento-for39/`).
- Alterar o contrato de `POST /atendimentos/{id}/finalizar` (homologado).
- Introduzir soft-delete em `exames`. Avaliado e adiado: a tabela nao possui
  coluna de exclusao logica (`backend/app/models/laudo.py:45-85`) e filtrar
  exclusao logica exigiria tocar as leituras de Atendimento, Laudos, Portal,
  Agenda e fiscal. Fica como pacote proprio.
- Os demais ~27 achados da auditoria: perda de texto por falta de
  `beforeunload`, calculo mg/kg descartado no save, `DELETE /atendimentos/{id}`
  sem guard nem auditoria, filtro de data com off-by-one, estado de exames
  indexado por posicao, `consulta_concluida` com dois donos, timezone
  naive/aware. Ficam para `atendimento-persistencia-e-fluidez`.
- Conciliar duplicidades historicas de agendamento em stage/producao.
- Publicar em stage ou producao sem solicitacao explicita.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - o pacote da finalizacao transacional foi commitado antes deste trabalho
    (`49c4076f`); o pacote de Portal (migrations `57`/`58`/`60`, `laudos.py`,
    `portal.py`, `tutores.py` e frontend correspondente) permanece na working
    tree e nao deve ser tocado;
  - se houver migration, ela entra **depois** da `20260730_59` e deve usar
    `upgrade(connection, dialect: str | None = None)`;
    `20260730_58_portal_partner_auth.py:22` usa a assinatura errada e ja quebra
    `test_migration_ci_cycle.py` - nao replicar;
  - nao existe binario `python` no PATH: usar `backend/venv/bin/python`;
  - nao existe runner de teste no frontend (`frontend/package.json` sem
    `test`, zero arquivos `*.test.*` no projeto), entao a verificacao de UI e
    manual e registrada no `verify.md`.
- Restricoes de prazo: pacote de correcao, sem dependencia externa.
- Restricoes regulatorio/operacional: exame, anexo e resultado sao prontuario.
  Exclusao precisa ser intencional, bloqueada quando ha laudo ou liberacao, e a
  desvinculacao do prontuario precisa deixar rastro de auditoria.

## 5) Impacto esperado

- Usuarios impactados: veterinarios (tela de Atendimento), clinicas parceiras
  (acesso a exame liberado no Portal), financeiro (OS que deixa de ser pulada).
- Modulos impactados: Atendimento (backend e frontend), Portal (leitura de
  liberacao), Laudos (exame com `laudo_id`), Agenda (vinculo).
- Risco de regressao:
  - o cliente deixa de mandar exclusao por omissao; se algum fluxo dependia
    disso, exames antes apagados passam a sobreviver;
  - `status` do exame enviado pelo cliente passa a ser ignorado;
  - `agendamento_id` deixa de ser enviado quando vazio, o que muda o payload de
    autosave e criacao.

## 6) Riscos iniciais

- Risco 1: exames "fantasma" acumulados por payloads antigos que dependiam da
  exclusao por omissao. Mitigacao: acao explicita de excluir exame na UI, com
  confirmacao, e botao "Remover vazios" passando a marcar `_destroy`.
- Risco 2: derivar `status` no servidor sobrescrever um status legitimo escrito
  por outro modulo. Mitigacao: preservar explicitamente `Liberado no portal`
  (escrito por `atendimento.py:3657` e `laudos.py:193`) e derivar apenas entre
  `Solicitado`, `Em andamento` e `Concluido`.
- Risco 3: bloquear a desvinculacao romper algum fluxo de troca de agendamento.
  Mitigacao: a troca por outro `agendamento_id` continua permitida; so a
  desvinculacao para `null` exige confirmacao, e prontuario concluido fica
  bloqueado.
- Risco 4: exclusao bloqueada por anexo virar beco sem saida. Mitigacao: a UI
  ja possui exclusao de anexo por item (`AtendimentoExamesSection.tsx:695`); a
  mensagem de erro orienta remover os arquivos primeiro.

## 7) Perguntas abertas

Resolvidas com o Martiniano em 2026-07-31, antes da spec:

- Escopo desta rodada: apenas este pacote, com documentos, codigo, testes e
  `verify.md` com numeros reais. `atendimento-persistencia-e-fluidez` fica para
  a rodada seguinte. **Decidido.**
- Pendencia da working tree: commitar so a fatia Atendimento/Agenda antes de
  comecar, deixando Portal intocado. **Feito em `49c4076f`** (27 arquivos, 3
  specs). `agenda.py` misturava o guard da finalizacao com o pacote
  `agenda-admin-alteracao-servico-hoje`, que nao era separavel por arquivo e
  entrou no mesmo commit.
- `POST /atendimentos/exames/{exame_id}/portal/liberar`: manter e ligar na UI
  neste pacote, com revogacao explicita como par. **Decidido.**
- Exclusao de exame: `_destroy` explicito com hard delete e guards `409`
  (laudo, anexo, liberacao), sem migration. **Decidido.**

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
