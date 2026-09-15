# Intent - atendimento-verificar-pdf-real

Data: 2026-08-05
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

O achado #20 da auditoria (`docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`)
- "guard de liberacao no portal confia em metadado do cliente" - ja foi
corrigido por outra sessao concorrente (branch
`claude/fortcordis-features-ideias-8ml2bb`, ja mesclada em `origin/stage` e
promovida a producao): `liberar_exame_no_portal` agora exige
`_anexo_eh_pdf(anexo) and attachment_has_download_source(anexo)` para pelo
menos um anexo, em vez de so `_anexo_eh_pdf(anexo)`.

Essa correcao fecha a lacuna de "anexo sem nenhum arquivo real por tras"
(URL/caminho que nao resolve para nada), mas `attachment_has_download_source`
so confirma que EXISTE algo baixavel (arquivo local existe no disco, ou URL
remota resolve para IP publico) - nao confirma que o CONTEUDO real desse
arquivo e de fato um PDF. Um anexo cujo arquivo existe mas e, por exemplo,
um `.txt` renomeado para `.pdf` (upload corrompido, erro de usuario, ou
manipulacao deliberada do `mime_type`/nome no payload de
`POST /{atendimento_id}/anexos`) ainda passa por essa checagem e libera o
exame no portal da clinica parceira.

## 2) Objetivo

Adicionar uma segunda camada de verificacao, complementar a
`attachment_has_download_source` (nao substitui-la): confirmar os bytes
magicos `%PDF-` no INICIO do conteudo real do arquivo antes de liberar o
exame no portal.

## 3) Nao objetivos

- Nao mudar a decisao de design do achado #25 (conteudo de exame liberado
  editavel) - a outra sessao ja escolheu BLOQUEAR a edicao inteiramente
  quando o exame esta liberado (diferente da auditoria proposta
  anteriormente); essa decisao ja esta em producao e nao e revisitada aqui.
- Nao mudar `attachment_has_download_source`/`resolve_attachment_download_source`
  (mantidos exatamente como estao) - a nova funcao e ADITIVA, chamada
  em conjunto com a existente, so no gate de `liberar_exame_no_portal`.
- Nao aplicar a verificacao de conteudo aos outros 2 usos de
  `_anexo_eh_pdf` (guards de exclusao de anexo/atendimento) - mesmo escopo
  restrito ja adotado quando este mesmo achado foi investigado
  anteriormente nesta serie.
- Os demais achados da auditoria (18 restantes, ja parcialmente cobertos
  por outra sessao) nao sao revisitados aqui - ver
  `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md` para o estado real
  apos reconciliar com o que ja foi promovido a producao.

## 4) Contexto e restricoes

- **Trabalho concorrente:** uma sessao diferente do Claude Code trabalhou
  no mesmo backlog de auditoria em paralelo (a partir do mesmo arquivo
  `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`, que foi escrito
  diretamente na working tree principal do repositorio, nao numa branch -
  a outra sessao encontrou o arquivo ainda nao commitado e continuou a
  partir dele). Isso ja resultou em multiplos pacotes corrigindo quase
  todos os achados restantes, ja promovidos a producao. Este pacote e
  deliberadamente pequeno e isolado para nao colidir com esse trabalho.
- Trabalho em worktree isolado (`atendimento-verificar-pdf-real`), baseado
  na tip ATUAL de `origin/stage` (ja inclui todo o trabalho da outra
  sessao).
- Reaproveita `resolve_attachment_download_source`/`_build_remote_headers`
  ja existentes em `attachment_download_service.py`, sem modifica-los.

## 5) Impacto esperado

- Usuarios impactados: veterinarios liberando exames no portal com anexos
  cujo conteudo real nao e um PDF valido (cenario raro, mas real).
- Modulos impactados: `backend/app/services/attachment_download_service.py`
  (nova funcao), `backend/app/api/v1/endpoints/atendimento.py` (gate de
  `liberar_exame_no_portal`).
- Risco de regressao: baixo - aditivo, so estreita ainda mais um caso ja
  tratado como erro (422) pela checagem existente.

## 6) Riscos iniciais

- Risco 1: para anexo "externo" (URL remota), a verificacao exige um GET
  com Range no momento de liberar - custo de rede pontual, mesmo padrao ja
  aceito quando a mesma ideia foi avaliada anteriormente nesta serie.
- Risco 2: servidores de storage que nao suportam `Range` podem responder
  200 completo em vez de 206 parcial - aceito, desde que os primeiros bytes
  ainda comecem com `%PDF-`.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros, com o contexto do trabalho
  concorrente explicitado.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
