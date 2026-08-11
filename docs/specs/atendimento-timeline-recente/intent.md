# Intent - atendimento-timeline-recente

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #48 ("[UX] Timeline só por ano, ordem crescente"), origem
achado #29 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): `_montar_timeline_paciente`
(`backend/app/api/v1/endpoints/atendimento.py`) agrupa os eventos
(consulta/evolucao/exame solicitado/exame resultado/anexo/laudo) so por
ano, ordenados do mais antigo para o mais recente - tanto os anos
quanto os eventos dentro de cada ano. Cada card e visualmente
identico, com o tipo distinguido so por um texto pequeno em
maiuscula, sem icone ou cor por categoria.

Para um paciente cronico com anos de acompanhamento, um unico ano pode
acumular dezenas de eventos misturados; como a ordenacao e crescente,
o evento mais recente do ano fica no fim da lista (exigindo rolagem
para achar o que acabou de acontecer), e como todos os cards sao
iguais, o vet precisa ler o rotulo de texto de cada um para saber o
tipo.

## 2) Objetivo

Os dois pontos centrais da sugestao da auditoria:

1. Inverter a ordem - mais recente primeiro, tanto para os anos quanto
   para os eventos dentro de cada ano.
2. Atribuir icone e cor distintos por tipo de evento (atendimento,
   evolucao, exame solicitado, exame resultado, anexo, laudo) para
   permitir escaneamento visual rapido, em vez do texto pequeno
   uniforme atual.

## 3) Escopo reduzido em relacao a sugestao da auditoria

A auditoria tambem sugere "agrupar por mes quando o volume for alto".
Optei por **nao** incluir esse terceiro ponto neste pacote:

- Os dois primeiros pontos (ordem + icone/cor) já resolvem a fricção
  central descrita ("evento mais recente exige rolagem" + "cards
  identicos exigem leitura de texto") sem exigir uma nova dimensao de
  agrupamento (mes) com seu proprio limiar de "volume alto" a definir,
  logica de subtitulo adicional na UI, e mais codigo para manter.
- Isso mantem o pacote como "esforço médio" e nao "esforço grande" -
  agrupamento por mes e um incremento independente que pode ser um
  pacote futuro se a rolagem dentro de um ano ainda incomodar depois
  desta mudanca.
- Documentando essa decisao aqui de forma transparente, no mesmo
  espirito de outras decisoes de escopo tomadas em pacotes anteriores
  desta auditoria (ex.: `atendimento-header-fixo`,
  `atendimento-badges-pendencia`).

## 4) Nao objetivos

- Nao muda `limite` (quantidade de atendimentos/exames/laudos
  buscados) - permanece o mesmo comportamento de paginacao/limite ja
  corrigido pelo achado #23 (`atendimento-timeline-limitada`).
- Nao muda a estrutura dos dados retornados pela API (`TimelineGrupo`/
  `TimelineEvento` no frontend, dict no backend) - so a ordem interna
  das listas.
- Nao adiciona filtro por tipo de evento na timeline - so
  diferenciacao visual (icone/cor), a auditoria nao pede filtro aqui.
