# Verify - atendimento-badges-pendencia

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | Estado neutro (0 exames, 0 itens de prescricao): badges "Exames"/"Prescricao" sem classe `fc-care-tab-badge-alert`, confirmado via DOM (`classList.contains`). | ok |
| CA-2 | aceitacao | Exame adicionado so com nome (sem arquivo, `aguardando_arquivo`): badge "Exames" -> `fc-care-tab-badge-alert`, `background-color: rgb(245, 158, 11)` (amber-500), `title="Ha pendencia real nesta area"` - confirmado via DOM e screenshot. | ok |
| CA-3 | aceitacao | Item de prescricao com medicamento preenchido e dose/frequencia/via vazios: badge "Prescricao" -> `fc-care-tab-badge-alert` **imediatamente**, sem precisar clicar "Salvar atendimento" (ver secao 4, achado corrigido). | ok |
| CA-4 | aceitacao | Card "Consulta" (sem `pendente`) nunca recebe a classe alert em nenhum dos cenarios acima - sem falso positivo. | ok |
| CA-5 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde - confirmado antes e depois da correcao do achado da revisao adversarial. | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Sem suite automatizada de UI para esta pagina no projeto. Verificacao
via preview local (inspecao de DOM) + revisao adversarial.

## 3) Testes manuais

Preview local isolado do worktree (backend em `:8016`, frontend em
`:3016`, `fortcordis.db`/`.env` copiados so para teste e removidos do
worktree ao final - nunca commitados, nunca tocando o banco real):

1. Login como `admin@fortcordis.com`, paciente real ("marinete")
   selecionado em atendimento novo.
2. Estado neutro: badges "Exames"/"Prescricao" com `0`, classe base
   (`fc-care-tab-badge `, sem `-alert`) - confirmado via
   `getComputedStyle`/`className`.
3. Aba Exames: exame adicionado so com `tipo_exame="Ecocardiograma"`
   (sem arquivo). Badge "Exames" -> `1`, classe
   `fc-care-tab-badge-alert`, `bg amber-500`/texto branco, `title="Ha
   pendencia real nesta area"` - confirmado via DOM e screenshot.
4. Aba Prescricao: item manual criado, "Salvar atendimento" clicado
   sem preencher dose/frequencia/via -> save bloqueado pela validacao
   existente, badge "Prescricao" -> `1` com `-alert`; badge permaneceu
   `-alert` mesmo apos navegar de volta para a aba Consulta (nao e so
   um flash do erro pontual).
5. Preview encerrado; db/.env copiados removidos do worktree; dados de
   teste existiam so no banco local descartavel (nunca tocaram
   producao/stage).

## 4) Revisao adversarial

Agente ceptico revisou o diff completo (`page.tsx` ~16 linhas,
`globals.css` ~8 linhas) e o codigo ao redor.

**Achado real (CONFIRMED), corrigido nesta mesma sessao:**

`pendente: prescricaoErrosCount > 0` (versao inicial) reusava
`prescricaoValidationErrors`, um estado que so e populado por acoes
explicitas do usuario (`executarSaveAtendimento` modo manual, imprimir,
finalizar) e NUNCA e populado ao simplesmente abrir/carregar um
atendimento existente (`abrirAtendimento` nao toca esse estado). Os
dois `useEffect` que sincronizam esse estado (linhas ~5590-5599) so
limpam ou atualizam erros que **ja** sao diferentes de zero - nunca os
populam a partir de zero usando o memo live
`prescricaoValidacaoAtual`. Resultado: abrir um atendimento com um item
de prescricao ja incompleto (salvo via autosave, que pula a validacao)
mostraria o badge "Prescricao" como neutro (falso negativo) at o vet
tentar salvar manualmente - exatamente o cenario que a issue #21 pede
para tornar visivel de forma proativa.

**Correcao aplicada:** troca de `prescricaoErrosCount` (estado,
"stale") por `prescricaoValidacaoAtual.total` (memo live, recalculado
a cada mudanca em `form.prescricao_itens`, ja usado em outro ponto do
componente) - `page.tsx`, card "prescricao" de `workspaceCards`.
Reverifiquei em preview local: badge fica `-alert` assim que o
medicamento e digitado sem dose/frequencia/via, **sem** precisar
clicar em salvar (ver CA-3/passo 4 na secao 3 - teste refeito apos a
correcao, confirmando o comportamento live).

**Demais pontos verificados pelo agente, sem achados:**
- `examesPendentesCount` soma corretamente `aguardando_arquivo` +
  `arquivo_anexado` de `resumoExamesFluxo`, sem duplicidade/omissao.
- Concatenacao de classe no JSX sem bug de espaco (`fc-care-tab-badge
  fc-care-tab-badge-alert`, nao colado).
- Especificidade CSS: `.fc-care-tab-active .fc-care-tab-badge-alert`
  tem a mesma especificidade que a regra pre-existente
  `.fc-care-tab-active .fc-care-tab-badge` e vem depois no
  stylesheet - vence corretamente quando uma aba pendente esta ativa.
- `pendente` opcional (`undefined` em Consulta/Documentos) tratado com
  seguranca no render (falsy check).
- Nenhum outro consumidor no repo le `.fc-care-tab-badge` ou
  `workspaceCards` esperando uma unica classe fixa.

`tsc`/`build` re-confirmados limpos apos a correcao.

## 5) Riscos residuais aceitos

- Badge continua so binario (pendente/nao-pendente), sem contador
  separado de quantos itens estao pendentes - fora de escopo (issue
  #21 pede so diferenciacao de cor).
- Sem suite automatizada cobrindo este comportamento.
- Escopo deste pacote cobre apenas o achado #21 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
