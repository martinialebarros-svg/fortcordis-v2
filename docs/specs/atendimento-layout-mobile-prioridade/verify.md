# Verify - atendimento-layout-mobile-prioridade

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | 1024px, aba Consulta, painel de casos aberto: `.fc-care-workspace` (`order` computado = `1`, `top = 622.5`) renderiza ANTES de `.fc-care-sidebar` (`order` computado = `2`, `top = 4590`) - confirmado via `getBoundingClientRect`/`getComputedStyle`. | ok |
| CA-2 | aceitacao | 1440px (`xl`+): ambos com `order` computado = `0` (`xl:order-none` revertendo); `sidebar.left = 280` e `workspace.left = 570`, mesmo `top` - layout lado a lado identico ao anterior, confirmado via DOM e screenshot visual. | ok |
| CA-3 | aceitacao | Sticky do pacote #20 intacto a 1440px: `.fc-care-sidebar > div` com `position: sticky`, `top: 500px` via `getComputedStyle` - sem regressao na calibracao anterior. | ok |
| CA-4 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde. | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Sem suite automatizada de UI para esta pagina no projeto; mudanca
100% CSS/classe, sem mudanca de backend.

## 3) Testes manuais

Preview local isolado do worktree (backend `:8020`, frontend `:3020`,
`fortcordis.db`/`.env` copiados so para teste e removidos do worktree
ao final). Login via `fetch()` autenticado + `localStorage` (mesmo
padrao dos pacotes anteriores desta sessao onde o clique do Browser
tool ficou instavel - aqui o clique real funcionou normalmente apos
autenticar, entao usei `.click()` via DOM para alternar
"Casos recentes"/aba "Consulta" de forma confiavel, e confirmei via
medicoes de DOM):

1. Viewport 1024px: clique em "Casos recentes" (confirmado via classe/
   texto do botao mudando para "Ocultar casos") e na aba "Consulta"
   (confirmado via `.fc-care-tab-active`) - `showCaseSidebar` fica
   `true`. Medido `.fc-care-sidebar`/`.fc-care-workspace` via
   `getBoundingClientRect()` e `getComputedStyle().order` - resultado
   em CA-1.
2. Viewport 1440px: mesma pagina, sem outra interacao - medido
   novamente, resultado em CA-2; screenshot confirma visualmente
   painel de casos a esquerda, contexto do paciente ao centro, radar
   do caso a direita - identico ao layout pre-existente.
3. Sticky do `.fc-care-sidebar > div` confirmado intacto a 1440px
   (CA-3).
4. Preview encerrado; db/.env copiados removidos do worktree.

## 4) Revisao adversarial

Agente ceptico leu o bloco `.fc-care-layout` completo (sidebar +
workspace + aside interno), com foco explicito em nao reabrir a
calibracao sensivel de `sticky` do pacote `atendimento-header-fixo`
(achado #20, 2 rodadas de revisao adversarial anteriores).

**Veredito: correto, sem achados.**
- `.fc-care-layout` e `display: grid`; `order` em item de grid so
  afeta ordem de auto-placement entre irmaos, nao interfere com
  `position: sticky`, `max-height` ou qualquer sizing do proprio
  elemento.
- `.fc-care-aside` fica varios niveis DENTRO de `.fc-care-workspace`
  (nao e filho direto do grid de `.fc-care-layout`) - totalmente
  nao afetado pelo `order` no workspace.
- Todas as classes de offset sticky do #20 usam `xl:` de forma
  consistente com o novo `xl:order-none` - sem descompasso de
  breakpoint (`lg:` vs `xl:`) que criaria uma faixa de largura
  inconsistente.
- Nenhuma classe `order-*` pre-existente em conflito.
- `showCaseSidebar` e o unico gate de renderizacao do sidebar; com
  ele `false`, `.fc-care-workspace` e o unico filho do grid e
  `order-1`/`xl:order-none` sao no-op (sem efeito de item unico).
- Nenhum codigo no arquivo depende da ordem DOM entre sidebar/
  workspace para outra coisa alem de posicao visual (sem
  `nextElementSibling`/combinadores CSS de irmao/`tabIndex` explicito
  dependente de ordem).

## 5) Riscos residuais aceitos

- Painel de casos continua com sua visibilidade atual (controlada por
  `painelCasosAberto`) - nao ficou colapsado/oculto por padrao em
  telas estreitas (fora de escopo, ver `intent.md`).
- Escopo deste pacote cobre apenas o achado #52 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
