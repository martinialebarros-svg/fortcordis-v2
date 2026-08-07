# Spec - frontend-infraestrutura-testes

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

Instalar e configurar Vitest + React Testing Library como test runner do
frontend, com ambiente jsdom e suporte a JSX/TSX via
`@vitejs/plugin-react`. Adicionar `npm test` (Vitest + `node --test`) e
`npm run test:watch` ao `package.json`. Conectar `vivid-iq-dicom.test.mjs`
(ja existente, orfao) ao `node --test`. Adicionar dois arquivos de teste
reais como prova de que o harness funciona fim a fim: um de logica pura
(`lib/api-error.test.ts`) e um de renderizacao de componente
(`components/system/FortCordisStateShell.test.tsx`). Adicionar o passo
`Run frontend tests` ao job `quality-gate` do CI.

## 2) Requisitos funcionais (RF)

- RF-001: `npx vitest run` executa e passa com ambiente `jsdom`,
  suporte a TSX (via `@vitejs/plugin-react`) e ao alias `@/*` (mesmo
  alias de `tsconfig.json`).
- RF-002: `npm test` executa Vitest E o runner nativo `node --test` (que
  auto-descobre `**/*.test.mjs`), nessa ordem, falhando se qualquer um
  dos dois falhar.
- RF-003: `npm run test:watch` inicia o Vitest em modo watch (uso
  interativo local, nao usado em CI).
- RF-004: cada arquivo de teste tem `cleanup()` do
  `@testing-library/react` aplicado automaticamente apos cada `it()`,
  via `afterEach` registrado uma unica vez em `vitest.setup.ts` - nenhum
  arquivo de teste individual precisa lembrar de chamar `cleanup()`.
- RF-005: o job `quality-gate` do `.github/workflows/deploy.yml` executa
  `npm test` (working-directory `frontend`) entre os passos `Run
  frontend lint` e `Run frontend build` - uma falha em qualquer teste
  bloqueia o merge/deploy exatamente como lint/build ja bloqueiam.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (determinismo): nenhum teste depende de rede, tempo real
  (`setTimeout`/`Date.now`) ou ordem de execucao entre arquivos - todos
  os asserts sao sobre valores computados sincrona ou
  assincronamente a partir de um input fixo.
- NFR-002 (isolamento de config): o arquivo de config do Vitest usa
  extensao `.mts` (nao `"type": "module"` no `package.json`), para nao
  alterar a interpretacao CommonJS/ESM de nenhum outro arquivo `.js` do
  projeto (`next.config.js` depende de permanecer CommonJS).
- NFR-003 (sem novo mecanismo redundante): a suite `node:test` ja
  existente nao e reimplementada em Vitest - so passa a ser executada
  automaticamente.
- NFR-004 (velocidade): a suite completa (Vitest + node:test) roda em
  menos de 2s localmente - nao adiciona latencia relevante ao
  `quality-gate`.

## 4) Contratos tecnicos

### API

Nao aplicavel - infraestrutura de teste, sem mudanca de contrato de API.

### Banco/migracoes

Nao aplicavel.

### Frontend

- Arquivos de config novos: `frontend/vitest.config.mts`,
  `frontend/vitest.setup.ts`.
- Scripts novos em `frontend/package.json`: `test`, `test:watch`.
- Dependencias novas (devDependencies): `vitest`,
  `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`.
- Arquivos de teste novos: `frontend/lib/api-error.test.ts`,
  `frontend/components/system/FortCordisStateShell.test.tsx`.
- Nenhum arquivo de codigo de produção (`app/`, `lib/*.ts` fora do
  arquivo de teste, `components/*.tsx` fora do arquivo de teste) e
  alterado - a feature e puramente aditiva de tooling.

## 5) Compatibilidade e rollout

- Backward compatibility: total - nenhum comportamento de runtime
  muda, so ferramentas de desenvolvimento/CI.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit remove os arquivos de
  config/teste novos e o passo do CI; `npm run lint`/`npm run build`
  continuam funcionando exatamente como antes (nao dependem dos
  arquivos novos).

## 6) Criterios de aceitacao (CA)

- CA-001: `npx vitest run` reporta 2 arquivos de teste, 18 testes,
  todos passando.
- CA-002: `npm test` reporta a suite Vitest E a suite `node --test`
  (9 testes de `vivid-iq-dicom.test.mjs`) passando, nessa ordem.
- CA-003: `npx tsc --noEmit -p tsconfig.json` nao reporta erro nos
  arquivos novos.
- CA-004: `npm run lint` (eslint `--max-warnings=0`) nao reporta erro
  nem warning nos arquivos novos.
- CA-005: `npm run build` completa com sucesso apos as mudancas (prova
  de que os arquivos de teste/config novos nao interferem no build de
  producao).
- CA-006: a sequencia exata do CI (`npm ci && npm run lint && npm test
  && npm run build`, nessa ordem, a partir de um `node_modules` limpo)
  completa com sucesso localmente antes do commit.

## 7) Casos de borda

- CB-001: um componente com `next/image` (`fill`, `sizes`) e
  `next/link` renderiza corretamente sob jsdom sem mock adicional -
  confirmado empiricamente por
  `FortCordisStateShell.test.tsx` (o componente usa ambos).
  Reforca que o setup basico funciona com padroes reais do projeto, nao
  so com componentes triviais sem dependencia do Next.
- CB-002: sem `afterEach(cleanup)`, dois `it()` no mesmo arquivo que
  fazem `render()` do mesmo componente acumulam DOM (`getByRole`
  encontra "multiplos elementos") - reproduzido e corrigido durante a
  implementacao; o teste de regressao para isso E o proprio arquivo
  `FortCordisStateShell.test.tsx` ter 4 `it()` que chamam `render()`
  independentemente e todos passarem.

## 8) Fora de escopo

- Testes E2E/navegador real (Playwright, Cypress).
- Cobertura de codigo (`@vitest/coverage-v8` ou similar).
- Testes retroativos para os achados #1-#29 da auditoria de atendimento.
- Migrar `vivid-iq-dicom.test.mjs` de `node:test` para Vitest.
