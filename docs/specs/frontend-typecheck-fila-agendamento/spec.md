# Spec - frontend-typecheck-fila-agendamento

Data: 2026-09-10
Responsavel: Martiniano Barros
Status: done

## 1) Escopo funcional

Corrigir os tres erros TS2322 que deixam `tsc --noEmit` vermelho em `stage`,
sem alterar comportamento de runtime. O tipo `Item` de `AppointmentQueue.tsx`
passa a ser exportado, e a fixture do teste e o parametro `itens` de
`response()` passam a ser anotados com ele. Assim o literal `historico: []`
deixa de ser inferido como `never[]` e os casos que enviam historico real
compilam contra o contrato verdadeiro do componente.

## 2) Requisitos funcionais (RF)

- RF-001: `npx tsc --noEmit -p tsconfig.json` termina com codigo 0 no frontend.
- RF-002: A fixture `item` e tipada como `Item`, o tipo real consumido por
  `AppointmentQueue`, e nao por uma copia local ou estrutura equivalente.
- RF-003: `response()` aceita `Item[]`, permitindo que cada caso monte
  `historico` com `acao`, `em`, `horario_preferido` e `observacao`.
- RF-004: Nenhuma asserção de escape (`as any`, `as unknown`,
  `@ts-expect-error`, `@ts-ignore`) e usada para silenciar os erros.
- RF-005: As sete assercoes de comportamento dos testes permanecem inalteradas.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): sem impacto; `export type` e apagado na compilacao e
  nao gera codigo nem entra no bundle do cliente.
- NFR-002 (seguranca/permissoes): sem impacto. Nenhuma rota, permissao, dado de
  paciente/tutor ou credencial e tocada.
- NFR-003 (observabilidade): a fixture passa a ser verificada contra o contrato,
  entao uma divergencia futura entre `Item` e o teste falha no typecheck em vez
  de passar silenciosamente.

## 4) Contratos tecnicos

### API

Nenhuma mudanca. O formato consumido (`{ itens, total, contagens }`) e o mesmo.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: nenhuma em runtime. `app/whatsapp-stage/AppointmentQueue.tsx`
  muda apenas de `type Item = {` para `export type Item = {`.
- Estados de UI: inalterados.
- Regras de exibicao/erro: inalteradas. O destaque de horario preferido e sua
  retirada apos nova correcao continuam cobertos pelos mesmos dois testes.

## 5) Compatibilidade e rollout

- Backward compatibility: total. Sem mudanca de runtime, contrato de API ou props.
- Feature flag: nao se aplica.
- Estrategia de rollback: reverter o commit; os dois arquivos sao independentes
  do restante de `stage`.

### Proposta (nao implementada nesta entrega): gate de frontend em CI

Hoje apenas tres workflows disparam em `pull_request`: `sdd-guardrail`
(stage, main), `migrations-ci` (stage, main) e `branch-flow-guard` (apenas
main). Os outros nove sao `push` de deploy ou `workflow_dispatch` manual.
Nenhum compila o frontend, roda ESLint ou executa vitest — por isso um
typecheck quebrado alcancou `stage` sem sinal. `migrations-ci` ja estabelece o
formato de um gate de PR para `stage` e `main`; um `frontend-ci.yml` analogo
(setup-node com cache de npm, `npm ci`, depois `tsc --noEmit`, `npm run lint` e
`npx vitest run`) fecharia a lacuna. Decisao e YAML proposto ficam na descricao
do PR; nada em `.github/workflows/` e alterado aqui.

## 6) Criterios de aceitacao (CA)

- CA-001: `npx tsc --noEmit -p tsconfig.json` sai 0, sem nenhum TS2322.
- CA-002: `npm run lint` sai 0 com `--max-warnings=0`.
- CA-003: `npx vitest run` passa integralmente, incluindo os sete casos de
  `AppointmentQueue.test.tsx`.
- CA-004: `git diff` nao contem `as any`, `as unknown`, `@ts-ignore` nem
  `@ts-expect-error`.

## 7) Casos de borda

- CB-001: fixture sobrescrita por spread (`{...item, historico:[...]}`) — o
  spread continua valido porque `historico` agora aceita o tipo declarado em
  `Item`, nao `never[]`.
- CB-002: `historico: []` vazio no `item` base — permanece valido, pois o array
  vazio e atribuivel ao tipo de elemento anotado.
- CB-003: exportar tipo de um modulo `"use client"` — seguro; tipos nao cruzam
  a fronteira servidor/cliente em runtime.

## 8) Fora de escopo

- Criar `.github/workflows/frontend-ci.yml` (proposto, nao implementado).
- Refatorar o layout denso de uma linha por campo em `AppointmentQueue.tsx`.
- Revisar as outras fixtures de `app/whatsapp-stage/` que ainda nao sao tipadas
  contra o contrato do componente.
