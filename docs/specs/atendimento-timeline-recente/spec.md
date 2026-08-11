# Spec - atendimento-timeline-recente

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Comportamento esperado

### Backend (`_montar_timeline_paciente`)

- A lista `events` continua construida da mesma forma (atendimentos,
  evolucoes, exames solicitados/resultado, anexos, laudos).
- O agrupamento por ano (`grouped[year]`) passa a iterar `events`
  ordenados por `data` **decrescente** (`reverse=True`), preservando a
  ordem decrescente dentro de cada bucket de ano (sort estavel do
  Python).
- A lista de anos (`ordered_years`) passa a ser: anos reais em ordem
  decrescente (`sorted(..., reverse=True)`), seguidos por `"Sem data"`
  por ultimo, se existir - em vez da ordenacao crescente com
  `"Sem data"` por ultimo de antes.
- Resultado: `[{"ano": "2026", "eventos": [...]}, {"ano": "2025",
  ...}, ..., {"ano": "Sem data", ...}]` (se houver eventos sem data).

### Frontend (`page.tsx`, painel "Linha do tempo")

- Novo `TIMELINE_EVENTO_META`: mapa de `evento.tipo` ->
  `{ label, icon, dotClass, badgeClass }`, com um icone e um par de
  cores (fundo solido para o marcador circular, par claro/escuro para
  o badge de texto) distintos para cada um dos 6 tipos existentes
  (`atendimento`, `evolucao`, `exame_solicitado`, `exame_resultado`,
  `anexo`, `laudo`). `TIMELINE_EVENTO_META_PADRAO` cobre qualquer tipo
  nao mapeado (defensivo, o backend so emite os 6 tipos acima hoje).
- Cada card de evento na timeline passa a exibir:
  - Um marcador circular colorido com o icone do tipo, ao lado do
    titulo (substitui o espaco vazio antes do titulo).
  - Um badge de texto colorido com o rotulo legivel do tipo (ex.:
    "Resultado de exame"), no lugar do texto uppercase cinza antigo
    (`evento.tipo` bruto).
- O numero exibido/formatado da data (`formatDate(evento.data)`) e a
  descricao/status continuam inalterados.
- A ordem de renderizacao (`timelineGrupos.map` / `grupo.eventos.map`)
  nao muda - ja reflete a ordem vinda da API, que agora e decrescente.

## 2) Casos de borda

- Evento sem `data` (nunca deveria ocorrer - todos os construtores em
  `_montar_timeline_paciente` fazem `if not data_evento: continue`
  antes de adicionar o evento) - mantido, nao alterado por este
  pacote.
- Ano `"Sem data"` (evento cuja data nao pode ser parseada por
  `_parse_datetime`) - continua existindo como grupo separado, agora
  sempre ao final da lista de anos (antes tambem era ao final, so que
  em ordem crescente entre os anos reais).
- Tipo de evento desconhecido/futuro (defensivo, nao ocorre hoje) -
  cai em `TIMELINE_EVENTO_META_PADRAO` (icone `History`, cinza) em vez
  de quebrar o render.

## 3) Fora de escopo

- Agrupamento por mes para anos de alto volume (ver `intent.md`,
  secao 3) - pacote futuro se necessario.
- Filtro por tipo de evento na timeline.
- Mudanca em `limite` ou nas queries de `atendimentos`/`exames`/
  `laudos`/`evolucoes`/`anexos`.
