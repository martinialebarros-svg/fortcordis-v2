# Verify — Fluxo de confecção do laudo ecocardiográfico

## Restauração planejada de stage após a promoção de04/11/2026

Este ramo prepara a **restauração completa de stage** a partir do backup `1a5b444a`. Os registros abaixo sobre recorte e exclusão de HP descrevem o snapshot destinado a produção na PR549; não redefinem o conteúdo de stage restaurado. Stage recupera HP, comparação anterior, Gestão e demais recursos do backup, com suas fontes, testes e documentos completos. Produção permanece restrita à conferência/prévia e dependências autorizadas. A salvaguarda de Nginx e a evidência desta publicação são mantidas. Cache eco v35 distingue o renderer completo de stage do renderer v34 do recorte; PA não muda. Nenhuma tabela, frase, fórmula ou intervalo clínico é alterado por esta restauração. A instalação e o smoke da restauração serão registrados após resultado terminal.


## Promoção isolada autorizada —04/11/2026

Pedido humano atual: “Publique em produção a conferência final e a prévia do PDF do laudo.” A entrega inclui a fase1b de rascunho/atualização atômica **como dependência necessária e explícita da prévia na edição**, usada na homologação do caso sintético63. A fase1a já está em produção. O recorte parte de main3f134432 e reaplica os commits funcionais49ca4381/a5ed822a/e541de8c, resolvendo contextos contra o baseline de produção. Nenhuma migração nova:105 já integra main.

Ficam fora do recorte: Gestão/migração101, comparação anterior, classificação/avisos de HP, novas faixas de referência e mudanças de WhatsApp/egress/host-routing que só estão em stage. As fórmulas, fontes e faixas de produção são conservadas. Duas correções de revisão integram o recorte: retirar o espaçador terminal quando não há imagens e usar a normalização exata de espécie já existente no backend para os índices. O cache de eco recebe identificador v34 para não servir um PDF v32 com página vazia; PA não muda. O helper de avisos usa o normalizador já existente em main; a dependência opcional de HP foi retirada. Viewer/hook/painel e seis respectivos testes permanecem byte idênticos ao corretivo e541de8c homologado. O literal de espécie cadastrado é preservado; apenas as decisões de cálculo/apresentação usam o normalizador compartilhado.

Stage completo1a5b444a será preservado por ref antes da substituição temporária por um snapshot isolado. A promoção permanece pelo PR protegido direto stage→main, após CI/deploy/homologação do recorte. Depois, restaurar o conteúdo completo de stage com ancestry de main, preservando a salvaguarda operacional e os registros. Não publicar os módulos excluídos nem usar cherry-pick/PR de feature direto em main.

A salvaguarda documentada em deploy-preserve-nginx seleciona ENABLE_NGINX_HTTP2=0 e RELOAD_NGINX_ON_DEPLOY=0 apenas para o SHA cujo commit contém [preserve-nginx]. O merge final em main deverá portar esse marcador. Não altera nginx.conf, TLS/CSP, flags do Atendimento ou os defaults das demais publicações.

O histórico abaixo registra autorizações e validações anteriores; limites antigos de publicação somente local/stage são substituídos apenas pela autorização atual deste recorte. Evidências do recorte e da instalação serão registradas sem converter testes locais ou do stage completo em prova de produção.


## Situação atual — fase 2 em stage; QA autenticada do caso63 concluída em03→04/11/2026

A fase2 foi instalada pela PR #546 e pelo corretivo #548, SHA1a5b444a, com workflows/gates aprovados. Em novo pedido humano de03/11, a conferência autenticada da prévia e da atualização do caso sintético63 foi concluída: PDF.js real, edição/recuperação, preservação do oficial até aplicação explícita, atualização única no mesmo ID e paridade das três páginas. Este resultado substitui a pendência temporária do controle de navegador descrita no histórico; produção não foi promovida.

## Histórico — fase 1b publicada e homologação central de stage aprovada em02/11/2026

Em 01/11/2026, após a entrega da fase 1a, o usuário autorizou implementar e validar localmente recuperação/rascunho na edição de ecocardiogramas existentes. Em **02/11/2026**, autorizou publicar a fase 1b em **stage** e testar com dados sintéticos; essa autorização substitui o limite anterior de trabalho somente local e não autoriza produção. O registro inicial `49ca43811e280ba2df388d7c253753276546fc46`, da branch `codex/echo-existing-draft-recovery-20261101` baseada no stage restaurado `2fef8bb1`, foi seguido pelos checks da head final `cc084f6a`. A [PR #541](https://github.com/martinialebarros-svg/fortcordis-v2/pull/541) foi instalada em stage como `89b58cb498dec9fab6ae856e51b8301435f93f99`. A publicação, a homologação central e a limpeza final da cópia concorrente foram concluídas em stage. Naquele ciclo a fase2 de conferência/prévia real do PDF ainda não integrava a entrega; o estado atual está na seção da fase2.

A fase 1a e o lote de imagens foram publicados em produção `4f6a11ba81f0433e6b3d061a70bce6a30ec6517f` pela PR #539, e stage foi restaurado `2fef8bb13fb8e0f503fdfe070036619885e08288` pela PR #540. São resultados verificados anteriormente no mesmo chat, não reconsultados remotamente neste ciclo; o registro e seus links estão no Histórico 4. Esses resultados e as matrizes anteriores não comprovam a fase 1b.

A fase 1b implementa `existing-echo`, contexto `edit:laudo:<id>`, source/revisão opaca e sessão imutáveis, autosave privado e PUT dedicado com validação anterior aos efeitos, recibo e fechamento atômicos na infraestrutura 105. Suítes locais/CI e workflow de stage passaram. Foram conferidos autosave privado, recuperação, atualização explícita, PDF sintético e smoke básico de teclado/viewport. A edição foi reaberta na mesma aba, sem recuperação oferecida e com Atualizar habilitado; não houve segunda atualização. O descarte da cópia concorrente e o reset do viewport foram posteriormente confirmados pela UI após reautenticação, conforme o complemento abaixo. Nada neste registro declara publicação da fase 1b em produção ou acessibilidade exaustiva.

### Matriz da fase 1b — evidência histórica aprovada

| ID | Status | Evidência |
| --- | --- | --- |
| CA-FC-1B-01 | automatizado local aprovado | Contratos HTTP/hook/página cobrem identidade editor/context/source/sessão, owner/matriz e negativos de rota/tipo/referência, sem reatribuição da cópia. Não houve repetição remota desses controles. |
| CA-FC-1B-02 | automatizado local e recuperação em stage aprovados | Contratos locais preservam campos/métodos/derivação/flags, incluindo clínica/médico apagados. Stage recuperou nomes sintéticos, conclusão, Onda A zero, TD limpo, E/A fundidas, e′/a′ separadas, e′ 0,16, a′ 0,08, TRIV 40 e três imagens com metadados. |
| CA-FC-1B-03 | automatizado local e preservação em stage aprovados | Operações privadas preservam oficialmente laudo/cadastros/imagens nos testes isolados. Em stage, nome/tutor e Revisão 2 continuaram intactos antes da atualização; o PDF oficial permaneceu byte a byte idêntico ao baseline. Portal/rollback remoto não foram induzidos. |
| CA-FC-1B-04 | automatizado local e conflito/descarte em stage aprovados | CAS e origem clínica foram exercitados no PostgreSQL local. Em stage, a cópia concorrente preservou a edição e mostrou origem obsoleta, com Atualizar bloqueado. Após reautenticação, um Descartar e confirmação nativa por Return voltaram ao #61 com nomes sintéticos, Revisão 3 e Finalizado intactos, concluindo a limpeza sem nova aplicação clínica. |
| CA-FC-1B-05 | automatizado local e atualização em stage aprovados | Backend verifica atomicidade/rollback e identidade autoritativa; conservação dos IDs de paciente/tutor é prova local/modelo. Em stage, uma ação atualizou o mesmo laudo #61 Finalizado e o PDF correspondeu à Revisão 3/imagens selecionadas; IDs internos de paciente/tutor não foram inspecionados por API remota. Falhas transacionais e criação explícita de tutor permanecem provas locais; a UI pede vínculo no cadastro se ausente. |
| CA-FC-1B-06 | automatizado local e aplicação única em stage aprovados | Recibo/replay, omitido versus nulo e próxima edição estão cobertos localmente. Em stage, Atualizar foi acionado uma vez por Enter, recebeu confirmação e voltou ao mesmo #61 Finalizado. A edição foi reaberta na mesma aba com nome atualizado, zero opções de Retomar e Atualizar habilitado, sem nova atualização; replay remoto não foi forçado. |
| CA-FC-1B-07 | automatizado local aprovado | Timeout após commit e recarga recebem 410 estruturado, mantêm UUID/bloqueio e conferência, sem novo apply. Testes cobrem confirmação explícita/reabertura posterior e snapshot congelado coerente entre flush e corpo clínico. |
| CA-FC-1B-08 | automatizado local e imagens em stage aprovados | Provas locais cobrem sessão/IDs, negativos e expiração reparável. Stage recuperou duas imagens persistidas com inclusão invertida e um PNG novo; o PDF atualizado trouxe apenas as duas selecionadas com legendas previstas, sem a excluída. Expiração ou sessão inválida remotas não foram induzidas. |
| CA-FC-1B-09 | automatizado local aprovado | Ditado usa o ID existente, sem POST de criação nem rebaixamento preparatório. Sugestões/flags permanecem privadas e recuperáveis, com guarda de contexto para callbacks antigos. |
| CA-FC-1B-10 | automatizado local aprovado | Página/hook cobrem carregamento, owner, navegação com flush, erro/retry e callbacks de upload/atividade/importação/ditado antigos depois de mudar laudo/geração/sessão, sem mistura. Campos locais continuam editáveis em erro; estados incertos não têm saída genérica. |
| CA-FC-1B-11 | homologação básica em stage aprovada | Viewport real 390 × 844, sem overflow: Enter retomou a cópia e atualizou uma vez; Tab percorreu Salvar rascunho → Atualizar. Antes de Retomar, ambos estavam bloqueados. No conflito, alerta legível, Atualizar desabilitado e Tab alcançando Descartar. Não equivale a auditoria WCAG ou cobertura de todos os dispositivos/estados. |
| CA-FC-1B-12 | automatizado local e CI aprovados | Suítes locais completas/focadas, PostgreSQL, tipos/lint/build/diff/SDD passaram. Na head final `cc084f6a`, CI confirmou 148 arquivos/2.638 testes frontend, Node 23 e tipos. No quality gate do merge de stage `89b58cb4`, backend confirmou 2.572 testes/140 skips; os quatro jobs do workflow terminaram em success. |

### Correções de ciclo de vida e isolamento verificadas localmente

- Sucesso 2xx estritamente correspondente a ID/request/`updated: true`, com owner/contexto ativos, aposenta o ponteiro local e permite reabrir a edição. O cliente não envia outro close ao servidor já fechado.
- Resposta incerta conserva o ponteiro. O 410 existente estruturado mostra o resultado/conferência, sem rotação silenciosa de UUID; só confirmação explícita pode aposentar esse ponteiro e voltar ao laudo.
- Uma source antiga não é rebased. Descarte privado confirmado fecha por CAS a revisão conhecida, sem flush de formulário vazio nem alteração oficial; cópia com tentativa pendente/confirmada não usa esse descarte. Continuação pela mesma base também usa workspace/sessão novos.
- Os 409 de apply usam `code`/`message`: origem, imagens oficiais, workspace, vínculo, operação e temporários indisponíveis são distintos. Temporários expirados são reparáveis e não são tratados como mudança da origem clínica.
- `sessionId` existente é obrigatório e imutável. Apply confere sessão e IDs temporários positivos/recebidos contra o snapshot privado. Mudança de laudo renova a sessão; callbacks de imagem, atividade, importação e ditado validam rota/laudo, geração, owner e sessão antes de alterar estado.

### Resultados locais da fase 1b

Resultados consolidados a partir das execuções do principal e dos agentes sobre a árvore de trabalho, sem publicação. Rodadas se sobrepõem; não somar suas contagens.

| Verificação | Resultado e limite |
| --- | --- |
| Backend completo final | 2.572 testes, com 139 skips de integrações opcionais; OK/exit 0 em 126,506 s. SQLite temporário removido, sem opt-ins de banco externo. Log `/var/folders/6s/4lv007g54pb7l2jj3q9drmtm0000gn/T/echo-phase1b-postfix-full-ppa17cx3.log`. |
| Backend focado | 96 testes e 324 subtestes aprovados na rodada combinada; a rodada HTTP posterior de 12 testes/9 subtestes também passou, incluindo o fingerprint de campo omitido versus nulo. Os focos se sobrepõem ao completo. |
| PostgreSQL 16 local real | 4 testes aprovados na última repetição após backend congelado, em 1,56 s, incluindo o reforço de sessão/descritores. CAS concorrente (200/409), retry com um efeito, rollback de paciente/imagens/remoção lógica/temporários/portal/workspace e renderização com imagens novas antes da regeneração. Cluster descartável encerrado/removido; nenhum banco remoto. Log `/tmp/fortcordis-echo-existing-pg-test.log`. |
| Frontend global antes das duas atribuições finais | 148 arquivos / 2.637 testes aprovados em 64,76 s, Node 20.20.2; suíte inclui fase 1a e componentes compartilhados. A contagem anterior de 2.636 foi substituída nessa rodada. Depois foram alteradas duas atribuições para respeitar clínica/médico apagados no ramo atômico e acrescentadas regressões; não apresentar 2.637 como reexecução global posterior a essas alterações. Log `/tmp/echo-existing-vitest-final.log`. |
| Frontend focado após os ajustes finais | 3 arquivos / 61 testes e lint aprovados, incluindo limpeza de clínica/médico solicitante e reabertura após descarte. A página de edição possui 15 cenários. Não inferir nem somar uma contagem global nova a partir desse foco. Logs `/tmp/echo-existing-clears-focus.log` e `/tmp/echo-existing-clears-lint.log`. |
| Frontend Node e lint | 23 testes Node e `npm run lint` aprovados. Logs `/tmp/echo-existing-node-final.log` e `/tmp/echo-existing-lint-final.log`. |
| Frontend build e TypeScript finais | Build de produção com 45 páginas aprovado e `tsc --noEmit --incremental false` posterior aprovado, com log vazio/exit 0. A primeira verificação de tipos apontou somente a fixture qualitativa do teste novo; após preenchê-la com os seis campos vazios esperados, foco/lint/tipos foram reexecutados e aprovados. Logs `/tmp/echo-existing-build-final-source.log` e `/tmp/echo-existing-tsc-final-source.log`. |
| SDD e diff finais | Avaliação do principal após a consolidação documental aprovada sobre a árvore de trabalho, incluindo arquivos novos: 23 caminhos de código, 4 documentos e feature `laudo-fluxo-confeccao` qualificada. Relatório `output/echo-existing-sdd-local.json` atualizado; `git diff --check` aprovado. |

Comandos registrados, em ambientes locais sintéticos:

```text
# raiz da worktree: backend/venv principal, DATABASE_URL em TemporaryDirectory,
# SECRET_KEY sintética, FORTCORDIS_PROCESS_ROLE=api, PYTHONDONTWRITEBYTECODE=1;
# opt-ins *_TEST_POSTGRES_URL e *_TEST_DATABASE_URL removidos
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'

# frontend, Node 20.20.2
npx --no-install vitest run --maxWorkers=2
npx --no-install vitest run app/laudos/echo-draft-existing-page.test.tsx app/laudos/hooks/useEchoEditorDraft.test.tsx lib/echo-editor-draft.test.ts --maxWorkers=2
node --test
npm run lint
npm run build
npx tsc --noEmit --incremental false
```

### Publicação e homologação central em stage — 02/11/2026

- A [PR #541](https://github.com/martinialebarros-svg/fortcordis-v2/pull/541) foi integrada em stage como `89b58cb498dec9fab6ae856e51b8301435f93f99`. O [Deploy to Stage 41383275402](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41383275402) terminou com os quatro jobs em `success`. Logs confirmaram instalação, seis arquivos runtime preservados/restaurados, `MIGRATIONS_OK`, readiness gate, canário autenticado e restore drill aprovados. Não houve publicação da fase 1b em produção.
- Na head final `cc084f6a`, CI confirmou **148 arquivos / 2.638 testes frontend**, **23 testes Node**, tipos e demais checks da PR aprovados. No merge de stage `89b58cb498dec9fab6ae856e51b8301435f93f99`, o quality gate confirmou **2.572 testes backend / 140 skips**, em 213,841 s, no job `125078478185`. O job de frontend correspondente é `125077444451`. Esses resultados de CI complementam as rodadas locais; não substituem retroativamente os 139 skips locais nem se somam a essas contagens.
- A homologação autenticada reutilizou somente o ecocardiograma **sintético #61**, sem finalidade clínica. O baseline era Revisão 2, status Finalizado, E/A fundidas, TRIV 40, e′ 0,16 e a′ 0,08. Foram editados nomes sintéticos, conclusão para Revisão 3, texto qualitativo de fusão, metadados de duas imagens persistidas com inclusão invertida e um PNG novo. O mesmo ID de laudo #61 foi observado antes/depois; os IDs internos de paciente/tutor não foram inspecionados por API remota, embora sua conservação esteja coberta localmente pelo modelo/contratos.
- O autosave conservou essas alterações no workspace. A aba oficial manteve nome/tutor e Revisão 2; o PDF oficial permaneceu byte a byte idêntico ao baseline durante as alterações privadas: SHA-256 `9c33f395a14b1a0a2e5378e31fb1edda82ba06fdb5e42a11a953b8cf219702d8`. Isso é uma comparação observada nessa rodada, não promessa de identidade binária de toda geração futura.
- Após recarga em viewport **390 × 844**, Salvar rascunho e Atualizar ficaram bloqueados até a decisão. Enter em Retomar recuperou nomes/conclusão, Onda A `0`, TD vazio, E/A fundidas, e′/a′ separadas, e′ `0.16`, a′ `0.08`, TRIV `40`, três imagens e seus metadados. Tab percorreu Salvar rascunho → Atualizar; ações/status legíveis e documento sem overflow horizontal.
- Atualizar foi acionado **uma vez por Enter**, recebeu confirmação e direcionou ao mesmo #61 Finalizado. O PDF atualizado foi baixado, seu texto conferido e suas **três páginas renderizadas e inspecionadas visualmente**: Revisão 3, nomes sintéticos revisados, seis parâmetros dependentes de E/A marcados Não mensurável, TRIV/TDI preservados, duas imagens selecionadas com as legendas sintéticas previstas e ausência da persistida excluída.
- A edição foi reaberta na **mesma aba**: nome atualizado, nenhuma opção Retomar, Atualizar habilitado e sem bloqueio 410. Não houve segunda aplicação clínica.
- Uma cópia B, aberta antes da aplicação A, foi recarregada/retomada depois. Ela preservou a edição privada e exibiu origem obsoleta, com Atualizar bloqueado. Em 390 × 844, o alerta continuou legível, sem overflow, e Tab pulou a ação desabilitada para Descartar. Isso completa o smoke básico de recuperação/atualização/conflito por teclado e viewport; não equivale a auditoria WCAG ou cobertura exaustiva.
- O canônico respondeu HTTP 200 e a API anônima HTTP 401 no smoke informado pelo executor. Aliases e outras rotas com timeouts da CLI permaneceram inconclusivos, sem conversão em pass; a UI autenticada funcionou. O bundle observado no navegador, `page-cdcf8ce181878600.js`, respondeu 200, SHA-256 `5a95fe94f35589bcca18ba0641e054360fdc83aa0eeb35a0e65fdc2ff67440e7`, com `Atualizar`, `/editor-update` e `existing-echo`. Esses marcadores comprovam funcionalidade servida; a identidade do release depende também do workflow/SHA instalado.

Artefatos locais: `output/qa-existing-stage-61-checks.json`, `output/pdf/qa-existing-stage-61-after.pdf` e seus três renders. A descrição da PR #541 foi atualizada pelo principal com a homologação e a pendência de limpeza que existia naquele momento; o complemento abaixo registra sua resolução observada. Este fechamento documental fica local, sem nova publicação de código idêntico.

### Limpeza final concluída — histórico do bloqueio e limites da prova

Na primeira tentativa, o descarte privado da cópia B chegou ao diálogo nativo de confirmação, mas ele não foi exposto por `getJsDialog`. O usuário foi avisado; enquanto se aguardava a interação manual, o descarte e o reset não foram declarados concluídos. A primeira tentativa de reset expirou com o diálogo aberto. Esse bloqueio de controle não foi tratado como falha dos testes centrais de autosave, recuperação, atualização, PDF e conflito.

O usuário depois confirmou o OK, mas a conclusão foi registrada **somente após verificação da UI**. A sessão de stage havia expirado; o login já preenchido foi submetido com sucesso. Como a cópia ainda existia, Descartar foi acionado uma vez. `getJsDialog` continuou retornando `null`, e a API documentada `cleanupTab.pressKey(null, 'Return')` confirmou o diálogo nativo pelo teclado. A UI navegou para `/laudos/61`, mantendo nomes sintéticos, Revisão 3 e status Finalizado. Assim foram confirmados descarte/limpeza privados, sem uma segunda atualização do documento oficial.

O comando `viewport.reset()` retornou sucesso e o DOM mediu **504 × 774**, tamanho normal atual do painel. Isso confirma a restauração nessa sessão; não foi inferido um tamanho diferente nem declarada nova auditoria de tela. Os fluxos já aprovados não foram repetidos.

Timeout após commit, replay forçado, expiração de temporários e todos os negativos de acesso não foram induzidos remotamente; permanecem identificados como provas locais/CI. Não houve homologação nem publicação da fase 1b em produção. A fase 2 continua fora deste ciclo. CA-FC-1B-11 foi encerrado pelo smoke básico efetivamente observado, sem alegar acessibilidade exaustiva.

## Histórico 1 — implementação local em 01/11/2026, antes da homologação

O usuário autorizou criar o plano e iniciar a implementação. Foram preparados `intent.md`, `plan.md`, `spec.md` e este registro. A fase 1 foi dividida em 1a (somente novos ecocardiogramas, neste ciclo) e 1b (edição de laudos existentes, posteriormente e antes da fase 2). A fase 1a foi implementada localmente na branch `codex/echo-draft-recovery-20261101`, em worktree isolada baseada em `origin/stage`.

O delta contém workspace privado com GET/PUT/POST de fechamento lógico, CAS e retry por operação; precondição `X-Editor-Owner-Id` conferida contra a sessão autenticada; snapshot bruto sem binários/credenciais; UUID em `sessionStorage`; debounce de 1.500 ms; recuperação explícita após inicialização do contexto; e ações distintas de rascunho/emissão. Troca/perda do primeiro usuário conhecido bloqueia a tela. A emissão e a criação explícita para ditado conservam guarda recuperável se a resposta clínica for incerta. Imagens temporárias mantêm validade de 24 horas e exigem reenvio quando ausentes; são reconciliadas antes da emissão e após a associação.

Naquele momento, as verificações abaixo eram locais, com dados sintéticos; ainda não havia publicação, HTTP autenticado em stage, migração em PostgreSQL operacional, emissão real ou revisão visual de PDF deste incremento. Os resultados foram consolidados pelo executor principal e pelos agentes responsáveis por backend/UI. Nenhum paciente real integra a documentação.

### Validações locais iniciais — histórico

| Verificação | Resultado local e escopo |
| --- | --- |
| Backend do workspace e regressões clínicas de persistência | 30 testes e 86 subtestes aprovados. CAS, repetição de operação, conflito, fechamento, proprietário, cookie divergente, permissões, limites de transporte e preservação de tabelas clínicas. SQLite foi executado; o DDL PostgreSQL foi simulado. |
| Helper, hook, medidas e indicador de rascunho | 4 arquivos / 73 testes aprovados. Snapshot literal, estado de derivação AE/Ao, fila, debounce, erros/retry, recuperação explícita, headers de owner, troca de usuário e `beforeunload`, inclusive imagem ainda não enviada. |
| Quatro páginas reais importadas pelo teste de integração | 100 testes aprovados: 18 da página de novos exames e 82 regressões clínicas anteriores. API e subcomponentes específicos são simulados; não é E2E com servidor/navegador real. |
| Vitest global | 145 arquivos / 2.609 testes aprovados na última fonte funcional. Após ajustar o link do banner para `NextLink`, os 18 casos da página foram reexecutados e aprovados. |
| Revisão final da terminologia de salvamento | Após harmonizar os avisos usados também no preparo de ditado, 3 arquivos / 54 testes aprovados e lint das quatro fontes pertinentes aprovado. |
| Testes Node do frontend | 23 testes aprovados, conforme execução do principal. |
| TypeScript | `npx tsc --noEmit --incremental false` aprovado na rodada UI. O build final também aprovou a verificação de tipos. |
| ESLint | Hook e teste de hook aprovados; `npm run lint` global aprovado após substituir a âncora interna do banner por `NextLink`. |
| Build | `PATH=/Users/martiniano/.local/node-v20/bin:$PATH npm run build` aprovado, com tipos/lint e 45 páginas. A primeira tentativa havia apontado a âncora interna, corrigida antes da rodada aprovada. |
| Guardrail SDD | `evaluate_guardrail` aprovado sobre diff e arquivos novos, cobrindo 22 arquivos de código, conforme execução do principal. |
| Diff check | `git diff --check` aprovado; os quatro SDD novos também foram conferidos sem espaços finais. |

Comandos registrados:

```text
# backend
PYTHONDONTWRITEBYTECODE=1 /Users/martiniano/fortcordis-v2/backend/venv/bin/python -m pytest -q -p no:cacheprovider tests/test_laudo_editor_drafts.py tests/test_laudos_ecocardiograma_estruturado.py tests/test_laudos_feline_alias_persistence.py

# frontend
npx vitest run lib/echo-editor-draft.test.ts app/laudos/hooks/useEchoEditorDraft.test.tsx app/laudos/hooks/useEchoMeasurements.test.tsx app/laudos/components/EchoDraftStatus.test.tsx --maxWorkers=2
npx vitest run app/laudos/echo-draft-new-page.test.tsx app/laudos/feline-alias-page-save.test.tsx app/laudos/feline-wave-review-page-save.test.tsx app/laudos/feline-narrative-review-page.test.tsx --maxWorkers=2
npx vitest run --maxWorkers=2
npx vitest run app/laudos/echo-draft-new-page.test.tsx --maxWorkers=2
npx vitest run app/laudos/echo-draft-new-page.test.tsx app/laudos/hooks/useEchoEditorDraft.test.tsx app/laudos/components/EchoDraftStatus.test.tsx --maxWorkers=2
node --test
npx eslint app/laudos/hooks/useEchoEditorDraft.ts app/laudos/hooks/useEchoEditorDraft.test.tsx --max-warnings=0
npx tsc --noEmit --incremental false
npm run lint
PATH=/Users/martiniano/.local/node-v20/bin:$PATH npm run build

# raiz da worktree
git diff --check
```

### Matriz local inicial — histórico substituído pela matriz atual

| Critério | Estado local | Evidência e limite |
| --- | --- | --- |
| CA-FC-01 | automatizado aprovado | Backend e hook isolam proprietário/contexto; página bloqueia troca/perda de owner e novo eco sem identidade. Edição existente fora da fase 1a. |
| CA-FC-02 | automatizado aprovado | Transporte e recuperação literal de medidas/textos, campos limpos, métodos/ondas e estado de derivação; regressões clínicas anteriores mantidas. Falta homologação no ambiente instalado. |
| CA-FC-03 | automatizado aprovado | Descritores de imagens, ausência/expiração, expiração após retomada e associação 200 sem imagens persistidas. Não houve upload real nem PDF visual nesta rodada. |
| CA-FC-04 | automatizado aprovado | Fila, edição durante request, CAS, retry, conflito, encerramento lógico e guard de resposta clínica incerta. Concorrência backend em SQLite isolado; PostgreSQL real pendente. |
| CA-FC-05 | automatizado aprovado | Inicialização tardia, owner divergente/ausente, troca de conta durante recuperação e saída imediata por Voltar/link interno com flush. Browser Back e navegação programática externa não são interceptados. |
| CA-FC-06 | parcial | Erro/retry preservam edição local e estado confirmado; PA dedicada cria seu próprio payload sem workspace eco. Teclado e tela pequena ainda não foram conferidos visualmente. |
| CA-FC-07 | automatizado aprovado | Autosave escreve só workspace; emissão explícita, ditado→recarga→PUT no mesmo laudo, resposta incerta e associação incompleta não repetem criação clínica. Casos usam API simulada na página. |
| CA-FC-08 | automatizado aprovado | Backend, 73 testes UI, 100 integrações, Vitest global, Node, tipos, lint, build, diff check e guardrail aprovados; 18 casos da página aprovados após ajuste do link e 54 testes focados aprovados após a revisão final de terminologia. Homologação visual permanece pendente. |

### Revisão estática independente inicial

A revisão do backend, hook e integração na página identificou e motivou correções de: identidade por cookie divergente do cache local; restauração assíncrona após troca de usuário; formulário congelado por erro de autosave; dependência indevida do fluxo de PA; perda do guard de salvamento clínico ao continuar genericamente; saída SPA antes do debounce; nova criação clínica do ditado após resposta incerta; e associação de imagens HTTP 200 sem recebimento persistido. A releitura terminal confirmou os controles correspondentes nas fontes. Isso não substitui a homologação do ambiente instalado.

### Limites e verificações ainda abertas naquele momento

- A descoberta do workspace depende do UUID em `sessionStorage` da aba/sessão atual. Não há lista de rascunhos nem garantia de retomada após fechar a aba ou usar outro dispositivo, embora o snapshot permaneça no servidor até fechamento lógico.
- Voltar do formulário e cliques comuns em links internos da mesma aba aguardam flush. `beforeunload` protege saída nativa. Botão Voltar do navegador e navegação programática iniciada fora do formulário não são interceptados nesta fatia.
- Repetir operações do workspace é idempotente; POST clínico não é repetido automaticamente. Resposta clínica incerta exige conferência humana na central antes de retomar.
- Imagens temporárias mantêm validade de 24 horas; guardar seus descritores não estende a validade. Após associação, a conferência usa quantidade e metadados correspondentes, sem alterar o contrato existente de imagens.
- Naquele momento, a migração `20261101_105_laudo_editor_drafts.py` ainda não havia sido aplicada em stage/produção e o DDL PostgreSQL só havia sido simulado. O PostgreSQL local real e a aplicação em stage foram comprovados nas etapas posteriores registradas abaixo; produção ainda não foi comprovada neste documento.
- Fase 1b e fases 2–5 permanecem planejadas. A proteção da rota `/laudos/{id}/editar`, prévia real do PDF, layout/rodapés, síntese clínica, comparação no PDF e imagens principais não foram implementados neste delta. O ditado coberto pela 1a começa no formulário novo.

## Histórico 2 — publicação e homologação em stage em 01/11/2026

### Preflight da publicação em stage — 01/11/2026

A integração com o `origin/stage` atual foi feita por merge, sem conflitos, preservando o conteúdo financeiro e os workflows já publicados. A validação adicional executou 34 testes e 86 subtestes de contratos/migração/segurança, com sucesso; essas contagens se sobrepõem às suítes anteriores.

Também foi executado PostgreSQL **16.13 real e descartável**, local, em socket Unix privado, sem TCP ou banco remoto: migração 105 aplicada pelo runner (primeira execução: 1; segunda: 0), versão atual/mais recente 105 e zero pendentes. Foram conferidos RLS, bloqueio de privilégios para `anon`/`authenticated`, unicidade proprietário+UUID, FK, roundtrip literal, retry, autoria, CAS concorrente com um sucesso e um conflito, encerramento/retry, GET 410 e rejeição de autosave após fechamento. A tabela sentinela permaneceu intacta; o cluster foi encerrado e removido. Isso complementa o DDL antes simulado, sem comprovar ainda a migração no ambiente instalado.

Na primeira solicitação houve apenas implementação local. Em 01/11/2026, o usuário autorizou publicar em **stage** e testar rascunho automático, recuperação e emissão de novos laudos. A preparação desta publicação preserva a versão remota `a7b97cff25a10fb6dd61fdc11dc75f949b2a0b72` e confirmou que a maior migração remota é a 104, sem colisão com a nova 105. A fila anterior de deploy estava concluída com sucesso.

Nessa etapa, a autorização era restrita a stage e ainda não havia pedido de promoção a produção. O fechamento dependia de checks/workflow terminais, versão instalada e testes aplicáveis. Os resultados locais anteriores não eram evidência de ambiente instalado; a homologação efetiva foi registrada nas etapas seguintes. A autorização posterior e restrita de produção está descrita na situação atual deste documento.

### Primeira publicação e homologação de stage — PR #536

- Publicação concluída: PR #536, merge `554ab4f8a2dca5e551d770c1bcc597c8bb0c95d2`. A atualização intermediária do painel de gestão (`4a7e24d6`) também foi integrada e preservada antes do merge.
- Workflow [Deploy to Stage (VPS)](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41335383746) terminou com `success`, incluindo quality gate, SDD, diagnóstico e deploy. Migration CI `41335383796`, Frontend CI `41335383816` e Google Maps Cost Control `41335383810` também terminaram com sucesso.
- Log do deploy confirmou `Installed deploy SHA` igual ao merge, migração `20261101_105` aplicada, preservação/restauração dos seis arquivos runtime, backend health, runtime gate, canário autenticado e backup restore drill aprovados. O gate não publica o payload completo de `/health`; não afirmar leitura independente desses campos.
- A árvore integrada passou localmente por 147 arquivos / 2.617 testes Vitest, 23 testes Node, lint/build/TypeScript e 2.560 testes unittest de backend (139 skips de integrações opcionais), além dos testes focados e do PostgreSQL descartável já registrados.
- No navegador interno autenticado, com nome/tutor sintéticos únicos e sem vínculo com paciente/agendamento existente: autosave confirmado; emissão bloqueada antes da decisão de recuperação; recargas recuperaram cabeçalho, valores literais, zero, campo apagado e estados independentes de fusão. Edição de medida invalidou a confirmação pertinente como previsto, sem uma nova confirmação fabricada.
- Uma revisão de conclusão seguida de Voltar antes do debounce foi recuperada na reabertura. A busca pelo identificador sintético na central retornou zero laudos antes da emissão, distinguindo workspace de documento clínico.
- Duas imagens sintéticas recebidas individualmente foram recuperadas com nomes, legendas, ordem e seleção de inclusão no PDF corretas. O usuário confirmou o diálogo nativo inacessível ao controle, sem repetir a emissão. O laudo sintético #61 foi finalizado; PDF baixado, texto conferido e três páginas renderizadas/revisadas. Revisão 2 preservada, parâmetros dependentes de E/A fundidas não mensuráveis, TRIV/TDI independentes e apenas a imagem selecionada presentes. Reabrir novo laudo mostrou nome/tutor vazios e não ofereceu recuperação do documento já emitido.
- Smoke externo foi parcial por timeouts TCP intermitentes da CLI: `www.stage` completou a cadeia HTTPS com login 200; o chunk canônico `app/laudos/novo/page-8bfec82e363a55ee.js` respondeu 200 e contém os quatro marcadores do incremento. Foram obtidos 12/20 chunks; oito timeouts e a API anônima não foram marcados como aprovados. A interface autenticada funcionou. Evidências locais: `/tmp/fortcordis-pr536-stage-deploy-watch.log` e arquivos temporários da homologação; não incluem credenciais.

### Correção complementar encontrada na homologação: lote de imagens

O seletor recebeu dois PNGs sintéticos, mas o painel exibiu apenas o primeiro. A rotina existente também estava presente na base `4a7e24d6`: o handler limpava o input enquanto `processarArquivos` aguardava o primeiro FileReader e continuava iterando a coleção viva. A regressão local esvazia a seleção quando `input.value` é limpo e demonstrou **um POST em vez de dois** antes do patch.

A correção captura `Array.from(files)` antes da primeira leitura assíncrona e processa essa coleção estável, mantendo a semântica de metadados, ordem, inclusão e upload. O teste novo verifica dois arquivos, dois uploads e seus identificadores próprios.

| Critério | Estado local | Evidência e limite |
| --- | --- | --- |
| CA-FC-09 | automatizado e stage aprovados | RED reproduzido antes da cópia; GREEN com 26 testes nos três arquivos focados, lint completo, build de 45 páginas e TypeScript aprovados. Após a publicação, selecionar os mesmos dois PNGs em um único seletor produziu os dois envios e o autosave; recarga/retomada recuperou ambos com prévias decodificadas de 800 px. |

Comando focado: `npx vitest run app/laudos/components/ImageUploader.test.tsx app/laudos/echo-draft-new-page.test.tsx app/laudos/components/ImagePreviewModal.test.tsx --maxWorkers=2`. Logs locais `/tmp/fortcordis-image-batch-{red,green,lint,build,tsc}-554ab4f8.log`. Nenhum valor, método ou referência clínica foi alterado.

### Encerramento da homologação — PR #537

A correção complementar foi publicada como `9825174ccea1c586792f0ef54240ebbde1d2e44a`, pela PR #537. [Deploy 41340952188](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41340952188) e os checks Migration CI, Frontend CI e Google Maps Cost Control terminaram com sucesso. O log confirmou esse SHA instalado, nenhuma migração pendente, preservação/restauração runtime, health, runtime gate, canário autenticado e restore drill.

O teste final foi executado após recarregar o frontend publicado: um rascunho sintético distinto recebeu dois arquivos na mesma abertura do seletor. Ambos ficaram disponíveis, foram salvos automaticamente e recuperados após nova recarga, com as duas imagens carregadas e nenhuma indicação de reenvio. Esse rascunho não foi emitido; o laudo #61 é o único documento clínico criado pela homologação.

Artefatos locais em `output/pdf/`: `qa-autosave-stage-61.pdf`, texto extraído, três PNGs renderizados e verificações JSON. O documento é sintético e não tem finalidade clínica. Não houve envio de mensagens, liberação de portal ou promoção a produção por esta tarefa.

Ao encerrar essa rodada, permaneciam os limites de descoberta por UUID na aba/sessão, prazo próprio de imagens temporárias, workspace para edição existente fora do incremento, teclado/mobile ainda sem smoke completo e disponibilidade HTTP externa parcial por conectividade da CLI. O fechamento remoto foi confirmado pelo comportamento do novo formulário; GET 410 remoto não foi repetido. O complemento de teclado/viewport estreito abaixo substitui a pendência básica de CA-FC-06, sem declarar auditoria WCAG ou cobertura móvel exaustiva. Os demais limites continuam explícitos.

## Histórico 3 — preparação da promoção restrita da fase 1a em 01/11/2026

A fase 1a e a correção da seleção de imagens em lote foram homologadas em stage, incluindo o complemento básico de teclado e viewport estreito descrito abaixo. O usuário autorizou promover **somente novos ecocardiogramas com workspace/autosave e a correção de imagens em lote**. Outras funcionalidades presentes em stage não estão autorizadas por este pedido. Naquele momento, a publicação em produção ainda não havia sido realizada; a conclusão está registrada no Histórico 4.

O candidato isolado está na branch `codex/echo-draft-prod-isolated-20261101`, baseado em `main` `7430d5d8f9054f80cb9ee61e284462c4b6226892`. O código validado corresponde a `6e3a091496dc89bfc099497c75e1d0c0ee4c00c9`, com 27 caminhos no delta informado pelo executor principal, antes desta consolidação documental. O protocolo prevê apresentar esse escopo isolado em stage, promover pelo fluxo protegido `stage → main` e restaurar o estado de stage `9825174ccea1c586792f0ef54240ebbde1d2e44a` depois; essas operações não são declaradas concluídas aqui. Os checks devem corresponder ao SHA final da promoção, sem reutilizar apenas o sucesso de uma versão anterior.

A integração de workspace/autosave permanece exclusiva de `/laudos/novo`. O patch de lote é no `ImageUploader` compartilhado: também corrige o processamento da seleção múltipla quando usado pelo editor de laudos existentes e pela ultrassonografia abdominal. Isso não implementa recuperação/autosave nesses consumidores, nem entrega a fase 1b.

### Matriz de aceitação da entrega — fase 1a e correção de lote

A matriz abaixo consolida evidências automatizadas e de homologação. As matrizes iniciais foram mantidas no histórico para não apagar resultados anteriores; estados iniciais substituídos não representam a situação atual. “Aprovado” refere-se ao critério desta entrega e não declara implantação em produção.

| ID | Status | Evidência |
| --- | --- | --- |
| CA-FC-01 | aprovado | Testes de backend/hook/página cobrem isolamento por usuário/contexto, owner divergente/ausente e troca de conta. Stage autenticado preservou o contexto sintético, sem vínculo com paciente/agendamento existente. Não houve repetição de todos os controles negativos no servidor remoto. |
| CA-FC-02 | aprovado | Contratos locais preservam valores literais, medidas limpas, métodos/ondas e estado de derivação. Em stage, recargas recuperaram cabeçalho, zero, campo apagado e estados de fusão; editar medida invalidou a confirmação pertinente. |
| CA-FC-03 | aprovado | Testes locais cobrem descritores, envio incompleto, expiração e associação 200 incompleta. Stage recuperou duas imagens com ordem, legendas e inclusão; o PDF sintético #61 foi baixado/renderizado e exibiu somente a imagem selecionada. Expiração e associação incompleta remotas não foram induzidas. |
| CA-FC-04 | aprovado | Fila/CAS/retry/fechamento cobertos em testes isolados, com concorrência real no PostgreSQL local descartável. Migração 105 e gates foram confirmados pelo log de stage; emissão do sintético #61 foi seguida de novo formulário vazio, sem ressuscitar o documento. GET 410 e concorrência remotos não foram repetidos. |
| CA-FC-05 | aprovado | Testes cobrem inicialização tardia, respostas de outro contexto/owner, recuperação assíncrona e navegação com flush. Em stage, revisão de conclusão seguida de Voltar antes do debounce foi recuperada. Browser Back e navegação programática externa continuam fora da interceptação contratada. |
| CA-FC-06 | aprovado | Erro/retry e PA dedicada cobertos em testes locais. O complemento real de stage em 390 × 844 confirmou leitura/ações sem overflow do documento, Tab nos controles pertinentes, Enter para salvar/retomar, bloqueio antes da recuperação e retomada do nome sintético. É smoke básico, sem auditoria WCAG ou cobertura de todos os dispositivos. |
| CA-FC-07 | aprovado | Testes distinguem workspace, ditado e emissão, conservando guard de resposta clínica incerta sem repetir criação. Em stage, a busca sintética retornou zero laudos antes da emissão; apenas #61 foi finalizado. PDF e novo formulário foram conferidos; sem mensagens, portal ou efeitos financeiros. |
| CA-FC-08 | aprovado | O código isolado passou nas suítes locais indicadas abaixo: frontend, backend, tipos/lint/build, SHA, SDD, diff e Bash. A funcionalidade e o lote já foram homologados em stage; checks e identidade do SHA final de promoção serão conferidos no protocolo de publicação. |
| CA-FC-09 | aprovado | RED local reproduziu um upload em vez de dois; GREEN validou dois arquivos, dois uploads e IDs próprios. Após PR #537, um único seletor em stage enviou ambos os PNGs sintéticos; autosave e recarga recuperaram as duas imagens com prévias decodificadas. |

### Complemento real de CA-FC-06 — teclado e viewport estreito

Em 01/11/2026, o executor principal testou o navegador interno autenticado sobre stage `9825174ccea1c586792f0ef54240ebbde1d2e44a`, com viewport **390 × 844**. Ações e status estavam legíveis e o documento não apresentou overflow horizontal. Tab percorreu **Salvar rascunho → Emitir laudo** e **Nome → Tutor**. Um nome sintético privado foi preenchido; Enter em Salvar rascunho produziu o estado salvo, com indicador de 18:30. Após recarga, as duas ações de gravação/emissão permaneceram bloqueadas antes da decisão de recuperação; Enter em Retomar rascunho recuperou o nome. O documento continuou sem overflow, o viewport foi restabelecido e a aba fechada. Nenhum laudo foi emitido nessa rodada.

Este smoke encerra a pendência básica de teclado/legibilidade da fase 1a. Não equivale a auditoria WCAG, teste de todos os controles, todos os tamanhos de tela ou todos os dispositivos.

### Validação do código candidato isolado

Resultados informados pelos executores responsáveis sobre `6e3a091496dc89bfc099497c75e1d0c0ee4c00c9`, antes das alterações documentais deste fechamento. As contagens de rodadas distintas se sobrepõem e não devem ser somadas.

| Verificação | Resultado |
| --- | --- |
| Frontend Vitest | 142 arquivos / 2.479 testes aprovados. |
| Frontend Node | 23 testes aprovados. |
| Frontend tipos/lint/build | TypeScript e lint aprovados; build aprovado, com 44 páginas no candidato isolado. |
| Backend focado e segurança | 84 testes e 89 subtestes aprovados, em SQLite temporário isolado, sem opt-ins de banco externo. Inclui workspace, persistência clínica, migração/runtime, autenticação, permissões, CSRF, WebSocket, headers e isolamento stage/auth. |
| SHA, SDD e integridade | 13 testes de SHA imutável, SDD, `git diff --check` e `bash -n` dos scripts de deploy aprovados. |

Comando backend registrado, executado a partir de `backend` com o Python do venv principal e ambiente sintético isolado:

```text
python -m pytest -q -p no:cacheprovider tests/test_laudo_editor_drafts.py tests/test_laudos_ecocardiograma_estruturado.py tests/test_laudos_feline_alias_persistence.py tests/test_migration_ci_cycle.py tests/test_runtime_checks_observability.py tests/test_supabase_auth.py tests/test_permission_matrix_sync.py tests/test_csrf_protection.py tests/test_websocket_auth.py tests/test_security_headers.py tests/test_stage_auth_release_isolation.py
```

O histórico abaixo contém os comandos frontend e as rodadas anteriores, incluindo PostgreSQL local real, deploys e PDF sintético de stage. A publicação final continua condicionada aos checks/workflow terminais e à identidade do SHA instalado; nenhum sucesso local é prova de produção.

### Limites registrados na preparação da promoção da fase 1a

- A descoberta depende do UUID em `sessionStorage` da aba/sessão. Não há lista de rascunhos nem garantia de retomada depois de fechar a aba ou mudar de dispositivo.
- Imagens temporárias mantêm prazo próprio de 24 horas; descritores não prolongam sua validade. A conferência pós-associação usa quantidade e metadados correspondentes.
- Resposta clínica incerta requer conferência humana na central; POST clínico não é repetido automaticamente. Browser Back e navegação programática externa não estão interceptados.
- Disponibilidade HTTP externa teve comprovação parcial por conectividade intermitente da CLI. Os timeouts e a API anônima remota não foram registrados como pass; UI autenticada e chunk canônico foram observados funcionando.
- A migração 105 foi comprovada pelo log de stage, além dos testes em PostgreSQL local real. Implantação e migração em produção ainda não estão comprovadas neste registro.
- Fase 1b (workspace/autosave para edição existente) e fases 2–5 (prévia real, filtros/rodapés, síntese/comparação no PDF e imagens principais) são roadmap, fora da matriz desta entrega. Não foram convertidas em critérios aprovados ou publicadas por este pedido.


## Histórico 4 — fase 1a publicada em produção e stage restaurado em 01/11/2026

Este registro consolida fatos já verificados em turnos anteriores do mesmo chat, sem nova execução ou consulta remota no ciclo da fase 1b. A evidência principal foi preservada em `output/release-539-proof.json`, complementada pelos logs e pela nota de continuidade da conversa.

- A promoção isolada [PR #539](https://github.com/martinialebarros-svg/fortcordis-v2/pull/539) foi publicada em produção como `4f6a11ba81f0433e6b3d061a70bce6a30ec6517f`. O [Deploy de produção 41354709810](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41354709810) terminou com `success`, assim como os checks aplicáveis. A migração 105 e a preservação/restauração dos arquivos runtime foram confirmadas; nenhuma funcionalidade alheia de stage foi incluída nessa promoção.
- O smoke autenticado em produção confirmou rascunho/recuperação e dois arquivos de um mesmo lote, com legendas e inclusão preservadas, usando somente conteúdo sintético privado. Não houve emissão de laudo oficial, envio de mensagens ou liberação de portal nesse smoke.
- A restauração completa de stage foi concluída pela [PR #540](https://github.com/martinialebarros-svg/fortcordis-v2/pull/540), merge `2fef8bb13fb8e0f503fdfe070036619885e08288`. O [Deploy de restauração 41355892407](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41355892407) e os checks aplicáveis terminaram com `success`, com SHA instalado, migrações sem pendências, runtime, health/readiness, canário autenticado e restore drill confirmados nos logs.
- O conteúdo funcional de stage voltou a corresponder à árvore `9825174c`, preservando as outras funcionalidades não promovidas; somente spec/verify desta entrega receberam a consolidação documental. A UI autenticada final de stage foi conferida. Esses fatos não dizem que uma edição existente já tem workspace: essa é a fase 1b agora iniciada apenas localmente.


## Fase 2 — ciclo local iniciado em 03/11/2026

Autorização atual: “pode seguir com o plano”, após proposta de conferência final e prévia real. Implementação/validação locais; nenhum commit/publicação autorizado. Base stage45f06fee, worktree deste chat e branch `codex/echo-pdf-preview-20261103`. As evidências anteriores de 1a/1b permanecem históricas.

| Critério | Estado | Evidência |
|---|---|---|
| CA-FC2-01 — payload e páginas reais | aprovado local | Testes das páginas reais comparam a intenção enviada à prévia e à emissão/atualização; texto manual/flags, cadastro e ordem/legendas/inclusão de imagens preservados. `echo-preview-frontend-focused.log`. |
| CA-FC2-02 — somente leitura e isolamento | aprovado local | Dez casos HTTP/PDF, captura SQL sem DML e comparação de todas as tabelas; repetição/erro, owner, visualizar+editar, revisão e imagens alheias/expiradas. `echo-preview-backend-regressions.log`. |
| CA-FC2-03 — paridade e renderização PDF | aprovado local | Corpo textual e número de páginas comparados ao renderer oficial após emissão/atualização sintética real. Catálogo reconciliado, cm/mm, 2D, AE/Ao, diastólica e bibliografia, fusão felina e HP pendente/revisada. Três PDFs finais, nove páginas renderizadas/inspecionadas; uma marca de prévia em cada página. `output/echo-preview-pdf-20261103/{manifest.json,contact-sheet.png,generate.py}`. |
| CA-FC2-04 — concorrência e preservação | aprovado local | Regressões de hook/página/visualizador para alteração, usuário/contexto, disabled, falha/retry, timeout/cancel, resposta tardia, revogação de URLs e destroy/cancel de PDF.js. Não há emissão no painel. `echo-preview-frontend-focused.log`. |
| CA-FC2-05 — avisos/navegação/responsividade | aprovado local | Componente real no IAB em1280×900 e390×844, CSP real preservada, PDF.js visível, página1→3, teclado, foco no campo, fusão informativa, edição invalida, cancel/late response, falha/retry e isolamento de contexto. Largura375/viewport390, sem overflow. `output/echo-preview-ui-20261103/`. Harness fixo sintético, sem homologação autenticada remota. |
| CA-FC2-06 — checks locais | aprovado local | Backend final2612 +2555 subtestes/175 skips em dois papéis, frontend2786 +Node23, foco80, lint/tipos/build45, revisão independente e SDD aprovados. Logs finais e limites abaixo. Sem publicação remota. |

Stage/produção: não publicados por este ciclo. Janela deste chat cedida ao Atendimento; não há operação remota do laudo em curso.


### Evidências e limites locais da fase 2

- Backend selecionado:232 testes em módulos distintos aprovados, incluindo dez HTTP/PDF novos. Revisão independente reproduziu e corrigiu um P2: editar=1/visualizar=0 agora recebe403 antes de ler origem/paciente, nos modos novo e existente. Regressões de leitura/portal/jobs/PDFs preexistentes passaram.
- PDFs finais incluem fontes/referências já existentes e não acrescentam limites clínicos. A projeção respeita a diferença de estrutura/manual entre novo/edição; observações gerais continuam no payload, sem inventar uma seção que o renderer oficial não exibia.
- Inicialmente o iframe estava em branco no IAB; não foi considerado aprovado. PDF.js final foi validado com os cabeçalhos de segurança do aplicativo, biblioteca/worker locais e marca legível, além dos testes assíncronos. A versão Next de produção foi compilada com worker local em `.next/static/media/pdf.worker.min.55579594.mjs`.
- Frontend antes do último ajuste de foco:2785 Vitest+23 Node aprovados; após o ajuste,80 testes focados aprovados. Lint, tipos e build45 páginas passaram. Registros finais amplos serão consolidados abaixo, sem somar conjuntos sobrepostos.
- Uma tentativa inicial de coleta ampla incluiu scripts debug fora de `tests` e depois encontrou imports irmãos sem PYTHONPATH de `tests`; configuração da execução local foi corrigida, sem mudança de produto. Log de coleta retido em `echo-preview-backend-collection-setup.log`.
- Na primeira execução ampla com papel padrão de processo ocorreram seis falhas de worker WhatsApp (processed0/lock), com2606 testes e2555 subtestes aprovados/175 skips. Os mesmos módulos passaram isolados, com a prévia e com Portal. Causa ainda não atribuída ao incremento; controle de baseline e execução sem workers de fundo estão sendo conferidos antes do encerramento. Não houve correção alheia em WhatsApp.
- Validação local não comprova publicação nem navegação autenticada de stage/produção, uso de portal real ou envio. Nenhum documento real foi emitido/alterado. Publicação posterior precisa de pedido e janela/SHAs/checks próprios; janela do Atendimento continua cedida até aviso de encerramento.


### Checks finais já concluídos em 03/11/2026

- Frontend final:2786 testes Vitest em155 arquivos +23 testes Node aprovados; execução com concorrência limitada a quatro workers. Oito testes de PDF.js estão incluídos nesse total. Foco novo/edição/painel/viewer/política/hook:80 testes aprovados, sem somar ao conjunto amplo.
- ESLint, TypeScript e build Next45 páginas aprovados sobre a versão final; SDD aprovado com19 arquivos de código e feature laudo-fluxo-confeccao qualificada. `git diff --check` aprovado. Logs `echo-preview-{frontend-full,frontend-focused,lint,types-final,build}.log` e `echo-preview-sdd.json`.
- Uma execução frontend simultânea aos dois testes backend e build excedeu o limite de5000ms no teste de recuperação HP existente; passou focado e na suíte final com concorrência limitada, sem ampliar timeout ou modificar o guard. Histórico preservado em `echo-preview-frontend-concurrent-timeout.log`; não foi tratado como defeito clínico corrigido.
- Backend amplo no papel API, sem workers de fundo, com SQLite temporário e rede externa bloqueada:2612 testes +2555 subtestes aprovados,175 skips opt-in/dependência,25 warnings preexistentes;136,85s. Log `echo-preview-backend-full.log`. Controle arquivado da base45f06fee, mesmo venv/rede/SQLite e papel padrão, sem alteração do checkout:2602 testes +2538 subtestes aprovados,175 skips,162,99s. A falha inicial dos seis testes WhatsApp não foi reproduzida nesse controle; causa ainda não demonstrada. Rerun exato do candidato com papel padrão em andamento em log separado, sem mudança de código/configuração do produto.


### Encerramento local da fase 2 — 03/11/2026

A repetição **exata do candidato final no papel padrão `all`** terminou com exit0:2612 testes +2555 subtestes aprovados,175 skips,25 warnings,131,04s. Os seis arquivos backend mantiveram os mesmos hashes durante as execuções. As seis falhas iniciais **não se repetiram** nessa execução nem no controle da base; não há causa demonstrada nem correção de WhatsApp alegada. Não se transformou o controle aprovado em prova de defeito preexistente. Relatório `output/echo-preview-backend-validation.md` e `echo-preview-backend-default-role-rerun.{log,json}` conservam a comparação e os comandos. O papel API já havia aprovado o mesmo total em136,85s, com rede externa bloqueada e SQLite em memória. Os175 skips são de opt-ins/banco externo/dependências já identificados; não representam homologação PostgreSQL/remota.

Frontend final em155 arquivos:2786 Vitest +23 Node aprovados; o foco80 sobrepõe o total. Execução final com quatro workers evita a sobreposição de recursos da tentativa que excedeu5000ms; nenhum timeout foi ampliado. Lint, tipos, build45, SDD e diff check aprovados. Worker PDF.js foi emitido como asset local no build; a renderização CUA local com CSP original foi comprovada em desktop/390px. As nove páginas dos três PDFs finais foram renderizadas/inspecionadas, com conclusão no início, bibliografia compacta após qualitativa, fusão e HP corretamente projetadas e marca em todas as páginas.

**Resultado:** todos os critérios desta fase aprovados no escopo local. Não houve commit, push, migração, publicação, alteração de dado real, envio ou liberação de portal. A homologação autenticada em stage do frontend Next compilado continua uma etapa futura, condicionada ao pedido próprio; não foi substituída pelo harness Vite de componente. Janela do Atendimento ainda cedida até aviso explícito. Código/SDD e evidências estão preservados nesta worktree; não incluir output/ ou arquivos de runtime em futuro commit.


### Janela do Atendimento encerrada — 03/11/2026

Aviso explícito recebido e relatório responsável conferido; GitHub41578561817/41579081548 completed/success, refs main3f134432/stage45f06fee preservados. A espera deste chat está encerrada. Segundo o relatório, o estado intencional autorizado do Atendimento é IA ON persistente em produção e OFF em stage; não restaurar o OFF histórico. Nenhum novo deploy ou teste pago foi feito por laudos. A publicação/homologação da fase2 continua dependente do pedido próprio e preflight vigente; essa coordenação não a autoriza. Detalhe/proveniência na nota Obsidian deste chat de03/11.


## Publicação fase 2 em stage — autorizada, em preparação em03/11/2026

Usuário autorizou “publique” após a proposta explícita de stage. Base remota conferida45f06fee e main3f134432, fila vazia; não há promoção de produção autorizada. Código local mantém validações finais acima. Esta seção substitui apenas a ausência anterior de autorização para commit/push/deploy em stage; a publicação e a homologação remota ainda serão comprovadas por PR/workflows/logs e UI/PDF sintéticos. HPplan/verify e output anteriores preservados fora do commit desta fase.


### Stage PR #546 — deploy aprovado e achado de homologação em03/11/2026

- Head a5ed822a e merge873a94a5b7f8091dbad52d1c0b4d499f3bbc97c4 têm árvores idênticas. Checks de tipos/testes/migração/SDD/shared-budget aprovados. Deploy41678188977, Frontend41678189012, Migration41678189100 e Maps41678189009 terminaram completed/success no merge. Revisão externa automática foi ignorada por quota e não conta como aprovação; revisão independente local foi executada.
- Instalador confirmou SHA resolvido/instalado/final coincidentes, seis arquivos runtime preservados/restaurados, migrações, readiness, canário geral e restore drill aprovados. As cinco amostras/p95 368,99ms são de latência da Agenda, não cinco canários clínicos. Nginx sem reload/alteração e canários pagos opcionais não executados; WhatsApp real não aplicável em stage sem número. Main3f134432 permaneceu intacto.
- Smoke público: canônico e dois aliases200, API protegida401 e worker local200/application/javascript/hash esperado. Logs/provas em output/echo-preview-stage-20261103. Não houve acesso SSH adicional: uma tentativa somente leitura falhou na autenticação antes de executar comando.
- UI recuperou a cópia nova exclusivamente sintética criada antes do deploy, com medidas/textos/imagem/legenda; a cópia anterior do teste #62 permaneceu intocada. Prévia recebida e baixada pela UI:927055bytes, SHA25667c9fbcce4385a451124d4868815b4606b6779da247078d5725cd2c16a2e7022, três páginas, marca/rodapé visíveis em todas e conteúdo esperado. Mudar E0,7→0,8 invalidou imediatamente o PDF/link antigos, recalculou E/A1,6 e E/e′10 e salvou o rascunho. Nenhuma emissão clínica ocorreu nessa etapa.
- Achado: o visualizador mostrou erro de carregamento, apesar do PDF válido. Reprodução em harness Next15 compilado de produção, com componente/CSP/worker reais e o mesmo fixture sintético: URL blob falhou com ResponseException/status0; Uint8Array dos mesmos bytes carregou três páginas. PDF.js usa XMLHttpRequest para blob URLs. O harness Vite anterior não comprovava esse caminho Next; a falha remota permanece registrada. Não enfraquecer CSP nem atribuir problema ao backend/worker ausente.
- Branch de correção codex/echo-preview-pdf-bytes-20261103 parte exatamente de stage873a94a5. Alterar somente transporte efêmero Blob→bytes e regressões relacionadas, atualizar SDD e revalidar o frontend/Next real, publicar novamente em stage e concluir QA novo/edição/PDF. Resultados serão acrescentados após execução.


### Correção Blob→bytes — validação local terminal

O hook agora mantém o Blob já validado somente em memória e o entrega ao viewer; cada load/retry lê ArrayBuffer próprio e passa Uint8Array ao PDF.js, sem XHR/fetch do documento. URL continua exclusivamente no link e é revogada junto ao Blob em invalidação/fechamento/contexto. Guards antes/depois da leitura e cancelamento/destroy preservados. Regressões incluem transferência/detach real do buffer e nova cópia na repetição, leitura cancelada e troca de fonte. Nenhuma alteração de CSP/backend/referência clínica.

- Foco31/31 aprovado por implementador e por revisor independente; revisão dos seis arquivos sem bloqueadores acionáveis. Os testes focados se sobrepõem ao total global.
- Frontend global155 arquivos/2789 testes e Node23 aprovados; TypeScript/ESLint dos seis arquivos e build completo Next45 páginas aprovados. Logs fix-frontend-full.log/fix-node.log/fix-build.log e BLOB-FIX-REVIEW.md em output/echo-preview-stage-20261103.
- CUA no harness Next15 de produção, componente real corrigido, PDF real de stage e CSP original: canvas e navegação1→2→3 aprovados, screenshot next-bytes-fixed.png e AX salvos. Aba própria encerrada; servidor isolado em limpeza pelo implementador. Esse resultado local não substitui a próxima homologação autenticada remota.


### Homologação autenticada final — caso sintético63,03→04/11/2026

- Browser voltou a estar disponível. Usuário autorizou explicitamente conferir visualmente a prévia e testar a atualização de63 em stage. Refs observados stage1a5b444a/main3f134432, sem novo deploy. Documento inteiramente sintético confirmado antes de qualquer edição.
- PDF oficial inicial e o anterior à atualização são byte idênticos (hash402464d6…); o segundo foi baixado depois de editar, salvar, recarregar e retomar o workspace. A prévia baseline do editor existente corresponde ao oficial nas três páginas, removendo apenas a marca.
- Viewer instalado carregou canvas1→2→3 e navegação por teclado. Desktop1280×900 e390×844 aprovados; documento375px/canvas291px na tela estreita, sem corte horizontal. Ao mudar DIVEd30→31mm, índice1,52→1,58 e retirada imediata da prévia/link antigos; nenhuma geração automática. Conclusão e legenda revisão2 foram salvas/recuperadas com a mesma imagem incluída.
- Uma única ação Atualizar, por teclado, exibiu “Laudo atualizado com sucesso!” e retornou ao mesmo63/Finalizado. PDF oficial revisão2 tem926937bytes, SHA25653b9fcdaeecb09037d886de1af404c896a74822346879620fe777afae88431a9. Corpo/paginação/geometria de três páginas iguais à prévia; pixels diferem somente no retângulo da marca em cada página. Revisão independente inspecionou todas as páginas: sem cortes/sobreposições, campos previstos e imagem/legenda corretos, nenhuma marca no oficial.
- Reabertura confirmou0 recuperações antigas, Atualizar habilitado e valores31/1,58. O workspace novo limpo criado por essa reabertura foi recarregado/retomado sem novas alterações e deixado por Voltar, sem segunda aplicação. Sua cópia de QA fica privada; não foi forçado descarte nem tocado o rascunho62. Viewport restaurado e aba auxiliar fechada;63 mantido para avaliação humana.
- Evidências em output/echo-preview-stage-20261103/qa63-final/{qa-completion.json,QA-RESULTADO.md,PDF-INDEPENDENT-REVIEW.md,parity-review2.json,official-updated-ui.png}. Os cenários clínicos felinos/fusão/HP permanecem as provas locais já registradas; não alegar que o caso canino63 sozinho repetiu toda essa matriz remota. Smoke de teclado/responsividade não é auditoria WCAG/cross-browser exaustiva; IDs internos de paciente/tutor não foram lidos por API remota.

**Resultado:** homologação técnica deste incremento no fluxo novo/edição e PDF sintético concluída no escopo registrado. Avaliação clínica humana e promoção de produção continuam etapas separadas. Nenhuma mudança de código, publicação, IA paga, envio/portal ou paciente real neste turno.


## Validação do snapshot isolado de produção —04/11/2026

Este registro pertence ao recorte main3f134432+fase1b+fase2, não à árvore completa stage1a5b444a. Antes de promover, aguardar todos os resultados locais/CI, stage isolado e preservação operacional. A prova clínica usa somente fixtures sintéticos.

- Frontend:208 testes focados em12arquivos e2555 Vitest/147arquivos+23Node globais aprovados (conjuntos se sobrepõem), lint/tipos/build aprovados. Nove arquivos de cálculo/espécie/referência/detalhe/dashboard byte idênticos ao main; viewer/hook/painel e seus testes byte idênticos a e541de8c. Sem pacote/lock/CSP novos.
- Backend:82 testes+303subtestes focados aprovados, incluindo leitura semDML/permissões/origem/imagens/paridade. Comparação adicional oficial baseline main→recorte: três fixtures cãoM/cm/cão2D/gato com fusão, sete páginas com texto/geometria/pixels120dpi idênticos, sem mascaramento. Bytes de PDF podem variar por metadata temporal. Nenhum import de HP/comparador/Gestão nos módulos novos; renderer v32 mantido.
- PostgreSQL16 local descartável por socket Unix, sem listenTCP: quatro testes de atualização concorrente/atomicidade aprovados; cluster encerrado e removido. Sem banco ou comando remoto.
- A primeira suíte backend ampla foi interrompida para corrigir o caminho do guard de rede local; log preservado. Nova execução confirma guard de socket ativo antes de iniciar, papelapi, SQLite em memória e sem opt-ins remotos. Resultado terminal será registrado antes do commit.
- Salvaguarda Nginx:6 testes dedicados e13 de SHA, sintaxe e isolamento aprovados. O marcador é lido do próprio DEPLOY_SHA, sem avaliar nem ecoar a mensagem de commit. Flags0 impedem helper/reload inclusive no caminho de rollback.

Artefatos em output/echo-preview-prod-20261104 e output/echo-preview-frontend-20261104 da worktree de promoção. Os testes isolados e de baseline não substituem o deploy/QA do recorte em stage nem a confirmação terminal em produção.


### Fechamento local do recorte —04/11/2026

Suíte backend ampla terminal:2467 testes +2420 subtestes aprovados,175 skips opt-in/dependência e25 warnings,143,21s. Papelapi e guard externo conferido antes da execução, SQLite em memória; fonte sem mudança durante a rodada. A tentativa interrompida por configuração local do caminho do guard está preservada separadamente e não foi tratada como falha/correção de produto.

Frontend terminal:2555 Vitest em147arquivos +23Node, foco208 sobreposto, tipos/lint/build aprovados. PostgreSQL real local:4/4 aprovados e cluster removido. Comparação oficial baseline main→recorte:3 fixtures/7páginas, texto/geometria/pixels idênticos. SalvaguardaNginx6/6 e13 immutableSHA aprovados. Paridade dos seis arquivos de viewer/hook/painel com e541de8c e de nove arquivos fora do recorte com main comprovadas. Não há migração nova, referência clínica nova ou HP no recorte.

O stage completo está preservado no ref remoto codex/echo-stage-full-before-preview-prod-20261104, SHA1a5b444a. A sessão de produção foi confirmada pela UI no dashboard, sem ler/exportar dados clínicos; será usada somente para smoke delimitado após a instalação autorizada.


### Registro documental de exclusão de HP

O guardrail SDD exige a estrutura de uma feature tocada mesmo quando seu código é temporariamente retirado. O snapshot mantém somente quatro documentos mínimos de eco-probabilidade-hipertensao-pulmonar que registram a exclusão. Não há implementação/avisos/referências/testes de HP na promoção, nem critério clínico declarado aprovado nesses documentos. Os documentos completos, assim como o código, estão no backup1a5b444a e serão restaurados em stage. Guardrail não foi alterado nem recebeu exceção.


### P2 da revisão de isolamento — corrigidos e validados em04/11/2026

Os dois comportamentos já existiam no baseline main e foram percebidos pela revisão como diferenças contra o stage completo. A decisão de corrigi-los é explícita neste recorte, pois afetam o PDF e a coerência da prévia/edição; não se promove a auditoria completa de referências nem a classificação HP.

1. PDF: fixture sem imagens reproduziu duas páginas, a última apenas com rodapé. Espaçador5mm agora pertence somente à seção de imagens. A mesma fixture gera uma página em oficial e prévia, com texto/pixels da primeira página preservados. Cache de eco v34 invalida v32; cache de PA continua igual. Sete páginas com imagens dos três fixtures representativos continuam idênticas ao baseline main por texto/geometria/pixels.
2. Espécie: reproduzidas sete falhas com Dog/Cão/cachorro, incluindo payload com índice0,9 desatualizado após alterarDIVEd25→30mm. Cinco pontos de fonte usam o normalizador exato já existente: apresentação, derivação Cornell, gate2D e predicados das páginas novo/editar. Nenhuma fórmula0,294/0,316, fonte, faixa, domínio, vista ou unidade foi mudada. Literal cadastrado preservado; CaninaXYZ/Dogfish/felinos não recebem índice canino. Regressões cobrem formulário/payload, detalhe e argumentos da comparação de referências.

Validação terminal após as correções: backend2469 testes+2422subtestes,175skips/25warnings,137,83s, papelapi e bloqueio externo; frontend2581Vitest/147arquivos+23Node, tipos/lint/build aprovados; foco193 sobreposto. Backend foco124+428subtestes e13+26subtestes também aprovado. Revisão independente de ambas correções sem achados acionáveis. PostgreSQL4/4 anterior permanece prova do módulo transacional que não mudou nesses P2. Logs/regressões em output/echo-preview-prod-20261104/backend/footer-boundary e output/echo-preview-frontend-20261104/alias-validation.json.

As afirmações de paridade byte a byte de nove arquivos com main e renderer v32 nos registros anteriores se referem ao snapshot antes desses ajustes; não descrevem a fonte final corrigida. A paridade dos seis arquivos de viewer/painel/hook com e541de8c continua válida.


### Fechamento do seletor de método AE/Ao —04/11/2026

A revisão apontou um terceiro gate de espécie literal em ReferenciaComparison: o seletor canino de método AE/Ao ficava oculto para Dog/Cão/cachorro e aparecia indevidamente para CaninaXYZ. O import/predicado usa agora o mesmo normalizeEchoSpecies já produtivo. A seleção permanece explícita, altera somente AE_Ao_metodo e não reescreve espécie nem confirma aquisição automaticamente. Gates que operam a espécie canônica do catálogo continuam preservados.

Regressões reproduziram quatro falhas antes do ajuste e agora cobrem quatro aliases e seis controles desconhecidos/felinos; foco107 aprovado, com seleção/callback único/rerender e objetos/literal preservados. Frontend final2591Vitest/147arquivos+23Node, tipos/lint/build53 e diffcheck aprovados. Backend fonte e resultados2469+2422 permanecem inalterados por este ajuste de UI. Revisão independente sem achados; não há fórmula/faixa/fonte nova. Evidência aeao-alias-validation.json e logs próprios no output/echo-preview-frontend-20261104.

### Preparação local da restauração de stage —04/11/2026

Frontend inteiro (fontes/testes) e renderer/motor HP byte idênticos ao backup1a5b444a; os três P2 de normalização/seletor/espaçador já estavam semanticamente resolvidos nesse conteúdo completo. Workflow de stage também restaurado integralmente. Guard de Nginx/teste/docs operacionais preservados do recorte. Backend difere do backup somente no identificador v35 e suas três suítes de teste: todos os métodos existentes, inclusive HP/fusão2D, preservados; duas regressões adicionais. Foco offlineAPI:80 testes+223subtestes aprovados. Rejeita cachesv32/v33/v34, sem mudar PA. Diffcheck limpo. Deploy/QA da restauração ainda aguardam promoção e PR próprio para stage; não equivale a publicação.
