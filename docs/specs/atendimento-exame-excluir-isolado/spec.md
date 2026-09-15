# Spec - atendimento-exame-excluir-isolado

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Mudanca aditiva de JSX/CSS: envolver o botao "Excluir"/"Remover" do
header do card de exame em um wrapper com divisor visual e espacamento
extra, separando-o do grupo de botoes de acao normal.

## 2) Requisitos funcionais (RF)

- RF-1: o botao de exclusao do exame
  (`frontend/app/atendimento/components/AtendimentoExamesSection.tsx`)
  passa a ser envolvido por um `<div>` com `border-l` (divisor
  vertical), `pl-3` (espacamento interno apos o divisor) e `ml-1`
  (espacamento adicional antes do divisor).
- RF-2: nenhum comportamento do botao (`onClick`, `title`, icone,
  cores) e alterado - so a estrutura/espacamento do wrapper.
- RF-3: nenhuma mudanca nos demais botoes do mesmo grupo (toggle de
  expandir, chip de status, "Laudar", "Liberar no portal"/"Revogar
  portal").

## 3) Requisitos nao funcionais (NFR)

- NFR-A (sem regressao de clicabilidade): o botao "Excluir" deve
  continuar totalmente clicavel (o elemento no centro do seu retangulo
  deve ser o proprio botao ou um filho dele, nao outro elemento
  sobreposto).
- NFR-B (compatibilidade visual): o espacamento adicional nao deve
  quebrar o layout do header do card em nenhuma largura - o grupo de
  botoes ja usa `flex items-center gap-2`, que acomoda naturalmente um
  wrapper extra sem exigir mudanca de breakpoint.

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo. Mudanca 100% frontend
(JSX/CSS).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - so adiciona espacamento visual; nenhum
  dado ou fluxo muda.
- Rollback: reverter o commit.

## 6) Criterios de aceitacao (CA)

- CA-1: no header do card de exame, o botao "Excluir"/"Remover" fica
  visualmente separado do grupo anterior por um divisor + espacamento
  maior que o `gap-2` padrao entre os demais botoes.
- CA-2: o botao "Excluir"/"Remover" permanece clicavel
  (`elementFromPoint` no centro do seu retangulo retorna o proprio
  botao ou um filho dele).
- CA-3: o botao "Laudar" (e demais botoes do grupo) permanecem
  clicaveis normalmente, sem alteracao de posicao relativa entre eles.
- CA-4: `npx tsc --noEmit` e `npm run build` sem erros novos.
