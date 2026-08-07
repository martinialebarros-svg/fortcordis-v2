# Intent - atendimento-performance-nplus1-timeline

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Dois achados de performance da auditoria completa
(docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md, achados #22 e #23):

- **#22**: dentro do loop `for payload in exames_payload:` de
  `_sync_exames`, para CADA item o codigo executava uma query
  `db.query(CatalogoExame)...first()` e, se houver, mais
  `db.query(PainelExame)...first()` - uma query por exame, em vez de uma
  unica `.filter(id.in_(ids))` fora do loop (padrao ja usado corretamente
  em `_contar_anexos_por_exame` no mesmo arquivo). O mesmo padrao existia
  em `_sync_prescricao` via `_obter_nome_medicamento`. Como o frontend
  SEMPRE reenvia os arrays `exames`/`prescricao` inteiros em todo PUT
  (inclusive no autosave, a cada ~1.8s de pausa de digitacao), um
  atendimento com um painel de 8 exames gerava ate 16 SELECTs extras por
  autosave, mesmo quando nenhum exame mudou.
- **#23**: `GET /paciente/{id}/historico` ja busca `AtendimentoClinico` com
  `.limit(limite)`, mas em seguida chama `_montar_timeline_paciente(db, paciente_id)`,
  que executa uma SEGUNDA query, independente e SEM LIMITE, na MESMA
  tabela - e busca `Exame`/`Laudo` tambem sem limite, filtrados so por
  `paciente_id`. Um paciente cronico com anos de acompanhamento faz essa
  funcao escanear todo o historico a cada chamada (a cada troca de
  paciente, a cada save/finalizacao - 4 pontos de chamada no frontend).

## 2) Objetivo

`_sync_exames`/`_sync_prescricao` fazem no maximo 1 query por tabela de
referencia (catalogo, painel, medicamento) por chamada, independente do
numero de itens no payload. `_montar_timeline_paciente` reaproveita a lista
de atendimentos ja buscada pelo chamador quando disponivel, e limita
`Exame`/`Laudo` a uma janela recente, independente do volume historico
total do paciente.

## 3) Nao objetivos

- Nao inclui cache entre requisicoes (cada request continua consultando o
  banco - o achado e sobre eliminar queries REDUNDANTES dentro da MESMA
  requisicao, nao sobre cache entre requisicoes distintas).
- Nao inclui mudar o valor do limite default de `historico_paciente`
  (permanece `limite: int = 10` no endpoint de historico) - apenas
  `/timeline` isolado ganha um `limite` (antes inexistente, agora default
  12, alinhado ao valor que o frontend usa para historico).
- Nao inclui paginacao real (cursor/offset) para exames/laudos na timeline
  - um `.limit()` simples e suficiente para o objetivo (bounded work),
  paginacao completa seria over-engineering para uma timeline de leitura
  rapida.

## 4) Contexto e restricoes

- Restricoes tecnicas: `_obter_nome_medicamento` perdeu o parametro `db`
  (nao precisa mais, recebe o dict pre-buscado) - unico chamador
  confirmado antes da mudanca.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: nenhuma alem de desempenho/custo de
  infraestrutura.

## 5) Impacto esperado

- Usuarios impactados: todos os veterinarios usando autosave em
  atendimentos com exames/prescricao (#22); usuarios abrindo pacientes com
  historico extenso (#23).
- Modulos impactados: apenas
  `backend/app/api/v1/endpoints/atendimento.py`.
- Risco de regressao: baixo - #22 e substituicao mecanica de
  query-por-item por dict pre-buscado, preservando a mesma logica de
  fallback (id invalido -> `None`/exception, igual a antes); #23 muda o
  MOMENTO/quantidade dos dados buscados, nao a logica de montagem dos
  eventos (o `sorted()` final ja reordena tudo por data, entao a timeline
  resultante e ordenada corretamente independente de qual subconjunto foi
  buscado).

## 6) Riscos iniciais

- Risco 1 (mitigado): a ordem interna da lista `atendimentos` importava
  para a construcao dos eventos? Nao - `_montar_timeline_paciente` so usa
  `atendimentos` para EXTRAIR `atendimento_ids` (usado em filtros de
  `evolucoes`/`anexos`) e para gerar eventos tipo "atendimento" (cada um
  com sua propria `data`); o `sorted(events, key=lambda item: item.get("data"))`
  no final reordena TUDO por data, tornando a ordem de entrada irrelevante.
- Risco 2 (mitigado): limitar `exames`/`laudos` por `paciente_id`
  independente de `atendimento_ids` poderia criar referencias "orfas" (um
  anexo cujo exame nao esta no `exame_map`) - confirmado por leitura de
  codigo que isso ja era possivel ANTES desta mudanca (o `exame_map.get(...)`
  ja tinha fallback para prefixo vazio) e so afeta um DETALHE de exibicao
  (`exam_prefix`), nunca gera excecao.

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
