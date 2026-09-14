# Verify - financeiro-resumo-recarga-desnecessaria

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: verificado. Teste automatizado e conferencia manual em stage (secao 7).

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
| CA-006 | aceitacao | stage sobre `44809a4f`, secao 7: dois filtros trocados sem recarregar o resumo; periodo trocado recarregando | ok |

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

## 5) Nada pendente

A checagem em stage prevista aqui foi executada; registro na secao 7.

Paginacao nao serviu para essa checagem em stage: sao 23 transacoes para uma
pagina de 100, entao nao existe pagina 2. Trocar filtro exercita o mesmo caminho
-- o efeito reexecutando -- e foi o que se usou.

## 6) Origem

Observado de passagem durante o aceite de `financeiro-transacoes-pagination` em
producao, e registrado la como "observacao, nao defeito". Continua nao sendo
defeito de correcao: nenhum valor errado aparecia. E requisicao desperdicada.

## 7) Conferencia em stage (2026-09-13)

Sobre `44809a4f`, em `app.stage.fortcordis.com.br`, aba Financeiro > Transacoes.
Contagem lida do Resource Timing do proprio navegador. Somente leitura e troca
de filtro; nenhuma mutacao.

| Acao | `/financeiro/transacoes` | `/financeiro/resumo` |
| --- | --- | --- |
| Carga inicial | 1 | 1 |
| Trocar filtro de tipo | 2 | **1** |
| Trocar filtro de status | 3 | **1** |
| Trocar periodo `Mes` -> `dia` | 4 | **2** (`?periodo=dia`) |
| Botao "Atualizar" | 5 | **3** |

As duas metades de CA-006 batem: filtro nao recarrega o resumo, periodo
recarrega. A lista de transacoes refaz em todas as trocas, como deve -- se ela
tivesse parado de refazer, a guarda teria pegado a carga errada.

### A linha que mais importava

O botao "Atualizar" era um dos dois `onClick={carregarDados}` corrigidos em T6.
Sem essa correcao, o `MouseEvent` ocuparia `origem`, a decisao cairia na
comparacao de periodo e o botao teria **parado de recarregar o resumo** em
silencio. No app real ele recarregou (3 apos 2, com o periodo inalterado), o que
fecha RF-005 fora do teste unitario e confirma que a correcao que o `tsc`
forcou esta certa.

A tela foi devolvida ao estado inicial: filtros em "todos", periodo em "Mes".
