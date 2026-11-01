# Verify — Fluxo de confecção do laudo ecocardiográfico

## Situação atual — autorização restrita de produção em 01/11/2026

A fase 1a e a correção da seleção de imagens em lote foram homologadas em stage, incluindo o complemento básico de teclado e viewport estreito descrito abaixo. O usuário autorizou promover **somente novos ecocardiogramas com workspace/autosave e a correção de imagens em lote**. Outras funcionalidades presentes em stage não estão autorizadas por este pedido. A publicação em produção ainda não foi realizada nem comprovada neste registro.

O candidato isolado está na branch `codex/echo-draft-prod-isolated-20261101`, baseado em `main` `7430d5d8f9054f80cb9ee61e284462c4b6226892`. O código validado corresponde a `6e3a091496dc89bfc099497c75e1d0c0ee4c00c9`, com 27 caminhos no delta informado pelo executor principal, antes desta consolidação documental. O protocolo prevê apresentar esse escopo isolado em stage, promover pelo fluxo protegido `stage → main` e restaurar o estado de stage `9825174ccea1c586792f0ef54240ebbde1d2e44a` depois; essas operações não são declaradas concluídas aqui. Os checks devem corresponder ao SHA final da promoção, sem reutilizar apenas o sucesso de uma versão anterior.

A integração de workspace/autosave permanece exclusiva de `/laudos/novo`. O patch de lote é no `ImageUploader` compartilhado: também corrige o processamento da seleção múltipla quando usado pelo editor de laudos existentes e pela ultrassonografia abdominal. Isso não implementa recuperação/autosave nesses consumidores, nem entrega a fase 1b.

### Matriz atual da entrega — fase 1a e correção de lote

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

### Limites atuais e fases futuras

- A descoberta depende do UUID em `sessionStorage` da aba/sessão. Não há lista de rascunhos nem garantia de retomada depois de fechar a aba ou mudar de dispositivo.
- Imagens temporárias mantêm prazo próprio de 24 horas; descritores não prolongam sua validade. A conferência pós-associação usa quantidade e metadados correspondentes.
- Resposta clínica incerta requer conferência humana na central; POST clínico não é repetido automaticamente. Browser Back e navegação programática externa não estão interceptados.
- Disponibilidade HTTP externa teve comprovação parcial por conectividade intermitente da CLI. Os timeouts e a API anônima remota não foram registrados como pass; UI autenticada e chunk canônico foram observados funcionando.
- A migração 105 foi comprovada pelo log de stage, além dos testes em PostgreSQL local real. Implantação e migração em produção ainda não estão comprovadas neste registro.
- Fase 1b (workspace/autosave para edição existente) e fases 2–5 (prévia real, filtros/rodapés, síntese/comparação no PDF e imagens principais) são roadmap, fora da matriz desta entrega. Não foram convertidas em critérios aprovados ou publicadas por este pedido.

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
