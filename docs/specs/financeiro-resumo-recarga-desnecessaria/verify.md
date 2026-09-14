# Verify - financeiro-resumo-recarga-desnecessaria

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: verificado por teste automatizado; verificacao manual em stage pendente

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001, RF-002 / CA-001 | aceitacao | `financeiro-loading.test.ts` - "nao refaz o resumo ao navegar entre paginas no mesmo periodo" | ok |
| RF-003 / CA-002 | aceitacao | "refaz quando o periodo muda" | ok |
| RF-004 / CA-003 | aceitacao | "refaz na primeira carga, quando nada foi aplicado ainda" | ok |
| RF-005 / CA-004 | aceitacao | "recarga manual sempre refaz, mesmo no mesmo periodo" | ok |
| RF-006 | funcional | a carga do resumo continua vindo de `/financeiro/resumo`; o unico ponto tocado foi a guarda que decide *se* ela roda | ok |
| RT-001 | tecnico | decisao em `deveRecarregarResumo`; `page.tsx` so chama | ok |
| RT-002 | tecnico | `carregarDados(origem: FinanceiroLoadOrigin = "manual")`; so o efeito passa `"efeito"` | ok |
| RT-003 | tecnico | `periodoResumoCarregadoRef.current = periodo` dentro do `onSuccess` | ok |
| RT-004 | tecnico | os dois `onClick={carregarDados}` viraram `onClick={() => void carregarDados()}`; `tsc` limpo | ok |
| CA-005 | tecnico | secao 2 | ok |
| CA-006 | aceitacao | stage, contagem de chamadas ao trocar filtro e ao trocar periodo | pendente |

## 2) Testes executados

```bash
cd frontend && npx tsc --noEmit && npx vitest run && npm run lint && npm run build
```

- `tsc --noEmit`: **limpo**. Os tres erros historicos de
  `app/whatsapp-stage/AppointmentQueue.test.tsx` deixaram de existir -- foram
  corrigidos em `financeiro-transacoes-pagination` (#123). Esta e a primeira
  entrega em que o typecheck fecha sem ressalva.
- **297 testes em 42 arquivos**, todos passando (eram 293; quatro novos).
- `eslint --max-warnings=0` limpo.
- `next build` concluido.

## 3) Teste negativo

Trocando o corpo de `deveRecarregarResumo` por `return true` -- isto e, voltando
ao comportamento anterior -- falha exatamente o teste que descreve o defeito:

```
× nao refaz o resumo ao navegar entre paginas no mesmo periodo
AssertionError: expected true to be false
Tests  1 failed | 10 passed (11)
```

Os outros tres continuam passando, o que e o esperado: o comportamento antigo
recarregava em excesso, nunca de menos.

## 4) O defeito que a mudanca quase introduziu

Vale mais que o defeito original.

Ao acrescentar o parametro `origem`, dois botoes passavam o handler direto:

```tsx
<button onClick={carregarDados}>Recarregar transacoes</button>
```

O React entrega o `MouseEvent` como primeiro argumento, entao `origem` viraria
um objeto. Nao sendo `"manual"`, a decisao cairia na comparacao de periodo -- e
**os botoes de "Recarregar" parariam de recarregar o resumo**. Sem erro, sem
valor errado, so um numero velho na tela depois de clicar exatamente o botao que
existe para atualiza-lo.

Pego pelo `tsc --noEmit`, antes de qualquer teste:

```
error TS2322: Type '(origem?: FinanceiroLoadOrigin) => Promise<void>' is not
assignable to type 'MouseEventHandler<HTMLButtonElement>'.
```

Registrado como RT-004 para que a regra sobreviva a esta entrega: passar
`carregarDados` direto para um `onClick` volta a quebrar isto.

## 5) Pendente

- Stage: abrir Financeiro > Transacoes, contar as chamadas a
  `/financeiro/resumo`, trocar um filtro e conferir que a contagem **nao** sobe;
  depois trocar o periodo (Dia/Semana/Mes/Ano) e conferir que **sobe**.
- Paginacao nao serve para essa checagem em stage: sao 23 transacoes para uma
  pagina de 100, entao nao existe pagina 2. Trocar filtro exercita o mesmo
  caminho -- o efeito reexecutando.

## 6) Origem

Observado de passagem durante o aceite de `financeiro-transacoes-pagination` em
producao, e registrado la como "observacao, nao defeito". Continua nao sendo
defeito de correcao: nenhum valor errado aparecia. E requisicao desperdicada.
