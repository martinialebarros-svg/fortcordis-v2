# Intent - frontend-infraestrutura-testes

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

O frontend (`frontend/`) nao tem nenhum test runner configurado -
`package.json` nao declara nenhum script `test` e nenhuma dependencia de
teste (Vitest, Jest, React Testing Library etc.). Duas consequencias
concretas, ambas observadas na sessao de auditoria+correcao do modulo de
atendimento (achados #1-#29 de
`docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`):

- Toda verificacao de logica assincrona/estado no frontend (guards de
  `requestId`, serializacao de save, contagem de upload) precisou ser
  provada via scripts Node ad-hoc (`docs/specs/*/verificacao/*.mjs`) que
  reimplementam a logica isoladamente em vez de importar e testar o
  codigo real - uma "prova algoritmica determinística", nao um teste de
  verdade contra o codigo em produção.
- Ja existe um arquivo de teste real no repositorio,
  `frontend/lib/vivid-iq-dicom.test.mjs` (9 casos, usa `node:test` +
  `node:assert/strict`, roda com zero dependencia externa), mas ele nunca
  foi conectado a nenhum script do `package.json` nem ao workflow de CI -
  esta orfao, nunca executado automaticamente.

## 2) Objetivo

Dar ao frontend um harness de teste real, executavel via `npm test` e
imposto pelo `quality-gate` do CI, capaz de:

- testar logica pura importando o modulo real (nao reimplementando a
  logica em um script paralelo);
- renderizar componentes React de verdade (React Testing Library) para
  provar que a config de ambiente (jsdom) e transform (JSX/TSX) funciona
  fim a fim;
- continuar executando o teste `node:test` ja existente, sem duplicar
  nem substituir sua abordagem (zero dependencia, arquivo `.mjs` puro).

## 3) Nao objetivos

- Nao inclui migrar `vivid-iq-dicom.test.mjs` para Vitest - o arquivo ja
  funciona corretamente com `node:test` e nao ha motivo para trocar de
  ferramenta; o objetivo e so PLUGAR o que ja existe em `npm test`/CI.
- Nao inclui escrever testes retroativos para os achados #1-#29 ja
  corrigidos nesta sessao - isso e trabalho futuro, item por item, agora
  que a infraestrutura existe.
- Nao inclui testes E2E/navegador real (Playwright, Cypress) - escopo e
  unit/component-level (Vitest + RTL), que e o que faltava e o que
  desbloqueia teste de logica e renderizacao isoladas. Confirmacao visual
  real no navegador continua sendo uma lacuna separada, documentada em
  outros `verify.md` desta sessao.
- Nao inclui configurar cobertura de codigo (`@vitest/coverage-v8`) -
  nenhum limiar de cobertura foi pedido; adicionar a ferramenta sem um
  uso definido seria escopo especulativo.

## 4) Contexto e restricoes

- Restricoes tecnicas: o projeto usa Next.js 15 (App Router) + React 18 +
  TypeScript, sem `"type": "module"` no `package.json` (o
  `next.config.js` usa `require`/`module.exports` - CommonJS - e
  depende disso continuar assim). Qualquer arquivo de config novo que
  precise ser ESM sem ambiguidade usa extensao `.mts`, nao
  `"type": "module"` no `package.json`.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: o job `quality-gate` do
  `.github/workflows/deploy.yml` bloqueia o deploy em `main` - qualquer
  novo passo de teste ali precisa ser deterministico e rapido (sem rede,
  sem timers reais) para nao introduzir flakiness que bloqueie deploys
  legitimos.

## 5) Impacto esperado

- Usuarios impactados: nenhum usuario final diretamente - impacto e no
  processo de desenvolvimento (qualquer pessoa/agente que alterar
  `frontend/` a partir de agora pode escrever um teste real).
- Modulos impactados: `frontend/package.json`,
  `.github/workflows/deploy.yml` (novo passo `Run frontend tests` no
  `quality-gate`), mais os arquivos de config/teste novos.
- Risco de regressao: baixo, mas o `quality-gate` ganha um novo modo de
  falha (teste de frontend) - mitigado testando localmente a sequencia
  exata do CI (`npm ci && npm run lint && npm test && npm run build`)
  antes de subir a mudanca.

## 6) Riscos iniciais

- Risco 1: dependencias novas (`vitest`, `jsdom`,
  `@testing-library/react`, `@testing-library/jest-dom`,
  `@vitejs/plugin-react`) podem introduzir vulnerabilidades de auditoria
  novas. Mitigacao: `npm audit` conferido apos a instalacao - nenhuma das
  10 vulnerabilidades reportadas (7 delas ja preexistentes em
  dependencias de producao como `axios`/`next`/`pdfjs-dist`) e originaria
  dos pacotes novos; todas as novas são transitivas de tooling de
  desenvolvimento, nunca embarcadas no bundle de producao.
- Risco 2: `@testing-library/react` exige limpar o DOM entre testes
  (`cleanup()`) apos cada `it()`, ou testes dentro do mesmo arquivo
  acumulam elementos e geram falsos positivos/negativos. Mitigacao:
  `afterEach(cleanup)` registrado uma vez em `vitest.setup.ts` (aplicado
  a todo arquivo de teste automaticamente, sem exigir que cada arquivo
  lembre de chamar).

## 7) Perguntas abertas

Nenhuma - implementacao concluida e validada localmente com a sequencia
exata do CI.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
