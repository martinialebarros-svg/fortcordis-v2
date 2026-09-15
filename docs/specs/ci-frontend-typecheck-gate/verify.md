# Verify - ci-frontend-typecheck-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: verificado

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001, RF-002 / CA-002 | aceitacao | o workflow roda no PR desta entrega e passa (secao 3) | ok |
| RF-003 | tecnico | gatilho `push` para `stage` e `main` declarado | ok |
| RF-004 / CA-004 | tecnico | `paths` limitado a `frontend/**` e ao proprio workflow | ok |
| RF-005 | tecnico | `deploy-stage.yml` intocado; o diff so acrescenta arquivo novo | ok |
| RT-001 | tecnico | job unico, `npx tsc --noEmit` em `working-directory: frontend` | ok |
| RT-002 | tecnico | secao 4 | ok |
| RT-003 | tecnico | `concurrency` por PR/ref com `cancel-in-progress` | ok |
| RT-004 | tecnico | `permissions: contents: read` | ok |
| RT-005 | tecnico | `npm ci` com cache de `frontend/package-lock.json` | ok |
| CA-001 | tecnico | `yaml.safe_load` valido; gatilhos `pull_request`, `push`, `workflow_dispatch` | ok |
| CA-003 | aceitacao | teste negativo, secao 2 | ok |

## 2) Teste negativo

Injetando um erro de tipo em `frontend/lib/financeiro-loading.ts`:

```ts
const erroDeTipoProposital: number = "isto nao e um numero";
```

```
lib/financeiro-loading.ts(96,7): error TS2322: Type 'string' is not assignable to type 'number'.
```

Removido o erro, `npx tsc --noEmit` volta limpo. Confirma que o comando do gate
reprova de verdade, e nao so roda.

## 3) Por que o gate nao e redundante com o build

O `quality-gate` de `deploy-stage.yml` ja roda `npm run lint` e `npm run build`
no frontend. Nenhum dos dois pega o que este gate pega:

- `next.config.js` **nao** desliga o typecheck -- nao ha
  `typescript.ignoreBuildErrors`.
- Mas o `next build` so verifica tipos do que entra no grafo de compilacao.
  Arquivo de teste nao e importado por pagina nenhuma, entao nunca foi olhado.
- O `tsconfig.json` inclui `**/*.ts` e `**/*.tsx`, sem excluir teste. O
  `tsc --noEmit` cobre o que o build deixa passar.

A prova empirica ja existia: os tres `TS2322` de
`app/whatsapp-stage/AppointmentQueue.test.tsx` conviveram com build e lint
verdes por dias, e foram anotados como "pre-existentes, fora do diff" em pelo
menos tres `verify.md` antes de alguem corrigir.

## 4) Escopo do gatilho

`paths` cobre `frontend/**` e o proprio arquivo do workflow. A segunda entrada e
o que faz o gate rodar no PR desta entrega -- ele se autotesta -- e tambem
garante que futura mudanca no gate seja exercitada por ele mesmo.

PR so de `docs/` nao dispara o check. Isso e deliberado: o repo recebe muitos, e
nenhum pode quebrar tipo de frontend.

## 5) O que este gate deliberadamente nao faz

- **Nao torna o check obrigatorio.** `stage` e `main` nao tem protecao de branch
  (confirmado: `GET /branches/main/protection` devolve 404). Um check vermelho
  informa, nao bloqueia o merge. Tornar obrigatorio exige admin do repositorio e
  e decisao do responsavel.
- **Nao roda `vitest`.** Ver secao 6.

## 6) Buraco maior, anotado aqui e fechado depois

Os testes do frontend -- 297 vitest em 42 arquivos, mais 9 do runner do Node --
**nao rodavam em CI nenhum**. Rodavam so na maquina de quem implementa. O
`quality-gate` roda a suite do backend (`python -m unittest discover`), mas
nunca rodou o `npm test`.

Nao foi tratado nesta entrega porque o pedido era o gate de `tsc`, e porque
ligar a suite de frontend tem custo de tempo de pipeline que merecia decisao
propria, nao de carona.

Fechado em seguida por `docs/specs/ci-frontend-testes-gate/`, que acrescenta o
job `testes-devem-passar` e renomeia este workflow para `frontend-ci.yml` -- o
nome antigo passaria a mentir sobre o conteudo. O job de tipos manteve o nome,
entao o check criado aqui continua o mesmo.
