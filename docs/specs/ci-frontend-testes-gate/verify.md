# Verify - ci-frontend-testes-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: verificado

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001, RF-002 / CA-002 | aceitacao | os dois checks rodam no PR desta entrega e passam (secao 4) | ok |
| RF-003 | tecnico | gatilho `push` para `stage` e `main` declarado | ok |
| RF-004 | tecnico | `paths` limitado a `frontend/**` e ao proprio workflow | ok |
| RF-005 | tecnico | o job de tipos manteve o nome `tipos-devem-compilar`; so o nome do workflow mudou | ok |
| RF-006 | tecnico | jobs separados: `tipos-devem-compilar` e `testes-devem-passar` | ok |
| RF-007 | tecnico | `deploy-stage.yml` intocado; o diff so renomeia um workflow e acrescenta um job | ok |
| RT-001 | tecnico | `npm test` em `working-directory: frontend` | ok |
| RT-002 | tecnico | `git mv` (o diff mostra `R`, renomeacao); `paths` atualizados nos dois gatilhos | ok |
| RT-003 | tecnico | `concurrency: frontend-ci-${{ ... }}` | ok |
| RT-004 | tecnico | `permissions: contents: read` | ok |
| CA-001 | tecnico | `yaml.safe_load` valido; nome `Frontend CI`; dois jobs | ok |
| CA-003 | tecnico | secao 2 | ok |
| CA-004 | aceitacao | teste negativo, secao 3 | ok |

## 2) Estado da suite antes de ligar o gate

```bash
cd frontend && npm test
```

```
Test Files  42 passed (42)
     Tests  297 passed (297)
# pass 9
# fail 0
```

297 testes vitest em 42 arquivos, mais 9 do runner do Node. Verde antes de o
gate existir -- que era a condicao para liga-lo.

## 3) Teste negativo

Invertendo a asercao de um teste (`toBe(false)` para `toBe(true)` em
"nao refaz o resumo ao navegar entre paginas no mesmo periodo"):

```
FAIL  lib/financeiro-loading.test.ts > deveRecarregarResumo > nao refaz o resumo ao navegar entre paginas no mesmo periodo
AssertionError: expected false to be true
     Tests  1 failed | 296 passed (297)
```

Restaurado, `npm test` volta a sair com codigo 0. Confirma que o comando do gate
reprova de verdade, e nao so roda.

## 4) Por que este gate faltava

Conferido antes de escrever, em vez de supor:

- `deploy-stage.yml` (`quality-gate`): roda `python -m unittest discover` do
  backend, `npm run lint` e `npm run build` do frontend, e build/teste do
  `whatsapp-stage-backend`. **Nunca `npm test` do frontend.**
- `migrations-ci.yml`: backend.
- `frontend-typecheck.yml`: so `tsc --noEmit`.

Ou seja, ate aqui os 297 + 9 testes so rodavam na maquina de quem implementava.
Bastava abrir um PR sem ter rodado a suite -- ou te-la rodado antes do ultimo
commit -- para codigo com teste quebrado entrar em `stage`.

## 5) Job separado, nao mais um passo

Falha de tipo e falha de teste sao diagnosticos diferentes e aparecem como checks
diferentes. Em um unico job, o `tsc` reprovando abortaria antes de rodar teste
nenhum, e a lista de checks diria so "frontend falhou".

Custo: um `npm ci` a mais, em paralelo com o outro job. Sem impacto no tempo de
espera.

## 6) O que este gate deliberadamente nao faz

- **Nao torna os checks obrigatorios.** `stage` e `main` nao tem protecao de
  branch, entao check vermelho informa, nao bloqueia o merge. Tornar obrigatorio
  exige admin do repositorio e segue como decisao em aberto do responsavel.
- **Nao mede cobertura.** O escopo foi rodar o que ja existe.
