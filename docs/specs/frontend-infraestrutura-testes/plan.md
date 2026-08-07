# Plan - frontend-infraestrutura-testes

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1/2 (DB/backend): nao aplicavel - feature 100% tooling de
  frontend/CI.
- Fase 3 (frontend): instalar dependencias, criar config, escrever os 2
  testes de prova, atualizar scripts.
- Fase 4 (integracao/observabilidade): conectar ao `quality-gate` do CI,
  validar a sequencia completa localmente.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 - Instalar `vitest`, `@vitejs/plugin-react`, `jsdom`,
  `@testing-library/react`, `@testing-library/jest-dom` como
  devDependencies.
- [x] T3.2 - Criar `vitest.config.mts` (ambiente jsdom, plugin React,
  alias `@/*`, `include: ["**/*.test.{ts,tsx}"]` para nao colidir com o
  `.test.mjs` existente).
- [x] T3.3 - Criar `vitest.setup.ts` (`@testing-library/jest-dom/vitest`
  + `afterEach(cleanup)`).
- [x] T3.4 - Escrever `lib/api-error.test.ts` (14 casos cobrindo os dois
  exports de `lib/api-error.ts`).
- [x] T3.5 - Escrever
  `components/system/FortCordisStateShell.test.tsx` (4 casos).
- [x] T3.6 - Adicionar scripts `test`/`test:watch` ao `package.json`.
- Criterio de conclusao: `npx vitest run` verde.
- Risco: nenhum identificado.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Adicionar passo `Run frontend tests` (`npm test`) ao job
  `quality-gate` de `.github/workflows/deploy.yml`, entre lint e build.
- [x] T4.2 - Rodar `npm ci` limpo (nao `npm install`) para validar que o
  `package-lock.json` atualizado e autoconsistente (mesmo mecanismo que
  o CI usa).
- [x] T4.3 - Rodar a sequencia exata do CI localmente: `npm ci && npm
  run lint && npm test && npm run build`.
- [x] T4.4 - Rodar a suite completa do backend para confirmar isolamento
  (feature 100% frontend/CI, nenhuma rota de API afetada).
- Criterio de conclusao: os 4 comandos da T4.3 retornam sucesso, suite
  backend sem regressao.
- Risco: quality-gate ganha um novo modo de falha (teste de frontend);
  mitigado por T4.2/T4.3 rodarem a sequencia real antes do push.
- Rollback: reverter o commit (remove o passo do CI e os arquivos novos;
  lint/build seguem funcionando sem eles).

## 3) Plano de testes

- Testes unitarios: os proprios 18 casos novos (`api-error.test.ts` +
  `FortCordisStateShell.test.tsx`) SAO o teste desta feature - a prova
  de que a infraestrutura funciona e eles passarem de verdade, nao um
  script externo.
- Testes de integracao: `npx tsc --noEmit` + `npm run lint` + `npm run
  build` (gates do `quality-gate`) + suite completa do backend (garantia
  de isolamento) + `npm ci` limpo (garantia de lockfile consistente).
- Testes manuais: nao aplicavel - nao ha UI nova visivel ao usuario
  final; a "interface" desta feature e a linha de comando/CI.

## 4) Dependencias e bloqueios

- Dependencia 1: `lib/api-error.ts` (`extractApiErrorMessage`,
  `extractApiErrorMessageSync`) e `components/system/FortCordisStateShell.tsx`
  ja existentes e exportados - nenhuma mudanca neles foi necessaria para
  serem testaveis.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (Vitest local + sequencia exata do CI
  reproduzida localmente antes do push).
