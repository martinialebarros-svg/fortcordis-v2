# Intent - atendimento-badges-pendencia

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #21 ("[UX] Badges das abas mostram contagem bruta"),
origem achado #2 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): o badge de cada aba do atendimento (`workspaceCards`,
`page.tsx` ~5417) e uma contagem simples - Exames mostra o total
solicitado, Prescricao mostra o total de itens - sem usar a
granularidade de status por exame (`aguardando_arquivo`/
`arquivo_anexado`/`interpretado`/`liberado_portal`, ja calculada em
`resumoExamesFluxo`) nem o contador de erros de validacao da
prescricao (`prescricaoErrosCount`, ja calculado e usado em outro
lugar do componente).

O vet ve "Exames: 3" no menu superior sem saber se os 3 ja foram
resolvidos ou ainda estao pendentes, ou se a prescricao tem itens com
erro bloqueando a impressao - so descobre entrando na aba.

## 2) Objetivo

Diferenciar visualmente o badge quando ha pendencia real,
reaproveitando dados ja calculados (sem novo estado, sem chamada de
API adicional):

- Badge da aba **Exames** em alerta (amber) quando ha exames ainda nao
  resolvidos pelo vet.
- Badge da aba **Prescricao** em alerta (amber) quando
  `prescricaoErrosCount > 0` (ha itens ativos com dose/frequencia/via
  incompletos, o que ja bloqueia o "Salvar atendimento").

## 3) Decisao de engenharia - o que conta como "pendencia real" em Exames

A sugestao literal da auditoria usa a expressao "cor de alerta na aba
Exames quando ha itens `aguardando_arquivo`/`interpretado` > 0". Essa
redacao entra em conflito com a semantica de cores ja estabelecida no
proprio codigo (`EXAME_STATUS_META`, `page.tsx` ~566-587): o chip de
status por exame usa `emerald` (verde/sucesso) para `interpretado` e
`amber` (alerta) apenas para `aguardando_arquivo` - ou seja, o app ja
trata "interpretado" como um estado resolvido, nao pendente.

Optei por **`aguardando_arquivo` + `arquivo_anexado`** como criterio de
pendencia (em vez do texto literal da auditoria), pelos seguintes
motivos:

1. Consistencia com a cor already-estabelecida por exame: um exame
   `interpretado` (verde no card) nao deveria simultaneamente acionar
   um alerta (amber) na aba - isso confundiria o vet com sinais
   contraditorios sobre o mesmo exame.
2. `arquivo_anexado` (arquivo chegou, ainda nao foi lido/interpretado
   pelo vet) e o estado mais claramente "acionavel" do fluxo - omiti-lo
   do alerta (como a redacao literal sugere) deixaria de fora
   exatamente o caso mais critico de pendencia real.
3. Reaproveita os mesmos campos ja calculados em `resumoExamesFluxo`
   (`aguardando_arquivo`, `arquivo_anexado`), sem novo estado.

Essa decisao e documentada de forma transparente aqui e em `plan.md`,
seguindo o mesmo padrao adotado no pacote `atendimento-header-fixo`
(onde um numero literal da auditoria foi revisado apos analise mais
detalhada do comportamento real do app).

## 4) Nao objetivos

- Nao alterar o calculo de `resumoExamesFluxo` ou `prescricaoErrosCount`
  - ambos ja existem e sao usados corretamente em outros pontos da UI;
  este pacote so consome esses valores para estilizar o badge.
- Nao adicionar alerta nas abas Consulta/Documentos - a auditoria
  escopa a sugestao explicitamente a Exames e Prescricao.
- Nao mudar o numero exibido no badge (continua a contagem bruta) - a
  mudanca e so visual (cor), preservando a informacao ja existente.
- Nao tratar `liberado_portal` como obrigatorio para todo exame - nem
  todo exame precisa ser liberado no portal parceiro; por isso
  `interpretado` (sem portal) e considerado resolvido, nao pendente.
