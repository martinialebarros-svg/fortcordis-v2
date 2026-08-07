# Verify - frontend-infraestrutura-testes

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 | requisito | `npx vitest run` -> "Test Files 2 passed (2)", "Tests 18 passed (18)" | ok |
| RF-002 | requisito | `npm test` executa Vitest (18 passed) seguido de `node --test` (9 passed) na mesma invocacao | ok |
| RF-003 | requisito | `test:watch` mapeado para `vitest` (modo watch por definicao do proprio Vitest quando sem `run`) | ok (por construcao) |
| RF-004 | requisito | `vitest.setup.ts` registra `afterEach(cleanup)` uma unica vez; os 4 `it()` de `FortCordisStateShell.test.tsx` chamam `render()` de forma independente sem vazar DOM entre si | ok |
| RF-005 | requisito | `.github/workflows/deploy.yml`: passo "Run frontend tests" (`npm test`) adicionado entre "Run frontend lint" e "Run frontend build" no job `quality-gate` | ok |
| NFR-001 | determinismo | nenhum teste usa `setTimeout`/rede/`Date.now`; todos os asserts sao sobre valores computados a partir de input fixo (strings, objetos, Blobs em memoria) | ok (por construcao) |
| NFR-002 | isolamento de config | `vitest.config.mts` usa extensao `.mts` (nao `"type":"module"` em `package.json`) - `next.config.js` (CommonJS) nao afetado, confirmado por `npm run build` continuar funcionando | ok |
| NFR-003 | sem redundancia | `vivid-iq-dicom.test.mjs` nao foi reescrito - so passou a ser descoberto por `node --test` | ok |
| NFR-004 | velocidade | Vitest: "Duration 551ms"; node:test: "duration_ms 56.964208" - suite completa bem abaixo de 2s | ok |
| CA-001 | aceitacao | `npx vitest run` -> 2 arquivos, 18 testes, todos passando (secao 2) | ok |
| CA-002 | aceitacao | `npm test` -> Vitest 18/18 + node:test 9/9 (secao 2) | ok |
| CA-003 | aceitacao | `npx tsc --noEmit -p tsconfig.json` sem output (sem erro) | ok |
| CA-004 | aceitacao | `npm run lint` sem output alem do cabecalho do script (sem erro/warning) | ok |
| CA-005 | aceitacao | `npm run build` completo, rotas listadas normalmente (secao 2) | ok |
| CA-006 | aceitacao | sequencia `npm ci && npm run lint && npm test && npm run build` executada localmente, todas as 4 etapas com sucesso (secao 2) | ok |
| CB-001 | caso de borda | `FortCordisStateShell.test.tsx` renderiza `next/image` (`fill`+`sizes`) e `next/link` sob jsdom sem mock - HTML gerado inclui `<img>` com `srcset` calculado e `<a href="/">` real | ok |
| CB-002 | caso de borda | reproduzido durante a implementacao: sem `afterEach(cleanup)`, o 4o `it()` de `FortCordisStateShell.test.tsx` falhava com "multiplos elementos" (DOM de testes anteriores acumulado); corrigido adicionando `afterEach(cleanup)` em `vitest.setup.ts`; os 18 testes passam de forma estavel apos a correcao | ok |

## 2) Testes automatizados executados

Comandos (sequencia real, incluindo a simulacao exata do CI a partir de
um `node_modules` limpo):

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build

npx tsc --noEmit -p tsconfig.json

cd ../backend
./venv/bin/python -m pytest tests/ -q --no-header
```

Resultados:
- `npm run lint`: sem erro/warning (`eslint --max-warnings=0`).
- `npm test`:
  - Vitest: `Test Files 2 passed (2)`, `Tests 18 passed (18)`,
    `Duration 551ms`.
  - `node --test`: 9/9 `ok` (arquivo `vivid-iq-dicom.test.mjs`, ja
    existente), `# pass 9`, `# fail 0`.
- `npm run build`: completo, todas as rotas listadas normalmente
  (nenhuma rota nova, nenhum erro de tipo/bundle).
- `npx tsc --noEmit`: sem erro.
- Backend (suite completa, para confirmar isolamento): 673 passed, 0
  failed - identico ao baseline anterior a este pacote (nenhum arquivo
  de `backend/` foi tocado).

## 3) Auditoria de dependencias novas

`npm audit` apos a instalacao reporta 10 vulnerabilidades (1
moderate, 9 high). Todas rastreadas por nome de pacote via
`npm audit --json`: `axios`, `brace-expansion`, `follow-redirects`,
`form-data`, `js-yaml`, `next`, `pdfjs-dist`, `postcss`, `sharp`, `ws` -
nenhuma delas e `vitest`/`jsdom`/`@testing-library/*`/`@vitejs/plugin-react`
(os pacotes novos deste pacote). Ou seja: zero vulnerabilidade nova
introduzida pelas dependencias de teste; as 10 reportadas sao
preexistentes na arvore de dependencias de producao/build.

## 4) Testes manuais

Nao aplicavel - esta feature nao tem superficie de UI visivel ao usuario
final. A verificacao "manual" equivalente e a leitura direta do output
dos comandos acima (secao 2), o que foi feito.

## 5) Regressao e riscos residuais

- Risco residual 1: o `quality-gate` do CI ganha um novo modo de falha
  (testes de frontend). Mitigado por ter reproduzido a sequencia exata
  do CI localmente (`npm ci` limpo, no lugar de `npm install`) antes do
  push - mesma cadeia de comandos, mesma versao de Node (20, confirmada
  local e no workflow).
- Risco residual 2: os 2 arquivos de teste novos cobrem apenas 2 modulos
  pequenos (`lib/api-error.ts`,
  `components/system/FortCordisStateShell.tsx`) - a infraestrutura
  existe, mas a maior parte do frontend (em especial
  `app/atendimento/page.tsx`, ~6500 linhas, e os achados #1-#29 ja
  corrigidos) ainda nao tem teste automatizado real, so as provas
  algoritmicas em `docs/specs/*/verificacao/*.mjs` produzidas ao longo
  da sessao de auditoria. Este pacote resolve a lacuna estrutural
  (ferramenta ausente); nao resolve retroativamente a cobertura.
- Risco residual 3 (pre-existente, nao introduzido por este pacote):
  `npm audit` continua reportando 10 vulnerabilidades em dependencias de
  producao/build (`axios`, `next`, `pdfjs-dist` etc.) - fora de escopo
  deste pacote, ja preexistiam.

## 6) Itens fora de escopo entregues

Nenhum.

## 7) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
