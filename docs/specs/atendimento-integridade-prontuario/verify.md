# Verify - atendimento-integridade-prontuario

Data: 2026-07-31 (revisao adversarial e correcoes: 2026-08-01)
Responsavel: Claude (pareado com Martiniano)
Status: in-progress (backend e build verificados; smoke autenticado de UI pendente)

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_put_que_omite_exame_existente_nao_apaga_exame_nem_anexo` + smoke HTTP "exame omitido sobreviveu", "anexo do exame omitido sobreviveu", "arquivo fisico preservado" | ok |
| CA-002 | aceitacao | `test_exclusao_explicita_remove_exame` + smoke HTTP "_destroy aceito via JSON", "exame excluido por marcacao explicita"; mecanismo de remocao de arquivo isolado em `test_excluir_anexos_por_exame_remove_registro_e_arquivo_fisico` (ver secao 1.1) | ok |
| CA-003 | aceitacao | `test_exclusao_explicita_bloqueada_quando_exame_tem_laudo` + smoke HTTP `409` "possui laudo vinculado (#77)" | ok |
| CA-004 | aceitacao | `test_exclusao_explicita_bloqueada_quando_exame_tem_anexo` (`409` "Remova os arquivos"; exame, anexo e arquivo intactos) | ok |
| CA-005 | aceitacao | `test_exclusao_explicita_bloqueada_quando_exame_esta_liberado_no_portal` + smoke HTTP "exclusao de exame liberado bloqueada" | ok |
| CA-006 | aceitacao | `test_put_do_frontend_preserva_status_liberado_no_portal`, `test_put_do_frontend_preserva_liberacao_mesmo_sem_resultado`, `test_status_do_exame_e_derivado_no_servidor` + smoke HTTP "liberacao no portal preservada" | ok |
| CA-007 | aceitacao | `test_upload_anexo_preserves_portal_released_exam_status` (+ nao regressao: `test_upload_anexo_still_promotes_pending_exam_to_in_progress`, `test_upload_anexo_does_not_downgrade_concluded_exam`) | ok |
| CA-008 | aceitacao | `test_revogacao_explicita_devolve_exame_ao_status_derivado`, `test_revogar_exame_nao_liberado_retorna_conflito` + smoke HTTP "status derivado apos revogar", "revogar de novo retorna conflito" | ok |
| CA-009 | aceitacao | `test_concluir_com_agendamento_nulo_retorna_conflito_e_nao_altera_nada` + smoke HTTP "nada alterado apos o bloqueio" (status, vinculo, Agenda e zero OS) | ok |
| CA-010 | aceitacao | `test_reabrir_concluido_com_agendamento_nulo_retorna_conflito`, `test_desvincular_concluido_e_bloqueado_mesmo_com_confirmacao` | ok |
| CA-011 | aceitacao | `test_desvincular_sem_confirmacao_retorna_conflito_confirmavel`, `test_desvincular_com_confirmacao_e_auditado` + smoke HTTP com o `detail` completo | ok |
| CA-012 | aceitacao | `buildAtendimentoPayload` ([page.tsx:1166](../../../frontend/app/atendimento/page.tsx:1166)) monta `agendamento_id` por spread condicional; cobertura de efeito em `test_autosave_sem_agendamento_no_payload_preserva_o_vinculo` | ok |
| CA-013 | aceitacao | `pytest -k atendimento`: 91 aprovados (baseline 62) | ok |
| CA-014 | aceitacao | `test_reatribuir_agendamento_de_concluido_para_outro_valor_e_bloqueado` (ver secao 1.1) | ok |
| NFR-001 | nao funcional | CA-001 e CA-004 provam que nenhum `PUT` remove exame, anexo ou arquivo sem `_destroy` | ok |
| NFR-002 | nao funcional | CA-006, CA-007 e CA-008: liberacao muda apenas por `/portal/liberar` e `/portal/revogar` | ok |
| NFR-003 | nao funcional | Contrato de `POST /atendimentos/{id}/finalizar` intacto; `test_atendimento_transactional_finalization.py` (26 testes) segue verde | ok |
| NFR-004 | nao funcional | `_auditar_transicao_exame_portal` e `_auditar_desvinculo_agendamento`; `auditoria_mock.call_count == 1` em `test_desvincular_com_confirmacao_e_auditado` | ok |
| NFR-005 | nao funcional | `detail` do smoke: `{'codigo': 'CONFIRMACAO_DESVINCULO_AGENDAMENTO', 'confirmavel': True, 'agendamento_id': 1}` | ok |
| NFR-006 | nao funcional | `_contar_anexos_por_exame` resolve a contagem em uma consulta agregada por `_sync_exames` | ok |
| CB-001 | borda | `test_exclusao_de_exame_inexistente_e_ignorada` | ok |
| CB-002 | borda | `test_payload_marcado_para_exclusao_dispensa_tipo_exame` | ok |
| CB-004 | borda | `test_put_do_frontend_preserva_status_liberado_no_portal` (com `resultado` preenchido) | ok |
| CB-005 | borda | `test_revogar_exame_nao_liberado_retorna_conflito` | ok |
| CB-007 | borda | `test_atendimento_sem_vinculo_continua_podendo_concluir_por_put`, `test_desvincular_atendimento_sem_vinculo_nao_exige_confirmacao` | ok |
| RF-022 a RF-025 | funcional | Compilado e tipado; comportamento visual pendente do smoke autenticado (secao 3) | pendente |
| RF-026/RF-027 | funcional | `buildAtendimentoPayload` envia `status: item.status` e filtra apenas exame sem nome que nao esta marcado com `_destroy`; smoke HTTP "PUT do frontend aceito" com o payload real | ok |

| CB-006 | borda | `test_trocar_agendamento_de_um_valor_para_outro_nao_exige_confirmacao` (ver secao 1.1) | ok |

`CB-003` e `CB-008` continuam cobertos por leitura do codigo, sem teste
dedicado: exame novo com `_destroy` cai no mesmo `continue` de `CB-001`; e o
guard de laudo checa `exame.laudo_id` sem consultar a tabela `laudos`.

## 1.1) Revisao adversarial pos-implementacao

Antes do commit, rodei uma revisao com 6 agentes independentes (4 dimensoes de
bug com verificacao adversarial de cada achado - transacionalidade,
derivacao de status, guards de vinculo, frontend - mais 2 checklists sem
verificacao adversarial - conformidade com spec, lacunas de teste). 10 agentes,
261 chamadas de ferramenta, ~917k tokens.

**Achados de alta severidade, confirmados e corrigidos:**

- **RF-028/CA-014**: reatribuir `agendamento_id` de um atendimento **concluido**
  para OUTRO agendamento nao-nulo nao disparava nenhum dos tres guards
  originais (eles so cobriam transicao de status atraves da fronteira
  `Concluido` ou desvinculo explicito com `null`). Corrigido generalizando o
  guard: `alterando_vinculo_agendamento = "agendamento_id" in data and
  agendamento_destino != agendamento_atual`; se o atendimento ja esta
  concluido, qualquer mudanca (nulificar OU reatribuir) e bloqueada com `409`,
  antes mesmo de chegar no sub-caso que exige confirmacao. Teste novo:
  `test_reatribuir_agendamento_de_concluido_para_outro_valor_e_bloqueado`
  (`backend/tests/test_atendimento_vinculo_agendamento_guard.py`). Verifiquei
  que os 8 testes existentes do arquivo continuam passando com a
  generalizacao (a ordem dos guards de transicao de status, que rodam antes,
  nao muda).
- Os testes de auditoria de liberacao/revogacao no portal mockavam
  `_auditar_transicao_exame_portal` sem capturar nem afirmar `.call_count`.
  Corrigido em `test_liberar_ecg_importado_normaliza_tipo_e_publica_exame`
  (`test_atendimento_portal_exam_release.py`) e
  `test_revogacao_explicita_devolve_exame_ao_status_derivado`
  (`test_atendimento_exame_integridade.py`): ambos agora capturam o mock e
  afirmam `call_count == 1` e a `acao` registrada.
- `test_exclusao_explicita_remove_exame_e_arquivo` criava um anexo real mas
  nunca verificava a remocao do arquivo de fato — e, ao investigar, o cenario
  se revelou **inalcancavel pelo endpoint publico**: o proprio guard de
  CA-004 bloqueia exclusao de exame com anexo, entao `_excluir_anexos_por_exame`
  dentro do loop de `_sync_exames` so roda quando a contagem de anexos ja e
  zero (nada para limpar). Dividido em tres testes: `test_exclusao_
  explicita_remove_exame` (sem anexo, caminho real via `PUT`),
  `test_excluir_anexos_por_exame_remove_registro_e_arquivo_fisico` (chama o
  helper diretamente para provar que o mecanismo de remocao — registro e
  arquivo em disco — funciona), e `test_remover_anexo_individual_depois_
  excluir_exame_agora_vazio` (fluxo real de dois passos: `DELETE
  /anexos/{id}` primeiro, depois `_destroy` no exame agora sem anexo).

**Achados de media/baixa severidade, confirmados e registrados como risco
residual (nao corrigidos nesta rodada — decisao explicita, ver secao 4):**

- Lacuna de teste para dois exames marcados `_destroy` no mesmo payload com
  resultados mistos (um passa o guard, outro e bloqueado). Fechada com
  `test_exclusao_com_dois_exames_resultado_misto_nao_apaga_o_permitido`.
- Race condition no autosave do frontend: chamadas sobrepostas podem reverter
  `_destroy` de um exame ja excluido com sucesso por uma chamada anterior,
  fazendo-o reaparecer e ser recriado como duplicata no proximo save. Requer
  timing de rede desfavoravel; a causa raiz (falta de sequenciamento/
  `AbortController` no debounce de autosave) e pre-existente e esta no escopo
  do pacote `atendimento-persistencia-e-fluidez`.
- Ausencia de controle de concorrencia otimista (versao/`updated_at`/
  `with_for_update`) em `atualizar_atendimento`, ao contrario de
  `finalizar_atendimento` que usa `_adquirir_lock_finalizacao`. Pre-existente,
  nao introduzido por este pacote.
- Duas dimensoes (conformidade com spec e logica de derivacao de status —
  o cerne do defeito D2) voltaram **sem nenhum achado**: a implementacao bate
  com o `spec.md` requisito a requisito, e nenhuma sequencia de chamadas
  (save, upload, liberar, revogar) conseguiu tirar um exame de `Liberado no
  portal` sem passar por `/portal/revogar`.

## 2) Testes automatizados executados

```bash
cd /Users/martiniano/fortcordis-v2/backend
./venv/bin/python -m pytest tests/ -k atendimento -q --no-header
./venv/bin/python -m pytest tests/ -q --no-header

cd /Users/martiniano/fortcordis-v2/frontend
npx tsc --noEmit --pretty false
npm run lint
npm run build
```

Resumo dos resultados:

- **Backend, modulo Atendimento:** `91 passed, 454 deselected` em 3,49 s.
  Baseline antes das mudancas medido no mesmo comando: `62 passed, 454
  deselected`. Os 29 testes novos (24 da primeira rodada + 5 da revisao
  adversarial da secao 1.1) sao:
  - `tests/test_atendimento_exame_integridade.py` - 16 testes (exclusao por
    omissao, exclusao explicita, os tres guards de `409`, idempotencia,
    validacao do schema, derivacao de status, preservacao da liberacao,
    revogacao e conflito de revogacao, mecanismo de remocao de arquivo
    isolado, fluxo real de dois passos, resultado misto entre dois exames);
  - `tests/test_atendimento_vinculo_agendamento_guard.py` - 10 testes (evasao
    dos dois guards com `agendamento_id: null`, desvinculo de concluido,
    confirmacao, auditoria, reatribuicao bloqueada em concluido - RF-028,
    troca de vinculo sem confirmacao em aberto - CB-006, e as duas nao
    regressoes);
  - `tests/test_atendimento_upload_endpoint.py` - 3 testes novos no arquivo
    existente (liberacao preservada, promocao normal para `Em andamento`,
    concluido nao rebaixado).
- **Backend, suite completa:** `1 failed, 544 passed, 13 subtests passed` em
  27,53 s. A unica falha e `test_migration_ci_cycle.py`, com
  `TypeError: upgrade() takes 1 positional argument but 2 were given` - o
  bloqueio pre-existente de `20260730_58_portal_partner_auth.py` (pacote
  Portal). Este pacote **nao cria migration**, portanto nao amplia o bloqueio.
- **TypeScript:** aprovado, sem diagnosticos.
- **ESLint:** `npm run lint` aprovado no projeto inteiro (`--max-warnings=0`).
- **Build Next.js:** aprovado, 39 paginas geradas; `/atendimento` com 43,8 kB e
  180 kB de First Load JS.
  (Os tres resultados de frontend acima sao da rodada original; a correcao
  pos-revisao da secao 1.1 nao tocou nenhum arquivo de frontend, entao
  permanecem validos.)

### Smoke HTTP em banco isolado

Script: `scratchpad/smoke_integridade.py` (temporario, fora do repositorio).
Sobe o `app` real com `TestClient`, `Base.metadata.create_all` em SQLite
temporario e `dependency_overrides` para sessao e usuario. Valida o que os testes
de funcao nao cobrem: o alias `_destroy` atravessando JSON -> pydantic, o
roteamento das duas rotas de portal e a geracao do OpenAPI com o novo parametro
`request`.

22 verificacoes, todas aprovadas:

```text
[OK] PUT do frontend aceito -- HTTP 200
[OK] exame omitido sobreviveu
[OK] anexo do exame omitido sobreviveu
[OK] arquivo fisico preservado
[OK] liberacao no portal preservada
[OK] vinculo com a agenda preservado
[OK] _destroy aceito via JSON -- HTTP 200
[OK] exame excluido por marcacao explicita
[OK] exclusao com laudo bloqueada -- HTTP 409: O exame #3 possui laudo
     vinculado (#77) e nao pode ser excluido pelo prontuario.
[OK] exclusao de exame liberado bloqueada -- HTTP 409
[OK] concluir com agendamento_id nulo bloqueado -- HTTP 409
[OK] nada alterado apos o bloqueio
[OK] desvinculo sem confirmacao bloqueado -- HTTP 409:
     {'codigo': 'CONFIRMACAO_DESVINCULO_AGENDAMENTO', 'confirmavel': True,
      'agendamento_id': 1}
[OK] revogacao aceita -- HTTP 200
[OK] status derivado apos revogar -- Concluido
[OK] revogar de novo retorna conflito -- HTTP 409
[OK] liberacao aceita -- HTTP 200
[OK] status liberado apos liberar -- Liberado no portal
[OK] desvinculo confirmado aceito -- HTTP 200
[OK] vinculo removido
```

## 3) Testes manuais

Nao ha runner de teste no frontend (`frontend/package.json` sem script `test`,
zero arquivos `*.test.*` no projeto), entao os criterios de UI dependem de smoke
autenticado.

**Status: nao executado.** O smoke exige login na aplicacao, e digitar
credenciais nao e uma acao que eu execute. Roteiro preparado para o Martiniano,
com o resultado esperado de cada passo:

1. **Autosave nao apaga exame** - abrir um atendimento com exame que tenha PDF
   anexado, limpar o campo "Tipo de exame", aguardar 2 s (autosave).
   *Esperado:* exame e PDF continuam na lista; nenhum erro; o exame nao e
   atualizado enquanto o nome estiver em branco.
2. **Exclusao explicita** - clicar na lixeira de um exame ja salvo.
   *Esperado:* dialogo de confirmacao; ao confirmar, o exame sai da lista e a
   exclusao e aplicada no proximo save.
3. **Exclusao bloqueada** - repetir o passo 2 num exame com PDF anexado.
   *Esperado:* mensagem "O exame #N possui X arquivo(s) anexado(s). Remova os
   arquivos antes de excluir o exame." e o exame **volta** para a lista.
4. **Exclusao bloqueada por laudo** - repetir num exame com laudo vinculado.
   *Esperado:* mensagem citando o laudo; exame preservado.
5. **Liberar no portal** - num exame com PDF, clicar "Liberar no portal".
   *Esperado:* chip roxo "Liberado no portal"; o botao vira "Revogar portal".
   Sem PDF anexado, o botao fica desabilitado com tooltip explicando.
6. **Liberacao sobrevive ao save** - editar qualquer campo clinico e aguardar o
   autosave. *Esperado:* o chip "Liberado no portal" permanece.
7. **Liberacao sobrevive ao upload** - anexar um segundo arquivo ao exame
   liberado. *Esperado:* o chip permanece.
8. **Revogar** - clicar "Revogar portal". *Esperado:* confirmacao; depois o chip
   volta a "Interpretado" ou "Arquivo anexado" conforme o conteudo.
9. **Vinculo preservado** - abrir um atendimento vinculado a agendamento, digitar
   e aguardar o autosave. *Esperado:* o prontuario continua vinculado; a Agenda
   nao muda de status e nenhuma OS e criada.
10. **Filtro "No portal"** - usar o filtro rapido de exames.
    *Esperado:* lista apenas os exames liberados.

## 4) Regressao e riscos residuais

- **Risco residual 1:** exames que antes eram apagados por omissao agora
  sobrevivem. Bases com payloads antigos podem acumular exames vazios ate que
  alguem use "Remover vazios" ou a lixeira. Nenhum dado e perdido; o efeito e
  ruido na lista.
- **Risco residual 2:** exclusao de exame com anexo exige remover os arquivos
  primeiro. E um passo a mais deliberado; a mensagem de erro orienta o caminho.
- **Risco residual 3:** o `status` de exame enviado pelo cliente passou a ser
  ignorado. Se algum outro consumidor da API dependia de escrever esse campo via
  `PUT /atendimentos/{id}`, precisa usar os endpoints dedicados. Nenhum consumidor
  desse tipo foi encontrado no repositorio.
- **Risco residual 4:** os criterios de UI (RF-022 a RF-025) estao verificados
  por compilacao e tipagem, nao por interacao. Ficam pendentes do roteiro da
  secao 3.
- **Risco residual 5:** `DELETE /atendimentos/{id}` continua sem guard, sem
  reversao de Agenda/OS e sem auditoria. Fora do escopo deste pacote,
  enderecado em `atendimento-persistencia-e-fluidez`.
- **Risco residual 6:** a auditoria segue best-effort com sessao propria
  (`registrar_auditoria`). Uma falha de auditoria nao desfaz a operacao clinica,
  por desenho.
- **Risco residual 7** (achado pela revisao adversarial, decisao explicita de
  nao corrigir nesta rodada): race condition no autosave do frontend entre
  `removerExame`/o revert de `_destroy` no `catch` de `saveAtendimento` e a
  ausencia de sequenciamento entre chamadas de autosave sobrepostas
  (pre-existente). Cenario: duas chamadas de autosave em voo ao mesmo tempo,
  uma delas exclui um exame com sucesso, a outra falha por motivo nao
  relacionado e reverte `_destroy` sobre o exame ja excluido, que reaparece na
  tela e e recriado como registro duplicado no proximo save. Exige timing de
  rede desfavoravel. A correcao raiz (sequenciamento/`AbortController` no
  debounce de autosave) e escopo do pacote `atendimento-persistencia-e-fluidez`
  (item 1: "guarda de idempotencia contra duplo POST").
- **Risco residual 8** (achado pela revisao adversarial, pre-existente, nao
  introduzido por este pacote): `atualizar_atendimento` nao tem controle de
  concorrencia otimista (versao/`updated_at`/`with_for_update`), ao contrario
  de `finalizar_atendimento`. Duas requisicoes `PUT` concorrentes no mesmo
  atendimento leem o mesmo snapshot antes de qualquer commit.

### Bloqueios externos observados (nao introduzidos por este pacote)

1. `test_migration_ci_cycle.py` falha em
   `backend/migrations/versions/20260730_58_portal_partner_auth.py:22`, que
   define `upgrade(connection)` enquanto `backend/migrations/runner.py:150`
   chama `upgrade(connection, dialect_name)`. Como o ciclo para na 58, a
   **migration 59 do Atendimento nunca e aplicada pelo runner real**. Arquivo do
   pacote Portal.
2. A migration `20260730_59` aborta a esteira inteira quando ha duplicidade
   preexistente: `_assert_no_duplicates` levanta `RuntimeError` antes de criar os
   indices unicos parciais, e o runner para na primeira falha, bloqueando tambem
   a `20260730_60`. **Exige conciliacao de dados em stage e producao antes do
   deploy.**

## 5) Itens fora de escopo entregues

- `frontend/lib/api-error.ts`: `readDetailFromObject` passou a ler `detail` como
  objeto (`{ codigo, mensagem, confirmavel }`). Necessario para RF-025 - sem
  isso, o `409` de desvinculo apareceria como "Request failed with status code
  409". Beneficia todos os conflitos confirmaveis da aplicacao.
- `backend/tests/test_atendimento_portal_exam_release.py`: passou a mockar
  `_auditar_transicao_exame_portal`. Sem isso, a auditoria nova abriria sessao
  contra o banco de desenvolvimento durante o teste, que usa SQLite temporario.
- O commit `49c4076f` consolidou os pacotes SDD de Atendimento e Agenda que
  estavam na working tree, como acordado antes de iniciar. `agenda.py` misturava
  o guard da finalizacao com `agenda-admin-alteracao-servico-hoje`, inseparaveis
  por arquivo, entao os dois entraram no mesmo commit. Portal (migrations
  `57`/`58`/`60` e frontend correspondente) ficou intocado.

### Efeito colateral a limpar

O smoke HTTP gravou **6 eventos de auditoria** no banco de desenvolvimento
`backend/fortcordis.db` (ids 177, 178, 180, 181, 182, 183 - acoes
`LIBERAR_EXAME_PORTAL`, `REVOGAR_EXAME_PORTAL` e `DESVINCULAR_AGENDAMENTO`),
porque `registrar_auditoria` abre sessao propria contra `DATABASE_URL`. Os
testes ja nao produzem mais esses eventos apos o mock do item anterior. As 6
linhas continuam no banco local; nao foram removidas.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda o roteiro manual da secao 3 e a conciliacao de dados do
  bloqueio externo 2.
