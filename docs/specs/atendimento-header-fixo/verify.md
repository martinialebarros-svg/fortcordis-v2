# Verify - atendimento-header-fixo

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | Preview local, viewport 1440px: apos rolar (`window.scrollY` > 2000), `.fc-care-header` confirmado via `getBoundingClientRect().top === 0` + `getComputedStyle(header).position === "sticky"` + `zIndex === "20"`. | ok |
| CA-2 | aceitacao | Mesmo cenario: `document.elementFromPoint()` no centro do retangulo do botao "Salvar atendimento" retorna o proprio botao (nao outro elemento sobreposto). | ok |
| CA-3 | aceitacao | Viewport 1024px (abaixo de `xl`), apos o mesmo scroll: `.fc-care-header` confirmado com `position: "relative"` (comportamento inalterado). | ok |
| CA-4 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde - confirmado 2x (apos a implementacao inicial e apos a correcao dos offsets do painel lateral/aside). | ok |
| CA-5 | aceitacao | Altura real do header medida ao vivo com atendimento selecionado: 320.5px (viewport 1440px). Offsets finais (500px/488px) calculados com folga sobre o PIOR CASO TEORICO estimado por revisao adversarial (~416.5px, contabilizando viewport 1280px + bloco condicional "Horario da OS" nao reproduzido ao vivo) - nao so sobre o valor unico medido. Folga final: ~84px sobre o pior caso teorico, ~180px sobre o valor medido. | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Nao ha suite automatizada de CSS/layout no projeto. A verificacao de
comportamento foi feita via preview local (inspecao de DOM) e via
raciocinio aritmetico revisado adversarialmente (secao 3).

## 3) Testes manuais e revisao adversarial (2 rodadas)

Preview local isolado do worktree (backend em `:8013`, frontend em
`:3013`, banco de dados sqlite copiado de `backend/fortcordis.db` so
para login, depois apagado do worktree - nunca commitado):

1. Login como `admin@fortcordis.com`, aba Atendimento, atendimento
   existente selecionado (paciente "celine").
2. Viewport 1440px, apos rolar: `.fc-care-header` confirmado sticky
   (`top:0`, `z-index:20`); botao "Salvar atendimento" confirmado
   clicavel via `elementFromPoint`.
3. Viewport 1024px, mesmo scroll: header confirmado `position:
   relative` (inalterado).

**Primeira rodada de revisao adversarial** (1 agente ceptico, sobre a
implementacao inicial - so `.fc-care-header` com `xl:sticky xl:top-0
xl:z-20`, sem tocar em mais nada): identificou que
`.fc-care-sidebar`/`.fc-care-aside` (ja `xl:sticky` antes deste pacote,
offsets `top-6`/`top-3` = 24px/12px) ficariam cobertos pelo header fixo
(altura real ~280-320px, `z-20`) sempre que os dois estivessem presos
simultaneamente - incluindo a aside de alertas criticos (issue #47).
Achado real, nao especulativo - confirmado ao vivo:

4. Offset do painel lateral e da aside aumentados (primeira tentativa:
   420px/408px, calculados sobre 320.5px medido com atendimento
   selecionado + margem de ~100px). `max-height` da aside recalculado
   (`calc(100vh-436px)`).
5. Re-confirmado via HMR: margem de 99.5px entre a altura medida
   (320.5px) e o novo offset (420px).

**Segunda rodada de revisao adversarial** (confirmatoria, sobre a
correcao acima): apontou que a medicao de 320.5px foi feita em
viewport 1440px - mais largo que o minimo (1280px) em que `xl:sticky`
ja ativa - e sem confirmar simultaneamente o bloco condicional
"Horario da OS" (aparece quando ha agendamento vinculado, adiciona
largura a mesma fileira de botoes que ja quebra linha). Pior caso
teorico estimado pela revisao: ~416.5px. Decisao: em vez de reproduzir
essa combinacao especifica no preview (que apresentou instabilidade
recorrente nesta sessao - abas presas, `window.scrollTo` inoperante em
alguns momentos, screenshots retornando tela preta), os offsets foram
aumentados para 500px/488px (`max-height` para `calc(100vh-516px)`) -
~84px de folga sobre o pior caso teorico, nao so sobre o valor medido.
`tsc`/`build` re-confirmados limpos apos essa mudanca.

## 4) Riscos residuais aceitos

- Os offsets `top`/`max-height` do painel lateral e da aside sao
  valores fixos em pixels, aproximando a altura real do header (que
  varia com o conteudo - rotulo de botao, bloco "Horario da OS", nome
  de paciente/tutor muito longo). Nao ha medicao dinamica via
  JS/ResizeObserver + CSS custom property - decisao deliberada para
  manter o pacote pequeno (`esforço pequeno` do issue original). Se o
  header crescer alem do pior caso teorico estimado (~416.5px) por
  algum motivo nao considerado (ex.: nome de paciente extremamente
  longo quebrando a faixa em 2 linhas), a sobreposicao pode reaparecer
  - mitigado por uma folga generosa (~84px sobre o pior caso teorico
  estimado), nao eliminado por design.
- Nao foi possivel reproduzir ao vivo a combinacao exata "viewport
  1280px + agendamento vinculado + paciente selecionado" devido a
  instabilidade do ambiente de preview nesta sessao (mesma observada
  nos pacotes anteriores desta sequencia - `atendimento-triagem-
  alerta-vital`, `atendimento-cobertura-prontuario-real`). A folga
  aplicada (84px sobre o pior caso teorico calculado por revisao
  adversarial) e a mitigacao adotada no lugar dessa reproducao.
- Sem suite automatizada cobrindo este comportamento.
- Escopo deste pacote cobre apenas o achado #20 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
