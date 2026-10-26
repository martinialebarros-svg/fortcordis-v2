# Verify - frontend-next-deps-security-upgrade

Data: 2026-10-16
Responsavel: Equipe FortCordis
Status: validacao local concluida; PR draft autorizado, deploy nao autorizado

## Ciclo de seguranca de outubro de 2026

Branch local: `codex/next-security-20261016`. Base: `77f65b3de020680aed579780945094988755686a` (`origin/stage`). Nenhum AGENTS.md encontrado no repositorio ou ancestrais aplicaveis. Checkout original preservado; nenhuma alteracao de outra tarefa foi transportada para esta branch.

### Matriz atual

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| OUT-CA-001 | aceitacao | Next/eslint-config 15.5.28; npm ls confirma sharp 0.35.5 deduplicado; carregamento nativo pelo contexto Next; entradas Linux preservadas | ok |
| OUT-CA-002 | aceitacao | npm ci, lint, TypeScript e build aprovados; 1029 Vitest + 23 Node com 2 workers, sem alterar timeouts | ok |
| OUT-CA-003 | aceitacao | Smoke HTTP/imagens aprovado; regressao sintetica backend de laudos/imagens/importador: 98 testes + 43 subtests | ok |
| OUT-CA-004 | aceitacao | Backend, migracoes, PostgreSQL descartavel, shell e WhatsApp aprovados; SDD avaliado sobre o diff real sem commit | ok |
| OUT-CA-005 | aceitacao | npm audit antes/depois coletado; detalhamento abaixo | ok |
| OUT-CA-006 | operacional | Runtime Linux glibc do destino, login autenticado e fluxos reais em stage dependem de deploy autorizado | pendente |

### Evidencias locais

Ambiente: macOS arm64, Node 20.20.2, npm 10.8.2. Logs completos em `../evidence/` relativo ao clone isolado (fora do diff). O arquivo `dependency-resolution.json` registra `createRequire(require.resolve('next/package.json'))('sharp').versions` e os pacotes Linux do lock. `sharp/package.json` nao e exportado na versao 0.35.5; a verificacao usa o modulo nativo carregado e `npm ls`, sem depender desse subpath privado.

- `npm ci --no-audit --no-fund`: aprovado, 506 pacotes.
- `npm run lint`: aprovado, sem warnings.
- `npx --no-install tsc --noEmit`: aprovado.
- Primeira execucao de `npm test`: 1027/1029 testes Vitest passaram; dois testes de `feline-narrative-review-page.test.tsx` atingiram 5000 ms durante execucoes concorrentes. Repeticao focal: 14/14 passaram. Repeticao integral com `npx --no-install vitest run --maxWorkers=2`: 106 arquivos, 1029/1029 passaram em 53,89 s; seguida de `node --test`: 23/23 passaram. Nenhuma assercao ou timeout foi alterado. A causa dos timeouts iniciais nao foi comprovada; o resultado com concorrencia limitada e registrado como tal.
- `node --test`: 23/23 aprovados separadamente e novamente apos a suite integral com 2 workers.
- `NEXT_TELEMETRY_DISABLED=1 API_BACKEND_URL=http://127.0.0.1:9 npm run build`: aprovado, Next.js 15.5.28. Nenhum backend real foi usado.
- Backend `unittest discover`: 1903 testes, 44 skipped no primeiro passe SQLite. Validacoes PostgreSQL foram executadas separadamente em cluster descartavel local: os 44 casos inicialmente pulados foram cobertos nas suites PostgreSQL especificas.
- Subconjunto Migration CI: 30 aprovados. Extras de CI (triagem, documentos, historico, concorrencia e recebimento PostgreSQL): 64 aprovados + 3 subtests. Fiscal PostgreSQL: 49 aprovados. PostgreSQL adicional: 38 aprovados. As contagens das suites se sobrepoem; nao somar como testes unicos.
- Regressao dirigida de PDF/imagens/importador: 98 aprovados + 43 subtests, incluindo unidades, ausencia de medidas, valores brutos, identificacao por pagina e legendas.
- Gates shell: 6/6 scripts. WhatsApp: build, 13/13 scripts independentes e 6/6 com PostgreSQL descartavel; auditoria runtime WhatsApp com zero vulnerabilidades. Auditoria completa WhatsApp tem 4 alertas altos de desenvolvimento preexistentes; seu lockfile nao foi alterado.
- SDD: `evaluate_guardrail(git diff --name-only, repo_root)` aprovado para os quatro arquivos reais do diff; esta verificacao usa o avaliador oficial, sem criar commit apenas para executar a interface de CI.
- `git diff --check`: aprovado. Revisao independente do diff: nenhum achado bloqueante; React/ReactDOM preservados e alteracoes da arvore de dependencias limitadas ao Next/sharp. Nenhuma alteracao backend/WhatsApp/rotas/configuracao foi necessaria.
- Gate de promocao avaliado sobre o diff: bloqueia corretamente OUT-CA-006, ainda pendente. Isso nao foi contornado nem convertido em aprovacao. O gate SDD local aprovado nao equivale a CI hospedado executado. Os checks hospedados serao acompanhados no PR draft autorizado; resultados devem ser vinculados ao SHA publicado, sem confundir CI Ubuntu com smoke nativo do servidor de destino.

### Smoke local e revisao de regressoes

- Servidor Next em `127.0.0.1:3018`, encerrado ao final; backend apontado para porta local indisponivel. Sem credenciais, dados reais ou chamadas a API externa.
- Host de aplicacao: `/`, `/agenda`, `/laudos/novo`, `/laudos/123` e `/clinica-parceira`: HTTP 200, headers CSP, X-Frame-Options e nosniff preservados. Esses 200 provam entrega do shell e nao autenticacao nem acesso a dados.
- Host institucional: landing distinta e redirecionamentos 307 de Agenda/laudos para o host da aplicacao. 29 bundles referenciados responderam HTTP 200.
- `/_next/image`: PNG institucional convertido para WebP 128x128; JPEG institucional convertido para WebP 640x360, ambos HTTP 200. Sharp 0.35.5 e libvips 8.18.7 carregados nativamente no macOS arm64.
- Login interno esta em `app/page-client.tsx` servido por `/`; a suite cobre sessao dos portais, mas nao comprova login interno real. Sem alteracao de autenticacao; PR concorrente #348 permaneceu fora desta branch.
- Agenda, upload/preview e payloads de laudo passaram nas suites existentes. Imagens clinicas usam `<img>`/API e PDF e gerado em Python; esses caminhos nao foram substituidos pelo otimizador Next.
- Limites: nenhum login real, browser hidratado, CRUD clinico, deploy ou smoke Linux glibc foi executado. Os testes sinteticos de PDF nao equivalem a uma validacao clinica de laudo real.
- Avisos nao bloqueantes observados: base Browserslist antiga e navegacao nao implementada em jsdom. Nao alterados neste patch.

### Auditoria de dependencias

Comparacao do mesmo dia por `npm audit --omit=dev --json`: base com 7 pacotes sinalizados (1 critico, 6 altos); atualizacao com 6 (0 criticos, 5 altos, 1 moderado). Os alertas diretos do Next e de sharp sairam; o alerta restante de Next vem de PostCSS. Permanecem Axios, nanoid, PDF.js, PostCSS e source-map-js, todos presentes na base. `npm audit` retorna codigo 1; nao e um gate aprovado. A auditoria completa atual aponta 22 pacotes (17 altos, 5 moderados), incluindo tooling. Nao foi executado `npm audit fix --force` nem upgrade major fora do escopo.

### Autorizacao de revisao e limites de rollout

Em 16/10/2026, o usuario autorizou commit, publicacao da branch e abertura de PR draft para `stage`, sem merge ou deploy. A rechecagem anterior ao envio confirmou a mesma base `77f65b3d`, apenas os quatro arquivos previstos alterados, branch remota ainda inexistente e nenhum PR equivalente encontrado. Acompanhar os checks do SHA publicado e registrar o resultado no PR.

Antes de qualquer rollout, tratar as pendencias da matriz, confirmar compatibilidade nativa no destino e definir a decisao sobre alertas remanescentes. Merge, deploy em stage, promocao e producao continuam sem autorizacao. Nenhum dado clinico ou credencial foi alterado. Nao ha evidencia de exposicao efetiva ou comprometimento do servidor.

## Historico: verificacao do ciclo de abril de 2026

Os resultados e aprovacoes abaixo pertencem exclusivamente ao ciclo de 05/04/2026 e nao autorizam publicar a atualizacao de outubro.

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/package.json` e lockfile com `next`/`eslint-config-next` em `15.5.14` | ok |
| CA-002 | aceitacao | `npm run build` verde (Next.js `15.5.14`) | ok |
| CA-003 | aceitacao | `npm run lint` verde com ESLint CLI | ok |
| CA-004 | aceitacao | `npm audit --omit=dev` com 0 vulnerabilidades | ok |
| CA-005 | aceitacao | deploy de stage confirmado apos push do ciclo | ok |
| CA-006 | aceitacao | deploy de main confirmado apos promocao (`3c84303`) | ok |
| NFR-001 | nao funcional | sem alteracao funcional de UI/fluxos | ok |
| NFR-002 | nao funcional | risco de runtime mitigado com upgrade de framework | ok |
| NFR-003 | nao funcional | pipeline de stage/main preservado | ok |
| NFR-004 | nao funcional | rollback simples por `git revert` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend
npm run build
npm run lint
npm audit --omit=dev
npm audit
```

Resumo dos resultados:
- Frontend: build/lint verdes.
- Auditoria runtime (`--omit=dev`): 0 vulnerabilidades.
- Auditoria completa: 0 vulnerabilidades.

## 3) Testes manuais

- Cenario 1: smoke de acesso na aplicacao apos deploy em stage.
- Cenario 2: smoke de acesso na aplicacao apos deploy em main.

## 4) Regressao e riscos residuais

- Risco residual 1: monitorar futuros upgrades major (Next 16+) por mudancas de tooling e lint config.

## 5) Itens fora de escopo entregues

- Ajuste complementar de lint para eliminar deprecacao (`next lint` -> ESLint CLI) documentado no ciclo `frontend-lint-next16-ready`.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
