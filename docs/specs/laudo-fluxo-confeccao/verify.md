# Verify — Fluxo de confecção do laudo ecocardiográfico

## Estado em 01/11/2026

O usuário autorizou criar o plano e iniciar a implementação. Foram preparados `intent.md`, `plan.md`, `spec.md` e este registro. A fase 1 foi dividida em 1a (somente novos ecocardiogramas, neste ciclo) e 1b (edição de laudos existentes, posteriormente e antes da fase 2). A fase 1a foi implementada localmente na branch `codex/echo-draft-recovery-20261101`, em worktree isolada baseada em `origin/stage`.

O delta contém workspace privado com GET/PUT/POST de fechamento lógico, CAS e retry por operação; precondição `X-Editor-Owner-Id` conferida contra a sessão autenticada; snapshot bruto sem binários/credenciais; UUID em `sessionStorage`; debounce de 1.500 ms; recuperação explícita após inicialização do contexto; e ações distintas de rascunho/emissão. Troca/perda do primeiro usuário conhecido bloqueia a tela. A emissão e a criação explícita para ditado conservam guarda recuperável se a resposta clínica for incerta. Imagens temporárias mantêm validade de 24 horas e exigem reenvio quando ausentes; são reconciliadas antes da emissão e após a associação.

As verificações abaixo são locais, com dados sintéticos. Não houve publicação, HTTP autenticado em stage, migração em PostgreSQL operacional, emissão real ou revisão visual de PDF deste incremento. Os resultados foram consolidados pelo executor principal e pelos agentes responsáveis por backend/UI. Nenhum paciente real integra a documentação.

## Validações executadas

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

## Critérios e evidências

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

## Revisão estática independente

A revisão do backend, hook e integração na página identificou e motivou correções de: identidade por cookie divergente do cache local; restauração assíncrona após troca de usuário; formulário congelado por erro de autosave; dependência indevida do fluxo de PA; perda do guard de salvamento clínico ao continuar genericamente; saída SPA antes do debounce; nova criação clínica do ditado após resposta incerta; e associação de imagens HTTP 200 sem recebimento persistido. A releitura terminal confirmou os controles correspondentes nas fontes. Isso não substitui a homologação do ambiente instalado.

## Limitações e pendências

- A descoberta do workspace depende do UUID em `sessionStorage` da aba/sessão atual. Não há lista de rascunhos nem garantia de retomada após fechar a aba ou usar outro dispositivo, embora o snapshot permaneça no servidor até fechamento lógico.
- Voltar do formulário e cliques comuns em links internos da mesma aba aguardam flush. `beforeunload` protege saída nativa. Botão Voltar do navegador e navegação programática iniciada fora do formulário não são interceptados nesta fatia.
- Repetir operações do workspace é idempotente; POST clínico não é repetido automaticamente. Resposta clínica incerta exige conferência humana na central antes de retomar.
- Imagens temporárias mantêm validade de 24 horas; guardar seus descritores não estende a validade. Após associação, a conferência usa quantidade e metadados correspondentes, sem alterar o contrato existente de imagens.
- A migração `20261101_105_laudo_editor_drafts.py` não foi aplicada em stage/produção. O DDL PostgreSQL foi simulado e SQLite executado nos testes isolados; autorização, isolamento e concorrência no PostgreSQL instalado ainda precisam de homologação.
- Fase 1b e fases 2–5 permanecem planejadas. A proteção da rota `/laudos/{id}/editar`, prévia real do PDF, layout/rodapés, síntese clínica, comparação no PDF e imagens principais não foram implementados neste delta. O ditado coberto pela 1a começa no formulário novo.

## Publicação e dados

### Preflight da publicação em stage — 01/11/2026

A integração com o `origin/stage` atual foi feita por merge, sem conflitos, preservando o conteúdo financeiro e os workflows já publicados. A validação adicional executou 34 testes e 86 subtestes de contratos/migração/segurança, com sucesso; essas contagens se sobrepõem às suítes anteriores.

Também foi executado PostgreSQL **16.13 real e descartável**, local, em socket Unix privado, sem TCP ou banco remoto: migração 105 aplicada pelo runner (primeira execução: 1; segunda: 0), versão atual/mais recente 105 e zero pendentes. Foram conferidos RLS, bloqueio de privilégios para `anon`/`authenticated`, unicidade proprietário+UUID, FK, roundtrip literal, retry, autoria, CAS concorrente com um sucesso e um conflito, encerramento/retry, GET 410 e rejeição de autosave após fechamento. A tabela sentinela permaneceu intacta; o cluster foi encerrado e removido. Isso complementa o DDL antes simulado, sem comprovar ainda a migração no ambiente instalado.

Na primeira solicitação houve apenas implementação local. Em 01/11/2026, o usuário autorizou publicar em **stage** e testar rascunho automático, recuperação e emissão de novos laudos. A preparação desta publicação preserva a versão remota `a7b97cff25a10fb6dd61fdc11dc75f949b2a0b72` e confirmou que a maior migração remota é a 104, sem colisão com a nova 105. A fila anterior de deploy estava concluída com sucesso.

A autorização é restrita a stage. A publicação só será considerada comprovada após checks/workflow terminais, versão instalada e testes aplicáveis. Promoção a produção não foi solicitada neste ciclo. Os resultados locais acima não são evidência de ambiente instalado; registrar abaixo o resultado efetivo da homologação.

### Primeira publicação e homologação de stage — PR #536

- Publicação concluída: PR #536, merge `554ab4f8a2dca5e551d770c1bcc597c8bb0c95d2`. A atualização intermediária do painel de gestão (`4a7e24d6`) também foi integrada e preservada antes do merge.
- Workflow [Deploy to Stage (VPS)](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41335383746) terminou com `success`, incluindo quality gate, SDD, diagnóstico e deploy. Migration CI `41335383796`, Frontend CI `41335383816` e Google Maps Cost Control `41335383810` também terminaram com sucesso.
- Log do deploy confirmou `Installed deploy SHA` igual ao merge, migração `20261101_105` aplicada, preservação/restauração dos seis arquivos runtime, backend health, runtime gate, canário autenticado e backup restore drill aprovados. O gate não publica o payload completo de `/health`; não afirmar leitura independente desses campos.
- A árvore integrada passou localmente por 147 arquivos / 2.617 testes Vitest, 23 testes Node, lint/build/TypeScript e 2.560 testes unittest de backend (139 skips de integrações opcionais), além dos testes focados e do PostgreSQL descartável já registrados.
- No navegador interno autenticado, com nome/tutor sintéticos únicos e sem vínculo com paciente/agendamento existente: autosave confirmado; emissão bloqueada antes da decisão de recuperação; recargas recuperaram cabeçalho, valores literais, zero, campo apagado e estados independentes de fusão. Edição de medida invalidou a confirmação pertinente como previsto, sem uma nova confirmação fabricada.
- Uma revisão de conclusão seguida de Voltar antes do debounce foi recuperada na reabertura. A busca pelo identificador sintético na central retornou zero laudos antes da emissão, distinguindo workspace de documento clínico.
- Duas imagens sintéticas recebidas individualmente foram recuperadas com nomes, legendas, ordem e seleção de inclusão no PDF corretas. A conclusão da emissão/PDF ainda estava aguardando o diálogo nativo durante a preparação desta correção complementar.
- Smoke externo foi parcial por timeouts TCP intermitentes da CLI: `www.stage` completou a cadeia HTTPS com login 200; o chunk canônico `app/laudos/novo/page-8bfec82e363a55ee.js` respondeu 200 e contém os quatro marcadores do incremento. Foram obtidos 12/20 chunks; oito timeouts e a API anônima não foram marcados como aprovados. A interface autenticada funcionou. Evidências locais: `/tmp/fortcordis-pr536-stage-deploy-watch.log` e arquivos temporários da homologação; não incluem credenciais.

### Correção complementar encontrada na homologação: lote de imagens

O seletor recebeu dois PNGs sintéticos, mas o painel exibiu apenas o primeiro. A rotina existente também estava presente na base `4a7e24d6`: o handler limpava o input enquanto `processarArquivos` aguardava o primeiro FileReader e continuava iterando a coleção viva. A regressão local esvazia a seleção quando `input.value` é limpo e demonstrou **um POST em vez de dois** antes do patch.

A correção captura `Array.from(files)` antes da primeira leitura assíncrona e processa essa coleção estável, mantendo a semântica de metadados, ordem, inclusão e upload. O teste novo verifica dois arquivos, dois uploads e seus identificadores próprios.

| Critério | Estado local | Evidência e limite |
| --- | --- | --- |
| CA-FC-09 | automatizado aprovado; stage pendente | RED reproduzido antes da cópia; GREEN com 26 testes nos três arquivos focados, lint completo, build de 45 páginas e TypeScript aprovados. A seleção simultânea será repetida após publicar esta correção em stage. |

Comando focado: `npx vitest run app/laudos/components/ImageUploader.test.tsx app/laudos/echo-draft-new-page.test.tsx app/laudos/components/ImagePreviewModal.test.tsx --maxWorkers=2`. Logs locais `/tmp/fortcordis-image-batch-{red,green,lint,build,tsc}-554ab4f8.log`. Nenhum valor, método ou referência clínica foi alterado.
