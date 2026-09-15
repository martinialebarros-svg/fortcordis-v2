# Verify - atendimento-card-clinica

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | preview local: com filtro em "Todas as clinicas", item `#2 - junio` (clinica "vetworld") mostra o badge "vetworld" como primeiro chip, antes de "0 exame(s)" e "Receita salva" (confirmado via `read_page`) | ok |
| CA-002 | aceitacao | preview local: apos `setClinicaFiltro("9")` + clique em "Aplicar filtros", lista refeita para "1 atendimento(s) encontrado(s)" e o badge "vetworld" desaparece do card | ok |
| CA-003 | aceitacao | preview local: item `#1 - celine` (sem `clinica_id`, `clinica_nome` vazio da API) nunca mostra nenhum badge, com o filtro em "Todas as clinicas" | ok |
| CA-004 | aceitacao | `npx tsc --noEmit` e `npm run build` do frontend: ambos aprovados (2 rodadas - antes e depois da correcao de staleness) | ok |
| CA-005 | aceitacao (adicionado pos-revisao adversarial) | preview local: `setClinicaFiltro("9")` via select SEM clicar "Aplicar filtros" - badge "vetworld" permanece visivel e lista continua mostrando "2 atendimento(s) encontrado(s)" (valor antigo, ainda nao refeita); so desaparece apos "Aplicar filtros" de fato refazer a lista | ok |

## 2) Testes automatizados executados

Nao aplicavel - nao ha suite de testes de componente React no projeto
para este modulo (mesma limitacao registrada em pacotes frontend-only
anteriores).

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Resumo: ambos aprovados, log limpo (rodado antes e depois da correcao do
bug de staleness encontrado na revisao adversarial).

## 3) Verificacao funcional (preview local)

Worktree isolado (`atendimento-card-clinica`, branch de `origin/stage`),
banco `fortcordis.db` e `.env` copiados temporariamente (nunca committed,
removidos ao final). Backend e frontend do worktree levantados em portas
dedicadas (`8129`/`3109`). Autenticacao via `fetch('/api/v1/auth/login',
...)` + `localStorage`.

Roteiro executado:

1. Login, navegacao ate `/atendimento`, abertura do painel "Casos
   recentes" ("Atendimentos recentes").
2. Com filtro em "Todas as clinicas" (estado inicial), confirmado via
   `read_page`: item `#2 - junio` mostra badge "vetworld" antes de "0
   exame(s)"/"Receita salva"; item `#1 - celine` (sem clinica) nao mostra
   nenhum badge.
3. Filtro alterado para "vetworld" (id 9) + "Aplicar filtros": lista
   refeita para 1 item, badge de clinica corretamente ausente (redundante
   quando ja filtrado a uma unica clinica).
4. Filtro revertido para "Todas as clinicas"; via `javascript_tool`,
   confirmado o `className` e `getComputedStyle` reais do badge:
   `rounded-full bg-slate-200 px-2.5 py-1 text-slate-700`, background
   `rgb(226, 232, 240)`, texto `rgb(51, 65, 85)`, `border-radius: 9999px`,
   ordem correta entre irmaos (`vetworld` -> `0 exame(s)` -> `Receita
   salva`). Screenshot indisponivel nesta sessao (instabilidade conhecida
   da ferramenta - tela preta em varias tentativas); a verificacao via
   DOM + CSS computado foi conclusiva e substituiu a evidencia visual.
5. **Revisao adversarial** (secao 4) encontrou um bug real de staleness.
   Apos a correcao (estado `clinicaFiltroAplicado`), reverificado: filtro
   alterado para "vetworld" SEM clicar "Aplicar filtros" - badge
   permanece visivel e contagem da lista nao muda ("2 atendimento(s)
   encontrado(s)", valor antigo); apos clicar "Aplicar filtros", lista vai
   para "1 atendimento(s) encontrado(s)" e o badge desaparece
   corretamente.
6. Filtros limpos ("Limpar") ao final para deixar o preview em estado
   neutro.

Nota nao-bloqueante: o preview local acusou 500 em
`/api/v1/alertas-internos` (`sqlite3.OperationalError: no such table:
alertas_internos`) durante toda a sessao - drift de schema no snapshot do
banco copiado para o preview (tabela nao existe nesse dump), sem relacao
com este pacote. Todas as chamadas `/api/v1/atendimentos*` retornaram 200
OK durante toda a verificacao.

## 4) Revisao adversarial

Agente dedicado (general-purpose) leu o diff real (`git diff
origin/stage`) de `page.tsx`, cobrindo 7 checagens especificas: corretude
da condicao dupla; ausencia de regressao nos chips vizinhos; validade do
JSX; corretude de tipos (`clinica_nome?: string`, truthy-check cobrindo
`undefined` e `""`); consistencia de estilo Tailwind com os chips
vizinhos; ausencia de outros usos de `clinica_nome` no arquivo; e um item
aberto para qualquer outro bug real.

**Veredito: 1 bug real encontrado (item 7).** A condicao original usava
`clinicaFiltro` (valor ao vivo do `<select>`) em vez do filtro que de fato
gerou a `lista` renderizada. Como `carregarLista` so roda por acoes
explicitas (nenhum `useEffect` observa `clinicaFiltro`), trocar o select
sem clicar "Aplicar filtros" fazia o badge sumir instantaneamente mesmo
com a lista ainda misturando clinicas - recriando, no momento exato da
troca de filtro, a ambiguidade que o pacote deveria resolver.
Reproducao deterministica confirmada pelo agente via leitura de codigo
(ausencia de `useEffect` dependente do filtro + `atendimentosVisiveis`
sendo alias direto de `lista`).

Todos os outros 6 itens passaram sem ressalvas.

**Correcao aplicada e reverificada** (ver secoes 1 e 3, CA-005): novo
estado `clinicaFiltroAplicado`, atualizado dentro de `carregarLista` no
mesmo ponto que `setLista`/`setTotalLista`/`setPaginaLista` (unico local
do arquivo que chama `setLista`, garantindo sincronia atomica). Badge
agora usa `clinicaFiltroAplicado === ""` em vez de `clinicaFiltro === ""`.

## 5) Regressao e riscos residuais

- **Risco residual 1:** a verificacao visual (screenshot) do badge nao
  pode ser confirmada por captura de tela nesta sessao (instabilidade
  conhecida da ferramenta - tela preta em multiplas tentativas); a
  verificacao via DOM (`read_page`) + CSS computado (`getComputedStyle`)
  foi usada como evidencia equivalente e e conclusiva quanto a presenca,
  posicao, texto e estilo do badge.
- **Risco residual 2:** nao ha runner de teste de componente React no
  projeto para este modulo - cobertura via tsc/build + preview manual,
  mesmo padrao dos pacotes frontend-only anteriores.
- **Risco residual 3:** o preview local expos um erro pre-existente e
  nao relacionado (`alertas-internos`, tabela ausente no snapshot do
  banco copiado) - documentado como nota nao-bloqueante, fora do escopo
  deste pacote.

## 6) Itens fora de escopo entregues

- Nenhum (a correcao do bug de staleness em `clinicaFiltroAplicado` esta
  dentro do escopo do proprio achado #50 - e parte necessaria para o
  badge refletir corretamente "a clinica de cada atendimento na lista
  exibida", nao uma feature adicional).

## 7) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda autorizacao explicita para deploy (mesmo processo
  dos pacotes anteriores).
