# Verify - atendimento-confirm-dialog

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `grep -n "window.confirm(\|confirm("` em `page.tsx`: zero ocorrencias apos a migracao | ok |
| CA-002 | aceitacao | preview local: fluxo "Excluir anexo" - dialogo com icone/botao vermelhos (`bg-red-100 text-red-600`/`bg-red-600`), `document.activeElement` = botao Cancelar | ok |
| CA-003 | aceitacao | preview local: Cancelar mantem o anexo na lista (`Documentos ... 1`); Esc tambem fecha o dialogo sem executar a acao | ok |
| CA-004 | aceitacao | preview local: clicar "Excluir" no dialogo chama `DELETE /atendimentos/anexos/{id}` e o anexo desaparece da lista (`Documentos ... 0`) | ok |
| CA-005 | aceitacao | preview local: fluxo "variavel nao reconhecida" ao gerar PDF - dialogo com icone ambar (`bg-amber-100 text-amber-600`), botao escuro (`bg-slate-900`), `document.activeElement` = botao "Gerar assim mesmo" | ok |
| CA-006 | aceitacao | `npx tsc --noEmit` e `npm run build` do frontend: ambos aprovados, sem erros | ok |

## 2) Testes automatizados executados

Nao aplicavel - nao ha suite de testes de componente React no projeto para
este modulo (mesma limitacao ja registrada em pacotes frontend-only
anteriores).

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Resumo: ambos aprovados, log limpo, incluindo apos a correcao do achado da
revisao adversarial (secao 4).

## 3) Verificacao funcional (preview local)

Worktree isolado (`atendimento-confirm-dialog`, branch de `origin/stage`),
banco `fortcordis.db` e `.env` copiados temporariamente (nunca committed,
removidos ao final). Backend e frontend do worktree levantados em portas
dedicadas (`8124`/`3104`). Autenticacao via `fetch('/api/v1/auth/login',
...)` + `localStorage`. Navegacao via `?atendimento_id=1`.

Verificacao via DOM/eventos reais (setter nativo de `value` +
`dispatchEvent`, nao apenas leitura visual - screenshots retornaram tela
solida preta nesta sessao, instabilidade conhecida ja registrada em pacotes
anteriores):

1. **Fluxo destrutivo completo** (`excluirAnexo`): adicionado um anexo via
   "Adicionar link externo"; clicado "Remover"; confirmado que o dialogo
   abre com `titulo="Excluir anexo?"`, `descricao` correta, icone
   `bg-red-100 text-red-600`, botao de acao `bg-red-600` com texto
   "Excluir", e foco inicial no botao "Cancelar". Clicado "Cancelar":
   dialogo fecha, anexo permanece na lista. Reaberto o dialogo (novo clique
   em "Remover") e clicado "Excluir": dialogo fecha, `DELETE` executado, o
   anexo some da lista (contagem de Documentos volta a 0).
2. **Fluxo informativo completo** (`baixarPdfDocumentoClinico`, aviso de
   variavel nao reconhecida): criado um documento com corpo contendo
   `{{variavel_inexistente}}`; clicado "Gerar PDF"; confirmado que o
   dialogo abre com `titulo="Variaveis nao reconhecidas no documento"`,
   `descricao` citando a variavel e a contagem corretas, icone
   `bg-amber-100 text-amber-600`, botao de acao `bg-slate-900` com texto
   "Gerar assim mesmo", e foco inicial no proprio botao de acao (nao no
   Cancelar) - variante `default`.
3. **Esc-para-cancelar**: disparado `KeyboardEvent("keydown", {key:
   "Escape"})` no elemento focado durante um dialogo aberto - dialogo fecha
   (equivalente a cancelar).

## 4) Revisao adversarial

Agente dedicado (general-purpose) leu o diff real (`git diff origin/stage`)
e o arquivo completo de `ConfirmDialog.tsx`, cobrindo 7 checagens
especificas: migracao fiel dos 12 call sites (condicao/mensagem/acao
preservadas); atribuicao correta de variante `destructive` as 5 exclusoes
citadas no achado; preservacao da ordem de efeitos colaterais em
`removerExame` apos se tornar `async`; corretude da reentrancia em
`finalizarAtendimento`; risco de Promise pendente por dupla abertura;
corretude de tipos.

**Achado real (1):** `confirmarAcao` podia deixar uma Promise anterior
pendente para sempre se uma segunda acao de confirmacao disparasse antes da
primeira ser resolvida - especificamente no primeiro uso da sessao, antes
do chunk do `ConfirmDialog` (import dinamico, `ssr: false`) terminar de
carregar, quando o overlay ainda nao esta renderizado para bloquear cliques
concorrentes. **Corrigido**: `confirmarAcao` agora resolve como cancelado
(`false`) qualquer dialogo pendente antes de abrir o proximo
(`page.tsx`, dentro do `setConfirmDialogState((atual) => { atual?.resolve(false);
return {...} })`), eliminando a possibilidade de Promise presa
independentemente de quando o componente termina de carregar. `tsc`/`build`
reaprovados apos a correcao.

Demais 6 checagens: sem achados.

## 5) Regressao e riscos residuais

- **Risco residual 1:** nenhum runner de teste de componente React no
  projeto para este modulo - a cobertura e tsc/build + verificacao manual
  em preview, mesmo padrao dos pacotes frontend-only anteriores.
- **Risco residual 2:** os modais customizados pre-existentes do modulo
  (`AttachmentPreviewModal`, `PainelExamesModal`, etc.) continuam sem os
  mesmos atributos de acessibilidade (`role`, `aria-*`, foco) que o
  `ConfirmDialog` novo introduz - fica para o achado #55, fora do escopo
  deste pacote (ver `intent.md`).
- **Risco residual 3:** verificacao funcional foi feita via DOM/eventos
  (screenshots indisponiveis nesta sessao) - comportamento confirmado
  programaticamente para 2 dos 12 fluxos (1 destrutivo + 1 informativo,
  representando ambas as variantes visuais); os outros 10 compartilham o
  mesmo componente/mecanismo e foram verificados por leitura de codigo na
  revisao adversarial, nao individualmente em preview.

## 6) Itens fora de escopo entregues

- Nenhum.

## 7) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda autorizacao explicita para deploy (mesmo processo
  dos pacotes anteriores).
