# Intent - atendimento-exame-excluir-isolado

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #31 ("[UX] Botão 'Liberar no portal' fica ao lado de
'Excluir', mesmo tamanho e estilo"), origem achado #12 da auditoria
UX/fluxo (`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de
tracking #57): no header de cada card de exame
(`AtendimentoExamesSection.tsx`), os botoes "Laudar",
"Liberar no portal"/"Revogar portal" e "Excluir" ficam no mesmo grupo
flex, com o mesmo tamanho/padding, diferenciados so pela cor de fundo -
todos adjacentes, sem divisor.

Numa lista com varios exames, ao clicar em sequencia em "Liberar no
portal" de varios cards, o botao "Excluir" fica a poucos pixels de
distancia e tem o mesmo alvo de clique - um clique levemente deslocado
remove o exame do prontuario em vez de liberar/revogar o portal.

## 2) Objetivo

Isolar visualmente o botao "Excluir"/"Remover" dos demais botoes do
card de exame, aumentando o espacamento e adicionando um divisor antes
dele - reduzindo a chance de clique acidental sem exigir uma
reestruturacao maior (menu secundario, reposicionamento no card).

## 3) Nao objetivos

- Nao remover ou alterar o `window.confirm()` ja existente antes da
  exclusao de exame ja persistido (`removerExame`, `page.tsx`) - esse
  guard ja existe e cobre um problema diferente (achado #51, "Dez
  confirmacoes via window.confirm nativo"); este pacote trata so do
  espacamento/isolamento visual dos botoes, nao do mecanismo de
  confirmacao.
- Nao mover o botao "Excluir" para um menu secundario/"mais opcoes" nem
  para o canto oposto do card - a sugestao do issue oferece essas
  alternativas mais elaboradas, mas a alternativa mais simples
  ("aumentar o espacamento com um divisor antes do botao vermelho") ja
  resolve a fricao descrita com uma mudanca minima de CSS/JSX.
- Nao alterar os botoes "Laudar"/"Liberar no portal"/"Revogar portal"
  em si - so a posicao/espacamento do botao "Excluir" em relacao a
  eles.
- Nao alterar outros botoes de exclusao no mesmo arquivo (ex.: remover
  anexo de resultado, remover painel customizado) - fora do escopo
  citado pelo issue, que fala especificamente do header do card de
  exame.
