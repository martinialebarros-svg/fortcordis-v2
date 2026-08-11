# Verify - atendimento-exame-excluir-isolado

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | Preview local: gap medido entre "Laudar" e "Excluir" (exame nao salvo) = 25px, vs `gap-2`=8px padrao entre os demais botoes do grupo - divisor (`border-l border-slate-200`) e espacamento (`ml-1 pl-3`) confirmados via `getBoundingClientRect()`/`className`. | ok |
| CA-2 | aceitacao | `elementFromPoint()` no centro do retangulo do botao "Excluir"/"Remover" retorna o icone (filho do proprio botao) - `delBtn.contains(centerEl) === true`. | ok |
| CA-3 | aceitacao | Mesmo teste no botao "Laudar" do mesmo card - `laudarBtn.contains(centerEl) === true`; posicao relativa dos botoes no grupo inalterada. | ok |
| CA-4 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde - confirmado 2x (implementacao + revisao adversarial independente). | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Nao ha suite automatizada de UI para esta pagina no projeto. A
verificacao de comportamento foi feita via preview local (inspecao de
DOM) e revisao adversarial (leitura de codigo).

## 3) Testes manuais

Preview local isolado do worktree (backend em `:8014`, frontend em
`:3014`, banco de dados sqlite copiado de `backend/fortcordis.db` so
para login, depois apagado do worktree - nunca commitado):

1. Login como `admin@fortcordis.com`, aba Atendimento, atendimento
   existente selecionado (paciente "celine"), aba Exames.
2. Exame sem `id` (nao salvo, botao com title "Remover este exame da
   solicitacao") - confirmado via DOM: wrapper com classes
   `ml-1 flex items-center self-start border-l border-slate-200 pl-3`
   aplicado corretamente ao redor do botao vermelho.
3. Gap medido entre o botao "Laudar" (mesmo card) e o botao
   "Excluir"/"Remover": 25px (vs 8px padrao entre os demais botoes do
   grupo) - separacao visual clara.
4. `elementFromPoint()` no centro de cada botao confirma ambos
   continuam clicaveis (nenhum elemento sobreposto bloqueando o
   clique).
5. Preview local encerrado; `.env`/`fortcordis.db` copiados removidos
   do worktree.

## 4) Revisao adversarial

Escopo minimo (1 arquivo, 1 componente, mudanca estrutural/CSS sem
alteracao de comportamento) - revisao com 1 agente ceptico.

**Veredito: correto, sem achados.** Confirmado por leitura de codigo:
- Estrutura JSX correta - tags de abertura/fechamento coincidem, o
  wrapper novo e o unico elemento alterado.
- `self-start` migrado corretamente do botao para o wrapper (agora o
  item real do flex da linha externa).
- Divisor (`border-l`) renderiza com altura correta (dimensionada pelo
  filho, o botao com `py-2`), sem colapsar.
- Ambos os cenarios (com/sem `exame.id`, ou seja, com/sem o botao
  "Liberar no portal"/"Revogar portal" antes do divisor) resultam em
  exatamente um divisor, nunca duplicado ou orfao.
- `onClick`, `title` e icone confirmados byte-a-byte inalterados no
  diff.
- `tsc`/`build` re-confirmados limpos de forma independente.

## 5) Riscos residuais aceitos

- O `window.confirm()` que já existe antes da exclusão de exame
  persistido (achado #51, fora do escopo deste pacote) continua sendo
  a única barreira funcional contra exclusão acidental - este pacote
  reduz a chance do clique inicial ser no botão errado, mas não altera
  esse mecanismo.
- Sem suite automatizada cobrindo este comportamento.
- Escopo deste pacote cobre apenas o achado #31 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
